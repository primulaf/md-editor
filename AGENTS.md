# Repository Guidelines

This repository is a Manifest V3 Chrome extension for offline Markdown reading and editing with Mermaid diagram rendering, written in plain JavaScript without a bundler or framework.

## Project Structure & Module Organization

- Root source: `manifest.json` (MV3 config), `index.html` (UI), `style.css`, `app.js` (editor integration), `code-block-tools.js` (copy/download controls), `math-rendering.js` (KaTeX configuration and self-contained export styles), `image-assets.js` (image DataURL compaction), `document-stats.js` (readable-content statistics), `recent-files.js` (persistent handles and associated file URLs), `pending-file-storage.js` (associated-file handoff cleanup), `mermaid-renderer.mjs`, `mermaid-capability.mjs`, and `mermaid-tools.js` (Mermaid rendering, detection, and controls), `background.js` (service worker), `content.js` (file reading).
- `lib/`: vendored third-party dependencies (markdown-it, DOMPurify, highlight.js, KaTeX, Mermaid). Keep versions pinned; never edit vendored files directly.
- `tests/`: Node test suites plus fixtures in `tests/fixtures/`.
- `scripts/`: dependency sync, packaging, and validation (`sync-vendor.mjs`, `package-extension.mjs`, `validate-*.mjs`).
- `docs/`: `specs/` and `plans/` for feature docs (`YYYY-MM-DD-<topic>.md`), `releases/` for release notes (`v<version>.md`).
- `icons/` and `fonts/`: extension assets. `dist/` holds generated packages and is gitignored.

## Build, Test, and Development Commands

- `npm install` — install dependencies.
- `npm run vendor` — sync vendored libraries from dependencies into `lib/`.
- `npm test` — syntax-check every JS file, run Node test suites, and validate project structure and version consistency.
- `npm run package` — run tests, then build `dist/md-editor-<version>.zip` and `SHA256SUMS.txt`.
- Load the folder as an unpacked extension via `chrome://extensions`; no dev server is needed.

## Coding Style & Naming Conventions

- Use 2-space indentation, semicolons, and meaningful camelCase identifiers.
- Match the style of the file you are editing: `app.js` uses double quotes; `.mjs` modules and tests use single quotes.
- No formatter or linter is configured; keep files small and consistent with nearby code.

## Testing Guidelines

- Use Node's built-in `node:test` with `node:assert/strict`; name suites `<module>.test.cjs` or `<module>.test.mjs` under `tests/`.
- Pure helpers (e.g., image store, Mermaid capability detection) must have tests; place fixtures in `tests/fixtures/`.
- No coverage tool is configured. Run `npm test` before every commit.

## Commit & Pull Request Guidelines

- Write commit messages in Chinese, concise and descriptive: `实现 v1.6.0 Mermaid 离线渲染`; releases use `发布 <version>：<summary>`.
- For releases, bump the version consistently in `package.json` and `manifest.json` (the project validator enforces this) and add `docs/releases/v<version>.md`.
- Pull requests: explain what changed and why, link related issues, include screenshots for UI changes, and confirm `npm test` passes.

## Security & Configuration

- The extension must stay fully offline: no CDN or remote scripts, and Mermaid diagrams must not load remote images.
- Sanitize all rendered HTML with DOMPurify before inserting it into the preview.
