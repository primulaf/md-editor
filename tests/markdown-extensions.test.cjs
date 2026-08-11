const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const taskLists = require('markdown-it-task-lists');
const footnote = require('markdown-it-footnote');
const texmath = require('markdown-it-texmath');
const katex = require('katex');
const { createTexmathOptions } = require('../math-rendering.js');

function createMarkdown() {
  return new MarkdownIt({ html: true })
    .use(taskLists, { enabled: false, label: false })
    .use(footnote)
    .use(texmath, createTexmathOptions(katex));
}

test('renders disabled task-list checkboxes without changing Markdown source', () => {
  const source = '- [x] 已完成\n- [ ] 待处理';
  const html = createMarkdown().render(source);

  assert.match(html, /class="contains-task-list"/);
  assert.match(html, /checked="" disabled="" type="checkbox"/);
  assert.match(html, /disabled="" type="checkbox"/);
  assert.equal(source, '- [x] 已完成\n- [ ] 待处理');
});

test('renders footnote references, definitions and back links', () => {
  const html = createMarkdown().render('说明[^note]\n\n[^note]: 脚注内容');

  assert.match(html, /class="footnote-ref"/);
  assert.match(html, /href="#fn1"/);
  assert.match(html, /id="fn1" class="footnote-item"/);
  assert.match(html, /class="footnote-backref"/);
});

test('renders inline and block formulas with accessible MathML', () => {
  const html = createMarkdown().render([
    '行内 $E=mc^2$ 公式。',
    '',
    '$$',
    '\\int_0^1 x^2\\,dx',
    '$$'
  ].join('\n'));

  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"/);
  assert.match(html, /display="block"/);
});

test('keeps money, escaped delimiters and code samples out of math rendering', () => {
  const html = createMarkdown().render([
    '价格是 $100，折后 $80。',
    '',
    '\\$100',
    '',
    '`$notMath$`',
    '',
    '```text',
    '$notMath$',
    '```'
  ].join('\n'));

  assert.doesNotMatch(html, /class="katex"/);
  assert.match(html, /价格是 \$100，折后 \$80。/);
  assert.match(html, /<code>\$notMath\$<\/code>/);
});

test('renders invalid formulas as visible source without aborting the document', () => {
  const html = createMarkdown().render('$\\notARealCommand{x}$\n\n后续正文');

  assert.match(html, /mathcolor="#cf222e"/);
  assert.match(html, /\\notARealCommand/);
  assert.match(html, /后续正文/);
});
