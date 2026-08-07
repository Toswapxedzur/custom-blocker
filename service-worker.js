// Chromium MV3 worker entry point.
//
// Chrome can otherwise leave an updated unpacked extension with no registered
// worker when a synchronous startup/import error escapes background.js. Keep a
// tiny, stable entry point and preserve the real failure in DevTools instead
// of surfacing only Chrome's opaque "No SW" error to the user.
try {
  importScripts("background.js");
} catch (error) {
  try {
    console.error("[CustomBlocker] background worker failed to start", error);
  } catch (_) {}
}
