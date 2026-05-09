/* Tiny structured-log system for the test runner.
 *
 * The log is BOTH human-readable (printed line by line as tests execute)
 * AND machine-readable (a flat array of entries we can assert against
 * or dump as JSON). Each entry has:
 *   { t: ms-since-start, level, scenario, step, status, msg, data }
 *
 * Levels: "info" | "pass" | "fail" | "skip" | "section" | "summary".
 * The runner colourises only when stdout is a TTY (jsc has no isatty so
 * we just skip colour by default).
 */

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m"
};

function makeLogger({ colour = false, sink = print } = {}) {
  const start = Date.now();
  const entries = [];
  let currentScenario = null;

  function colourise(level, text) {
    if (!colour) return text;
    if (level === "pass") return C.green + text + C.reset;
    if (level === "fail") return C.red + C.bold + text + C.reset;
    if (level === "skip") return C.yellow + text + C.reset;
    if (level === "section") return C.cyan + C.bold + text + C.reset;
    if (level === "summary") return C.bold + text + C.reset;
    return C.dim + text + C.reset;
  }

  function emit(entry) {
    entry.t = Date.now() - start;
    entries.push(entry);
    const tag = ({
      info: "·",
      pass: "PASS",
      fail: "FAIL",
      skip: "SKIP",
      section: "──",
      summary: "=="
    })[entry.level] || "?";
    const head = "[" + String(entry.t).padStart(5, " ") + "ms] " + tag;
    let line = head + " " + entry.msg;
    if (entry.data !== undefined) {
      try {
        line += " " + JSON.stringify(entry.data);
      } catch (e) {
        line += " [unserialisable]";
      }
    }
    sink(colourise(entry.level, line));
  }

  return {
    section(title) {
      currentScenario = title;
      emit({ level: "section", scenario: title, step: null, status: null, msg: "── " + title });
    },
    info(msg, data) {
      emit({ level: "info", scenario: currentScenario, step: null, status: null, msg, data });
    },
    pass(step, data) {
      emit({ level: "pass", scenario: currentScenario, step, status: "pass", msg: step, data });
    },
    fail(step, data) {
      emit({ level: "fail", scenario: currentScenario, step, status: "fail", msg: step, data });
    },
    skip(step, reason) {
      emit({ level: "skip", scenario: currentScenario, step, status: "skip", msg: step, data: reason });
    },
    summary(msg, data) {
      emit({ level: "summary", scenario: null, step: null, status: null, msg, data });
    },
    entries() {
      return entries.slice();
    },
    counts() {
      const c = { pass: 0, fail: 0, skip: 0, total: 0 };
      for (const e of entries) {
        if (e.status === "pass") c.pass++;
        else if (e.status === "fail") c.fail++;
        else if (e.status === "skip") c.skip++;
        if (e.status) c.total++;
      }
      return c;
    }
  };
}

globalThis.__cbTestLog = { makeLogger };
