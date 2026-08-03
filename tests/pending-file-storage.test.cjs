const test = require('node:test');
const assert = require('node:assert/strict');
const pendingFiles = require('../pending-file-storage.js');

test('creates and validates a pending file envelope', () => {
  const envelope = pendingFiles.createEnvelope('', 'empty.md', 1000);

  assert.deepEqual(envelope, { content: '', name: 'empty.md', ts: 1000 });
  assert.equal(pendingFiles.isValidEnvelope(envelope), true);
  assert.equal(pendingFiles.isFreshEnvelope(envelope, { now: 1001 }), true);
  assert.equal(
    pendingFiles.isFreshEnvelope(envelope, {
      now: 1000 + pendingFiles.PENDING_MAX_AGE_MS + 1
    }),
    false
  );
  assert.equal(pendingFiles.isValidEnvelope({ content: '', name: 'empty.md' }), false);
});

test('normalizes storage and alarm keys from a nonce', () => {
  const nonce = 'mep8c2_ab12';

  assert.equal(pendingFiles.pendingKey(nonce), `pending:${nonce}`);
  assert.equal(pendingFiles.legacyFileKey(nonce), `file:${nonce}`);
  assert.equal(pendingFiles.legacyNameKey(nonce), `name:${nonce}`);
  assert.equal(
    pendingFiles.nonceFromCleanupAlarm(pendingFiles.cleanupAlarmName(nonce)),
    nonce
  );
  assert.equal(pendingFiles.pendingKey('../invalid'), '');
});

test('cleans stale, invalid and legacy entries without touching unrelated data', () => {
  const now = 2_000_000;
  const entries = {
    'pending:fresh01': pendingFiles.createEnvelope('fresh', 'fresh.md', now - 1000),
    'pending:stale01': pendingFiles.createEnvelope(
      'stale',
      'stale.md',
      now - pendingFiles.PENDING_MAX_AGE_MS - 1
    ),
    'pending:broken01': { content: 'broken' },
    'file:legacy01': 'legacy',
    'name:legacy01': 'legacy.md',
    unrelated: { keep: true }
  };

  assert.deepEqual(
    pendingFiles.collectCleanupKeys(entries, { now }).sort(),
    ['file:legacy01', 'name:legacy01', 'pending:broken01', 'pending:stale01']
  );
});

test('preserves the current launch envelope during startup cleanup', () => {
  const now = 2_000_000;
  const entries = {
    'pending:current1': pendingFiles.createEnvelope(
      'current',
      'current.md',
      now - pendingFiles.PENDING_MAX_AGE_MS - 1
    ),
    'pending:stale02': pendingFiles.createEnvelope(
      'stale',
      'stale.md',
      now - pendingFiles.PENDING_MAX_AGE_MS - 1
    )
  };

  assert.deepEqual(
    pendingFiles.collectCleanupKeys(entries, { now, currentNonce: 'current1' }),
    ['pending:stale02']
  );
});
