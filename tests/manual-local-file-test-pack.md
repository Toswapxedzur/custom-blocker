# Local File Manual Test Pack

Run this in a new Custom group named `Local File Check`. Keep the group enabled.

## Setup

1. In the extension, open **Settings > Local File Folder** and choose an empty folder.
2. In the macOS or Windows app, open **Settings > Local File Folder** and reveal the managed folder. It should be empty before the test.
3. Paste the matching rule below and press **Run**. Extension rules need one navigation after Run; native rules begin on the next tick.

## Extension Rule

```js
(events) => {
  events.on("webChangedEvent", "start-local-file-check", (ev, h) => {
    const state = h.getPersistenceHelper();
    if (state.get("started", false)) return;
    state.set("started", true);

    const files = h.getLocalFolderHelper();
    h.log("local-file unsafe request blocked", files.requestRead("../private.txt") === "");
    files.requestWrite("local-file-proof/journal.txt", "line-one\n");
    files.requestWriteJson("local-file-proof/state.json", { program: "extension", checked: true });
    files.requestExists("local-file-proof/missing.txt");
  });

  events.on("localFileEvent", "verify-local-file-check", (ev, h) => {
    const files = h.getLocalFolderHelper();
    const state = h.getPersistenceHelper();
    if (!ev.ok) {
      h.error("local-file failed", ev.action, ev.path, ev.error);
      return;
    }

    h.log("local-file result", ev.action, ev.path, ev.eventName, ev.bytes);
    if (ev.action === "write" && ev.path === "local-file-proof/journal.txt") {
      files.requestAppend("local-file-proof/journal.txt", "line-two\n");
    } else if (ev.action === "writeJson") {
      files.requestReadJson("local-file-proof/state.json");
    } else if (ev.action === "append") {
      files.requestRead("local-file-proof/journal.txt");
    } else if (ev.action === "read") {
      h.log("local-file journal", ev.text);
    } else if (ev.action === "readJson") {
      h.log("local-file JSON", ev.value.program, ev.value.checked);
      if (!state.get("listed", false)) {
        state.set("listed", true);
        files.requestList("local-file-proof");
      }
    } else if (ev.action === "list") {
      h.log("local-file entries", ev.entries.map((entry) => entry.name + ":" + entry.kind).join(", "));
    } else if (ev.action === "exists") {
      h.log("local-file missing exists", ev.exists);
    }
  });
}
```

After Run, navigate once in a normal tab. The selected folder should contain `local-file-proof/journal.txt` with two lines and `local-file-proof/state.json` with the JSON object.

## macOS and Windows Rule

```js
(event) => {
  event.registerTickEvent("start-local-file-check", (ev, h) => {
    const state = h.getPersistenceHelper();
    if (state.get("started", false)) return;
    state.set("started", true);

    const files = h.getLocalFolderHelper();
    h.log("local-file unsafe request blocked", files.requestRead("../private.txt") === "");
    files.requestWrite("local-file-proof/journal.txt", "line-one\n");
    files.requestWriteJson("local-file-proof/state.json", { program: "native", checked: true });
    files.requestExists("local-file-proof/missing.txt");
  });

  event.registerLocalFileEvent("verify-local-file-check", (ev, h) => {
    const files = h.getLocalFolderHelper();
    const state = h.getPersistenceHelper();
    if (!ev.ok) {
      h.error("local-file failed", ev.action, ev.path, ev.error);
      return;
    }

    h.log("local-file result", ev.action, ev.path, ev.eventName, ev.bytes);
    if (ev.action === "write" && ev.path === "local-file-proof/journal.txt") {
      files.requestAppend("local-file-proof/journal.txt", "line-two\n");
    } else if (ev.action === "writeJson") {
      files.requestReadJson("local-file-proof/state.json");
    } else if (ev.action === "append") {
      files.requestRead("local-file-proof/journal.txt");
    } else if (ev.action === "read") {
      h.log("local-file journal", ev.text);
    } else if (ev.action === "readJson") {
      h.log("local-file JSON", ev.value.program, ev.value.checked);
      if (!state.get("listed", false)) {
        state.set("listed", true);
        files.requestList("local-file-proof");
      }
    } else if (ev.action === "list") {
      h.log("local-file entries", ev.entries.map((entry) => entry.name + ":" + entry.kind).join(", "));
    } else if (ev.action === "exists") {
      h.log("local-file missing exists", ev.exists);
    }
  });
}
```

Wait two seconds after Run, then reveal the managed folder. It should contain the same two files. The log should report the JSON object, both journal lines, the folder entries, `missing exists false`, and `unsafe request blocked true`.

## Safety Check

The Log should never show `local-file failed` for the normal flow. The only intentionally unsafe path is rejected by the helper before it creates a request, which is why it reports `unsafe request blocked true` instead of a filesystem error.
