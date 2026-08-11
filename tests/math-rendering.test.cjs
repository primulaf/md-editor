const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const {
  KATEX_FONT_FILES,
  createTexmathOptions,
  getExportStyles,
  rewriteKatexFontUrls
} = require("../math-rendering.js");

test("creates conservative offline KaTeX options", () => {
  const engine = { renderToString() {} };
  const options = createTexmathOptions(engine);

  assert.equal(options.engine, engine);
  assert.deepEqual(options.delimiters, ["dollars"]);
  assert.equal(options.katexOptions.output, "htmlAndMathml");
  assert.equal(options.katexOptions.throwOnError, false);
  assert.equal(options.katexOptions.trust, false);
  assert.equal(options.katexOptions.maxExpand, 1000);
  assert.equal(options.katexOptions.maxSize, 20);
});

test("rewrites KaTeX font URLs to self-contained data URLs", () => {
  const css = '@font-face{src:url(fonts/KaTeX_Main-Regular.woff2) format("woff2")}';
  const rewritten = rewriteKatexFontUrls(css, {
    "KaTeX_Main-Regular.woff2": "data:font/woff2;base64,AAAA"
  });

  assert.match(rewritten, /data:font\/woff2;base64,AAAA/);
  assert.doesNotMatch(rewritten, /url\(fonts\//);
  assert.equal(KATEX_FONT_FILES.length, 20);
});

test("builds self-contained KaTeX export styles from vendored WOFF2 fonts", async () => {
  const projectRoot = join(__dirname, "..");
  const fetchFromProject = async (url) => {
    const pathname = new URL(url).pathname.replace(/^\//, "");
    const bytes = await readFile(join(projectRoot, ...pathname.split("/")));
    return {
      ok: true,
      text: async () => bytes.toString("utf8"),
      arrayBuffer: async () => bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      )
    };
  };
  const rootWithMath = { querySelector: () => ({}) };
  const styles = await getExportStyles(rootWithMath, fetchFromProject);

  assert.match(styles, /data:font\/woff2;base64,/);
  assert.doesNotMatch(styles, /url\(["']?fonts\//);
  assert.match(styles, /\.container eqn/);
});
