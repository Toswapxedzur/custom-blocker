/* In-memory integration checks for the extension local-folder broker. */

const fs = require("fs");
const vm = require("vm");

const sandboxFrame = {
  contentWindow: { postMessage() {} },
  getAttribute() { return "event-sandbox.html"; }
};

const context = {
  TextEncoder,
  console,
  document: { getElementById() { return sandboxFrame; } },
  setInterval() { return 0; },
  clearInterval() {},
  chrome: {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage() { return Promise.resolve(); },
      getURL(path) { return "chrome-extension://test/" + path; }
    },
    storage: {}
  }
};
context.globalThis = context;
context.self = context;
context.window = context;
context.window.addEventListener = () => {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("offscreen.js", "utf8"), context, { filename: "offscreen.js" });

let passed = 0;
let failed = 0;

function check(name, condition, details) {
  if (condition) {
    passed += 1;
    console.log("PASS " + name);
    return;
  }
  failed += 1;
  console.log("FAIL " + name + " " + JSON.stringify(details || {}));
}

class MemoryFileHandle {
  constructor(content = "") {
    this.kind = "file";
    this.content = content;
  }

  async getFile() {
    return {
      size: Buffer.byteLength(this.content, "utf8"),
      text: async () => this.content
    };
  }

  async createWritable() {
    return {
      write: async (text) => {
        this.content = String(text);
      },
      close: async () => {}
    };
  }
}

class MemoryDirectoryHandle {
  constructor() {
    this.kind = "directory";
    this.directories = new Map();
    this.files = new Map();
  }

  async getDirectoryHandle(name, options = {}) {
    if (this.directories.has(name)) return this.directories.get(name);
    if (!options.create) throw new Error("directory-not-found");
    const directory = new MemoryDirectoryHandle();
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(name, options = {}) {
    if (this.files.has(name)) return this.files.get(name);
    if (!options.create) throw new Error("file-not-found");
    const file = new MemoryFileHandle();
    this.files.set(name, file);
    return file;
  }

  async *entries() {
    for (const entry of this.directories) yield entry;
    for (const entry of this.files) yield entry;
  }
}

async function main() {
  const root = new MemoryDirectoryHandle();
  const broker = {
    getRoot: async () => root,
    getPermission: async () => "granted"
  };
  const request = (action, path, extra = {}) => context.handleLocalFileRequest({
    action,
    path,
    requestId: "test-" + action + "-" + path,
    ...extra
  }, broker);

  let result = await request("write", "notes/focus.txt", { text: "start" });
  check("B1 write succeeds", result.ok && result.eventName === "write" && result.bytes === 5, result);

  result = await request("append", "notes/focus.txt", { text: "+more" });
  check("B2 append replaces atomically with combined text", result.ok && result.eventName === "append" && result.bytes === 10, result);

  result = await request("read", "notes/focus.txt");
  check("B3 read returns text and byte count", result.ok && result.text === "start+more" && result.bytes === 10, result);

  result = await request("writeJson", "config/focus.json", { value: { enabled: true, limit: 25 } });
  check("B4 writeJson serializes a JSON value", result.ok && result.eventName === "write", result);

  result = await request("readJson", "config/focus.json");
  check("B5 readJson restores a JSON value", result.ok && result.eventName === "read" && result.value.enabled === true && result.value.limit === 25, result);

  result = await request("exists", "config/missing.json");
  check("B6 exists returns false for an absent supported file", result.ok && result.eventName === "exists" && result.exists === false, result);

  result = await request("list", "");
  check("B7 list exposes typed, sorted directory entries",
    result.ok && result.entries.length === 2 && result.entries[0].kind === "directory" && result.entries[0].name === "config"
      && result.entries[1].kind === "directory" && result.entries[1].name === "notes", result);

  const invalidPaths = ["../private.txt", "/tmp/private.txt", ".hidden.txt", "notes/focus.md", "https://example.com/file.txt"];
  for (const path of invalidPaths) {
    result = await request("read", path);
    check("B8 rejects " + path, result.ok === false && result.eventName === "error", result);
  }

  result = await request("write", "notes/large.txt", { text: "x".repeat(1024 * 1024 + 1) });
  check("B9 rejects files over one megabyte", result.ok === false && result.error === "file-too-large", result);

  console.log("LOCAL FOLDER BROKER TOTAL " + (passed + failed) + " PASS " + passed + " FAIL " + failed);
  if (failed > 0) {
    console.log("__CB_TEST_RESULT__: FAIL");
    process.exitCode = 1;
    return;
  }
  console.log("__CB_TEST_RESULT__: OK");
}

main().catch((error) => {
  console.error(error);
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
});
