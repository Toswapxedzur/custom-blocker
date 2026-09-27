# Local File Manual Test Pack

Run this in a new Custom group named `Local File Check`. Keep the group enabled.

## Setup

1. In the extension, open **Settings > Local File Folder** and choose an empty folder.
2. In Mac Vault, open **Settings > Local File Folder**, choose an empty folder, and reveal it.
3. Paste the rule below and press **Run**. It starts on the next "tick" (every second) in both
   the browser and Mac Vault: the file actions are shared, so one rule serves both engines.

## Rule (browser and Mac Vault)

```js
(on, v) => {
  on("tick", () => {
    if (v.state.started) return;
    v.state.started = true;
    v.file("read", "../private.txt"); // outside the folder: refused
    v.file("write", "local-file-proof/journal.txt", "line-one\n");
    v.file("write", "local-file-proof/state.json", { program: "rule", checked: true });
    v.file("exists", "local-file-proof/missing.txt");
  });

  on("file", (ev) => {
    const r = ev.data;
    if (!r.ok) {
      v.log("local-file refused", r.op, r.path, r.error);
      return;
    }
    v.log("local-file result", r.op, r.path);
    if (r.op === "write" && r.path === "local-file-proof/journal.txt") {
      v.file("append", "local-file-proof/journal.txt", "line-two\n");
    } else if (r.op === "append") {
      v.file("read", "local-file-proof/journal.txt");
    } else if (r.op === "write" && r.path === "local-file-proof/state.json") {
      v.file("read", "local-file-proof/state.json");
    } else if (r.op === "read" && r.path.endsWith(".json")) {
      const value = JSON.parse(r.text);
      v.log("local-file JSON", value.program, value.checked);
      v.file("list", "local-file-proof");
    } else if (r.op === "read") {
      v.log("local-file journal", r.text);
    } else if (r.op === "list") {
      v.log("local-file entries", (r.entries || []).map((entry) => entry.name + ":" + entry.kind).join(", "));
    } else if (r.op === "exists") {
      v.log("local-file missing exists", r.exists);
    }
  });
}
```

Wait two seconds after Run. The chosen folder should contain `local-file-proof/journal.txt` with two
lines and `local-file-proof/state.json` with the JSON object. The Log should show the JSON object, both
journal lines, the folder entries and `missing exists false`.

## Safety Check

The only refused request is the one outside the folder: the Log shows `local-file refused read
../private.txt` with the broker's error. Nothing is written outside the chosen folder.
