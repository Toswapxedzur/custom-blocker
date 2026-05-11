/* Self-contained markdown renderer used by the popup's instruction-manual
 * viewer. Pulled out of popup.js so it can be unit-tested under jsc
 * without dragging in a full DOM. The functions live as plain
 * declarations on the global scope so popup.js (loaded after this
 * script) sees them just like before, and the test harness can call
 * `renderMarkdownToHtml(...)` directly.
 *
 * Supports:
 *   - Headings (# … ######)
 *   - Unordered (- / *) and ordered (1. …) lists
 *   - Pipe-style tables with optional :--:/:--/--: alignment row
 *   - Blockquotes (>)
 *   - Horizontal rules (---, ***)
 *   - Fenced code blocks (```)
 *   - Inline `code`, **bold**, *italic*, [text](url) links
 *
 * The outer loop has a safety net: every iteration MUST advance `index`.
 * Otherwise malformed markdown (e.g. an orphan "|---|---|" left over
 * from a translation that mangled the header row) used to freeze the
 * popup. We now emit a literal paragraph and step forward instead.
 */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdownToHtml(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const blockStartIndex = index;
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>`);
        index += 1;
      }

      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        index += 1;
      }

      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Pipe-style markdown tables. The middle "alignment" row is what
    // distinguishes a table from a plain pipe-using paragraph; without
    // it the line falls through to the paragraph branch below.
    if (
      trimmed.startsWith("|") &&
      index + 1 < lines.length &&
      /^\s*\|?[\s:-]*\|[\s:|-]*$/.test(lines[index + 1])
    ) {
      const splitRow = (raw) => {
        let row = raw.trim();
        if (row.startsWith("|")) row = row.slice(1);
        if (row.endsWith("|")) row = row.slice(0, -1);
        return row.split("|").map((cell) => cell.trim());
      };

      const headers = splitRow(lines[index]);
      const aligns = splitRow(lines[index + 1]).map((spec) => {
        const left = spec.startsWith(":");
        const right = spec.endsWith(":");
        if (left && right) return "center";
        if (right) return "right";
        if (left) return "left";
        return null;
      });
      index += 2;

      const bodyRows = [];
      while (
        index < lines.length &&
        lines[index].trim().startsWith("|") &&
        lines[index].includes("|", 1)
      ) {
        bodyRows.push(splitRow(lines[index]));
        index += 1;
      }

      const styleFor = (i) => {
        const align = aligns[i];
        return align ? ` style="text-align:${align}"` : "";
      };

      const headHtml = headers
        .map((cell, i) => `<th${styleFor(i)}>${renderInlineMarkdown(cell)}</th>`)
        .join("");
      const bodyHtml = bodyRows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, i) => `<td${styleFor(i)}>${renderInlineMarkdown(cell)}</td>`)
              .join("")}</tr>`
        )
        .join("");

      blocks.push(
        `<table class="manual-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
      );
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote>${renderInlineMarkdown(quoteLines.join(" "))}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push("<hr>");
      index += 1;
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !lines[index].trim().startsWith(">") &&
      !lines[index].trim().startsWith("|") &&
      !/^---+$/.test(lines[index].trim()) &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    if (paragraphLines.length) {
      blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    }

    // Safety net: every outer-loop iteration MUST advance `index`. If
    // none of the branches above did, treat this line as a paragraph
    // so the loop cannot hang on malformed input (the bug we hit when
    // a translation pass left a "|---|---|" separator without its
    // header row above it).
    if (index === blockStartIndex) {
      blocks.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
      index += 1;
    }
  }

  return blocks.join("");
}

// Make the renderer reachable from globalThis for both the popup
// (loaded as a regular <script>) and the test runner (loaded via jsc's
// `load()` which dumps top-level decls onto the global object).
if (typeof globalThis !== "undefined") {
  globalThis.escapeHtml = escapeHtml;
  globalThis.renderInlineMarkdown = renderInlineMarkdown;
  globalThis.renderMarkdownToHtml = renderMarkdownToHtml;
}
