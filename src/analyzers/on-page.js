function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function getCanonicalValue(pageData = {}) {
  if (!pageData || typeof pageData !== 'object') {
    return null;
  }

  if (typeof pageData.canonical === 'string') {
    return pageData.canonical;
  }

  if (pageData.canonical && typeof pageData.canonical === 'object') {
    return pageData.canonical.value || pageData.canonical.href || pageData.canonical.raw || null;
  }

  return null;
}

function parseCanonicalValue(rawValue, auditedUrl) {
  const value = normalizeText(rawValue);

  if (!value) {
    return {
      present: false,
      value: '',
      resolvedUrl: null,
      valid: false,
      relative: false,
      mismatch: false,
    };
  }

  const relative = !/^(?:[a-zA-Z][a-zA-Z\d+.-]*:)?\/\//.test(value);

  try {
    const resolved = new URL(value, auditedUrl);
    const auditedPage = new URL(auditedUrl);
    const valid = ['http:', 'https:'].includes(resolved.protocol);

    return {
      present: true,
      value,
      resolvedUrl: valid ? resolved.href : null,
      valid,
      relative,
      mismatch: valid ? resolved.origin !== auditedPage.origin : false,
    };
  } catch {
    return {
      present: true,
      value,
      resolvedUrl: null,
      valid: false,
      relative,
      mismatch: false,
    };
  }
}

function countWords(value) {
  const text = normalizeText(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

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
    (image) => !image || typeof image.alt !== 'string' || image.alt.trim() === '',
  ).length;

  const rawContent = pageData.content || {};
  const bodyText = normalizeText(
    rawContent.text || pageData.bodyText || pageData.text || pageData.visibleText || '',
  );
  const contentWordCount = Number.isFinite(rawContent.wordCount)
    ? rawContent.wordCount
    : countWords(bodyText);
  const paragraphCount = Number.isFinite(rawContent.paragraphCount)
    ? rawContent.paragraphCount
    : 0;
  const headingCount = Number.isFinite(rawContent.headingCount)
    ? rawContent.headingCount
    : Math.max(h1.length + h2.length, 0);
  const contentIsEmpty = typeof rawContent.isEmpty === 'boolean'
    ? rawContent.isEmpty
    : contentWordCount === 0 || contentWordCount < 30;
  const contentIsThin = typeof rawContent.isThin === 'boolean'
    ? rawContent.isThin
    : contentWordCount > 0 && contentWordCount < 120;
  const hasMeaningfulContent = typeof rawContent.hasMeaningfulContent === 'boolean'
    ? rawContent.hasMeaningfulContent
    : contentWordCount >= 120;

  const canonicalValue = getCanonicalValue(pageData);
  const canonical = parseCanonicalValue(canonicalValue, pageData.url || 'https://example.test');
  const issues = [];

  if (!canonical.present) {
    issues.push({
      finding: 'The page does not declare a canonical URL.',
      suggestedFix: 'Add a <link rel="canonical" href="..."> tag that points to the preferred version of the page.',
    });
  } else if (!canonical.valid) {
    issues.push({
      finding: `The declared canonical URL is invalid: ${canonical.value}.`,
      suggestedFix: 'Replace the canonical value with a valid absolute or relative URL that resolves to the preferred page.',
    });
  } else if (canonical.mismatch) {
    issues.push({
      finding: `The canonical URL points to a different origin than the audited page: ${canonical.resolvedUrl}.`,
      suggestedFix: 'Align the canonical URL with the audited page domain so search engines understand the correct version.',
    });
  }

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

  if (contentIsEmpty) {
    issues.push({
      finding: 'The page appears to contain little or no meaningful visible text.',
      suggestedFix: 'Add substantive copy that explains the service, offer, or topic and includes clear headings.',
    });
  } else if (contentIsThin) {
    issues.push({
      finding: `The page has only ${contentWordCount} visible words, which is very thin for SEO content.`,
      suggestedFix: 'Expand the main body copy with useful, unique information that addresses the user intent and helps the page rank.',
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
      canonical: {
        present: canonical.present,
        value: canonical.value,
        valid: canonical.valid,
        resolvedUrl: canonical.resolvedUrl,
        relative: canonical.relative,
        mismatch: canonical.mismatch,
      },
      h1: {
        count: h1.length,
        status: h1.length === 0 ? 'missing' : h1.length === 1 ? 'single' : 'multiple',
        empty: emptyH1Count,
        headings: h1,
      },
      h2: { count: h2.length, empty: emptyH2Count, headings: h2 },
      content: {
        wordCount: contentWordCount,
        paragraphCount,
        headingCount,
        empty: contentIsEmpty,
        thin: contentIsThin,
        meaningful: hasMeaningfulContent,
      },
      images: { count: images.length, missingAlt: imagesMissingAlt },
      links: {
        internal: internalLinkCount,
        external: externalLinkCount,
      },
      importantElements: {
        title: Boolean(title),
        metaDescription: Boolean(description),
        h1: h1.length > 0,
        canonical: canonical.present,
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
      canonicalPresent: canonical.present,
      canonicalValid: canonical.valid,
      canonicalMismatch: canonical.mismatch,
      contentWordCount,
      contentIsEmpty,
      contentIsThin,
      imagesMissingAlt,
      internalLinkCount,
      externalLinkCount,
    },
  };
}

module.exports = { analyzeOnPage };
