const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculatePngSize,
  createDiagramFilename
} = require('../mermaid-tools.js');

test('keeps a regular PNG export at two times the SVG dimensions', () => {
  assert.deepEqual(calculatePngSize(1200, 600), {
    width: 2400,
    height: 1200,
    scale: 2
  });
});

test('reduces PNG scale to satisfy edge and pixel limits', () => {
  const edgeLimited = calculatePngSize(6000, 1000);
  assert.equal(edgeLimited.width, 8192);
  assert.ok(edgeLimited.height <= 8192);

  const pixelLimited = calculatePngSize(5000, 5000);
  assert.ok(pixelLimited.width * pixelLimited.height <= 32_000_000);
  assert.equal(pixelLimited.width, pixelLimited.height);
});

test('builds a safe diagram filename from the current Markdown file', () => {
  assert.equal(
    createDiagramFilename('KYC:分析?.markdown', 3, 'png'),
    'KYC-分析--diagram-3.png'
  );
  assert.equal(createDiagramFilename('', 0, 'svg'), 'Markdown-diagram-1.svg');
});
