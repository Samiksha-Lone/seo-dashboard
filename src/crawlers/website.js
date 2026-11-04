const cheerio = require('cheerio');

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function getCanonicalData(rawValue, pageUrl) {
  const value = normalizeText(rawValue);

  if (!value) {
    return {
      present: false,
      value: '',
      resolvedUrl: null,
      valid: false,
      relative: false,
      mismatch: false,
      reason: 'missing',
    };
  }

  const relative = !/^(?:[a-zA-Z][a-zA-Z\d+.-]*:)?\/\//.test(value);

  try {
    const resolved = new URL(value, pageUrl);
    const page = new URL(pageUrl);
    const valid = ['http:', 'https:'].includes(resolved.protocol);

    return {
      present: true,
      value,
      resolvedUrl: valid ? resolved.href : null,
      valid,
      relative,
      mismatch: valid ? resolved.origin !== page.origin : false,
      reason: valid ? (resolved.origin !== page.origin ? 'origin_mismatch' : null) : 'unsupported_protocol',
    };
  } catch {
    return {
      present: true,
      value,
      resolvedUrl: null,
      valid: false,
      relative,
      mismatch: false,
      reason: 'invalid_url',
    };
  }
}

async function crawlWebsite(url) {
  const { safeFetch } = require('./safe-fetch');

  try {
    const response = await safeFetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const websiteHostname = new URL(url).hostname;
    const canonicalTag = $('link[rel="canonical"], link[rel~="canonical"]').first().attr('href');
    const bodyText = normalizeText($('body').text());
    const mainText = normalizeText($('main, article, [role="main"]').first().text() || bodyText);
    const paragraphs = $('main p, article p, p').map((i, element) => normalizeText($(element).text())).get().filter(Boolean);
    const headings = $('h1, h2, h3, h4, h5, h6').map((i, element) => normalizeText($(element).text())).get().filter(Boolean);
    const wordCount = mainText ? mainText.split(/\s+/).filter(Boolean).length : 0;

    const pageData = {
      url,
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      headings: {
        h1: $('h1').map((i, element) => $(element).text().trim()).get(),
        h2: $('h2').map((i, element) => $(element).text().trim()).get(),
      },
      structuredData: $('script[type="application/ld+json"]')
        .map((i, element) => $(element).html().trim())
        .get(),
      canonical: getCanonicalData(canonicalTag, url),
      content: {
        text: mainText,
        wordCount,
        paragraphCount: paragraphs.length,
        headingCount: headings.length,
        isEmpty: wordCount === 0 || wordCount < 30,
        isThin: wordCount > 0 && wordCount < 120,
        hasMeaningfulContent: wordCount >= 120,
      },
      links: {
        internal: [],
        external: [],
      },
      images: [],
      bodyText,
    };

    $('a[href]').each((i, element) => {
      const href = $(element).attr('href');

      if (!href || !href.trim()) {
        return;
      }

      try {
        const linkUrl = new URL(href, url);
        const linkType = linkUrl.hostname === websiteHostname ? 'internal' : 'external';
        pageData.links[linkType].push(linkUrl.href);
      } catch {
        // Ignore invalid link URLs and continue crawling the page.
      }
    });

    $('img').each((i, element) => {
      pageData.images.push({
        src: $(element).attr('src') || '',
        alt: $(element).attr('alt') || '',
      });
    });

    return pageData;
  } catch (error) {
    console.error('Website crawling failed:', error);
    throw error;
  }
}

module.exports = { crawlWebsite };