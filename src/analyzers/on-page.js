function analyzeOnPage(pageData = {}) {
  pageData = pageData || {};
  const title = typeof pageData.title === 'string' ? pageData.title.trim() : '';
  const description =
    typeof pageData.description === 'string' ? pageData.description.trim() : '';
  const headings = pageData.headings || {};
  const h1 = Array.isArray(headings.h1) ? headings.h1 : [];
  const h2 = Array.isArray(headings.h2) ? headings.h2 : [];
  const emptyH1Count = h1.filter((heading) => typeof heading !== 'string' || !heading.trim()).length;
  const emptyH2Count = h2.filter((heading) => typeof heading !== 'string' || !heading.trim()).length;
  const images = Array.isArray(pageData.images) ? pageData.images : [];
  const links = pageData.links || {};
  const internalLinkCount = Array.isArray(links.internal) ? links.internal.length : 0;
  const externalLinkCount = Array.isArray(links.external) ? links.external.length : 0;
  const imagesMissingAlt = images.filter(
    (image) => !image || typeof image.alt !== 'string' || image.alt.trim() === ''
  ).length;
  const issues = [];

  if (!title) {
    issues.push({
      finding: 'The page title is missing or empty.',
      suggestedFix: 'Add a concise, descriptive title that reflects the page content.',
    });
  }

  if (!description) {
    issues.push({
      finding: 'The meta description is missing or empty.',
      suggestedFix: 'Add a unique description that summarizes the page for search results.',
    });
  }

  if (h1.length === 0) {
    issues.push({
      finding: 'The page has no H1 heading.',
      suggestedFix: 'Add one descriptive H1 heading that communicates the page topic.',
    });
  } else if (h1.length > 1) {
    issues.push({
      finding: `The page has ${h1.length} H1 headings.`,
      suggestedFix: 'Use a single primary H1 heading and structure subtopics with H2 headings.',
    });
  }

  if (emptyH1Count > 0) {
    issues.push({
      finding: `${emptyH1Count} H1 heading${emptyH1Count === 1 ? ' is' : 's are'} empty.`,
      suggestedFix: 'Add descriptive text to each H1 heading.',
    });
  }

  if (emptyH2Count > 0) {
    issues.push({
      finding: `${emptyH2Count} H2 heading${emptyH2Count === 1 ? ' is' : 's are'} empty.`,
      suggestedFix: 'Add descriptive text to each H2 heading.',
    });
  }

  if (imagesMissingAlt > 0) {
    issues.push({
      finding: `${imagesMissingAlt} of ${images.length} images have a missing or empty alt attribute.`,
      suggestedFix: 'Add concise, descriptive alt text to informative images.',
    });
  }

  return {
    checks: {
      title: { present: Boolean(title), length: title.length },
      metaDescription: { present: Boolean(description), length: description.length },
      h1: {
        count: h1.length,
        status: h1.length === 0 ? 'missing' : h1.length === 1 ? 'single' : 'multiple',
        empty: emptyH1Count,
        headings: h1,
      },
      h2: { count: h2.length, empty: emptyH2Count, headings: h2 },
      images: { count: images.length, missingAlt: imagesMissingAlt },
      links: {
        internal: internalLinkCount,
        external: externalLinkCount,
      },
      importantElements: {
        title: Boolean(title),
        metaDescription: Boolean(description),
        h1: h1.length > 0,
      },
    },
    issues,
    summary: {
      issueCount: issues.length,
      titlePresent: Boolean(title),
      metaDescriptionPresent: Boolean(description),
      h1Count: h1.length,
      h2Count: h2.length,
      emptyH1Count,
      emptyH2Count,
      imagesMissingAlt,
      internalLinkCount,
      externalLinkCount,
    },
  };
}

module.exports = { analyzeOnPage };
