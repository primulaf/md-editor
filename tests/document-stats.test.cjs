const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateDocumentStats,
  formatReadingTime
} = require("../document-stats.js");

test("reports an empty document without inventing reading time", () => {
  assert.deepEqual(calculateDocumentStats(""), {
    wordCount: 0,
    lineCount: 0,
    headingCount: 0,
    readingMinutes: 0,
    cjkCharacterCount: 0,
    latinWordCount: 0
  });
  assert.equal(formatReadingTime(0), "少于 1 分钟");
});

test("counts CJK characters, Latin words, lines and rendered heading forms", () => {
  const markdown = "# 标题\n\n这是测试。 Hello world.\n第二行\n\n补充标题\n----";
  const stats = calculateDocumentStats(markdown);

  assert.equal(stats.cjkCharacterCount, 13);
  assert.equal(stats.latinWordCount, 2);
  assert.equal(stats.wordCount, 15);
  assert.equal(stats.lineCount, 7);
  assert.equal(stats.headingCount, 2);
  assert.equal(stats.readingMinutes, 1);
});

test("excludes fenced code, Mermaid source, inline code and link targets", () => {
  const markdown = [
    "# 可见",
    "正文 [说明](https://example.com/very/long/path)",
    "`const hidden = 123`",
    "```mermaid",
    "graph LR",
    "# 隐藏标题",
    "A --> B",
    "```"
  ].join("\n");
  const stats = calculateDocumentStats(markdown);

  assert.equal(stats.headingCount, 1);
  assert.equal(stats.cjkCharacterCount, 6);
  assert.equal(stats.latinWordCount, 0);
  assert.equal(stats.wordCount, 6);
});

test("keeps image alt text but excludes DataURL and short-reference payloads", () => {
  const payload = "A".repeat(20000);
  const markdown = [
    `![架构图](data:image/png;base64,${payload})`,
    "![流程](md-image:12)",
    "正文"
  ].join("\n");
  const stats = calculateDocumentStats(markdown);

  assert.equal(stats.cjkCharacterCount, 7);
  assert.equal(stats.latinWordCount, 0);
  assert.equal(stats.wordCount, 7);
  assert.equal(stats.readingMinutes, 1);
});

test("formats longer reading estimates", () => {
  assert.equal(formatReadingTime(1), "少于 1 分钟");
  assert.equal(formatReadingTime(2), "约 2 分钟");
});
