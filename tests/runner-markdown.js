/* Markdown renderer test runner.
 *
 * Pure-function tests for popup-markdown.js. Run with:
 *   tests/run.sh
 *
 * The renderer used to hang the popup on certain malformed translated
 * manuals (an orphan "|---|---|---|" separator with no header row above
 * it). These tests pin down the safety net that prevents that, plus the
 * primary block-level features (heading / list / table / blockquote /
 * hr / fence) and the inline ones (code, bold, link). */

load("popup-markdown.js");
load("tests/log.js");

const log = globalThis.__cbTestLog.makeLogger({ colour: true });

function assert(name, cond, data) {
  if (cond) log.pass(name, data);
  else log.fail(name, data);
  return Boolean(cond);
}

function assertEqual(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    log.pass(name);
    return true;
  }
  log.fail(name, { expected, actual });
  return false;
}

function assertContains(name, haystack, needle) {
  if (typeof haystack === "string" && haystack.indexOf(needle) !== -1) {
    log.pass(name);
    return true;
  }
  log.fail(name, { expected: "string containing " + JSON.stringify(needle), actual: haystack });
  return false;
}

function assertNotContains(name, haystack, needle) {
  if (typeof haystack === "string" && haystack.indexOf(needle) === -1) {
    log.pass(name);
    return true;
  }
  log.fail(name, { expected: "string NOT containing " + JSON.stringify(needle), actual: haystack });
  return false;
}

// ── primitives ──────────────────────────────────────────────────────────
log.section("M1: escapeHtml");

assertEqual("escapeHtml: empty becomes empty",
  escapeHtml(""), "");
assertEqual("escapeHtml: null becomes empty",
  escapeHtml(null), "");
assertEqual("escapeHtml: angle brackets",
  escapeHtml("<script>alert('x')</script>"),
  "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
assertEqual("escapeHtml: ampersand goes first",
  escapeHtml("&amp;<"),
  "&amp;amp;&lt;");

log.section("M2: renderInlineMarkdown");

assertEqual("inline: backticks become <code>",
  renderInlineMarkdown("hello `world` ok"),
  "hello <code>world</code> ok");
assertEqual("inline: ** becomes <strong>",
  renderInlineMarkdown("a **bold** b"),
  "a <strong>bold</strong> b");
assertEqual("inline: * becomes <em>",
  renderInlineMarkdown("a *em* b"),
  "a <em>em</em> b");
assertEqual("inline: link",
  renderInlineMarkdown("see [here](https://x.test/p)"),
  'see <a href="https://x.test/p" target="_blank" rel="noreferrer">here</a>');
assertEqual("inline: HTML inside backticks is escaped",
  renderInlineMarkdown("`<x>`"),
  "<code>&lt;x&gt;</code>");

// ── block features ─────────────────────────────────────────────────────
log.section("M3: block features");

assertEqual("block: empty input",
  renderMarkdownToHtml(""), "");
assertEqual("block: heading 1",
  renderMarkdownToHtml("# Hi"), "<h1>Hi</h1>");
assertEqual("block: heading 6",
  renderMarkdownToHtml("###### deep"), "<h6>deep</h6>");
assertEqual("block: paragraph collapses lines",
  renderMarkdownToHtml("one\ntwo\nthree"),
  "<p>one two three</p>");

const ul = renderMarkdownToHtml("- a\n- b\n- c");
assertEqual("block: unordered list",
  ul,
  "<ul><li>a</li><li>b</li><li>c</li></ul>");

const ol = renderMarkdownToHtml("1. a\n2. b\n3. c");
assertEqual("block: ordered list",
  ol,
  "<ol><li>a</li><li>b</li><li>c</li></ol>");

const fence = renderMarkdownToHtml("```\nlet x = 1;\nlet y = 2;\n```");
assertEqual("block: fenced code preserves content",
  fence,
  "<pre><code>let x = 1;\nlet y = 2;</code></pre>");

assertContains("block: fenced code escapes HTML",
  renderMarkdownToHtml("```\n<script>x</script>\n```"),
  "&lt;script&gt;x&lt;/script&gt;");

assertEqual("block: hr ---",
  renderMarkdownToHtml("---"), "<hr>");
assertEqual("block: hr ***",
  renderMarkdownToHtml("***"), "<hr>");

const quote = renderMarkdownToHtml("> first\n> second");
assertEqual("block: blockquote merges lines",
  quote,
  "<blockquote>first second</blockquote>");

// ── tables ─────────────────────────────────────────────────────────────
log.section("M4: tables");

const table = renderMarkdownToHtml(
  "| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |"
);
assertContains("table: emits <table class=manual-table>",
  table, '<table class="manual-table">');
assertContains("table: header cell",
  table, "<th>a</th>");
assertContains("table: body cell",
  table, "<td>2</td>");
assertContains("table: tbody is closed",
  table, "</tbody></table>");

const aligned = renderMarkdownToHtml(
  "| L | C | R |\n|:--|:-:|--:|\n| 1 | 2 | 3 |"
);
assertContains("table: left align style", aligned, 'style="text-align:left"');
assertContains("table: center align style", aligned, 'style="text-align:center"');
assertContains("table: right align style", aligned, 'style="text-align:right"');

// ── safety net (the bug that froze the popup) ──────────────────────────
log.section("M5: malformed-markdown safety net");

const orphanSeparator = "|---|---|---|";
const out = renderMarkdownToHtml(orphanSeparator + "\nfollow-up paragraph");
// Must not hang. Must produce SOME output. Must contain the follow-up.
assert("orphan |---| does not hang the renderer (returns)", typeof out === "string");
assertContains("orphan |---| follow-up still rendered", out, "follow-up paragraph");

const noSeparator = "| header | only |\nfollow-up";
const out2 = renderMarkdownToHtml(noSeparator);
assert("table-header-without-separator does not hang", typeof out2 === "string");
assertContains("table-header-without-separator: header text preserved",
  out2, "header");

// Real-world repro: the freeze-causing pattern that machine translation
// produced — heading text fused with the table header, then a separator,
// then body rows. We don't try to recover the table; we just require
// that the renderer terminates and the body content survives.
const merged =
  "### 11.2.2 Built-in event types| Type | When it fires | payload |\n" +
  "|---|---|---|\n" +
  "| `tickEvent` | every tick | `{}` |\n" +
  "| `pageHeartbeatEvent` | tab heartbeat | `{}` |\n";
const out3 = renderMarkdownToHtml(merged);
assert("real-world freeze repro: renderer terminates", typeof out3 === "string");
assertContains("real-world freeze repro: tickEvent text preserved",
  out3, "tickEvent");
assertContains("real-world freeze repro: heartbeat text preserved",
  out3, "pageHeartbeatEvent");

// Big stress: 5000 lines of various malformed input. Must finish < 1s.
let stress = "";
for (let i = 0; i < 1000; i++) {
  stress += "|---|---|\n| weird | row\n";
  stress += "> a quote\n\n";
  stress += "- item\n- item\n\n";
  stress += "paragraph line " + i + "\n\n";
}
const t0 = Date.now();
const stressOut = renderMarkdownToHtml(stress);
const dt = Date.now() - t0;
assert("stress: 5000-ish lines render in < 2000 ms (got " + dt + " ms)", dt < 2000);
assert("stress: produced non-empty output", stressOut.length > 0);

// ── final summary ──────────────────────────────────────────────────────
const counts = log.counts();
log.summary("─".repeat(60));
log.summary(
  "MARKDOWN TOTAL " + counts.total +
  "  PASS " + counts.pass +
  "  FAIL " + counts.fail +
  "  SKIP " + counts.skip
);
if (counts.fail > 0) {
  log.summary("FAILED");
  print("__CB_TEST_RESULT__: FAILED");
} else {
  log.summary("OK");
  print("__CB_TEST_RESULT__: OK");
}
