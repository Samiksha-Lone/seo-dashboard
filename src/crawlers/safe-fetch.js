const dns = require('node:dns').promises;
const net = require('node:net');
const { Agent } = require('undici');

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

const IPV4_BLOCKED_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([address, prefix]) => [ipv4ToBigInt(address), prefix]);

const IPV6_BLOCKED_RANGES = [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
].map(([address, prefix]) => [ipv6ToBigInt(address), prefix]);

function ipv4ToBigInt(address) {
  return address.split('.').reduce(
    (value, octet) => (value << 8n) | BigInt(Number(octet)),
    0n
  );
}

function ipv6ToBigInt(address) {
  let normalized = address.toLowerCase().split('%')[0];
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const ipv4 = normalized.slice(lastColon + 1);
    const value = ipv4ToBigInt(ipv4);
    normalized = `${normalized.slice(0, lastColon)}:${(value >> 16n).toString(16)}:${(value & 0xffffn).toString(16)}`;
  }

  const [leftPart, rightPart = ''] = normalized.split('::');
  const left = leftPart ? leftPart.split(':') : [];
  const right = rightPart ? rightPart.split(':') : [];
  const zeroCount = 8 - left.length - right.length;
  if (zeroCount < 0 || (normalized.includes('::') && zeroCount < 1)) {
    throw new TypeError('Invalid IPv6 address.');
  }

  const groups = [
    ...left,
    ...Array(zeroCount).fill('0'),
    ...right,
  ];
  if (groups.length !== 8) throw new TypeError('Invalid IPv6 address.');
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group || '0'}`), 0n);
}

function matchesCidr(value, network, prefix, bits) {
  const shift = BigInt(bits - prefix);
  return (value >> shift) === (network >> shift);
}

function isPublicAddress(address) {
  const unwrapped = address.replace(/^\[|\]$/g, '').split('%')[0];
  const version = net.isIP(unwrapped);
  if (version === 4) {
    const value = ipv4ToBigInt(unwrapped);
    return !IPV4_BLOCKED_RANGES.some(([network, prefix]) =>
      matchesCidr(value, network, prefix, 32)
    );
  }

  if (version === 6) {
    const value = ipv6ToBigInt(unwrapped);
    const isGlobalUnicast = (value >> 125n) === 1n;
    const isSpecialPurpose = IPV6_BLOCKED_RANGES.some(([network, prefix]) =>
      matchesCidr(value, network, prefix, 128)
    );
    return isGlobalUnicast && !isSpecialPurpose;
  }

  return false;
}

function normalizeHostname(hostname) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
}

async function resolvePublicAddresses(hostname, lookup = dns.lookup) {
  const normalizedHostname = normalizeHostname(hostname);
  const family = net.isIP(normalizedHostname);
  const addresses = family
    ? [{ address: normalizedHostname, family }]
    : await lookup(normalizedHostname, { all: true, verbatim: true });

  if (!Array.isArray(addresses) || addresses.length === 0 ||
      addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Website URL resolves to a non-public network address.');
  }

  return addresses;
}

function createPinnedLookup(hostname, addresses) {
  const expectedHostname = normalizeHostname(hostname);
  return (requestedHostname, options, callback) => {
    if (normalizeHostname(requestedHostname) !== expectedHostname) {
      callback(new Error('Unexpected DNS lookup for website request.'));
      return;
    }

    const matchingAddresses = options && options.family
      ? addresses.filter((entry) => entry.family === options.family)
      : addresses;
    if (matchingAddresses.length === 0) {
      callback(new Error('No validated address matches the requested network family.'));
      return;
    }

    if (options && options.all) {
      callback(null, matchingAddresses);
      return;
    }

    const selected = matchingAddresses[0];
    callback(null, selected.address, selected.family);
  };
}

async function readResponseText(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Website response exceeded the maximum allowed size.');
  }

  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Website response exceeded the maximum allowed size.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString('utf8');
}

function validateTargetUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('A valid HTTP or HTTPS website URL is required.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Website URLs must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new TypeError('Website URLs must not contain credentials.');
  }

  return url;
}

async function safeFetch(
  input,
  init = {},
  {
    lookup = dns.lookup,
    fetchImpl = globalThis.fetch,
    AgentClass = Agent,
  } = {}
) {
  let url = validateTargetUrl(input instanceof URL ? input.href : input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await resolvePublicAddresses(url.hostname, lookup);
    const dispatcher = new AgentClass({
      connect: { lookup: createPinnedLookup(url.hostname, addresses) },
    });
    const signal = init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        dispatcher,
        redirect: 'manual',
        signal,
      });

      const location = response.headers.get('location');
      const isRedirect = [301, 302, 303, 307, 308].includes(response.status) && location;
      if (isRedirect) {
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error('Website request exceeded the redirect limit.');
        }
        await response.body?.cancel();
        url = validateTargetUrl(new URL(location, url).href);
        continue;
      }

      const text = await readResponseText(response);
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url: url.href,
        async text() {
          return text;
        },
      };
    } finally {
      await dispatcher.close();
    }
  }

  throw new Error('Website request exceeded the redirect limit.');
}

module.exports = {
  isPublicAddress,
  resolvePublicAddresses,
  safeFetch,
  validateTargetUrl,
};
