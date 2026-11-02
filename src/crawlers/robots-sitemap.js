function getHttpError(response) {
  const statusText = response.statusText ? ` ${response.statusText}` : '';
  return `HTTP ${response.status}${statusText}`;
}

async function fetchResource(url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return { url, status: 'available', httpStatus: response.status, error: null, response };
    }

    return {
      url,
      status: response.status === 404 ? 'missing' : 'http_error',
      httpStatus: response.status,
      error: getHttpError(response),
      response,
    };
  } catch (error) {
    return {
      url,
      status: 'network_error',
      httpStatus: null,
      error: error.message,
      response: null,
    };
  }
}

function extractDirectives(robotsText, robotsUrl) {
  const directives = {
    userAgent: [],
    allow: [],
    disallow: [],
    sitemap: [],
  };
  const directiveNames = {
    'user-agent': 'userAgent',
    allow: 'allow',
    disallow: 'disallow',
    sitemap: 'sitemap',
  };

  robotsText.split(/\r?\n/).forEach((line) => {
    const content = line.split('#', 1)[0].trim();
    const separator = content.indexOf(':');

    if (separator === -1) {
      return;
    }

    const name = content.slice(0, separator).trim().toLowerCase();
    const value = content.slice(separator + 1).trim();
    const key = directiveNames[name];

    if (!key || !value) {
      return;
    }

    directives[key].push(
      key === 'sitemap' ? new URL(value, robotsUrl).href : value
    );
  });

  directives.sitemap = [...new Set(directives.sitemap)];
  return directives;
}

function summarizeSitemapResults(results) {
  if (results.length > 1) {
    if (results.every((result) => result.status === 'available')) return 'available';
    if (results.every((result) => result.status === 'missing')) return 'missing';
    if (results.some((result) => result.status === 'available')) return 'partial';
    if (results.some((result) => result.status === 'network_error')) return 'network_error';
    return 'http_error';
  }

  return results[0].status;
}

async function checkRobotsAndSitemap(url) {
  let baseUrl;
  let robotsUrl;

  try {
    baseUrl = new URL(url);
    robotsUrl = new URL('/robots.txt', baseUrl).href;
  } catch (error) {
    const failure = {
      url: null,
      status: 'invalid_url',
      httpStatus: null,
      error: error.message,
    };
    return {
      robots: { ...failure, directives: { userAgent: [], allow: [], disallow: [], sitemap: [] } },
      sitemap: { status: 'invalid_url', source: 'conventional', urls: [failure] },
    };
  }

  const robotsResponse = await fetchResource(robotsUrl);
  const directives = { userAgent: [], allow: [], disallow: [], sitemap: [] };

  if (robotsResponse.status === 'available') {
    try {
      const robotsText = await robotsResponse.response.text();
      Object.assign(directives, extractDirectives(robotsText, robotsUrl));
    } catch (error) {
      robotsResponse.status = 'network_error';
      robotsResponse.error = error.message;
    }
  }

  const sitemapUrls = directives.sitemap.length > 0
    ? directives.sitemap
    : [new URL('/sitemap.xml', baseUrl).href];
  const sitemapResults = await Promise.all(sitemapUrls.map(fetchResource));
  const sitemapSource = directives.sitemap.length > 0 ? 'robots.txt' : 'conventional';

  return {
    robots: {
      url: robotsUrl,
      status: robotsResponse.status,
      httpStatus: robotsResponse.httpStatus,
      error: robotsResponse.error,
      directives,
    },
    sitemap: {
      status: summarizeSitemapResults(sitemapResults),
      source: sitemapSource,
      urls: sitemapResults.map(({ url: sitemapUrl, status, httpStatus, error }) => ({
        url: sitemapUrl,
        status,
        httpStatus,
        error,
      })),
    },
  };
}

module.exports = { checkRobotsAndSitemap };
