const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createCodeFilename,
  getLanguageDetails,
  normalizeLanguage
} = require("../code-block-tools.js");

test("normalizes common code language aliases", () => {
  assert.equal(normalizeLanguage("language-PY"), "python");
  assert.equal(normalizeLanguage("bash"), "shell");
  assert.equal(normalizeLanguage("yml"), "yaml");
  assert.equal(normalizeLanguage(""), "text");
});

test("maps known languages and falls back to text downloads", () => {
  assert.deepEqual(getLanguageDetails("json"), {
    extension: "json",
    mime: "application/json",
    label: "JSON"
  });
  assert.equal(getLanguageDetails("made-up-language").extension, "txt");
  assert.equal(getLanguageDetails("made-up-language").label, "made-up-language");
});

test("builds safe deterministic code filenames", () => {
  assert.equal(
    createCodeFilename("KYC:分析?.markdown", 3, "python"),
    "KYC-分析--code-03.py"
  );
  assert.equal(createCodeFilename("", 0, "unknown"), "Markdown-code-01.txt");
});
