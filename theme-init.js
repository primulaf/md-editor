(function initializeTheme() {
  "use strict";

  const storageKey = "md-editor-theme";
  let theme = "light";
  try {
    if (localStorage.getItem(storageKey) === "dark") theme = "dark";
  } catch {
    // Keep the default theme when storage is unavailable.
  }
  document.documentElement.dataset.theme = theme;
})();
