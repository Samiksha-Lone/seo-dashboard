const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPublicAddress,
  safeFetch,
} = require('../src/crawlers/safe-fetch');

function createAgentMock(instances) {
  return class AgentMock {
    constructor(options) {
      this.options = options;
      this.closed = false;
      instances.push(this);
    }

    async close() {
      this.closed = true;
    }
  };
}

function mockResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

test('public-address validation rejects private, local, and special-purpose IP ranges', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
  ]) {
    assert.equal(isPublicAddress(address), false, `${address} must not be fetched`);
  }

  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('unsupported schemes and embedded URL credentials are rejected', async () => {
  const options = {
    lookup: async () => {
      assert.fail('Invalid URLs must be rejected before DNS resolution.');
    },
    fetchImpl: async () => assert.fail('Invalid URLs must not be fetched.'),
    AgentClass: createAgentMock([]),
  };
  await assert.rejects(safeFetch('file:///etc/passwd', {}, options), /HTTP or HTTPS/);
  await assert.rejects(
    safeFetch('https://user:password@public.example.test/', {}, options),
    /must not contain credentials/
  );
});

test('DNS resolving to any non-public address blocks the request before fetch', async () => {
  let fetchCalls = 0;
  await assert.rejects(
    safeFetch('https://public.example.test', {}, {
      lookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.8', family: 4 },
      ],
      fetchImpl: async () => {
        fetchCalls += 1;
        return mockResponse('should not be fetched');
      },
      AgentClass: createAgentMock([]),
    }),
    /non-public network address/
  );
  assert.equal(fetchCalls, 0);
});

test('redirects are revalidated and cannot reach private addresses', async () => {
  const agents = [];
  let fetchCalls = 0;
  await assert.rejects(
    safeFetch('https://public.example.test', {}, {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      fetchImpl: async () => {
        fetchCalls += 1;
        return mockResponse(null, {
          status: 302,
          headers: { location: 'http://127.0.0.1/admin' },
        });
      },
      AgentClass: createAgentMock(agents),
    }),
    /non-public network address/
  );
  assert.equal(fetchCalls, 1);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].closed, true);
});

test('Fetch uses the validated DNS address and closes its dispatcher after reading', async () => {
  const agents = [];
  let fetchedUrl;
  const result = await safeFetch('https://public.example.test/page', {}, {
    lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: async (url, options) => {
      fetchedUrl = url.href;
      await new Promise((resolve, reject) => {
        options.dispatcher.options.connect.lookup(
          'public.example.test',
          {},
          (error, address, family) => {
            if (error) reject(error);
            else {
              assert.equal(address, '93.184.216.34');
              assert.equal(family, 4);
              resolve();
            }
          }
        );
      });
      return mockResponse('<title>Public page</title>');
    },
    AgentClass: createAgentMock(agents),
  });

  assert.equal(fetchedUrl, 'https://public.example.test/page');
  assert.equal(await result.text(), '<title>Public page</title>');
  assert.equal(agents[0].closed, true);
});

test('oversized response bodies are rejected and dispatcher resources are closed', async () => {
  const agents = [];
  await assert.rejects(
    safeFetch('https://public.example.test', {}, {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      fetchImpl: async () => mockResponse('large', {
        headers: { 'content-length': String(11 * 1024 * 1024) },
      }),
      AgentClass: createAgentMock(agents),
    }),
    /maximum allowed size/
  );
  assert.equal(agents[0].closed, true);
});
