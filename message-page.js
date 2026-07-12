// Renders the `?msg=` query parameter as the page's centred message.
// The page is reached via helpers.getRedirectionHelper().createMessageUrl()
// from a custom rule (e.g. redirecting users to a "Go Work" page after a
// timer ends).

(function renderMessage() {
  const body = document.getElementById("messageBody");
  if (!body) return;

  let message = "";
  try {
    const params = new URLSearchParams(window.location.search);
    message = params.get("msg") ?? "";
  } catch (_) {
    message = "";
  }

  // Use textContent to keep this safe against arbitrary user input;
  // we never want to render someone's "Go Work" string as HTML.
  body.textContent = message;
  if (message) {
    document.title = "Adamancia Vault — " + message;
  }
})();
