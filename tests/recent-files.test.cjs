const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_RECENT_FILES,
  calculateMenuPosition,
  findMatchingEntryIds,
  findMatchingUrlEntryIds,
  normalizeEntry,
  normalizeFileUrl,
  sortAndLimit
} = require('../recent-files.js');

function createHandle(name, identity = name) {
  return {
    kind: 'file',
    name,
    getFile() {},
    async isSameEntry(other) {
      return other?.identity === identity;
    },
    identity
  };
}

test('normalizes handle and local-URL recent file metadata', () => {
  const handle = createHandle('alpha.md');
  assert.deepEqual(normalizeEntry({
    id: 'alpha',
    name: 'alpha.md',
    size: 120,
    lastModified: 80,
    openedAt: 100,
    handle
  }), {
    id: 'alpha',
    name: 'alpha.md',
    size: 120,
    lastModified: 80,
    openedAt: 100,
    handle,
    fileUrl: ''
  });

  assert.deepEqual(normalizeEntry({
    id: 'associated',
    name: 'associated.md',
    size: 24,
    openedAt: 200,
    fileUrl: 'file:///C:/Docs/associated.md'
  }), {
    id: 'associated',
    name: 'associated.md',
    size: 24,
    lastModified: 0,
    openedAt: 200,
    handle: null,
    fileUrl: 'file:///C:/Docs/associated.md'
  });
  assert.equal(normalizeEntry({ id: 'missing', openedAt: 100 }), null);
});

test('sorts recent files by use time and enforces the twelve-file limit', () => {
  const entries = Array.from({ length: MAX_RECENT_FILES + 3 }, (_, index) => ({
    id: String(index),
    name: `${index}.md`,
    openedAt: index + 1,
    handle: createHandle(`${index}.md`)
  }));
  const sorted = sortAndLimit(entries);

  assert.equal(sorted.length, MAX_RECENT_FILES);
  assert.equal(sorted[0].name, '14.md');
  assert.equal(sorted.at(-1).name, '3.md');
});

test('uses file-handle identity instead of filename for deduplication', async () => {
  const incoming = createHandle('renamed.md', 'same-file');
  const entries = [
    { id: 'same', handle: createHandle('old.md', 'same-file') },
    { id: 'other', handle: createHandle('renamed.md', 'other-file') }
  ];

  assert.deepEqual(await findMatchingEntryIds(entries, incoming), ['same']);
});

test('accepts only local Markdown URLs and deduplicates their canonical form', () => {
  const fileUrl = 'file:///C:/Docs/test%20file.md?ignored=yes#section';
  assert.equal(normalizeFileUrl(fileUrl), 'file:///C:/Docs/test%20file.md');
  assert.equal(normalizeFileUrl('https://example.com/test.md'), '');
  assert.equal(normalizeFileUrl('file:///C:/Docs/test.txt'), '');
  assert.deepEqual(findMatchingUrlEntryIds([
    { id: 'same', fileUrl: 'file:///C:/Docs/test%20file.md' },
    { id: 'other', fileUrl: 'file:///C:/Docs/other.md' }
  ], fileUrl), ['same']);
});

test('positions the recent menu beyond the sidebar without crossing the viewport', () => {
  assert.deepEqual(calculateMenuPosition(
    { left: 14, top: 90, bottom: 180 },
    { width: 340, height: 280 },
    { width: 1440, height: 900 }
  ), { left: 14, top: 186 });

  assert.deepEqual(calculateMenuPosition(
    { left: 14, top: 760, bottom: 800 },
    { width: 304, height: 280 },
    { width: 320, height: 900 }
  ), { left: 8, top: 474 });
});
