# AGENTS.md - Markdown Editor Project Guide

This document provides guidance for agentic coding agents working on this Markdown Editor project. It captures the existing codebase patterns, conventions, and development practices.

## Project Overview

This is a **static web application** for editing Markdown with real-time preview. It's built with vanilla HTML, CSS, and JavaScript (ES6+) with no build system, frameworks, or dependencies (all third-party libraries are loaded via CDN).

**Key features:**
- Real-time Markdown preview with syntax highlighting
- Table of Contents generation
- Dark/light theme toggle
- Local storage persistence
- Image drag-and-drop/paste support
- HTML export functionality
- Document statistics
- Keyboard shortcuts
- Responsive design

**Files:**
- `index.html` - Main HTML structure with semantic markup and accessibility features
- `style.css` - All styling with CSS custom properties for theming
- `app.js` - Core application logic (800+ lines)

## Development Environment

### No Build System
This project intentionally has **no build system, package manager, or bundler**. All dependencies are loaded via CDN in `index.html`. Keep it simple and maintainable.

### Running the Application
Simply open `index.html` in a modern browser. No server required (though some features like file APIs work better with a local server).

For development, you can use a simple HTTP server:
```bash
# Python 3
python -m http.server 8000

# Node.js (if you have it)
npx serve .
```

### Testing
No formal test suite exists. Manual testing in multiple browsers is the current approach. If adding tests in the future, consider:
- Browser-based E2E tests with Playwright/Puppeteer
- Unit tests for pure JavaScript functions (extract them first)

### Linting & Formatting
No linter or formatter is configured. Follow existing code style meticulously.

## Code Style Guidelines

### General Principles
1. **Keep it simple** - No unnecessary abstractions or dependencies
2. **Accessibility first** - Use semantic HTML, ARIA attributes, keyboard navigation
3. **Progressive enhancement** - Core functionality works without JavaScript where possible
4. **Chinese comments** - This project uses Chinese for comments and user-facing text
5. **Modern JavaScript** - Use ES6+ features (const, arrow functions, template literals)

### HTML
- **Doctype**: `<!DOCTYPE html>`
- **Language**: `lang="zh-CN"` (Chinese)
- **Character encoding**: UTF-8
- **Viewport**: Responsive meta tag present
- **Indentation**: 2 spaces
- **Structure**: Semantic HTML5 elements with proper nesting
- **Accessibility**:
  - Include ARIA roles and labels where helpful
  - Use `visually-hidden` class for screen reader-only text
  - Ensure proper heading hierarchy
  - Add `skip-link` for keyboard navigation
- **Script loading**: Non-blocking, at end of body
- **Comments**: Chinese comments for major sections

### CSS
- **Organization**: Follow the existing structure in `style.css`
- **Variables**: Use CSS custom properties (CSS variables) defined in `:root` for theming
- **Naming**: BEM-like convention (e.g., `.toc-item`, `.toc-link.active`)
- **Units**: Use `px` for borders, `em/rem` for typography, `%` for fluid layouts
- **Responsive**: Mobile-first media queries at bottom of file
- **Selectors**: Keep specificity low, avoid `!important`
- **Flexbox/Grid**: Use modern layout methods as appropriate
- **Transitions**: Use `ease` timing function with 0.15s-0.2s duration
- **Dark theme**: Implement via `html[data-theme="dark"]` selector overriding variables

### JavaScript
- **Variables**: Use `const` by default, `let` only for mutables, avoid `var`
- **Functions**: Use arrow functions for callbacks, named functions for top-level declarations
- **Comments**: JSDoc-style Chinese comments for functions (see existing pattern)
- **Error handling**: Use try-catch with descriptive error messages in Chinese
- **DOM manipulation**: Prefer `querySelector`/`querySelectorAll` over older methods
- **Event handling**: Use event delegation where appropriate, remove listeners if needed
- **Performance**: Implement debouncing for scroll/resize/input events (see `debounce` function)
- **Storage**: Use `localStorage` with consistent key naming (`md-editor-` prefix)
- **Modules**: No module system; all code in one file with careful organization
- **Third-party libraries**: Load via CDN, check for updates periodically

### Naming Conventions
- **HTML IDs/CSS classes**: kebab-case (e.g., `editor-pane`, `stat-chars`)
- **JavaScript variables**: camelCase (e.g., `currentFileName`, `lastHighlightError`)
- **CSS custom properties**: kebab-case with `--` prefix (e.g., `--primary-color`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g., `STORAGE_KEY`)
- **Functions**: camelCase, descriptive verbs (e.g., `renderMarkdown`, `updateStats`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (e.g., `isTocScrolling`)

### File Organization
- **HTML**: Logical structure with comments for major sections
- **CSS**: Group related styles (variables, base, components, utilities, responsive)
- **JavaScript**:
  1. DOM element references
  2. Constants and configuration
  3. Utility functions
  4. Core functionality (rendering, TOC, stats)
  5. File operations (open, save, export)
  6. Event handlers and initialization
  7. Default content and helpers

### Error Handling Pattern
```javascript
try {
  // Operation that might fail
} catch (err) {
  console.error("Descriptive Chinese error message:", err);
  // Provide user feedback
  setStatus("操作失败：" + (err.message || "未知错误"));
  // Recovery logic if needed
}
```

### Accessibility Requirements
1. **Semantic HTML**: Use appropriate elements (`<main>`, `<aside>`, `<nav>`, etc.)
2. **ARIA attributes**: Add when helpful but don't overuse
3. **Keyboard navigation**: All interactive elements must be keyboard accessible
4. **Focus management**: Maintain logical tab order, don't trap focus unnecessarily
5. **Screen readers**: Test with NVDA/VoiceOver, use `aria-label` and `visually-hidden` text
6. **Color contrast**: Meet WCAG AA standards (4.5:1 for normal text)

## Development Workflow

### Adding New Features
1. **Assess complexity** - Can it be done without adding dependencies?
2. **Follow existing patterns** - Match code style, organization, and naming
3. **Test manually** - Check in Chrome, Firefox, Safari (if possible)
4. **Verify accessibility** - Keyboard navigation, screen reader announcements
5. **Update documentation** - Add comments, update this guide if patterns change

### Modifying Existing Code
1. **Understand the current implementation** - Read related functions
2. **Maintain backward compatibility** - Don't break existing functionality
3. **Refactor cautiously** - This is a stable application; prefer small, safe changes
4. **Test affected features** - Manual testing of related functionality

### Bug Fixes
1. **Reproduce the issue** - Document steps to reproduce
2. **Debug systematically** - Use browser DevTools, add logging if needed
3. **Fix root cause** - Not just symptoms
4. **Test the fix** - And related functionality
5. **Consider edge cases** - What else might break?

## Third-Party Libraries

Currently loaded via CDN:
- **markdown-it** (v14.1.0) - Markdown parsing
- **markdown-it-anchor** (v9.2.0) - Heading anchors
- **DOMPurify** (v3.1.6) - HTML sanitization
- **highlight.js** (v11.9.0) - Code syntax highlighting

**Update policy**: Update only when necessary for security or critical bug fixes. Test thoroughly after updates as API changes may break functionality.

## Future Considerations

If this project grows, consider:
1. **Adding a simple build step** for minification, bundling, or transpiling
2. **Implementing unit tests** for core utility functions
3. **Adding E2E tests** for critical user flows
4. **Setting up a linter/formatter** (Prettier, ESLint)
5. **Extracting reusable components** if complexity increases

## Agent-Specific Notes

When working as an agent on this project:

1. **Read existing code first** - Understand the patterns before making changes
2. **Preserve Chinese language** - Maintain Chinese comments and user-facing text
3. **Keep it simple** - Avoid over-engineering; this is a straightforward web app
4. **Test in browser** - Always verify changes work in at least one browser
5. **Document your changes** - Add or update Chinese comments for new functionality
6. **Consider performance** - This app should remain fast and responsive
7. **Maintain accessibility** - Don't introduce accessibility regressions

## Contact & Maintenance

This is a personal project. For questions about the codebase structure or decisions, refer to the existing code patterns and this document.

---

*Last updated: March 26, 2026*  
*For agentic coding agents working with OhMyOpenCode/Sisyphus*