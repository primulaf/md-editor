const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createStore,
  escapeAltText,
  mapPosition
} = require("../image-assets.js");

const RED_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

test("compacts and expands an inline image DataURL without changing the saved Markdown", () => {
  const store = createStore();
  const source = `before\n![pixel](${RED_PIXEL})\nafter`;
  const compacted = store.compact(source);

  assert.equal(compacted.content, "before\n![pixel](md-image:1)\nafter");
  assert.equal(compacted.count, 1);
  assert.equal(compacted.added, 1);
  assert.equal(store.expand(compacted.content).content, source);
});

test("deduplicates repeated image data", () => {
  const store = createStore();
  const compacted = store.compact(`![one](${RED_PIXEL})\n![two](${RED_PIXEL})`);

  assert.equal(compacted.content, "![one](md-image:1)\n![two](md-image:1)");
  assert.equal(store.size, 1);
  assert.equal(compacted.added, 1);
});

test("preserves escaped alt text and an optional title", () => {
  const store = createStore();
  const source = `![a\\]b](${RED_PIXEL} "title")`;
  const compacted = store.compact(source);

  assert.equal(compacted.content, '![a\\]b](md-image:1 "title")');
  assert.equal(store.expand(compacted.content).content, source);
  assert.equal(escapeAltText("a\\b]c"), "a\\\\b\\]c");
});

test("restores a resource snapshot", () => {
  const firstStore = createStore();
  const compacted = firstStore.compact(`![pixel](${RED_PIXEL})`);
  const restoredStore = createStore(firstStore.snapshot());

  assert.equal(restoredStore.size, 1);
  assert.equal(restoredStore.expand(compacted.content).content, `![pixel](${RED_PIXEL})`);
  assert.equal(restoredStore.add(RED_PIXEL), "1");
});

test("changes revision only when the resource table changes", () => {
  const store = createStore();
  const initialRevision = store.revision;
  store.add(RED_PIXEL);
  const addedRevision = store.revision;
  store.add(RED_PIXEL);

  assert.ok(addedRevision > initialRevision);
  assert.equal(store.revision, addedRevision);
  store.clear();
  assert.ok(store.revision > addedRevision);
});

test("reports missing short references without altering them", () => {
  const store = createStore();
  const source = "![missing](md-image:9)";
  const expanded = store.expand(source);

  assert.equal(expanded.content, source);
  assert.deepEqual(expanded.missingIds, ["9"]);
});

test("maps textarea positions after a long image reference is compacted", () => {
  const store = createStore();
  const source = `start ![pixel](${RED_PIXEL}) end`;
  const compacted = store.compact(source);

  assert.equal(
    mapPosition(source.length, compacted.replacements),
    compacted.content.length
  );
  assert.equal(
    mapPosition(2, compacted.replacements),
    2
  );
});
