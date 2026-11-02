const cheerio = require('cheerio');

async function crawlWebsite(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const websiteHostname = new URL(url).hostname;

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
      links: {
        internal: [],
        external: [],
      },
      images: [],
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