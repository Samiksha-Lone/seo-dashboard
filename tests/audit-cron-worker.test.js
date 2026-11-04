const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { processNextAuditJob } = require('../src/services/audit-cron-worker');

const secret = 'test-cron-secret';
const job = {
  id: 'audit_123',
  attemptsMade: 1,
  opts: { attempts: 3 },
};

function createWorkerHarness({ jobToProcess, processorError } = {}) {
  const state = {
    claimed: 0,
    closeCalls: 0,
    pauseCalls: 0,
    options: null,
    processor: null,
    connectionClosed: false,
  };

  class MockWorker extends EventEmitter {
    constructor(_queueName, processor, options) {
      super();
      state.processor = processor;
      state.options = options;
    }

    async waitUntilReady() {}

    async pause(doNotWaitActive) {
      assert.equal(doNotWaitActive, true);
      state.pauseCalls += 1;
    }

    async run() {
      if (!jobToProcess) {
        this.emit('drained');
        return;
      }

      state.claimed += 1;
      this.emit('active', jobToProcess);
      try {
        const result = await state.processor(jobToProcess);
        if (processorError) throw processorError;
        this.emit('completed', jobToProcess, result);
      } catch (error) {
        this.emit('failed', jobToProcess, error);
      }
    }

    async close() {
      state.closeCalls += 1;
    }
  }

  const connection = {
    status: 'ready',
    async quit() {
      state.connectionClosed = true;
      this.status = 'end';
    },
  };

  return {
    state,
    MockWorker,
    connection,
    createConnection: () => connection,
  };
}

function invoke(harness, options = {}) {
  return processNextAuditJob({
    authorization: `Bearer ${secret}`,
    secret,
    WorkerClass: harness.MockWorker,
    createConnection: harness.createConnection,
    processor: async () => ({ status: 'COMPLETED' }),
    ...options,
  });
}

test('rejects missing and incorrect cron authorization without connecting to Redis', async () => {
  let connectionAttempts = 0;
  const options = {
    secret,
    createConnection: () => {
      connectionAttempts += 1;
      throw new Error('Should not connect');
    },
  };

  const missing = await processNextAuditJob({ ...options, authorization: null });
  const incorrect = await processNextAuditJob({
    ...options,
    authorization: 'Bearer incorrect',
  });

  assert.equal(missing.status, 401);
  assert.equal(incorrect.status, 401);
  assert.equal(connectionAttempts, 0);
});

test('rejects an unconfigured cron secret without connecting to Redis', async () => {
  let connectionAttempts = 0;
  const result = await processNextAuditJob({
    authorization: `Bearer ${secret}`,
    secret: '',
    createConnection: () => {
      connectionAttempts += 1;
      throw new Error('Should not connect');
    },
  });

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    processed: false,
    status: 'not_configured',
    error: 'Audit processing is not configured.',
  });
  assert.equal(connectionAttempts, 0);
});

test('returns an empty result and closes the worker when no job is available', async () => {
  const harness = createWorkerHarness();
  const result = await invoke(harness);

  assert.deepEqual(result, {
    status: 200,
    body: { processed: false, status: 'empty' },
  });
  assert.equal(harness.state.claimed, 0);
  assert.equal(harness.state.closeCalls, 1);
  assert.equal(harness.state.connectionClosed, true);
});

test('claims and processes only one job, pausing before processing', async () => {
  const harness = createWorkerHarness({ jobToProcess: job });
  let processCalls = 0;
  const result = await invoke(harness, {
    processor: async () => {
      processCalls += 1;
      assert.equal(harness.state.pauseCalls, 1);
      return { status: 'COMPLETED' };
    },
  });

  assert.deepEqual(result, {
    status: 200,
    body: {
      processed: true,
      status: 'completed',
      jobId: 'audit_123',
    },
  });
  assert.equal(harness.state.options.concurrency, 1);
  assert.equal(harness.state.options.autorun, false);
  assert.equal(harness.state.claimed, 1);
  assert.equal(processCalls, 1);
  assert.equal(harness.state.closeCalls, 1);
  assert.equal(harness.state.connectionClosed, true);
});

test('reports processing failures and leaves retry policy to BullMQ', async () => {
  const harness = createWorkerHarness({ jobToProcess: job });
  const result = await invoke(harness, {
    processor: async () => {
      throw new Error('processing failed');
    },
  });

  assert.deepEqual(result, {
    status: 200,
    body: {
      processed: true,
      status: 'failed',
      jobId: 'audit_123',
      retryScheduled: true,
    },
  });
  assert.equal(harness.state.claimed, 1);
  assert.equal(harness.state.connectionClosed, true);
});
