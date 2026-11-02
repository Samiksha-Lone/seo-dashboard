function isSchemaOrgContext(context) {
  if (typeof context === 'string') {
    try {
      const contextUrl = new URL(context);
      return (
        ['http:', 'https:'].includes(contextUrl.protocol) &&
        contextUrl.hostname.toLowerCase() === 'schema.org'
      );
    } catch {
      return false;
    }
  }

  if (Array.isArray(context)) {
    return context.some(isSchemaOrgContext);
  }

  if (context && typeof context === 'object') {
    return isSchemaOrgContext(context['@vocab']);
  }

  return false;
}

function validateSchema(structuredData) {
  const blocks = Array.isArray(structuredData)
    ? structuredData
    : structuredData == null
      ? []
      : [structuredData];
  const errors = [];
  let validBlocks = 0;

  blocks.forEach((block, index) => {
    const blockNumber = index + 1;
    let data;

    if (typeof block !== 'string') {
      errors.push({ block: blockNumber, message: 'JSON-LD block must be a string.' });
      return;
    }

    try {
      data = JSON.parse(block);
    } catch (error) {
      errors.push({ block: blockNumber, message: `Invalid JSON: ${error.message}` });
      return;
    }

    const blockErrors = [];

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      blockErrors.push('JSON-LD block must contain a JSON object.');
    } else {
      if (!isSchemaOrgContext(data['@context'])) {
        blockErrors.push('@context must identify Schema.org.');
      }

      const hasType =
        (typeof data['@type'] === 'string' && data['@type'].trim() !== '') ||
        (Array.isArray(data['@type']) &&
          data['@type'].some((type) => typeof type === 'string' && type.trim() !== ''));

      if (!hasType) {
        blockErrors.push('@type is required.');
      }
    }

    if (blockErrors.length > 0) {
      blockErrors.forEach((message) => errors.push({ block: blockNumber, message }));
    } else {
      validBlocks += 1;
    }
  });

  const totalBlocks = blocks.length;
  const invalidBlocks = totalBlocks - validBlocks;

  return {
    status: totalBlocks === 0 ? 'no_data' : invalidBlocks === 0 ? 'valid' : 'invalid',
    totalBlocks,
    validBlocks,
    invalidBlocks,
    errors,
  };
}

module.exports = { validateSchema };
