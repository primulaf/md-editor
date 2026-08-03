const test = require('node:test');
const assert = require('node:assert/strict');
const MarkdownIt = require('markdown-it');
const taskLists = require('markdown-it-task-lists');
const footnote = require('markdown-it-footnote');

function createMarkdown() {
  return new MarkdownIt({ html: true })
    .use(taskLists, { enabled: false, label: false })
    .use(footnote);
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
