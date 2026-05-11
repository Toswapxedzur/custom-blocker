// Custom Web Blocker — template utilities and registry.
//
// This file is loaded by popup.html BEFORE the per-category template
// files and BEFORE popup.js, so every template file can do
//   window.CB_REGISTER_TEMPLATES([...])
// to add itself to the in-memory list. popup.js then reads from
// window.__CUSTOM_BLOCKER_TEMPLATES instead of holding the templates
// inline (which had grown to ~400 lines and was about to grow to
// ~1500). Each template object has the same shape as before:
//   { id, title, description, tags, params, buildCode(values) }
//
// Notes:
// - The module purposely avoids any chrome.* API access — these files
//   should be cheap to evaluate and have no side effects beyond
//   appending to the global registry.
// - quoteJs / minutesToMsLiteral are exposed globally because every
//   buildCode() function uses them; refactoring them per-template
//   would noise up the source for no benefit.

(function () {
  if (typeof window === "undefined") return;

  if (!Array.isArray(window.__CUSTOM_BLOCKER_TEMPLATES)) {
    window.__CUSTOM_BLOCKER_TEMPLATES = [];
  }

  // Registry helpers consumed by every templates/<category>.js file.
  // CB_REGISTER_TEMPLATES accepts an array (preferred — keeps
  // related templates visually grouped per category file).
  window.CB_REGISTER_TEMPLATE = function CB_REGISTER_TEMPLATE(template) {
    if (!template || typeof template !== "object") return;
    if (typeof template.id !== "string" || !template.id) return;
    window.__CUSTOM_BLOCKER_TEMPLATES.push(template);
  };
  window.CB_REGISTER_TEMPLATES = function CB_REGISTER_TEMPLATES(list) {
    if (!Array.isArray(list)) return;
    for (const tpl of list) window.CB_REGISTER_TEMPLATE(tpl);
  };

  // Shared by every buildCode() so we don't have to ship MS_PER_MINUTE
  // into each file. Mirrors the popup.js value (60_000).
  const MS_PER_MINUTE_TPL = 60 * 1000;

  // JSON-quote a string so it can be safely interpolated into a
  // user-visible code snippet that's later eval'd in the sandbox.
  // Returns a quoted string with all special characters escaped.
  window.quoteJs = function quoteJs(value) {
    return JSON.stringify(String(value ?? ""));
  };

  // Convert a number-of-minutes input (which may come from a text
  // field or a number field) into an integer ms literal that the
  // generated source pastes verbatim. Math.round protects against
  // 0.99999-style floats from spinners.
  window.minutesToMsLiteral = function minutesToMsLiteral(value) {
    return Math.round(Number(value) * MS_PER_MINUTE_TPL);
  };
})();
