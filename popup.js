const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";
const GLOBAL_SETTINGS_KEY = "globalSettings";
const LAYOUT_WIDTH_STORAGE_KEY = "custom-blocker-groups-panel-width";
const LANGUAGE_STORAGE_KEY = "custom-blocker-language";
const AI_PROMPT_STORAGE_PREFIX = "custom-blocker-ai-prompt:";
const GROUP_TRANSFER_PREFIX = "custom-blocker-group:v1:";
const LOCAL_FOLDER_DB_NAME = "custom-blocker-local-folder";
const LOCAL_FOLDER_DB_VERSION = 1;
const LOCAL_FOLDER_STORE = "handles";
const LOCAL_FOLDER_ROOT_KEY = "root";
const LOCAL_FOLDER_META_KEY = "metadata";

// Debug-mode-gated console helpers. Mirror the implementation in
// background.js / content.js / event-sandbox.js so every context has
// the same surface and they're all silent by default.
let cbDebugMode = false;
function cbDebugLog(...args) { if (cbDebugMode) { try { console.log(...args); } catch (_) {} } }
function cbDebugWarn(...args) { if (cbDebugMode) { try { console.warn(...args); } catch (_) {} } }
function cbDebugError(...args) { if (cbDebugMode) { try { console.error(...args); } catch (_) {} } }

// Extension-wide preferences. Keep these defaults in sync with the
// placeholder text in popup.html's Settings modal.
// Web-app bridge (connection) defaults. The macOS app is the only endpoint
// that can host the local hub (a browser extension cannot listen on a socket),
// so `server*` fields are honored only on the native host and `client*` fields
// only in the browser extensions. Both are persisted in globalSettings so the
// transport layer (background service worker / native server) can read them.
const CONNECTION_PROTOCOL_VERSION = 1;
const CONNECTION_DEFAULT_PORT = 8787;
const CONNECTION_DEFAULT_ADDRESS = `ws://127.0.0.1:${CONNECTION_DEFAULT_PORT}`;
const DEFAULT_CONNECTION_SETTINGS = {
  // macOS hub
  serverEnabled: false,
  // browser client
  clientEnabled: false
};

const DEFAULT_GLOBAL_SETTINGS = {
  tickRateMs: 1000,
  autosaveDebounceMs: 400,
  // Debug mode is off by default. When on it (a) shows the on-page
  // debug log overlay for custom rules and (b) emits the
  // [CustomBlocker:trace] / [CustomBlocker] dispatch console lines.
  // The user-facing helpers.log() output continues to flow regardless.
  debugMode: false,
  showOnPageLogToasts: true,
  defaultSnoozeMinutes: 30,
  defaultFallbackUrl: "about:blank",
  connection: { ...DEFAULT_CONNECTION_SETTINGS }
};
const TICK_RATE_MIN_MS = 250;
const TICK_RATE_MAX_MS = 60_000;
const AUTOSAVE_DEBOUNCE_MAX_MS = 5_000;

// True when running inside the macOS app's WKWebView (the native chrome shim),
// false in a real browser extension. Used to decide whether this endpoint is
// the connection HUB (macOS, hosts the server) or a CLIENT (browser).
function isNativeHost() {
  try {
    return !!(window.chrome && window.chrome.__cbShim);
  } catch (_) {
    return false;
  }
}

// Stable identifier for this endpoint's "program", shown in the per-group
// connection panel's program picker (macapp / chrome / edge / firefox / ...).
function detectProgramId() {
  if (isNativeHost()) return "macapp";
  let ua = "";
  try {
    ua = navigator.userAgent || "";
  } catch (_) {}
  if (/\bEdg\//.test(ua)) return "edge";
  if (/\bFirefox\//.test(ua)) return "firefox";
  if (/\bOPR\//.test(ua) || /\bOpera\//.test(ua)) return "opera";
  if (/\bChrome\//.test(ua)) return "chrome";
  if (/\bSafari\//.test(ua)) return "safari";
  return "browser";
}

const LOCAL_PROGRAM_ID = detectProgramId();
const IS_CONNECTION_HUB = isNativeHost();

const DEFAULT_ALLOWED_MINUTES = 15;
const DEFAULT_RESET_INTERVAL_HOURS = 24;
const DEFAULT_STRICT_FREEZE_HOURS = 24;
const DEFAULT_SNOOZE_MINUTES = 30;
const DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES = 0;
const DEFAULT_SNOOZE_COOLDOWN_MINUTES = 0;
const DEFAULT_GROUP_TYPE = "site";
const MAX_STRICT_FREEZE_HOURS = 72;
const MAX_SNOOZE_COOLDOWN_MINUTES = 5;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const UNFREEZE_CONFIRMATIONS_REQUIRED = 1;
const UNFREEZE_CONFIRMATION_INTERVAL_MS = 5000;
const DEFAULT_SNOOZE_CONFIRMATIONS = 0;
const MIN_GROUP_PANEL_WIDTH = 260;
const MAX_GROUP_PANEL_WIDTH = 760;
const DAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const layout = document.getElementById("layout");
const layoutResizer = document.getElementById("layoutResizer");
const groupList = document.getElementById("groupList");
const bulkActionNotice = document.getElementById("bulkActionNotice");
const languageSelect = document.getElementById("languageSelect");
const siteAccessBanner = document.getElementById("siteAccessBanner");
const siteAccessGrantButton = document.getElementById("siteAccessGrantButton");
const siteAccessDismissButton = document.getElementById("siteAccessDismissButton");
const manualButton = document.getElementById("manualButton");
const addGroupTypeField = document.getElementById("addGroupType");
const addGroupButton = document.getElementById("addGroupButton");
const deleteAllGroupsButton = document.getElementById("deleteAllGroupsButton");
const deleteGroupButton = document.getElementById("deleteGroupButton");
const exportGroupButton = document.getElementById("exportGroupButton");
const importGroupButton = document.getElementById("importGroupButton");
const editorCopy = document.getElementById("editorCopy");
const groupNameField = document.getElementById("groupName");
const groupEnabledField = document.getElementById("groupEnabled");
const groupTypeSummary = document.getElementById("groupTypeSummary");
const blockModeSection = document.getElementById("blockModeSection");
const blockModeField = document.getElementById("blockMode");
const timedSettings = document.getElementById("timedSettings");
const allowedMinutesRow = document.getElementById("allowedMinutesRow");
const allowedMinutesField = document.getElementById("allowedMinutes");
const resetIntervalHoursField = document.getElementById("resetIntervalHours");
const usageSummary = document.getElementById("usageSummary");
const scheduleSection = document.getElementById("scheduleSection");
const daysGrid = document.getElementById("daysGrid");
const scheduleWindowsField = document.getElementById("scheduleWindows");
const customSettingsCard = document.getElementById("customSettingsCard");
const blockingRulesEditor = document.getElementById("blockingRulesEditor");
const blockingRulesHighlight = document.getElementById("blockingRulesHighlight");
const blockingRulesField = document.getElementById("blockingRules");
const blockingRulesLint = document.getElementById("blockingRulesLint");
const openRuleTemplatesButton = document.getElementById("openRuleTemplatesButton");
const platformRulesCard = document.getElementById("platformRulesCard");
const platformVideoCard = document.getElementById("platformVideoFields");
const platformVideoTitle = document.getElementById("platformRulesTitle");
const platformVideoCopy = document.getElementById("platformRulesCopy");
const platformVideoModeRow = document.getElementById("platformVideoModeRow");
const platformVideoModeHelp = document.getElementById("platformVideoModeHelp");
const platformVideoModeLabel = document.getElementById("platformVideoModeLabel");
const platformVideoModeField = document.getElementById("platformVideoMode");
const platformVideoModeAllOption = platformVideoModeField.querySelector('option[value="all"]');
const platformVideoModeShortOption = platformVideoModeField.querySelector('option[value="short"]');
const platformVideoModeLongOption = platformVideoModeField.querySelector('option[value="long"]');
const platformVideoModePostOption = platformVideoModeField.querySelector('option[value="post"]');
const platformAuthorModeLabel = document.getElementById("platformAuthorModeLabel");
const platformAuthorModeField = document.getElementById("platformAuthorMode");
const platformAuthorModeHelp = document.getElementById("platformAuthorModeHelp");
const platformAuthorsBlock = document.getElementById("platformAuthorsBlock");
const platformAuthorsLabel = document.getElementById("platformAuthorsLabel");
const platformAuthorsField = document.getElementById("platformAuthors");
const platformVideoHelp = document.getElementById("platformVideoHelp");
const platformAuthorTagsBlock = document.getElementById("platformAuthorTagsBlock");
const platformAuthorTagsLabel = document.getElementById("platformAuthorTagsLabel");
const platformAuthorTagsField = document.getElementById("platformAuthorTags");
const platformAuthorTagsHelp = document.getElementById("platformAuthorTagsHelp");
const platformBlockHomePageField = document.getElementById("platformBlockHomePage");
const skipToNextOnBlockRow = document.getElementById("skipToNextOnBlockRow");
const skipToNextOnBlockField = document.getElementById("skipToNextOnBlock");
const redditSettingsCard = document.getElementById("redditFields");
const redditModeField = document.getElementById("redditMode");
const redditSubredditsField = document.getElementById("redditSubreddits");
const redditBlockHomePageField = document.getElementById("redditBlockHomePage");
const discordSettingsCard = document.getElementById("discordFields");
const discordModeField = document.getElementById("discordMode");
const discordTargetsField = document.getElementById("discordTargets");
const discordBlockHomePageField = document.getElementById("discordBlockHomePage");
const surfaceHidesSection = document.getElementById("surfaceHidesSection");
const surfaceHidesList = document.getElementById("surfaceHidesList");
const fallbackUrlSection = document.getElementById("fallbackUrlSection");
const fallbackUrlField = document.getElementById("fallbackUrl");
const groupEffectSection = document.getElementById("groupEffectSection");
const groupEffectField = document.getElementById("groupEffect");
const freezeSummary = document.getElementById("freezeSummary");
const freezeSetup = document.getElementById("freezeSetup");
const freezeModeField = document.getElementById("freezeMode");
const strictFreezeSettings = document.getElementById("strictFreezeSettings");
const strictFreezeHoursField = document.getElementById("strictFreezeHours");
const applyFreezeButton = document.getElementById("applyFreezeButton");
const unfreezeButton = document.getElementById("unfreezeButton");
const freezeBridgeNotice = document.getElementById("freezeBridgeNotice");
const parentalSettingsButton = document.getElementById("parentalSettingsButton");
const snoozeSummary = document.getElementById("snoozeSummary");
const allowSnoozeField = document.getElementById("allowSnooze");
const snoozeMinutesField = document.getElementById("snoozeMinutes");
const snoozeActivationDelayField = document.getElementById("snoozeActivationDelay");
const snoozeCooldownField = document.getElementById("snoozeCooldown");
const snoozeConfirmationsField = document.getElementById("snoozeConfirmations");
const snoozeWarning = document.getElementById("snoozeWarning");
const startSnoozeButton = document.getElementById("startSnoozeButton");
const endSnoozeButton = document.getElementById("endSnoozeButton");
const snoozeNumericFields = document.getElementById("snoozeNumericFields");
const snoozeCustomCopy = document.getElementById("snoozeCustomCopy");
const siteSettingsSection = document.getElementById("siteSettingsSection");
const blockedSitesField = document.getElementById("blockedSites");
const blockedSitesList = document.getElementById("blockedSitesList");
const siteAddPanel = document.getElementById("siteAddPanel");
const siteAddInput = document.getElementById("siteAddInput");
const siteAddConfirmButton = document.getElementById("siteAddConfirmButton");
const siteAddCancelButton = document.getElementById("siteAddCancelButton");
const clearSitesButton = document.getElementById("clearSitesButton");
const runCustomGroupButton = document.getElementById("runCustomGroupButton");
const checkSyntaxButton = document.getElementById("checkSyntaxButton");
const runCustomGroupStatus = document.getElementById("runCustomGroupStatus");
const aiPromptPanel = document.getElementById("aiPromptPanel");
const aiPromptInput = document.getElementById("aiPromptInput");
const aiPromptCopyButton = document.getElementById("aiPromptCopyButton");
const aiPromptStatus = document.getElementById("aiPromptStatus");
const editorTitle = document.getElementById("editorTitle");
const statusMessage = document.getElementById("statusMessage");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = confirmModal.querySelector("h3");
const confirmMessage = document.getElementById("confirmMessage");
const confirmProgress = document.getElementById("confirmProgress");
const confirmCancelButton = document.getElementById("confirmCancelButton");
const confirmProceedButton = document.getElementById("confirmProceedButton");
const manualModal = document.getElementById("manualModal");
const manualStatus = document.getElementById("manualStatus");
const manualContent = document.getElementById("manualContent");
const manualCloseButton = document.getElementById("manualCloseButton");
const templateModal = document.getElementById("templateModal");
const templateGrid = document.getElementById("templateGrid");
const templateStatus = document.getElementById("templateStatus");
const templateCloseButton = document.getElementById("templateCloseButton");
const templateFilterField = document.getElementById("templateFilter");
const templateApplyButton = document.getElementById("templateApplyButton");
const settingsButton = document.getElementById("settingsButton");
const settingsModal = document.getElementById("settingsModal");
const settingsCloseButton = document.getElementById("settingsCloseButton");
const settingsTickRateField = document.getElementById("settingsTickRate");
const settingsAutosaveDebounceField = document.getElementById("settingsAutosaveDebounce");
const settingsDebugModeField = document.getElementById("settingsDebugMode");
const settingsShowOnPageLogToastsField = document.getElementById("settingsShowOnPageLogToasts");
const settingsDefaultSnoozeMinutesField = document.getElementById("settingsDefaultSnoozeMinutes");
const settingsDefaultFallbackUrlField = document.getElementById("settingsDefaultFallbackUrl");
const localFolderChooseButton = document.getElementById("localFolderChooseButton");
const localFolderRevokeButton = document.getElementById("localFolderRevokeButton");
const localFolderStatus = document.getElementById("localFolderStatus");
const settingsResetButton = document.getElementById("settingsResetButton");
const settingsStatus = document.getElementById("settingsStatus");
const connectionSection = document.getElementById("connectionSection");
const connectionServerControls = document.getElementById("connectionServerControls");
const connectionClientControls = document.getElementById("connectionClientControls");
const connectionServerToggle = document.getElementById("connectionServerToggle");
const connectionConnectButton = document.getElementById("connectionConnectButton");
const connectionDisconnectButton = document.getElementById("connectionDisconnectButton");
const connectionStatusDot = document.getElementById("connectionStatusDot");
const connectionStatusText = document.getElementById("connectionStatusText");
const connectionAddressReadout = document.getElementById("connectionAddressReadout");
const connectionPeerList = document.getElementById("connectionPeerList");
const connectionGroupSection = document.getElementById("connectionGroupSection");
const connectionGroupHint = document.getElementById("connectionGroupHint");
const connectionGroupDisconnected = document.getElementById("connectionGroupDisconnected");
const connectionGroupConnected = document.getElementById("connectionGroupConnected");
const connectionGroupProgram = document.getElementById("connectionGroupProgram");
const connectionGroupConnectButton = document.getElementById("connectionGroupConnectButton");
const connectionGroupDisconnectButton = document.getElementById("connectionGroupDisconnectButton");
const connectionGroupMembers = document.getElementById("connectionGroupMembers");
const dayCheckboxes = Array.from(daysGrid.querySelectorAll('input[type="checkbox"]'));

const state = {
  groups: [],
  usageTimersMs: {},
  usageResetAtMs: {},
  groupSnoozes: {},
  groupSnoozeTotalsMs: {},
  globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
  isSettingsOpen: false,
  selectedGroupId: null,
  draggedGroupId: null,
  dragInsertIndex: null,
  suppressGroupClickUntil: 0,
  drafts: {},
  autosaveTimeoutId: null,
  statusTimeoutId: null,
  tickIntervalId: null,
  confirmIntervalId: null,
  unfreezeFlow: null,
  isManualOpen: false,
  isTemplateOpen: false,
  manualCache: {},
  selectedTemplateId: null,
  templateFilterTags: [],
  templateDrafts: {},
  suppressGroupStorageUpdatesUntil: 0,
  panelWidth: 300,
  aiPromptGroupId: null,
  language: "en",
  translationMessages: {},
  translationLoadPromises: {},
  // Runtime web-app bridge status, pushed by the transport layer (background
  // service worker in the browser, native server on macOS). Never persisted.
  connectionStatus: {
    running: false,
    state: "off",
    address: "",
    peers: [],
    error: ""
  },
  // Live web-app bridge clusters that involve this endpoint, supplied by the
  // transport layer (hub is the single source of truth). Never persisted: a
  // group is "connected" when a cluster lists {program: LOCAL_PROGRAM_ID,
  // groupName: <this group's name>}. Each entry:
  //   { id, groupName, groupType, members: [{ program, groupName }], shared }
  clusters: [],
  // Read-only mirror of the shared pools per clustered group:
  //   { [groupId]: { sites: [...], apps: [...] } }
  clusterMirror: {},
  // Hub's shared cumulative snooze total per clustered group (display only). We
  // show max(local total, this) so the figure reflects snoozes accrued on any
  // member without merging into — and thus double-counting — the local counter.
  clusterSnoozeTotalsMs: {},
  // Last contribution JSON we sent per group, so we don't echo applied state
  // back to the hub (loop suppression mirrors the hub's broadcast-on-change).
  clusterSyncSent: {},
  // Logical edit timestamp per group, used for scalar last-writer-wins.
  groupEditTs: {},
  // Group ids whose next sync should win the merge (the initiator of a link).
  pendingPriorityGroups: new Set(),
  // Serialized last-applied cluster list, so repeated identical pushes (the Mac
  // hub re-pushes every second) don't trigger needless re-renders.
  clustersLastJSON: ""
};

function getAiPromptStorageKey(groupId) {
  return `${AI_PROMPT_STORAGE_PREFIX}${groupId}`;
}

function loadAiPromptDraft(groupId) {
  try {
    return window.localStorage.getItem(getAiPromptStorageKey(groupId)) || "";
  } catch {
    return "";
  }
}

function saveAiPromptDraft(groupId, value) {
  try {
    const key = getAiPromptStorageKey(groupId);
    const text = String(value ?? "");
    if (text) {
      window.localStorage.setItem(key, text);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

function getTranslationsConfig() {
  return window.CUSTOM_BLOCKER_I18N ?? {
    defaultLanguage: "en",
    translationDirectory: "translation",
    languages: {
      en: {
        label: "English",
        nativeLabel: "English"
      }
    }
  };
}

function getAvailableLanguages() {
  return getTranslationsConfig().languages;
}

function getDefaultLanguageCode() {
  const configured = getTranslationsConfig().defaultLanguage;
  return getAvailableLanguages()[configured] ? configured : "en";
}

function getTranslationDirectory() {
  const directory = getTranslationsConfig().translationDirectory;
  return typeof directory === "string" && directory ? directory : "translation";
}

async function fetchLanguageMessages(languageCode) {
  const response = await fetch(
    chrome.runtime.getURL(`${getTranslationDirectory()}/${languageCode}.json`)
  );

  if (!response.ok) {
    throw new Error(`Missing translation file for language: ${languageCode}`);
  }

  const parsed = await response.json();
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function ensureLanguageMessages(languageCode) {
  if (state.translationMessages[languageCode]) {
    return state.translationMessages[languageCode];
  }

  if (state.translationLoadPromises[languageCode]) {
    return state.translationLoadPromises[languageCode];
  }

  const loadPromise = (async () => {
    try {
      const messages = await fetchLanguageMessages(languageCode);
      state.translationMessages[languageCode] = messages;
      return messages;
    } finally {
      delete state.translationLoadPromises[languageCode];
    }
  })();

  state.translationLoadPromises[languageCode] = loadPromise;
  return loadPromise;
}

function t(key, vars = {}) {
  const selected = state.translationMessages[state.language] ?? {};
  const fallback = state.translationMessages[getDefaultLanguageCode()] ?? {};
  const template = selected[key] ?? fallback[key] ?? key;
  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  );
}

function loadLanguage() {
  const defaultLanguage = getDefaultLanguageCode();
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && getAvailableLanguages()[stored]) {
      return stored;
    }
  } catch {}

  const browserLanguage = (navigator.language || defaultLanguage).toLowerCase().split("-")[0];
  return getAvailableLanguages()[browserLanguage] ? browserLanguage : defaultLanguage;
}

// `escapeHtml`, `renderInlineMarkdown`, and `renderMarkdownToHtml` live
// in [popup-markdown.js](popup-markdown.js) so the test harness can
// load them under jsc without dragging the whole DOM-bound popup along.
// popup.html includes that script before this one.

async function fetchManualMarkdown(languageCode) {
  const candidates = languageCode === "en" ? ["en"] : [languageCode, "en"];

  for (const candidate of candidates) {
    if (state.manualCache[candidate]) {
      return state.manualCache[candidate];
    }

    try {
      const response = await fetch(chrome.runtime.getURL(`manual/${candidate}.md`));

      if (!response.ok) {
        continue;
      }

      const markdown = await response.text();
      state.manualCache[candidate] = markdown;
      return markdown;
    } catch {}
  }

  throw new Error(t("manual.error"));
}

async function loadManualContent() {
  manualStatus.textContent = t("manual.loading");
  manualContent.innerHTML = "";

  try {
    const markdown = await fetchManualMarkdown(state.language);
    manualStatus.textContent = "";
    let html = renderMarkdownToHtml(markdown);
    // Non-English manuals are machine-translated. Surface that up-front
    // so a reader does not mistake an MT artefact for an authoritative
    // statement. The banner itself is localized via the standard
    // translation pipeline.
    if (state.language && state.language !== "en") {
      const bannerText = escapeHtml(t("manual.mtBanner"));
      html = `<blockquote class="mt-banner">${bannerText}</blockquote>${html}`;
    }
    manualContent.innerHTML = html;
  } catch (error) {
    manualStatus.textContent = error?.message || t("manual.error");
    manualContent.innerHTML = "";
  }
}

function openManual() {
  state.isManualOpen = true;
  manualModal.classList.remove("hidden");
  loadManualContent().catch((error) => {
    manualStatus.textContent = error?.message || t("manual.error");
  });
}

function closeManual() {
  state.isManualOpen = false;
  manualModal.classList.add("hidden");
}

function openLocalFolderDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_FOLDER_DB_NAME, LOCAL_FOLDER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_FOLDER_STORE)) {
        db.createObjectStore(LOCAL_FOLDER_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local folder storage."));
  });
}

async function localFolderDbGet(key) {
  const db = await openLocalFolderDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FOLDER_STORE, "readonly");
    const request = tx.objectStore(LOCAL_FOLDER_STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read local folder storage."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      try { db.close(); } catch (_) {}
      reject(tx.error || new Error("Could not read local folder storage."));
    };
  });
}

async function localFolderDbSet(key, value) {
  const db = await openLocalFolderDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FOLDER_STORE, "readwrite");
    tx.objectStore(LOCAL_FOLDER_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      try { db.close(); } catch (_) {}
      reject(tx.error || new Error("Could not write local folder storage."));
    };
  });
}

async function localFolderDbDelete(key) {
  const db = await openLocalFolderDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FOLDER_STORE, "readwrite");
    tx.objectStore(LOCAL_FOLDER_STORE).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      try { db.close(); } catch (_) {}
      reject(tx.error || new Error("Could not delete local folder storage."));
    };
  });
}

async function renderLocalFolderStatus() {
  if (!localFolderStatus) return;
  if (!("showDirectoryPicker" in window)) {
    localFolderStatus.textContent = t("settings.localFolderUnsupported");
    if (localFolderChooseButton) localFolderChooseButton.disabled = true;
    if (localFolderRevokeButton) localFolderRevokeButton.disabled = true;
    return;
  }
  if (localFolderChooseButton) localFolderChooseButton.disabled = false;
  try {
    const handle = await localFolderDbGet(LOCAL_FOLDER_ROOT_KEY);
    const metadata = await localFolderDbGet(LOCAL_FOLDER_META_KEY);
    if (!handle || handle.kind !== "directory") {
      localFolderStatus.textContent = t("settings.localFolderStatusNone");
      if (localFolderRevokeButton) localFolderRevokeButton.disabled = true;
      return;
    }
    if (localFolderRevokeButton) localFolderRevokeButton.disabled = false;
    const name = handle.name || metadata?.name || t("settings.localFolderUnknownName");
    let permission = "granted";
    if (typeof handle.queryPermission === "function") {
      permission = await handle.queryPermission({ mode: "readwrite" });
    }
    if (permission === "granted") {
      localFolderStatus.textContent = t("settings.localFolderStatusConnected").replace("{name}", name);
    } else {
      localFolderStatus.textContent = t("settings.localFolderStatusNeedsPermission").replace("{name}", name);
    }
  } catch (error) {
    localFolderStatus.textContent = String(error?.message ?? error);
    if (localFolderRevokeButton) localFolderRevokeButton.disabled = true;
  }
}

async function chooseLocalFolder() {
  if (!("showDirectoryPicker" in window)) {
    if (localFolderStatus) localFolderStatus.textContent = t("settings.localFolderUnsupported");
    return;
  }
  if (localFolderStatus) localFolderStatus.textContent = t("settings.localFolderChoosing");
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    let permission = "granted";
    if (typeof handle.requestPermission === "function") {
      permission = await handle.requestPermission({ mode: "readwrite" });
    }
    if (permission !== "granted") {
      throw new Error(t("settings.localFolderPermissionDenied"));
    }
    await localFolderDbSet(LOCAL_FOLDER_ROOT_KEY, handle);
    await localFolderDbSet(LOCAL_FOLDER_META_KEY, {
      name: handle.name || "",
      grantedAt: Date.now()
    });
    await renderLocalFolderStatus();
  } catch (error) {
    if (localFolderStatus) {
      localFolderStatus.textContent = error?.name === "AbortError"
        ? t("settings.localFolderStatusNone")
        : String(error?.message ?? error);
    }
  }
}

async function revokeLocalFolder() {
  await localFolderDbDelete(LOCAL_FOLDER_ROOT_KEY);
  await localFolderDbDelete(LOCAL_FOLDER_META_KEY);
  await renderLocalFolderStatus();
}

function getConnectionSettings() {
  const s = state.globalSettings || DEFAULT_GLOBAL_SETTINGS;
  return sanitizeConnectionSettings(s.connection);
}

// Persist a partial change to the connection block of globalSettings, then ask
// the transport layer to apply it. Used by the server toggle / connect buttons.
async function updateConnectionSettings(patch) {
  const current = getConnectionSettings();
  const next = sanitizeConnectionSettings({ ...current, ...patch });
  state.globalSettings = sanitizeGlobalSettings({
    ...(state.globalSettings || DEFAULT_GLOBAL_SETTINGS),
    connection: next
  });
  try {
    await chrome.storage.local.set({ [GLOBAL_SETTINGS_KEY]: state.globalSettings });
  } catch (_) {}
  return next;
}

function connectionStatusLabel(status) {
  switch (status && status.state) {
    case "running":
      return t("connection.statusRunning");
    case "connected":
      return t("connection.statusConnected");
    case "connecting":
      return t("connection.statusConnecting");
    case "error":
      return status.error
        ? t("connection.statusError") + ": " + status.error
        : t("connection.statusError");
    case "disconnected":
      return t("connection.statusDisconnected");
    default:
      return t("connection.statusOff");
  }
}

function renderConnectionSettings() {
  if (!connectionSection) return;
  const conn = getConnectionSettings();
  const status = state.connectionStatus || {};

  if (connectionServerControls) {
    connectionServerControls.classList.toggle("hidden", !IS_CONNECTION_HUB);
  }
  if (connectionClientControls) {
    connectionClientControls.classList.toggle("hidden", IS_CONNECTION_HUB);
  }

  if (IS_CONNECTION_HUB) {
    if (connectionServerToggle) connectionServerToggle.checked = Boolean(conn.serverEnabled);
  } else {
    const connected = status.state === "connected" || status.state === "connecting";
    if (connectionConnectButton) connectionConnectButton.classList.toggle("hidden", connected);
    if (connectionDisconnectButton)
      connectionDisconnectButton.classList.toggle("hidden", !connected);
  }

  const activeState = status.state || "off";
  if (connectionStatusDot) {
    connectionStatusDot.className = "connection-dot " + activeState;
  }
  if (connectionStatusText) {
    connectionStatusText.textContent = connectionStatusLabel(status);
  }
  if (connectionAddressReadout) {
    connectionAddressReadout.textContent = status.address || CONNECTION_DEFAULT_ADDRESS;
  }

  if (connectionPeerList) {
    connectionPeerList.textContent = "";
    const peers = Array.isArray(status.peers) ? status.peers : [];
    if (peers.length === 0) {
      const empty = document.createElement("p");
      empty.className = "field-help";
      empty.textContent = t("connection.noPeers");
      connectionPeerList.appendChild(empty);
    } else {
      for (const peer of peers) {
        const row = document.createElement("div");
        row.className = "connection-peer";
        const dot = document.createElement("span");
        dot.className = "connection-dot " + (peer.connected ? "connected" : "off");
        const label = document.createElement("span");
        label.textContent = peer.program || peer.id || "?";
        row.appendChild(dot);
        row.appendChild(label);
        connectionPeerList.appendChild(row);
      }
    }
  }
}

// The transport layer pushes the live connection status here (native server on
// macOS via window.__cbConnectionState, background worker in the browser).
function applyConnectionStatus(raw) {
  const incoming = raw && typeof raw === "object" ? raw : {};
  const wasOnline = bridgeIsOnline();
  state.connectionStatus = {
    running: Boolean(incoming.running),
    state: typeof incoming.state === "string" ? incoming.state : "off",
    address: typeof incoming.address === "string" ? incoming.address : "",
    peers: Array.isArray(incoming.peers) ? incoming.peers : [],
    error: typeof incoming.error === "string" ? incoming.error : ""
  };
  if (state.isSettingsOpen) renderConnectionSettings();
  // The per-group panel lives in the editor (always visible), so keep it fresh.
  refreshConnectionGroupPanel();
  if (!wasOnline && bridgeIsOnline()) {
    announceGroups();
    requestClusters();
  }
}

window.__cbConnectionState = function (json) {
  try {
    const incoming = typeof json === "string" ? JSON.parse(json) : json;
    applyConnectionStatus(incoming);
  } catch (_) {}
};

function requestConnectionStatus() {
  try {
    chrome.runtime
      .sendMessage({ type: "connection-status" })
      .then((res) => {
        if (res && res.status) applyConnectionStatus(res.status);
      })
      .catch(() => {});
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Per-group web-app bridge: link a Default/Custom group with the same-named
// group on another connected program (a "cluster"). The hub is the single
// source of truth for cluster membership; this layer only renders it and sends
// connect/disconnect intents.
// ---------------------------------------------------------------------------

const CONNECTION_PROGRAM_LABELS = {
  macapp: "Mac app",
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
  opera: "Opera",
  browser: "Browser"
};

function connectionProgramLabel(programId) {
  return CONNECTION_PROGRAM_LABELS[programId] || programId || "?";
}

function bridgeIsOnline() {
  const s = state.connectionStatus || {};
  return s.state === "connected" || s.state === "running";
}

function isBridgeEligibleGroup(group) {
  return Boolean(group) && (group.groupType === "site" || group.groupType === "custom");
}

// A cluster is "fully online" only when our own bridge link is live AND every
// member program reports online in the hub snapshot. When any member is offline
// the cluster's shared memory can't be reconciled, so we lock down actions that
// must not diverge while disconnected (notably freeze state changes).
function clusterAllOnline(cluster) {
  if (!cluster) return false;
  if (!bridgeIsOnline()) return false;
  if (cluster.allOnline === false) return false;
  const members = Array.isArray(cluster.members) ? cluster.members : [];
  if (members.length === 0) return false;
  return members.every((m) => m && m.online !== false);
}

// Offline member programs in this group's cluster (for the UI indicator).
function clusterOfflineMembers(cluster) {
  if (!cluster) return [];
  const members = Array.isArray(cluster.members) ? cluster.members : [];
  return members.filter((m) => {
    if (!m) return false;
    if (m.program === LOCAL_PROGRAM_ID) return false; // we are obviously here
    return m.online === false || !bridgeIsOnline();
  });
}

// The cluster (if any) this group currently belongs to, matched by this
// endpoint's program id + the group's saved name.
function groupConnectionCluster(group) {
  if (!group) return null;
  const clusters = Array.isArray(state.clusters) ? state.clusters : [];
  return (
    clusters.find((cluster) =>
      Array.isArray(cluster.members) &&
      cluster.members.some(
        (m) => m && m.program === LOCAL_PROGRAM_ID && m.groupName === group.name
      )
    ) || null
  );
}

// Programs the user can link to right now (other connected endpoints). A client
// is always implicitly connected to the Mac hub; the hub sees its peers.
function bridgeConnectablePrograms() {
  if (!bridgeIsOnline()) return [];
  const status = state.connectionStatus || {};
  const peers = Array.isArray(status.peers) ? status.peers : [];
  const programs = new Set();
  for (const peer of peers) {
    if (peer && peer.connected !== false && peer.program) programs.add(peer.program);
  }
  if (!IS_CONNECTION_HUB) programs.add("macapp");
  programs.delete(LOCAL_PROGRAM_ID);
  programs.delete("browser");
  programs.delete("");
  return Array.from(programs);
}

function renderConnectionGroupPanel(group, freezeStatus) {
  if (!connectionGroupSection) return;
  if (!isBridgeEligibleGroup(group)) {
    connectionGroupSection.classList.add("hidden");
    return;
  }
  connectionGroupSection.classList.remove("hidden");

  const cluster = groupConnectionCluster(group);
  connectionGroupSection.classList.toggle("bridge-linked", Boolean(cluster));

  if (connectionGroupConnected) connectionGroupConnected.classList.toggle("hidden", !cluster);
  if (connectionGroupDisconnected) connectionGroupDisconnected.classList.toggle("hidden", Boolean(cluster));

  if (cluster) {
    const allOnline = clusterAllOnline(cluster);
    connectionGroupSection.classList.toggle("bridge-offline", !allOnline);
    if (connectionGroupMembers) {
      connectionGroupMembers.textContent = "";
      const members = Array.isArray(cluster.members) ? cluster.members : [];
      for (const member of members) {
        const isSelf = member.program === LOCAL_PROGRAM_ID;
        // We always know our own side is present; remote members are online
        // only when the hub says so AND our link to the hub is live.
        const memberOnline = isSelf
          ? true
          : member.online !== false && bridgeIsOnline();
        const row = document.createElement("div");
        row.className = "connection-peer" + (memberOnline ? "" : " offline");
        const dot = document.createElement("span");
        dot.className = "connection-dot " + (memberOnline ? "connected" : "error");
        const label = document.createElement("span");
        const self = isSelf ? " (this app)" : "";
        const offlineTag = memberOnline ? "" : " — " + t("connectionGroup.memberOffline");
        label.textContent =
          connectionProgramLabel(member.program) + ": " + (member.groupName || group.name) + self + offlineTag;
        row.appendChild(dot);
        row.appendChild(label);
        connectionGroupMembers.appendChild(row);
      }
    }
    if (connectionGroupHint) {
      connectionGroupHint.textContent = allOnline ? "" : t("connectionGroup.clusterOffline");
    }
    return;
  }
  connectionGroupSection.classList.remove("bridge-offline");

  const online = bridgeIsOnline();
  const frozen = Boolean(freezeStatus && freezeStatus.isFrozen);
  const programs = bridgeConnectablePrograms();

  if (connectionGroupProgram) {
    const previous = connectionGroupProgram.value;
    connectionGroupProgram.textContent = "";
    for (const programId of programs) {
      const option = document.createElement("option");
      option.value = programId;
      option.textContent = connectionProgramLabel(programId);
      connectionGroupProgram.appendChild(option);
    }
    if (programs.includes(previous)) connectionGroupProgram.value = previous;
  }

  const disabled = !online || frozen || programs.length === 0;
  if (connectionGroupConnectButton) connectionGroupConnectButton.disabled = disabled;
  if (connectionGroupProgram) connectionGroupProgram.disabled = disabled;
  if (connectionGroupHint) {
    connectionGroupHint.textContent = !online
      ? t("connectionGroup.offline")
      : frozen
        ? t("connectionGroup.frozen")
        : programs.length === 0
          ? t("connectionGroup.noPrograms")
          : t("connectionGroup.ready");
  }
}

// For a clustered Default (site) group, renders the blocked-list type this
// endpoint does NOT own as a read-only, translucent mirror beside the editable
// list. Browsers own websites and mirror the shared apps; the Mac owns apps and
// mirrors the shared websites. Both platforms use the same chip styling so the
// linked group looks identical on either side.
function renderBridgeMirror(group) {
  const section = document.getElementById("bridgeMirrorSection");
  if (!section) return;
  const cluster = group ? groupConnectionCluster(group) : null;
  if (!group || group.groupType !== "site" || !cluster) {
    section.classList.add("hidden");
    return;
  }
  const shared = (cluster && cluster.shared) || state.clusterMirror[group.id] || {};
  const showApps = !bridgeOwnsApps(); // we own sites here, so mirror apps
  const items = showApps
    ? (Array.isArray(shared.apps) ? shared.apps : [])
    : (Array.isArray(shared.sites) ? shared.sites : []);

  const labelEl = document.getElementById("bridgeMirrorLabel");
  const hintEl = document.getElementById("bridgeMirrorHint");
  if (labelEl) {
    labelEl.textContent = showApps
      ? t("connectionGroup.mirrorApps")
      : t("connectionGroup.mirrorSites");
  }
  if (hintEl) {
    hintEl.textContent = showApps
      ? t("connectionGroup.mirrorAppsHint")
      : t("connectionGroup.mirrorSitesHint");
  }

  section.classList.remove("hidden");
  const list = document.getElementById("bridgeMirrorList");
  if (!list) return;
  list.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bridge-mirror-empty";
    empty.textContent = t("connectionGroup.mirrorEmpty");
    list.appendChild(empty);
    return;
  }
  for (const item of items) {
    const isObj = item && typeof item === "object";
    const name = typeof item === "string" ? item : (isObj && item.name) || "";
    if (!name) continue;
    const chip = document.createElement("div");
    chip.className = "bridge-mirror-chip";
    chip.setAttribute("role", "listitem");
    chip.title = name;

    // Icon: app mirrors carry a shared icon data URL from the owning Mac (fall
    // back to a monogram); site mirrors resolve a favicon locally where a helper
    // exists. Keeps the mirror visually consistent with the native lists.
    let iconEl = null;
    if (showApps) {
      const iconUrl = isObj && typeof item.icon === "string" ? item.icon : "";
      if (iconUrl) {
        iconEl = document.createElement("img");
        iconEl.className = "bridge-mirror-icon";
        iconEl.src = iconUrl;
        iconEl.alt = "";
      } else {
        iconEl = document.createElement("span");
        iconEl.className = "bridge-mirror-icon bridge-mirror-monogram";
        iconEl.textContent = name.charAt(0).toUpperCase();
      }
    } else if (typeof makeSiteIconElement === "function") {
      iconEl = makeSiteIconElement(name);
      iconEl.classList.add("bridge-mirror-icon");
    }
    if (iconEl) chip.appendChild(iconEl);

    const label = document.createElement("span");
    label.className = "bridge-mirror-name";
    label.textContent = name;
    chip.appendChild(label);

    list.appendChild(chip);
  }
}

function refreshConnectionGroupPanel() {
  const group = getSelectedGroup();
  const now = Date.now();
  renderConnectionGroupPanel(group, group ? getFreezeStatus(group, now) : null);
  renderBridgeMirror(group);
}

// Re-tag group cards with the bridge-linked cluster indicator without a full rebuild.
function updateGroupCardBridgeBadges() {
  const cards = groupList.querySelectorAll(".group-card");
  cards.forEach((card) => {
    const group = state.groups.find((g) => g.id === card.dataset.groupId);
    card.classList.toggle("bridge-connected", Boolean(group && groupConnectionCluster(group)));
  });
}

// One-shot bridge warnings: surface a notice the first time a condition occurs
// (e.g. a linked member goes offline) and reset it once the condition clears, so
// the user is warned once per episode instead of on every render tick.
const bridgeWarned = new Set();
function warnBridgeOnce(key, message) {
  if (bridgeWarned.has(key)) return;
  bridgeWarned.add(key);
  setStatus(message, true);
}
function clearBridgeWarn(key) {
  bridgeWarned.delete(key);
}

function applyClusters(list) {
  const incoming = Array.isArray(list) ? list : Array.isArray(list?.clusters) ? list.clusters : [];
  const incomingJSON = JSON.stringify(incoming);
  if (incomingJSON === state.clustersLastJSON) return;
  state.clustersLastJSON = incomingJSON;
  state.clusters = incoming;
  // Apply hub-authoritative shared settings to each of our member groups.
  for (const cluster of state.clusters) {
    if (!cluster || !Array.isArray(cluster.members)) continue;
    if (!cluster.members.some((m) => m && m.program === LOCAL_PROGRAM_ID)) continue;
    const group = state.groups.find((g) => g.name === cluster.groupName);
    if (!group) continue;
    if (cluster.shared) {
      applyClusterShared(group, cluster.shared);
    } else {
      // Freshly-formed cluster: the hub's first snapshot carries no `shared`
      // until each member has contributed its owned list. Force our owned-list
      // contribution to be (re)sent so the peer's mirror fills on the FIRST
      // connect instead of staying blank until a later edit.
      delete state.clusterSyncSent[group.id];
    }
  }
  // Drop mirrors for groups no longer clustered.
  for (const groupId of Object.keys(state.clusterMirror)) {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group || !groupConnectionCluster(group)) delete state.clusterMirror[groupId];
  }
  for (const groupId of Object.keys(state.clusterSnoozeTotalsMs)) {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group || !groupConnectionCluster(group)) delete state.clusterSnoozeTotalsMs[groupId];
  }
  updateGroupCardBridgeBadges();
  // Re-render the editor so synced scalar changes show, unless the user is
  // actively typing in a field (don't clobber in-progress input).
  const active = document.activeElement;
  const editing =
    active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
  if (getSelectedGroup() && !editing) {
    renderEditor();
  } else {
    refreshConnectionGroupPanel();
  }
  // Warn once per offline episode: if we're linked but a cluster member is
  // offline (e.g. the Mac app isn't open), shared changes won't sync until it's
  // back. The warning resets when every member is online again.
  for (const cluster of state.clusters) {
    if (!cluster || !Array.isArray(cluster.members)) continue;
    if (!cluster.members.some((m) => m && m.program === LOCAL_PROGRAM_ID)) continue;
    const key = "offline:" + cluster.groupName;
    if (cluster.allOnline === false) {
      warnBridgeOnce(key, t("connectionGroup.warnMemberOffline"));
    } else {
      clearBridgeWarn(key);
    }
  }
  // Propagated freeze may have changed our frozen status; refresh the roster
  // so future link validation sees it, then push our own contributions.
  announceGroups();
  syncAllClusters();
}

function applyGroupRejection(reason) {
  if (connectionGroupHint) {
    connectionGroupHint.textContent = t("connectionGroup.rejected") + (reason || "");
  }
}

// Native (macOS) pushes cluster membership here; the browser uses the
// "clusters-push" runtime message instead.
window.__cbClustersState = function (json) {
  try {
    const incoming = typeof json === "string" ? JSON.parse(json) : json;
    applyClusters(incoming);
  } catch (_) {}
};

window.__cbGroupRejected = function (json) {
  try {
    const incoming = typeof json === "string" ? JSON.parse(json) : json;
    applyGroupRejection(incoming && incoming.reason);
  } catch (_) {}
};

function requestClusters() {
  try {
    chrome.runtime
      .sendMessage({ type: "clusters-status" })
      .then((res) => {
        if (res && res.clusters) applyClusters(res.clusters);
      })
      .catch(() => {});
  } catch (_) {}
}

// Tell the hub which Default/Custom groups exist here (by saved name + type +
// freeze state) so it can validate connection requests against same-named
// groups. Sent on load, after group edits, and when the bridge comes online.
function announceGroups() {
  const groups = (Array.isArray(state.groups) ? state.groups : [])
    .filter(isBridgeEligibleGroup)
    .map((g) => ({
      name: g.name,
      type: g.groupType,
      frozen: getFreezeStatus(g, Date.now()).isFrozen
    }));
  try {
    chrome.runtime.sendMessage({ type: "groups-announce", program: LOCAL_PROGRAM_ID, groups });
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Settings sync: clustered groups share a single set of settings. The hub is
// the authority — scalars are last-writer-wins, blocked-domain / blocked-app
// pools are a union of each owner's list (browsers own domains, the Mac owns
// apps), and freeze state propagates as a scalar. The live elapsed usage
// counter is also shared for Default groups: each side reports its absolute
// local counter and the hub accumulates deltas into one shared budget that is
// folded back into every member's local timer (see applyClusterShared).
// ---------------------------------------------------------------------------

const SYNC_SCALAR_FIELDS = [
  "mode",
  "allowedMinutes",
  "resetIntervalHours",
  "allowSnooze",
  "snoozeMinutes",
  "snoozeActivationDelayMinutes",
  "snoozeCooldownMinutes",
  "snoozeConfirmations",
  "activeDays",
  "timeWindowsText",
  "freezeMode",
  "freezeModeChoice",
  "strictFreezeHours",
  "frozenAtMs",
  "blockHomePage",
  "fallbackUrl",
  "skipToNextOnBlock"
];

// This endpoint owns (can edit + contributes) one blocked-list type: the Mac
// owns apps, browsers own domains. The other type is a read-only mirror.
function bridgeOwnsApps() {
  return IS_CONNECTION_HUB;
}

function buildSyncContribution(group) {
  const scalars = {};
  for (const field of SYNC_SCALAR_FIELDS) scalars[field] = group[field];
  const contribution = { scalars };
  if (group.groupType === "site") {
    if (bridgeOwnsApps()) {
      contribution.apps = Array.isArray(group.apps) ? group.apps : [];
    } else {
      contribution.sites = Array.isArray(group.sites) ? group.sites : [];
    }
    // NOTE: the live usage budget is reported as deltas by the accrual owner
    // only — the browser's background heartbeat (cbReportClusterUsage) and the
    // Mac's in-process frontmost-app sampler (reportLocalUsage). The popup is
    // display-only for usage: it folds the hub's shared total back into the
    // local counter (applyClusterShared) but never reports it, so the popup and
    // background can't double-count the same accrual.
  }
  // Active snooze runtime is shared so a snooze started on any member applies to
  // every linked member (newest start wins). The entry carries all of its own
  // timing (start/until/cooldown), so each side enforces and expires it
  // identically without needing to propagate the eventual clear.
  const snoozeEntry = state.groupSnoozes[group.id];
  if (snoozeEntry && Number.isFinite(Number(snoozeEntry.startsAtMs))) {
    contribution.snooze = snoozeEntry;
    contribution.snoozeTs = Number(snoozeEntry.startsAtMs) || 0;
  }
  // Cumulative snooze total is shared so every member can display the combined
  // figure. The hub keeps the max across members; folding is display-only
  // (see applyClusterShared / getDisplayedSnoozeTotalMs) to avoid double-count.
  contribution.snoozeTotalMs = Math.max(0, Number(state.groupSnoozeTotalsMs[group.id]) || 0);
  return contribution;
}

// Validates a snooze record received from the hub for a specific group and
// returns a sanitized entry, or null if invalid or already fully expired (we
// never re-adopt a snooze whose cooldown has passed — that would fight local
// expiry and flip-flop the state).
function adoptSharedSnooze(group, raw, now = Date.now()) {
  if (!group || !raw || typeof raw !== "object") return null;
  const sanitized = sanitizeSnoozes({ [group.id]: raw }, [group]);
  const entry = sanitized[group.id];
  if (!entry) return null;
  if (Number(entry.cooldownUntilMs) <= now) return null;
  return entry;
}

// Writes the hub's shared settings onto a local member group (scalars + freeze)
// and records the shared list pools as a read-only mirror. The owned list is
// never overwritten (the user keeps editing their own type).
function applyClusterShared(group, shared) {
  if (!group || !shared || typeof shared !== "object") return;
  const scalars = shared.scalars && typeof shared.scalars === "object" ? shared.scalars : {};
  const idx = state.groups.findIndex((g) => g.id === group.id);
  if (idx < 0) return;
  const next = { ...state.groups[idx] };
  let changed = false;
  for (const field of SYNC_SCALAR_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(scalars, field) &&
      JSON.stringify(next[field]) !== JSON.stringify(scalars[field])
    ) {
      next[field] = scalars[field];
      changed = true;
    }
  }
  state.groups[idx] = next;
  state.clusterMirror[group.id] = {
    sites: Array.isArray(shared.sites) ? shared.sites : [],
    apps: Array.isArray(shared.apps) ? shared.apps : []
  };
  if (Number.isFinite(shared.ts)) state.groupEditTs[group.id] = shared.ts;

  // Display-only shared snooze total (max across the cluster). Never written
  // into the local accumulator so concurrent expiry can't double-count.
  state.clusterSnoozeTotalsMs[group.id] = Math.max(
    0,
    Number(shared.snoozeTotalMs) || 0
  );

  // Fold the hub's shared usage budget into our local counter so the live
  // elapsed timer (display + enforcement) reflects time spent on every member.
  // We never overwrite our own future accrual — the background keeps adding to
  // this value and reporting it back, and the hub measures only the new delta.
  if (next.groupType === "site" && Number.isFinite(shared.usageMs)) {
    const incomingUsage = Math.max(0, Number(shared.usageMs) || 0);
    if ((Number(state.usageTimersMs[group.id]) || 0) !== incomingUsage) {
      state.usageTimersMs[group.id] = incomingUsage;
      chrome.storage.local.set({ [USAGE_TIMERS_KEY]: state.usageTimersMs }).catch(() => {});
    }
    if (
      Number.isFinite(shared.usageResetAtMs) &&
      shared.usageResetAtMs > 0 &&
      (Number(state.usageResetAtMs[group.id]) || 0) !== Number(shared.usageResetAtMs)
    ) {
      state.usageResetAtMs[group.id] = Number(shared.usageResetAtMs);
      chrome.storage.local.set({ [USAGE_RESET_AT_KEY]: state.usageResetAtMs }).catch(() => {});
    }
  }

  // Adopt a newer shared snooze (newest start wins) so a snooze started on a
  // linked member activates here too. Liveness is checked inside adoptSharedSnooze.
  const sharedSnoozeTs = Number(shared.snoozeTs) || 0;
  if (sharedSnoozeTs > 0 && shared.snooze && typeof shared.snooze === "object") {
    const localEntry = state.groupSnoozes[group.id];
    const localTs = localEntry ? Number(localEntry.startsAtMs) || 0 : 0;
    if (sharedSnoozeTs > localTs) {
      const adopted = adoptSharedSnooze(next, shared.snooze);
      if (adopted) {
        state.groupSnoozes[group.id] = adopted;
        chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: state.groupSnoozes }).catch(() => {});
      }
    }
  }

  // Mark our contribution as up to date so we don't echo it back to the hub.
  state.clusterSyncSent[group.id] = JSON.stringify(buildSyncContribution(next));
  if (changed) {
    chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: state.groups }).catch(() => {});
  }
}

function syncClusterForGroup(group) {
  if (!group || !isBridgeEligibleGroup(group)) return;
  if (!groupConnectionCluster(group)) {
    delete state.clusterSyncSent[group.id];
    return;
  }
  const contribution = buildSyncContribution(group);
  const json = JSON.stringify(contribution);
  const priority = state.pendingPriorityGroups.has(group.id);
  if (json === state.clusterSyncSent[group.id] && !priority) return;
  state.clusterSyncSent[group.id] = json;
  state.pendingPriorityGroups.delete(group.id);
  state.groupEditTs[group.id] = Date.now();
  try {
    chrome.runtime.sendMessage({
      type: "group-sync",
      program: LOCAL_PROGRAM_ID,
      groupName: group.name,
      groupType: group.groupType,
      ts: state.groupEditTs[group.id],
      priority,
      ...contribution
    });
  } catch (_) {}
}

function syncAllClusters() {
  for (const group of state.groups) syncClusterForGroup(group);
}

function syncSettingsFormFromState() {
  const s = state.globalSettings || DEFAULT_GLOBAL_SETTINGS;
  renderConnectionSettings();
  if (settingsTickRateField) settingsTickRateField.value = String(s.tickRateMs);
  if (settingsAutosaveDebounceField) settingsAutosaveDebounceField.value = String(s.autosaveDebounceMs);
  if (settingsDebugModeField) settingsDebugModeField.checked = Boolean(s.debugMode);
  if (settingsShowOnPageLogToastsField) settingsShowOnPageLogToastsField.checked = s.showOnPageLogToasts !== false;
  if (settingsDefaultSnoozeMinutesField) settingsDefaultSnoozeMinutesField.value = String(s.defaultSnoozeMinutes);
  if (settingsDefaultFallbackUrlField) settingsDefaultFallbackUrlField.value = s.defaultFallbackUrl ?? "";
  if (settingsStatus) settingsStatus.textContent = "";
}

function openSettings() {
  state.isSettingsOpen = true;
  syncSettingsFormFromState();
  requestConnectionStatus();
  settingsModal.classList.remove("hidden");
  renderLocalFolderStatus().catch((error) => {
    if (localFolderStatus) localFolderStatus.textContent = String(error?.message ?? error);
  });
}

function closeSettings() {
  state.isSettingsOpen = false;
  settingsModal.classList.add("hidden");
  if (settingsStatus) settingsStatus.textContent = "";
}

async function saveSettingsFromForm() {
  const draft = {
    tickRateMs: settingsTickRateField?.value,
    autosaveDebounceMs: settingsAutosaveDebounceField?.value,
    debugMode: settingsDebugModeField?.checked ?? false,
    showOnPageLogToasts: settingsShowOnPageLogToastsField?.checked ?? true,
    defaultSnoozeMinutes: settingsDefaultSnoozeMinutesField?.value,
    defaultFallbackUrl: settingsDefaultFallbackUrlField?.value
  };
  const sanitized = sanitizeGlobalSettings(draft);
  state.globalSettings = sanitized;
  try {
    await chrome.storage.local.set({ [GLOBAL_SETTINGS_KEY]: sanitized });
    if (settingsStatus) {
      settingsStatus.textContent = t("settings.saved");
      settingsStatus.classList.remove("error");
    }
    setStatus(t("settings.saved"));
    // Reflect any clamping that sanitize did back into the form.
    syncSettingsFormFromState();
  } catch (error) {
    if (settingsStatus) {
      settingsStatus.textContent = String(error?.message ?? error);
      settingsStatus.classList.add("error");
    }
  }
}

function resetSettingsToDefaults() {
  state.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
  syncSettingsFormFromState();
  // No Save button anymore: persist the reset immediately.
  saveSettingsFromForm().catch((error) => {
    console.error("Failed to persist reset settings.", error);
  });
}

function applyStaticTranslations() {
  document.documentElement.lang = state.language;
  document.title = t("app.title");

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  }

  // Generic aria-label binding so any future element can use
  // data-i18n-aria-label="…" without touching this function.
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }

  // Generic title (tooltip) binding.
  for (const element of document.querySelectorAll("[data-i18n-title]")) {
    element.setAttribute("title", t(element.dataset.i18nTitle));
  }

  addGroupTypeField.setAttribute("aria-label", t("groups.addTypeAria"));
  languageSelect.setAttribute("aria-label", t("language.label"));
  groupList.setAttribute("aria-label", t("groups.listAria"));
  layoutResizer.setAttribute("aria-label", t("layout.resizeAria"));
  manualButton.setAttribute("aria-label", t("manual.button"));
  manualCloseButton.setAttribute("aria-label", t("manual.close"));
}

function populateLanguageOptions() {
  const languages = getAvailableLanguages();
  languageSelect.textContent = "";

  for (const [code, language] of Object.entries(languages)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = language.nativeLabel || language.label || code;
    languageSelect.appendChild(option);
  }

  languageSelect.value = state.language;
}

async function setLanguage(languageCode) {
  const nextLanguage = getAvailableLanguages()[languageCode]
    ? languageCode
    : getDefaultLanguageCode();
  await ensureLanguageMessages(nextLanguage).catch(() => {
    state.translationMessages[nextLanguage] = {};
  });
  state.language = nextLanguage;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
  } catch {}
  populateLanguageOptions();
  applyStaticTranslations();
  render();

  if (state.isManualOpen) {
    loadManualContent().catch((error) => {
      manualStatus.textContent = error?.message || t("manual.error");
    });
  }
}

function createGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureStatusStack() {
  let stack = document.getElementById("statusStack");

  if (!stack) {
    stack = document.createElement("div");
    stack.id = "statusStack";
    stack.className = "status-stack";
    document.body.appendChild(stack);
  }

  return stack;
}

function getStatusDurationMs(message) {
  const text = String(message ?? "").trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.length;
  return Math.min(22000, Math.max(4800, 2200 + wordCount * 420 + charCount * 18));
}

function setStatus(message, isError = false) {
  const text = String(message ?? "").trim();
  statusMessage.textContent = text;

  if (!text) {
    return;
  }

  const stack = ensureStatusStack();
  const toast = document.createElement("div");
  toast.className = `status-toast${isError ? " error" : ""}`;
  toast.textContent = text;
  stack.prepend(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  const durationMs = getStatusDurationMs(text);
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 280);
  }, durationMs);
}

function setSnoozeWarning(message = "") {
  snoozeWarning.textContent = message;
}

function normalizeSiteInput(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const maybeUrl = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const parsedUrl = new URL(maybeUrl);
    let hostname = parsedUrl.hostname.trim().toLowerCase();

    if (!hostname) {
      return null;
    }

    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    return hostname;
  } catch {
    return null;
  }
}

// normalizeYouTubeCreatorInput now comes from platform-profiles.js.

function parseSiteTextareaValue(value) {
  const validSites = [];
  const invalidSites = [];

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const normalizedSite = normalizeSiteInput(trimmedLine);

    if (normalizedSite) {
      validSites.push(normalizedSite);
    } else {
      invalidSites.push(trimmedLine);
    }
  }

  return {
    validSites: [...new Set(validSites)],
    invalidSites
  };
}

// --- Blocked-site chips -----------------------------------------------------
// The chip list is the visible editing surface for "site" groups. The hidden
// #blockedSites textarea stays the backing store (newline-separated hostnames)
// so the draft / autosave / save pipeline is unchanged; these helpers keep the
// chip list and that field in sync.

let siteAddPanelGroupId = null;

// Inline grey globe shown when a favicon can't be resolved: always on Safari
// (no `_favicon` provider) and for sites the browser hasn't cached yet.
const SITE_GLOBE_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>'
  );

function siteFaviconUrl(host) {
  try {
    return chrome.runtime.getURL(
      "/_favicon/?pageUrl=" + encodeURIComponent("https://" + host) + "&size=32"
    );
  } catch (_) {
    return "";
  }
}

function makeSiteIconElement(host) {
  const img = document.createElement("img");
  img.className = "site-chip-icon";
  img.alt = "";
  img.width = 16;
  img.height = 16;
  const url = siteFaviconUrl(host);
  img.src = url || SITE_GLOBE_ICON;
  img.addEventListener("error", () => {
    if (img.src !== SITE_GLOBE_ICON) {
      img.src = SITE_GLOBE_ICON;
    }
  });
  return img;
}

function getDraftSites() {
  return parseSiteTextareaValue(blockedSitesField.value).validSites;
}

// Writes the working hostname list into the hidden backing field and runs the
// same stash + autosave path the textarea input handler used to drive.
function commitBlockedSites(sites) {
  blockedSitesField.value = [...new Set(sites)].join("\n");
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
  renderBlockedSites();
}

function renderBlockedSites() {
  if (!blockedSitesList) {
    return;
  }
  const editable = !blockedSitesField.disabled;

  // Drop a stale add panel left open from a different group.
  if (
    siteAddPanel &&
    !siteAddPanel.classList.contains("hidden") &&
    siteAddPanelGroupId !== state.selectedGroupId
  ) {
    closeSiteAddPanel();
  }

  blockedSitesList.innerHTML = "";

  for (const host of getDraftSites()) {
    const chip = document.createElement("div");
    chip.className = "site-chip";
    chip.setAttribute("role", "listitem");
    chip.title = host;

    chip.appendChild(makeSiteIconElement(host));

    const label = document.createElement("span");
    label.className = "site-chip-name";
    label.textContent = host;
    chip.appendChild(label);

    if (editable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "site-chip-remove";
      remove.setAttribute("aria-label", t("sites.removeAria", { name: host }));
      remove.textContent = "\u2212"; // minus sign
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        commitBlockedSites(getDraftSites().filter((item) => item !== host));
      });
      chip.appendChild(remove);
    }

    blockedSitesList.appendChild(chip);
  }

  // Trailing "+" tile to reveal the multi-line add panel.
  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "site-chip-add";
  addTile.setAttribute("aria-label", t("sites.addAria"));
  addTile.textContent = "+";
  addTile.disabled = !editable;
  addTile.addEventListener("click", () => openSiteAddPanel());
  blockedSitesList.appendChild(addTile);
}

function openSiteAddPanel() {
  if (!siteAddPanel || blockedSitesField.disabled) {
    return;
  }
  siteAddPanelGroupId = state.selectedGroupId;
  siteAddPanel.classList.remove("hidden");
  if (siteAddInput) {
    siteAddInput.value = "";
    window.setTimeout(() => siteAddInput.focus(), 0);
  }
}

function closeSiteAddPanel() {
  siteAddPanelGroupId = null;
  if (siteAddPanel) {
    siteAddPanel.classList.add("hidden");
  }
  if (siteAddInput) {
    siteAddInput.value = "";
  }
}

// Parses the multi-line add field (one entry per line; bulk paste supported),
// merges valid hostnames into the list, then closes the panel.
function confirmSiteAdd() {
  if (!siteAddInput) {
    return;
  }
  const added = parseSiteTextareaValue(siteAddInput.value).validSites;
  if (added.length > 0) {
    commitBlockedSites([...getDraftSites(), ...added]);
  }
  closeSiteAddPanel();
}

// ── Entry chip inputs ──────────────────────────────────────────────────────
// Turns a backing <textarea> (one entry per line) into a row of small, removable
// chips with an inline add box. Each chip is validated with the field's
// normalizer; invalid entries get a red style so typos are obvious immediately.
// The hidden textarea stays the source of truth, so the existing draft / autosave
// pipeline (which reads `.value`) keeps working unchanged.
const chipInputRegistry = [];

// The group type currently shown in the editor — drives the author chip
// normalizer (YouTube vs TikTok vs Twitter handles differ).
let chipsGroupType = "youtube";

function getChipFieldEntries(field) {
  return String(field.value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function setChipFieldEntries(field, entries) {
  const deduped = [];
  for (const entry of entries) {
    const trimmed = String(entry ?? "").trim();
    if (trimmed && !deduped.includes(trimmed)) deduped.push(trimmed);
  }
  field.value = deduped.join("\n");
  // Drive the same stash + autosave path the raw textarea input used to.
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function setupChipField(field, options) {
  if (!field || field.__cbChip) return;
  const normalize = options?.normalize || ((value) => (String(value ?? "").trim() ? value : null));

  const list = document.createElement("div");
  list.className = "entry-chip-list";
  const addInput = document.createElement("input");
  addInput.type = "text";
  addInput.className = "entry-chip-input";
  addInput.spellcheck = false;

  field.classList.add("hidden");
  field.setAttribute("aria-hidden", "true");
  field.insertAdjacentElement("afterend", list);

  const commitAdd = () => {
    const parts = addInput.value
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    addInput.value = "";
    if (parts.length === 0) return;
    setChipFieldEntries(field, [...getChipFieldEntries(field), ...parts]);
    renderChips();
  };

  addInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitAdd();
    } else if (event.key === "Backspace" && addInput.value === "") {
      const entries = getChipFieldEntries(field);
      if (entries.length > 0) {
        entries.pop();
        setChipFieldEntries(field, entries);
        renderChips();
      }
    }
  });
  addInput.addEventListener("blur", commitAdd);

  function renderChips() {
    const editable = !field.disabled;
    list.classList.toggle("entry-chip-list-disabled", !editable);
    list.innerHTML = "";
    for (const entry of getChipFieldEntries(field)) {
      const valid = normalize(entry) !== null;
      const chip = document.createElement("span");
      chip.className = "entry-chip" + (valid ? "" : " entry-chip-invalid");
      chip.title = valid ? entry : t("chip.invalid");

      const label = document.createElement("span");
      label.className = "entry-chip-label";
      label.textContent = entry;
      chip.appendChild(label);

      if (editable) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "entry-chip-remove";
        remove.setAttribute("aria-label", t("chip.removeAria", { name: entry }));
        remove.textContent = "\u00d7";
        remove.addEventListener("click", () => {
          setChipFieldEntries(field, getChipFieldEntries(field).filter((item) => item !== entry));
          renderChips();
        });
        chip.appendChild(remove);
      }
      list.appendChild(chip);
    }

    addInput.disabled = !editable;
    addInput.placeholder = t("chip.addPlaceholder");
    list.appendChild(addInput);
  }

  field.__cbChip = { render: renderChips };
  chipInputRegistry.push(field);
  renderChips();
}

function refreshChipField(field) {
  if (field && field.__cbChip) field.__cbChip.render();
}

function setupPlatformChipInputs() {
  setupChipField(platformAuthorsField, {
    normalize: (value) => normalizePlatformAuthorInput(value, chipsGroupType)
  });
  setupChipField(platformAuthorTagsField, {
    normalize: (value) => (String(value ?? "").trim() ? value : null)
  });
  setupChipField(redditSubredditsField, {
    normalize: (value) => normalizeRedditSubredditInput(value)
  });
  setupChipField(discordTargetsField, {
    normalize: (value) => normalizeDiscordTargetInput(value)
  });
}

function parsePlatformAuthorsTextarea(groupType, value) {
  const validAuthors = [];
  const invalidAuthors = [];

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const normalized = normalizePlatformAuthorInput(trimmedLine, groupType);

    if (normalized) {
      validAuthors.push(normalized);
    } else {
      invalidAuthors.push(trimmedLine);
    }
  }

  return {
    validAuthors: [...new Set(validAuthors)],
    invalidAuthors
  };
}

function parseAllowedMinutes(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseResetIntervalHours(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStrictFreezeHours(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_STRICT_FREEZE_HOURS
    ? parsed
    : null;
}

function parseSnoozeMinutes(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSnoozeDelayMinutes(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseSnoozeCooldownMinutes(value) {
  const parsed = parseSnoozeDelayMinutes(value);
  return parsed !== null && parsed <= MAX_SNOOZE_COOLDOWN_MINUTES ? parsed : null;
}

function parseSnoozeConfirmations(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeConnectionSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    serverEnabled: src.serverEnabled === true,
    clientEnabled: src.clientEnabled === true
  };
}

function sanitizeGlobalSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const tickRateMs = Math.round(
    clampNumber(src.tickRateMs, TICK_RATE_MIN_MS, TICK_RATE_MAX_MS, DEFAULT_GLOBAL_SETTINGS.tickRateMs)
  );
  const autosaveDebounceMs = Math.round(
    clampNumber(src.autosaveDebounceMs, 0, AUTOSAVE_DEBOUNCE_MAX_MS, DEFAULT_GLOBAL_SETTINGS.autosaveDebounceMs)
  );
  const defaultSnoozeMinutes = (() => {
    const parsed = Number.parseFloat(src.defaultSnoozeMinutes);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GLOBAL_SETTINGS.defaultSnoozeMinutes;
  })();
  const defaultFallbackUrl =
    typeof src.defaultFallbackUrl === "string" ? src.defaultFallbackUrl.trim() : "";
  // Migrate the old `showDebugOverlay` key (which defaulted to true)
  // to the new `debugMode` key (which defaults to false). If the user
  // had previously SET showDebugOverlay we honor it; otherwise we
  // start fresh with debug off.
  const debugMode =
    src.debugMode === true ||
    (src.debugMode === undefined && src.showDebugOverlay === true);
  const showOnPageLogToasts = src.showOnPageLogToasts !== false;
  return {
    tickRateMs,
    autosaveDebounceMs,
    debugMode,
    showOnPageLogToasts,
    defaultSnoozeMinutes,
    defaultFallbackUrl,
    connection: sanitizeConnectionSettings(src.connection)
  };
}

function normalizeTimeWindowLine(line) {
  const match = String(line ?? "").trim().match(/^(\d{4})-(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, start, end] = match;
  const startHours = Number.parseInt(start.slice(0, 2), 10);
  const startMinutes = Number.parseInt(start.slice(2), 10);
  const endHours = Number.parseInt(end.slice(0, 2), 10);
  const endMinutes = Number.parseInt(end.slice(2), 10);
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  if (
    startHours > 23 ||
    endHours > 23 ||
    startMinutes > 59 ||
    endMinutes > 59 ||
    startTotalMinutes >= endTotalMinutes
  ) {
    return null;
  }

  return `${start}-${end}`;
}

function parseTimeWindowsText(value) {
  const normalizedLines = [];
  const invalidLines = [];

  for (const line of String(value ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const normalizedLine = normalizeTimeWindowLine(trimmed);

    if (!normalizedLine) {
      invalidLines.push(trimmed);
      continue;
    }

    normalizedLines.push(normalizedLine);
  }

  return {
    normalizedLines: [...new Set(normalizedLines)],
    invalidLines
  };
}

function formatDurationMs(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatHours(value) {
  return Number(value).toString();
}

function createDefaultDays() {
  return [...DAY_NAMES];
}

// normalizeGroupType now comes from platform-profiles.js.

function normalizeBlockingMode(value) {
  if (value === "after-minutes" || value === "timer") {
    return value;
  }
  return "instant";
}

function isTimedBlockingMode(mode) {
  return mode === "after-minutes" || mode === "timer";
}

function getGroupTypeLabel(groupType) {
  if (groupType === "youtube") {
    return t("groupType.youtube");
  }

  if (groupType === "tiktok") {
    return t("groupType.tiktok");
  }

  if (groupType === "facebook") {
    return t("groupType.facebook");
  }

  if (groupType === "instagram") {
    return t("groupType.instagram");
  }

  if (groupType === "twitch") {
    return t("groupType.twitch");
  }

  if (groupType === "reddit") {
    return t("groupType.reddit");
  }

  if (groupType === "discord") {
    return t("groupType.discord");
  }

  if (groupType === "twitter") {
    return t("groupType.twitter");
  }

  if (groupType === "custom") {
    return t("groupType.custom");
  }

  return t("groupType.site");
}

function getEditorTypeSummary(groupType) {
  if (groupType === "youtube") {
    return t("editor.typeSummaryYouTube");
  }

  if (groupType === "tiktok") {
    return t("editor.typeSummaryTikTok");
  }

  if (groupType === "facebook") {
    return t("editor.typeSummaryFacebook");
  }

  if (groupType === "instagram") {
    return t("editor.typeSummaryInstagram");
  }

  if (groupType === "twitch") {
    return t("editor.typeSummaryTwitch");
  }

  if (groupType === "reddit") {
    return t("editor.typeSummaryReddit");
  }

  if (groupType === "discord") {
    return t("editor.typeSummaryDiscord");
  }

  if (groupType === "twitter") {
    return t("editor.typeSummaryTwitter");
  }

  if (groupType === "custom") {
    return t("editor.typeSummaryCustom");
  }

  return t("editor.typeSummarySite");
}

function getPlatformDisplayName(groupType) {
  if (groupType === "youtube") {
    return t("groupType.youtube");
  }
  if (groupType === "tiktok") {
    return t("groupType.tiktok");
  }
  if (groupType === "facebook") {
    return t("groupType.facebook");
  }
  if (groupType === "instagram") {
    return t("groupType.instagram");
  }
  if (groupType === "twitch") {
    return t("groupType.twitch");
  }
  if (groupType === "twitter") {
    return t("groupType.twitter");
  }
  if (groupType === "reddit") {
    return t("groupType.reddit");
  }
  if (groupType === "discord") {
    return t("groupType.discord");
  }
  return t("groupType.youtube");
}

function getPlatformTypeLabel(groupType, type) {
  const normalized = normalizeGroupType(groupType);

  if (type === "short") {
    if (normalized === "youtube") {
      return t("platform.short.youtube");
    }
    if (normalized === "tiktok") {
      return t("platform.short.tiktok");
    }
    if (normalized === "facebook") {
      return t("platform.short.facebook");
    }
    if (normalized === "instagram") {
      return t("platform.short.instagram");
    }
    if (normalized === "twitch") {
      return t("platform.short.twitch");
    }
  }

  if (type === "long") {
    if (normalized === "youtube") {
      return t("platform.long.youtube");
    }
    if (normalized === "tiktok") {
      return t("platform.long.tiktok");
    }
    if (normalized === "facebook") {
      return t("platform.long.facebook");
    }
    if (normalized === "instagram") {
      return t("platform.long.instagram");
    }
    if (normalized === "twitch") {
      return t("platform.long.twitch");
    }
  }

  if (type === "post") {
    if (normalized === "youtube") {
      return t("platform.post.youtube");
    }
    if (normalized === "tiktok") {
      return t("platform.post.tiktok");
    }
    if (normalized === "facebook") {
      return t("platform.post.facebook");
    }
    if (normalized === "instagram") {
      return t("platform.post.instagram");
    }
    if (normalized === "twitch") {
      return t("platform.post.twitch");
    }
  }

  return "";
}

function getPlatformAuthorsPlaceholder(groupType) {
  return t(`platform.placeholder.${normalizeGroupType(groupType)}`);
}

// Sets the unified "Platform rules" card header (title + one-line copy). Runs
// for every platform-profile type, including Reddit/Discord which used to carry
// their own section headings before the cards were merged.
function applyPlatformRulesHeader(groupType) {
  const type = normalizeGroupType(groupType);
  const platform = getPlatformDisplayName(type);
  if (platformVideoTitle) platformVideoTitle.textContent = t("platform.rulesTitle", { platform });
  if (platformVideoCopy) platformVideoCopy.textContent = t("platform.rulesCopy", { platform });
}

// Builds the author/account mode dropdown for the current platform. Video
// platforms + Twitter share these modes; YouTube additionally offers the
// (visual-only) tag modes.
function rebuildAuthorModeOptions(type) {
  const isTwitter = type === "twitter";
  const isYouTube = type === "youtube";
  const noun = isTwitter ? t("platform.nounAccounts") : t("platform.nounAuthors");
  const modes = ["all", "include", "exclude", "nobody"];
  if (isYouTube) modes.push("tagInclude", "tagExclude");

  const previous = platformAuthorModeField.value;
  platformAuthorModeField.innerHTML = "";
  for (const mode of modes) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = t(`platform.authorMode.${mode}`, { noun });
    platformAuthorModeField.appendChild(option);
  }
  if (modes.includes(previous)) platformAuthorModeField.value = previous;
}

function applyPlatformVideoUi(groupType) {
  const type = normalizeGroupType(groupType);
  const platform = getPlatformDisplayName(type);
  const shortLabel = getPlatformTypeLabel(type, "short");
  const longLabel = getPlatformTypeLabel(type, "long");
  const postLabel = getPlatformTypeLabel(type, "post");
  const isYouTube = type === "youtube";
  const isTwitter = type === "twitter";

  // Twitter/X has no video-form axis — hide the content-type selector and
  // present account (handle) controls only.
  platformVideoModeRow.classList.toggle("hidden", isTwitter);

  platformVideoModeLabel.textContent = t("platform.videoMode");
  if (platformVideoModeHelp) platformVideoModeHelp.textContent = t("platform.videoModeHelp");
  platformVideoModeAllOption.textContent = t("platform.videoModeAll", { platform });
  platformVideoModeShortOption.textContent = t("platform.videoModeShort", { content: shortLabel });
  platformVideoModeLongOption.textContent = t("platform.videoModeLong", { content: longLabel });
  platformVideoModePostOption.textContent = t("platform.videoModePost", { content: postLabel });

  platformAuthorModeLabel.textContent = isTwitter ? t("platform.accountMode") : t("platform.authorMode");
  rebuildAuthorModeOptions(type);
  platformAuthorModeHelp.textContent = isTwitter
    ? t("platform.accountModeHelp")
    : t("platform.authorModeHelp");

  platformAuthorsLabel.textContent = isTwitter ? t("platform.accounts") : t("platform.authors");
  platformAuthorsField.setAttribute("placeholder", getPlatformAuthorsPlaceholder(type));
  platformVideoHelp.textContent = isYouTube
    ? t("platform.help.youtube", { platform })
    : isTwitter
      ? t("platform.help.twitter", { platform })
      : t("platform.help.generic", { platform, shortLabel, longLabel, postLabel });

  // YouTube-only tag stubs.
  platformAuthorTagsLabel.textContent = t("platform.authorTags");
  platformAuthorTagsField.setAttribute("placeholder", t("platform.authorTagsPlaceholder"));
  platformAuthorTagsHelp.textContent = t("platform.authorTagsHelp");
}

function getProfileSurfaceHideEntries(groupType) {
  const profile =
    typeof PLATFORM_PROFILES !== "undefined" ? PLATFORM_PROFILES[normalizeGroupType(groupType)] : null;
  return Array.isArray(profile?.surfaceHides) ? profile.surfaceHides : [];
}

function getDraftSurfaceHides(group, draft) {
  if (draft && Array.isArray(draft.surfaceHides)) {
    return draft.surfaceHides;
  }
  return Array.isArray(group?.surfaceHides) ? group.surfaceHides : [];
}

function readSurfaceHidesFromForm() {
  return [...surfaceHidesList.querySelectorAll('input[type="checkbox"]')]
    .filter((input) => input.checked)
    .map((input) => input.value);
}

// Render the opt-in "Hide elements" checklist for the selected platform group.
// Each entry maps to a registry surfaceHides id; toggling persists into the
// group's draft (same auto-save path as the other platform fields).
function renderSurfaceHides(group, draft, editable) {
  if (!surfaceHidesSection || !surfaceHidesList) {
    return;
  }

  const entries = getProfileSurfaceHideEntries(group.groupType);
  surfaceHidesList.innerHTML = "";

  if (entries.length === 0) {
    surfaceHidesSection.classList.add("hidden");
    return;
  }

  surfaceHidesSection.classList.remove("hidden");
  const enabled = new Set(getDraftSurfaceHides(group, draft));

  for (const entry of entries) {
    const row = document.createElement("label");
    row.className = "surface-hide-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = entry.id;
    input.checked = enabled.has(entry.id);
    input.disabled = !editable;
    input.addEventListener("change", () => {
      // Some hides (e.g. hiding ads) can violate platform Terms of Service and
      // risk the account — warn and require confirmation every time they're
      // turned on. Cancelling reverts the checkbox without saving.
      if (input.checked && entry.warnOnEnableKey) {
        const accepted = window.confirm(t(entry.warnOnEnableKey));
        if (!accepted) {
          input.checked = false;
          return;
        }
      }
      handleSurfaceHideChange(group.id);
    });

    const text = document.createElement("span");
    text.textContent = t(entry.labelKey);

    // Entry-scoped hides (e.g. YouTube comments) only apply on pages matching
    // the group's author scope — flag that inline so it isn't mistaken for a
    // site-wide toggle.
    if (surfaceHideEntryScope(entry) === "entry") {
      const hint = document.createElement("span");
      hint.className = "surface-hide-hint";
      hint.textContent = t("surfaceHide.scopeEntry");
      text.appendChild(hint);
    }

    row.appendChild(input);
    row.appendChild(text);
    surfaceHidesList.appendChild(row);
  }
}

function handleSurfaceHideChange(groupId) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group || !isGroupEditable(group)) {
    render();
    return;
  }
  stashCurrentDraft();
  scheduleAutosave();
}

// normalizePlatformAuthorMode, normalizeRedditMode, normalizeDiscordMode,
// isPlatformVideoGroupType, normalizePlatformAuthorInput, normalizeVideoMode,
// normalizeRedditSubredditInput and normalizeDiscordTargetInput now come from
// platform-profiles.js (loaded before this script).

function parseRedditSubredditsTextarea(value) {
  const validSubreddits = [];
  const invalidSubreddits = [];

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const normalized = normalizeRedditSubredditInput(trimmedLine);

    if (normalized) {
      validSubreddits.push(normalized);
    } else {
      invalidSubreddits.push(trimmedLine);
    }
  }

  return {
    validSubreddits: [...new Set(validSubreddits)],
    invalidSubreddits
  };
}

function parseDiscordTargetsTextarea(value) {
  const validTargets = [];
  const invalidTargets = [];

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const normalized = normalizeDiscordTargetInput(trimmedLine);

    if (normalized) {
      validTargets.push(normalized);
    } else {
      invalidTargets.push(trimmedLine);
    }
  }

  return {
    validTargets: [...new Set(validTargets)],
    invalidTargets
  };
}

function describePlatformVideoScope(groupLike) {
  const authors = Array.isArray(groupLike.platformAuthors) ? groupLike.platformAuthors : [];
  const scopes = [];
  const videoMode = normalizeVideoMode(groupLike.platformVideoMode);
  const groupType = normalizeGroupType(groupLike.groupType);

  if (videoMode === "short" || videoMode === "long" || videoMode === "post") {
    scopes.push(getPlatformTypeLabel(groupType, videoMode));
  }

  const authorMode = normalizePlatformAuthorMode(groupLike.platformAuthorMode);
  if (authorMode === "include") {
    scopes.push(`${authors.length} ${t("meta.creators")}`);
  } else if (authorMode === "exclude") {
    scopes.push(t("meta.allExceptCreators", { count: authors.length }));
  } else if (authorMode === "nobody") {
    scopes.push(t("meta.noAuthors"));
  } else if (authorMode === "tagInclude") {
    scopes.push(t("meta.tagAuthors"));
  } else if (authorMode === "tagExclude") {
    scopes.push(t("meta.tagAuthorsExcept"));
  }

  if (scopes.length > 0) {
    return scopes.join(" + ");
  }

  const metaKeyByGroupType = {
    youtube: "meta.allYouTube",
    tiktok: "meta.allTikTok",
    facebook: "meta.allFacebook",
    instagram: "meta.allInstagram",
    twitch: "meta.allTwitch"
  };
  return t(metaKeyByGroupType[groupType] ?? "meta.allYouTube");
}

function describeTwitterScope(groupLike) {
  const accounts = Array.isArray(groupLike.platformAuthors) ? groupLike.platformAuthors : [];
  const mode = normalizePlatformAuthorMode(groupLike.platformAuthorMode);

  if (mode === "include") {
    return `${accounts.length} ${t("meta.creators")}`;
  }
  if (mode === "exclude") {
    return t("meta.allExceptCreators", { count: accounts.length });
  }
  if (mode === "nobody") {
    return t("meta.noAuthors");
  }
  return t("meta.allTwitter");
}

function describeRedditScope(groupLike) {
  const subreddits = Array.isArray(groupLike.redditSubreddits) ? groupLike.redditSubreddits : [];
  const mode = normalizeRedditMode(groupLike.redditMode, subreddits);

  if (mode === "all") {
    return t("meta.allReddit");
  }

  if (mode === "exclude") {
    return t("meta.allExceptSubreddits", { count: subreddits.length });
  }

  return t("meta.subredditCount", { count: subreddits.length });
}

function describeDiscordScope(groupLike) {
  const targets = Array.isArray(groupLike.discordTargets) ? groupLike.discordTargets : [];
  const mode = normalizeDiscordMode(groupLike.discordMode, targets);

  if (mode === "all") {
    return t("meta.allDiscord");
  }

  if (mode === "exclude") {
    return t("meta.allExceptDiscordTargets", { count: targets.length });
  }

  return t("meta.discordTargetCount", { count: targets.length });
}

function getLocalizedUnfreezeMessages() {
  return Array.from({ length: UNFREEZE_CONFIRMATIONS_REQUIRED }, (_, index) =>
    t(`unfreeze.message.${index + 1}`)
  );
}

// Templates live in templates/*.js; each file calls
// CB_REGISTER_TEMPLATES(...) which appends to
// window.__CUSTOM_BLOCKER_TEMPLATES. popup.html loads those
// scripts before popup.js so the array is fully populated by
// the time we reach this line.
const CUSTOM_RULE_TEMPLATES = Array.isArray(window.__CUSTOM_BLOCKER_TEMPLATES)
  ? window.__CUSTOM_BLOCKER_TEMPLATES.slice()
  : [];

function normalizeTemplateTag(tag) {
  return String(tag ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTemplateTags(template) {
  return [...new Set((Array.isArray(template?.tags) ? template.tags : []).map(normalizeTemplateTag).filter(Boolean))];
}

// Preferred chip order. Categories cluster on the left, then short-form
// /addiction-prone platforms, then the rest. Tags not in this list keep
// their template-discovery order at the tail. Reorder these lines to
// reorder the visible chips.
const TEMPLATE_TAG_PREFERRED_ORDER = [
  // Categories — broad concerns first, narrower ones after.
  "timer",
  "count-up",
  "schedule",
  "feed",
  "shorts",
  "redirect",
  "focus",
  "nudge",
  "persistence",
  "dom",
  "debug",
  // Platforms — clustered by similarity (short-video first).
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "reddit",
  "twitter",
  "twitch",
  "discord",
  "site"
];

function getTemplateFilterOptions() {
  const seen = new Set();
  const collected = new Set();

  for (const template of CUSTOM_RULE_TEMPLATES) {
    for (const tag of getTemplateTags(template)) {
      collected.add(tag);
    }
  }

  const ordered = [];
  for (const tag of TEMPLATE_TAG_PREFERRED_ORDER) {
    if (collected.has(tag) && !seen.has(tag)) {
      seen.add(tag);
      ordered.push(tag);
    }
  }
  // Append any tag the templates introduced that isn't in the curated
  // list — keeps new templates working without forcing every author to
  // edit the order array. They sort alphabetically for stability.
  const tail = Array.from(collected).filter((t) => !seen.has(t)).sort();
  for (const tag of tail) ordered.push(tag);

  return ordered.map((tag) => {
    const translationKey = `custom.templateTag.${tag}`;
    const translated = t(translationKey);
    return {
      value: tag,
      label:
        translated !== translationKey
          ? translated
          : tag.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
    };
  });
}

function getFilteredTemplates() {
  if (!Array.isArray(state.templateFilterTags) || state.templateFilterTags.length === 0) {
    return CUSTOM_RULE_TEMPLATES;
  }
  return CUSTOM_RULE_TEMPLATES.filter((template) => {
    const templateTags = getTemplateTags(template);
    return state.templateFilterTags.every((tag) => templateTags.includes(tag));
  });
}

function renderTemplateFilter() {
  if (!templateFilterField) {
    return;
  }

  const options = getTemplateFilterOptions();
  const previousScrollLeft = templateFilterField.scrollLeft;
  const activeTags = [...new Set((Array.isArray(state.templateFilterTags) ? state.templateFilterTags : []).map(normalizeTemplateTag).filter(Boolean))];
  state.templateFilterTags = activeTags.filter((tag) =>
    options.some((option) => option.value === tag)
  );

  templateFilterField.replaceChildren(
    ...options.map((option) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `template-filter-chip${state.templateFilterTags.includes(option.value) ? " active" : ""}`;
      element.dataset.templateFilterTag = option.value;
      element.textContent = option.label;
      element.setAttribute("aria-pressed", state.templateFilterTags.includes(option.value) ? "true" : "false");
      return element;
    })
  );
  templateFilterField.scrollLeft = previousScrollLeft;
}

function getTemplateById(templateId) {
  return CUSTOM_RULE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function getTemplateDraft(templateId) {
  if (!state.templateDrafts[templateId]) {
    const template = getTemplateById(templateId);
    if (!template) return {};
    state.templateDrafts[templateId] = Object.fromEntries(
      template.params.map((param) => [param.id, param.defaultValue])
    );
  }
  return state.templateDrafts[templateId];
}

function buildTemplatePreview(template, draft) {
  try {
    return template.buildCode(draft);
  } catch (error) {
    console.error(`Failed to build preview for template "${template.id}".`, error);
    return `// ${t("custom.templatesError")}`;
  }
}

function createTemplateCardElement(template) {
  const draft = getTemplateDraft(template.id);
  const preview = buildTemplatePreview(template, draft);

  const card = document.createElement("article");
  card.className = `template-card ${template.id === state.selectedTemplateId ? "selected" : ""}`;
  card.dataset.templateCard = template.id;

  const title = document.createElement("h4");
  title.textContent = template.title;
  card.appendChild(title);

  const copy = document.createElement("p");
  copy.className = "template-card-copy";
  copy.textContent = template.description;
  card.appendChild(copy);

  const paramGrid = document.createElement("div");
  paramGrid.className = "template-param-grid";

  for (const param of template.params) {
    const label = document.createElement("label");
    if (param.span === 2) {
      label.classList.add("span-2");
    }

    const labelText = document.createElement("span");
    labelText.textContent = param.label;
    label.appendChild(labelText);

    const input = document.createElement("input");
    input.dataset.templateId = template.id;
    input.dataset.paramId = param.id;

    if (param.type === "checkbox") {
      input.type = "checkbox";
      input.checked = Boolean(draft[param.id]);
    } else {
      input.type = param.type;
      input.value = String(draft[param.id] ?? "");
      if (param.min !== undefined) input.min = String(param.min);
      if (param.max !== undefined) input.max = String(param.max);
      if (param.step !== undefined) input.step = String(param.step);
    }

    label.appendChild(input);
    paramGrid.appendChild(label);
  }

  card.appendChild(paramGrid);

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.innerHTML = highlightCustomRuleSource(preview);
  pre.appendChild(code);
  card.appendChild(pre);

  return card;
}

function renderTemplateModal() {
  if (!templateModal || !templateGrid || !templateStatus || !templateApplyButton) {
    return;
  }

  if (!state.isTemplateOpen) {
    templateModal.classList.add("hidden");
    return;
  }

  try {
    const previousScrollTop = templateGrid.scrollTop;
    renderTemplateFilter();

    const filteredTemplates = getFilteredTemplates();
    if (!filteredTemplates.some((template) => template.id === state.selectedTemplateId)) {
      state.selectedTemplateId = filteredTemplates[0]?.id ?? null;
    }

    if (filteredTemplates.length === 0) {
      templateGrid.innerHTML = `<div class="empty-state">${escapeHtml(t("custom.templatesNoMatches"))}</div>`;
    } else {
      templateGrid.replaceChildren(
        ...filteredTemplates.map((template) => createTemplateCardElement(template))
      );
    }
    templateGrid.scrollTop = previousScrollTop;
  } catch (error) {
    console.error("Failed to render template browser.", error);
    templateGrid.innerHTML = `<div class="empty-state">${escapeHtml(t("custom.templatesError"))}</div>`;
    templateStatus.textContent = t("custom.templatesError");
    templateApplyButton.disabled = true;
    templateModal.classList.remove("hidden");
    return;
  }

  templateStatus.textContent = state.selectedTemplateId
    ? t("custom.templateSelected", { name: getTemplateById(state.selectedTemplateId)?.title ?? "" })
    : getFilteredTemplates().length === 0
      ? t("custom.templatesNoMatches")
      : t("custom.templatesCopy");
  templateApplyButton.disabled = !state.selectedTemplateId;
  templateModal.classList.remove("hidden");
}

function openTemplateModal() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom") {
    return;
  }

  state.isTemplateOpen = true;
  const filteredTemplates = getFilteredTemplates();
  if (!filteredTemplates.some((template) => template.id === state.selectedTemplateId)) {
    state.selectedTemplateId = filteredTemplates[0]?.id ?? null;
  }
  if (templateModal) {
    templateModal.classList.remove("hidden");
  }
  if (templateStatus) {
    templateStatus.textContent = t("custom.templatesLoading");
  }
  renderTemplateModal();
}

function closeTemplateModal() {
  state.isTemplateOpen = false;
  if (templateModal) {
    templateModal.classList.add("hidden");
  }
}

async function applyTemplatePreset() {
  const template = getTemplateById(state.selectedTemplateId);
  const group = getSelectedGroup();
  if (!template || !group || group.groupType !== "custom" || blockingRulesField.disabled) {
    return;
  }

  const nextCode = template.buildCode(getTemplateDraft(template.id));
  const currentCode = String(blockingRulesField.value ?? "").trim();
  const shouldReplace = !currentCode || window.confirm(t("custom.confirmReplaceTemplate"));
  if (!shouldReplace) {
    return;
  }

  blockingRulesField.value = nextCode;
  stashCurrentDraft();
  closeTemplateModal();
  render();
  scheduleAutosave();
  setStatus(t("status.templateApplied", { name: template.title }));
}

const CUSTOM_RULE_KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
  "for", "from", "function", "get", "if", "import", "in", "instanceof", "let",
  "new", "of", "return", "set", "static", "switch", "throw", "try", "typeof",
  "var", "void", "while", "with", "yield"
]);
const CUSTOM_RULE_LITERALS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
const CUSTOM_RULE_API_NAMES = new Set(["event", "events", "helpers", "ev", "h"]);

function escapeCodeEditorHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapCodeToken(className, value) {
  return `<span class="${className}">${escapeCodeEditorHtml(value)}</span>`;
}

function highlightCustomRuleSource(source) {
  const text = String(source ?? "");
  let html = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "/" && next === "/") {
      let end = index + 2;
      while (end < text.length && text[end] !== "\n") end += 1;
      html += wrapCodeToken("token-comment", text.slice(index, end));
      index = end;
      continue;
    }

    if (char === "/" && next === "*") {
      let end = index + 2;
      while (end < text.length && !(text[end] === "*" && text[end + 1] === "/")) end += 1;
      end = Math.min(text.length, end + 2);
      html += wrapCodeToken("token-comment", text.slice(index, end));
      index = end;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      const quote = char;
      let end = index + 1;
      let escaped = false;
      while (end < text.length) {
        const current = text[end];
        if (escaped) {
          escaped = false;
        } else if (current === "\\") {
          escaped = true;
        } else if (current === quote) {
          end += 1;
          break;
        } else if (quote !== "`" && current === "\n") {
          break;
        }
        end += 1;
      }
      html += wrapCodeToken("token-string", text.slice(index, end));
      index = end;
      continue;
    }

    if (/\d/.test(char)) {
      let end = index + 1;
      while (end < text.length && /[\w.]/.test(text[end])) end += 1;
      html += wrapCodeToken("token-number", text.slice(index, end));
      index = end;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let end = index + 1;
      while (end < text.length && /[\w$]/.test(text[end])) end += 1;
      const word = text.slice(index, end);
      if (CUSTOM_RULE_KEYWORDS.has(word)) {
        html += wrapCodeToken("token-keyword", word);
      } else if (CUSTOM_RULE_LITERALS.has(word)) {
        html += wrapCodeToken("token-literal", word);
      } else if (CUSTOM_RULE_API_NAMES.has(word)) {
        html += wrapCodeToken("token-api", word);
      } else if (text[end] === "(") {
        html += wrapCodeToken("token-function", word);
      } else {
        html += escapeCodeEditorHtml(word);
      }
      index = end;
      continue;
    }

    if (/[{}()[\].,;:+\-*%=&|!?<>]/.test(char)) {
      html += wrapCodeToken("token-punctuation", char);
      index += 1;
      continue;
    }

    html += escapeCodeEditorHtml(char);
    index += 1;
  }

  return html || " ";
}

function isCspEvalBlockedError(error) {
  const message = String(error && error.message ? error.message : error);
  return message.includes("unsafe-eval") ||
    message.includes("Content Security Policy") ||
    message.includes("Evaluating a string as JavaScript");
}

function getCustomRuleLocalSyntaxError(source) {
  const rawTrimmed = String(source ?? "").trim();
  if (!rawTrimmed) return null;

  const trimmed = rawTrimmed.replace(/;+\s*$/, "");
  let exprCompileError = null;
  try {
    // Compile only; do not call the generated function in the popup.
    new Function("return (" + trimmed + ");");
    return null;
  } catch (error) {
    if (isCspEvalBlockedError(error)) return null;
    exprCompileError = error;
  }

  try {
    new Function("events", "event", "helpers", trimmed);
    return null;
  } catch (error) {
    if (isCspEvalBlockedError(error)) return null;
    const message = error && error.message ? error.message : String(error);
    const exprMessage = exprCompileError && exprCompileError.message
      ? ` Also failed as expression: ${exprCompileError.message}`
      : "";
    return `Syntax error: ${message}.${exprMessage}`;
  }
}

function syncBlockingRulesEditorScroll() {
  if (!blockingRulesField || !blockingRulesHighlight) return;
  blockingRulesHighlight.style.transform =
    `translate(${-blockingRulesField.scrollLeft}px, ${-blockingRulesField.scrollTop}px)`;
}

function updateBlockingRulesEditor() {
  if (!blockingRulesEditor || !blockingRulesField || !blockingRulesHighlight) return;

  blockingRulesHighlight.innerHTML = highlightCustomRuleSource(blockingRulesField.value);
  syncBlockingRulesEditorScroll();

  const isVisible = !customSettingsCard?.classList.contains("hidden");
  const syntaxError = isVisible ? getCustomRuleLocalSyntaxError(blockingRulesField.value) : null;
  blockingRulesEditor.classList.toggle("is-disabled", blockingRulesField.disabled);
  blockingRulesEditor.classList.toggle("has-error", Boolean(syntaxError));
  if (blockingRulesLint) {
    blockingRulesLint.textContent = syntaxError || "";
  }
}

function clearDragState(shouldRender = true) {
  state.draggedGroupId = null;
  state.dragInsertIndex = null;
  resetGroupDragLayout();

  if (shouldRender) {
    renderGroupList();
  }
}

function getGroupDragCards() {
  return Array.from(groupList.querySelectorAll(".group-card[data-group-id]"));
}

function getGroupCardGap() {
  const computed = window.getComputedStyle(groupList);
  const parsed = Number.parseFloat(computed.rowGap || computed.gap || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function resetGroupDragLayout() {
  groupList.classList.remove("is-reordering");
  for (const card of getGroupDragCards()) {
    card.classList.remove("dragging");
    card.style.removeProperty("transform");
    card.style.removeProperty("transition");
    card.style.removeProperty("z-index");
  }
}

function createGroupDragContext(groupId, pointerY) {
  const cards = getGroupDragCards();
  const sourceIndex = cards.findIndex((card) => card.dataset.groupId === groupId);
  if (sourceIndex === -1) return null;

  const draggedCard = cards[sourceIndex];
  const draggedRect = draggedCard.getBoundingClientRect();
  const listRect = groupList.getBoundingClientRect();
  const gap = getGroupCardGap();

  return {
    cards,
    sourceIndex,
    startY: pointerY,
    pointerOffsetY: pointerY - draggedRect.top,
    draggedHeight: draggedRect.height,
    minTop: listRect.top,
    shiftDistance: draggedRect.height + gap,
    rects: cards.map((card) => card.getBoundingClientRect())
  };
}

function getGroupDragInsertIndex(context, pointerY) {
  const draggedTop = pointerY - context.pointerOffsetY;
  const draggedCenterY = draggedTop + context.draggedHeight / 2;
  let insertIndex = 0;

  for (let i = 0; i < context.rects.length; i++) {
    if (i === context.sourceIndex) continue;
    const rect = context.rects[i];
    if (draggedCenterY > rect.top + rect.height / 2) {
      insertIndex += 1;
    }
  }

  return insertIndex;
}

function applyGroupDragLayout(context, pointerY) {
  if (!context) return;

  const clampedPointerY = Math.max(pointerY, context.minTop + context.pointerOffsetY);
  const dragY = clampedPointerY - context.startY;
  const insertIndex = getGroupDragInsertIndex(context, clampedPointerY);
  state.dragInsertIndex = insertIndex;

  for (let i = 0; i < context.cards.length; i++) {
    const card = context.cards[i];
    let offsetY = 0;

    if (i === context.sourceIndex) {
      offsetY = dragY;
      card.style.zIndex = "20";
    } else if (insertIndex > context.sourceIndex && i > context.sourceIndex && i <= insertIndex) {
      offsetY = -context.shiftDistance;
    } else if (insertIndex < context.sourceIndex && i >= insertIndex && i < context.sourceIndex) {
      offsetY = context.shiftDistance;
    }

    if (offsetY === 0) {
      card.style.removeProperty("transform");
    } else {
      card.style.transform = `translateY(${offsetY}px)`;
    }
  }
}

function getGroupDragSnapOffset(context, insertIndex) {
  if (!context || !Number.isInteger(insertIndex)) return 0;

  const normalizedInsertIndex = Math.max(0, Math.min(insertIndex, context.rects.length - 1));
  const sourceRect = context.rects[context.sourceIndex];
  const targetRect = context.rects[normalizedInsertIndex];
  if (!sourceRect || !targetRect) return 0;

  return targetRect.top - sourceRect.top;
}

function finishGroupDragRelease(context, insertIndex, callback) {
  if (!context) {
    callback();
    return;
  }

  const draggedCard = context.cards[context.sourceIndex];
  if (!draggedCard) {
    callback();
    return;
  }

  const snapOffset = getGroupDragSnapOffset(context, insertIndex);
  const done = () => {
    draggedCard.removeEventListener("transitionend", handleTransitionEnd);
    window.clearTimeout(fallbackTimeout);
    callback();
  };
  const handleTransitionEnd = (event) => {
    if (event.target === draggedCard && event.propertyName === "transform") {
      done();
    }
  };
  const fallbackTimeout = window.setTimeout(done, 220);

  draggedCard.addEventListener("transitionend", handleTransitionEnd);
  draggedCard.style.transition = "transform 180ms ease, box-shadow 120ms ease, opacity 120ms ease";

  window.requestAnimationFrame(() => {
    if (snapOffset === 0) {
      draggedCard.style.removeProperty("transform");
    } else {
      draggedCard.style.transform = `translateY(${snapOffset}px)`;
    }
  });
}

// Pixels of movement required before a mousedown on a group card commits to
// a reorder drag. Below the threshold the mousedown is treated as a plain
// click so the existing card click handler still selects the group.
const GROUP_DRAG_THRESHOLD_PX = 5;

function startGroupReorder(event, groupId) {
  if (event.button !== 0) {
    return;
  }

  const startX = event.clientX;
  const startY = event.clientY;
  let dragActive = false;
  let dragContext = null;

  const beginDrag = () => {
    dragContext = createGroupDragContext(groupId, startY);
    if (!dragContext) return;

    dragActive = true;
    flushAutosave().catch((error) => {
      console.error("Failed to flush autosave before reordering.", error);
    });
    state.draggedGroupId = groupId;
    state.dragInsertIndex = dragContext.sourceIndex;
    document.body.style.userSelect = "none";
    groupList.classList.add("is-reordering");
    dragContext.cards[dragContext.sourceIndex].classList.add("dragging");
    applyGroupDragLayout(dragContext, startY);
  };

  const handleMove = (moveEvent) => {
    if (!dragActive) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (dx * dx + dy * dy < GROUP_DRAG_THRESHOLD_PX * GROUP_DRAG_THRESHOLD_PX) {
        return;
      }
      beginDrag();
    }

    if (!dragActive) return;
    moveEvent.preventDefault();
    applyGroupDragLayout(dragContext, moveEvent.clientY);
  };

  const handleUp = () => {
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);

    if (!dragActive) {
      // Treated as a click; nothing to clean up. The card's click handler
      // (selectGroup) fires normally because we never preventDefault'd.
      return;
    }

    document.body.style.userSelect = "";
    state.suppressGroupClickUntil = Date.now() + 250;

    const draggedGroupId = state.draggedGroupId;
    const insertIndex = state.dragInsertIndex;
    const sourceIndex = dragContext?.sourceIndex ?? -1;

    if (!draggedGroupId || !Number.isInteger(insertIndex) || insertIndex === sourceIndex) {
      finishGroupDragRelease(dragContext, sourceIndex, () => clearDragState(true));
      return;
    }

    finishGroupDragRelease(dragContext, insertIndex, () => {
      reorderGroups(draggedGroupId, insertIndex).catch((error) => {
        console.error("Failed to reorder block groups.", error);
        setStatus(t("status.errorReorderGroups"), true);
        clearDragState(true);
      });
    });
  };

  window.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleUp);
}

function createDefaultGroup(groupType = DEFAULT_GROUP_TYPE) {
  const youtubeCount = state.groups.filter((group) => group.groupType === "youtube").length + 1;
  const tiktokCount = state.groups.filter((group) => group.groupType === "tiktok").length + 1;
  const facebookCount = state.groups.filter((group) => group.groupType === "facebook").length + 1;
  const instagramCount = state.groups.filter((group) => group.groupType === "instagram").length + 1;
  const twitchCount = state.groups.filter((group) => group.groupType === "twitch").length + 1;
  const redditCount = state.groups.filter((group) => group.groupType === "reddit").length + 1;
  const discordCount = state.groups.filter((group) => group.groupType === "discord").length + 1;
  const twitterCount = state.groups.filter((group) => group.groupType === "twitter").length + 1;
  const customCount = state.groups.filter((group) => group.groupType === "custom").length + 1;
  const siteCount = state.groups.filter((group) => group.groupType === "site").length + 1;
  const normalizedGroupType = normalizeGroupType(groupType);

  return {
    id: createGroupId(),
    groupType: normalizedGroupType,
    name:
      normalizedGroupType === "youtube"
        ? t("groupName.youtubePattern", { number: youtubeCount })
        : normalizedGroupType === "tiktok"
          ? t("groupName.tiktokPattern", { number: tiktokCount })
        : normalizedGroupType === "facebook"
          ? t("groupName.facebookPattern", { number: facebookCount })
        : normalizedGroupType === "instagram"
          ? t("groupName.instagramPattern", { number: instagramCount })
        : normalizedGroupType === "twitch"
          ? t("groupName.twitchPattern", { number: twitchCount })
        : normalizedGroupType === "reddit"
          ? t("groupName.redditPattern", { number: redditCount })
        : normalizedGroupType === "discord"
          ? t("groupName.discordPattern", { number: discordCount })
        : normalizedGroupType === "twitter"
          ? t("groupName.twitterPattern", { number: twitterCount })
        : normalizedGroupType === "custom"
          ? t("groupName.customPattern", { number: customCount })
        : t("groupName.sitePattern", { number: siteCount }),
    enabled: true,
    mode: "instant",
    allowedMinutes: DEFAULT_ALLOWED_MINUTES,
    resetIntervalHours: DEFAULT_RESET_INTERVAL_HOURS,
    allowSnooze: true,
    // Seed snooze knobs from the global default so the user doesn't redo
    // them per-group. Custom groups don't expose these in the editor but
    // we still keep them populated in case the group type changes later.
    snoozeMinutes: state.globalSettings?.defaultSnoozeMinutes ?? DEFAULT_SNOOZE_MINUTES,
    snoozeActivationDelayMinutes: DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
    snoozeCooldownMinutes: DEFAULT_SNOOZE_COOLDOWN_MINUTES,
    snoozeConfirmations: DEFAULT_SNOOZE_CONFIRMATIONS,
    activeDays: createDefaultDays(),
    timeWindowsText: "",
    platformVideoMode: "all",
    platformAuthorMode: "all",
    platformAuthors: [],
    platformAuthorTags: [],
    redditMode: "all",
    redditSubreddits: [],
    discordMode: "all",
    discordTargets: [],
    surfaceHides: [],
    blockingRulesText: t("custom.defaultRule"),
    activeEventSource: "",
    freezeMode: "none",
    freezeModeChoice: "frozen",
    strictFreezeHours: DEFAULT_STRICT_FREEZE_HOURS,
    frozenAtMs: null,
    parentalPasswordHash: null,
    parentalPasswordSalt: null,
    sites: [],
    blockHomePage: false,
    effect: "block",
    fallbackUrl: state.globalSettings?.defaultFallbackUrl ?? "",
    skipToNextOnBlock: false
  };
}

// The freeze-mode dropdown is the user's chosen mode to apply on the NEXT
// freeze. It is persisted per-group and kept SEPARATE from `freezeMode`
// (the active-frozen state), so selecting a mode never freezes the group on
// its own. Falls back to the active mode, then to a parental hint, then frozen.
const FREEZE_MODE_CHOICES = ["frozen", "strict", "parental"];
function normalizeFreezeModeChoice(group) {
  const choice = group?.freezeModeChoice;
  if (FREEZE_MODE_CHOICES.includes(choice)) return choice;
  if (FREEZE_MODE_CHOICES.includes(group?.freezeMode)) return group.freezeMode;
  if (typeof group?.parentalPasswordHash === "string" && group.parentalPasswordHash) {
    return "parental";
  }
  return "frozen";
}

// Group names must be unique per endpoint so the web-app bridge can link
// groups by name. On load we repair any pre-existing duplicates by suffixing
// " (2)", " (3)", … to all but the first occurrence (case-insensitive).
function dedupeGroupNames(groups) {
  const seen = new Set();
  return groups.map((group) => {
    const base = (group.name || "").trim() || group.name || "";
    let candidate = base;
    let counter = 2;
    while (seen.has(candidate.toLowerCase())) {
      candidate = `${base} (${counter})`;
      counter += 1;
    }
    seen.add(candidate.toLowerCase());
    return candidate === group.name ? group : { ...group, name: candidate };
  });
}

function sanitizeGroups(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  const sanitized = groups.map((group) => {
    const baseGroup = createDefaultGroup(normalizeGroupType(group?.groupType));
    const normalizedGroupType = normalizeGroupType(group?.groupType);
    const rawTimeWindowsText =
      typeof group?.timeWindowsText === "string"
        ? group.timeWindowsText
        : Array.isArray(group?.timeWindows)
          ? group.timeWindows.join("\n")
          : "";
    const parsedTimeWindows = parseTimeWindowsText(rawTimeWindowsText);
    const hasStoredDays = Array.isArray(group?.activeDays);
    const rawDays = hasStoredDays ? group.activeDays : createDefaultDays();
    const activeDays = rawDays
      .map((day) => String(day).trim().toLowerCase())
      .filter((day, index, array) => DAY_NAMES.includes(day) && array.indexOf(day) === index);
    const rawAuthors = Array.isArray(group?.platformAuthors) ? group.platformAuthors : [];
    const rawAuthorTags = Array.isArray(group?.platformAuthorTags) ? group.platformAuthorTags : [];
    const rawRedditSubreddits = Array.isArray(group?.redditSubreddits) ? group.redditSubreddits : [];
    const rawDiscordTargets = Array.isArray(group?.discordTargets) ? group.discordTargets : [];

    return {
      ...baseGroup,
      id: typeof group?.id === "string" && group.id ? group.id : baseGroup.id,
      name:
        typeof group?.name === "string" && group.name.trim()
          ? group.name.trim()
          : baseGroup.name,
      enabled: Boolean(group?.enabled),
      groupType: normalizedGroupType,
      mode: normalizeBlockingMode(group?.mode),
      allowedMinutes:
        parseAllowedMinutes(group?.allowedMinutes) ?? DEFAULT_ALLOWED_MINUTES,
      resetIntervalHours:
        parseResetIntervalHours(group?.resetIntervalHours) ??
        DEFAULT_RESET_INTERVAL_HOURS,
      allowSnooze: group?.allowSnooze !== false,
      snoozeMinutes:
        parseSnoozeMinutes(group?.snoozeMinutes) ?? DEFAULT_SNOOZE_MINUTES,
      snoozeActivationDelayMinutes:
        parseSnoozeDelayMinutes(group?.snoozeActivationDelayMinutes) ??
        DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
      snoozeCooldownMinutes:
        parseSnoozeCooldownMinutes(group?.snoozeCooldownMinutes) ??
        DEFAULT_SNOOZE_COOLDOWN_MINUTES,
      snoozeConfirmations:
        parseSnoozeConfirmations(group?.snoozeConfirmations) ?? DEFAULT_SNOOZE_CONFIRMATIONS,
      activeDays: hasStoredDays ? activeDays : createDefaultDays(),
      timeWindowsText: parsedTimeWindows.normalizedLines.join("\n"),
      platformVideoMode: normalizeVideoMode(group?.platformVideoMode),
      platformAuthorMode: normalizePlatformAuthorMode(group?.platformAuthorMode),
      platformAuthors: [
        ...new Set(
          rawAuthors
            .map((author) => normalizePlatformAuthorInput(author, normalizedGroupType))
            .filter(Boolean)
        )
      ],
      // Visual-only stub: free-form tags for the YouTube tag author modes.
      platformAuthorTags: [
        ...new Set(rawAuthorTags.map((tag) => String(tag ?? "").trim()).filter(Boolean))
      ],
      redditSubreddits: [
        ...new Set(rawRedditSubreddits.map(normalizeRedditSubredditInput).filter(Boolean))
      ],
      redditMode: normalizeRedditMode(group?.redditMode, rawRedditSubreddits),
      discordTargets: [
        ...new Set(
          rawDiscordTargets
            .map((target) => normalizeDiscordTargetInput(target))
            .filter(Boolean)
        )
      ],
      discordMode: normalizeDiscordMode(group?.discordMode, rawDiscordTargets),
      surfaceHides: normalizeSurfaceHides(group?.surfaceHides, normalizedGroupType),
      blockingRulesText:
        typeof group?.blockingRulesText === "string" && group.blockingRulesText.trim()
          ? group.blockingRulesText.trim()
          : baseGroup.blockingRulesText,
      // CRITICAL: this is the source the SW re-runs on restart. Stripping it
      // here used to wipe registrations whenever the popup persisted state
      // (toggle / edit / snooze etc.) — see notes in background.js
      // loadCustomGroupSource and reconcileCustomGroupHandlers.
      activeEventSource:
        typeof group?.activeEventSource === "string" ? group.activeEventSource : "",
      freezeMode:
        group?.freezeMode === "strict" ||
        group?.freezeMode === "frozen" ||
        group?.freezeMode === "parental"
          ? group.freezeMode
          : "none",
      freezeModeChoice: normalizeFreezeModeChoice(group),
      strictFreezeHours:
        parseStrictFreezeHours(group?.strictFreezeHours) ?? DEFAULT_STRICT_FREEZE_HOURS,
      frozenAtMs:
        Number.isFinite(Number(group?.frozenAtMs)) && Number(group.frozenAtMs) > 0
          ? Number(group.frozenAtMs)
          : null,
      parentalPasswordHash:
        typeof group?.parentalPasswordHash === "string" && group.parentalPasswordHash
          ? group.parentalPasswordHash
          : null,
      parentalPasswordSalt:
        typeof group?.parentalPasswordSalt === "string" && group.parentalPasswordSalt
          ? group.parentalPasswordSalt
          : null,
      sites: Array.isArray(group?.sites)
        ? [...new Set(group.sites.map(normalizeSiteInput).filter(Boolean))]
        : [],
      blockHomePage: Boolean(group?.blockHomePage),
      effect: group?.effect === "allow" ? "allow" : "block",
      fallbackUrl: typeof group?.fallbackUrl === "string" ? group.fallbackUrl.trim() : "",
      skipToNextOnBlock: Boolean(group?.skipToNextOnBlock)
    };
  });

  return dedupeGroupNames(sanitized);
}

function sanitizeUsageTimers(value, groups) {
  const timers = {};

  for (const group of groups) {
    timers[group.id] = Math.max(0, Number.parseInt(value?.[group.id], 10) || 0);
  }

  return timers;
}

function sanitizeResetTimes(value, groups) {
  const now = Date.now();
  const resetTimes = {};

  for (const group of groups) {
    const parsed = Number.parseInt(value?.[group.id], 10);
    resetTimes[group.id] = Number.isFinite(parsed) && parsed > 0 ? parsed : now;
  }

  return resetTimes;
}

function sanitizeSnoozes(value, groups) {
  const groupIds = new Set(groups.map((group) => group.id));
  const snoozes = {};

  for (const [groupId, snooze] of Object.entries(value ?? {})) {
    if (!groupIds.has(groupId)) {
      continue;
    }

    const startsAtMs = Number.parseInt(snooze?.startsAtMs, 10);
    const untilMs = Number.parseInt(snooze?.untilMs, 10);
    const cooldownUntilMs = Number.parseInt(snooze?.cooldownUntilMs, 10);
    const confirmationCount = parseSnoozeConfirmations(snooze?.confirmationCount);
    const activeMsApplied = Boolean(snooze?.activeMsApplied);
    // "none" means the group was not frozen when it was snoozed, so it must NOT
    // be refrozen on expiry. Preserve it (and default missing values to "none").
    const refreezeMode =
      snooze?.refreezeMode === "strict" ||
      snooze?.refreezeMode === "frozen" ||
      snooze?.refreezeMode === "parental"
        ? snooze.refreezeMode
        : "none";

    if (
      Number.isFinite(startsAtMs) &&
      Number.isFinite(untilMs) &&
      Number.isFinite(cooldownUntilMs) &&
      startsAtMs <= untilMs &&
      untilMs <= cooldownUntilMs
    ) {
      snoozes[groupId] = {
        startsAtMs,
        untilMs,
        cooldownUntilMs,
        confirmationCount: confirmationCount ?? 0,
        activeMsApplied,
        refreezeMode
      };
    }
  }

  return snoozes;
}

function sanitizeSnoozeTotals(value, groups) {
  const totals = {};
  for (const group of groups) {
    totals[group.id] = Math.max(0, Number.parseInt(value?.[group.id], 10) || 0);
  }
  return totals;
}

function getSerializableGroupSnapshot(group) {
  return {
    name: group.name,
    enabled: group.enabled,
    groupType: group.groupType,
    mode: group.mode,
    allowedMinutes: group.allowedMinutes,
    resetIntervalHours: group.resetIntervalHours,
    allowSnooze: group.allowSnooze !== false,
    snoozeMinutes: group.snoozeMinutes,
    snoozeActivationDelayMinutes:
      group.snoozeActivationDelayMinutes ?? DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
    snoozeCooldownMinutes: group.snoozeCooldownMinutes ?? DEFAULT_SNOOZE_COOLDOWN_MINUTES,
    snoozeConfirmations: group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS,
    activeDays: [...group.activeDays],
    timeWindowsText: group.timeWindowsText,
    platformVideoMode: group.platformVideoMode,
    platformAuthorMode: group.platformAuthorMode,
    platformAuthors: [...group.platformAuthors],
    platformAuthorTags: [...(group.platformAuthorTags ?? [])],
    redditMode: group.redditMode,
    redditSubreddits: [...group.redditSubreddits],
    discordMode: group.discordMode,
    discordTargets: [...group.discordTargets],
    surfaceHides: [...(group.surfaceHides ?? [])],
    blockingRulesText: group.blockingRulesText,
    freezeMode: group.freezeMode,
    freezeModeChoice: normalizeFreezeModeChoice(group),
    strictFreezeHours: group.strictFreezeHours,
    frozenAtMs: group.freezeMode === "none" ? null : group.frozenAtMs,
    parentalPasswordHash: group.parentalPasswordHash ?? null,
    parentalPasswordSalt: group.parentalPasswordSalt ?? null,
    sites: [...group.sites],
    blockHomePage: Boolean(group.blockHomePage),
    effect: group.effect === "allow" ? "allow" : "block",
    fallbackUrl: group.fallbackUrl ?? "",
    skipToNextOnBlock: Boolean(group.skipToNextOnBlock)
  };
}

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(String(value ?? ""));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function decodeUtf8Base64(value) {
  const binary = window.atob(String(value ?? ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeGroupTransferString(group) {
  const payload = {
    version: 1,
    kind: "custom-blocker-group",
    group: getSerializableGroupSnapshot(group)
  };
  const json = JSON.stringify(payload);
  return GROUP_TRANSFER_PREFIX + encodeUtf8Base64(json);
}

function decodeGroupTransferString(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error(t("status.invalidImportGroup"));
  }

  let jsonText = trimmed;
  if (trimmed.startsWith(GROUP_TRANSFER_PREFIX)) {
    const encodedPayload = trimmed.slice(GROUP_TRANSFER_PREFIX.length);
    try {
      jsonText = decodeUtf8Base64(encodedPayload);
    } catch {
      throw new Error(t("status.invalidImportGroup"));
    }
  }

  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error(t("status.invalidImportGroup"));
  }

  const sourceGroup =
    payload?.kind === "custom-blocker-group" && payload?.version === 1 && payload?.group
      ? payload.group
      : payload;
  const sanitizedGroup = sanitizeGroups([sourceGroup])[0];

  if (!sanitizedGroup) {
    throw new Error(t("status.invalidImportGroup"));
  }

  if (
    (sanitizedGroup.freezeMode === "frozen" || sanitizedGroup.freezeMode === "strict") &&
    !Number.isFinite(Number(sourceGroup?.frozenAtMs))
  ) {
    sanitizedGroup.frozenAtMs = Date.now();
  }

  return sanitizedGroup;
}

function getTransferReadySelectedGroup() {
  const group = getSelectedGroup();
  if (!group) {
    throw new Error(t("status.errorExportGroup"));
  }

  const draft = getDraftForGroup(group.id);
  if (!draft) {
    return group;
  }

  return buildUpdatedGroupFromDraft(group, draft).updatedGroup;
}

function groupToDraft(group) {
  return {
    name: group.name,
    enabled: group.enabled,
    mode: group.mode,
    allowedMinutes: String(group.allowedMinutes),
    resetIntervalHours: String(group.resetIntervalHours),
    allowSnooze: group.allowSnooze !== false,
    snoozeMinutes: String(group.snoozeMinutes),
    snoozeActivationDelayMinutes: String(
      group.snoozeActivationDelayMinutes ?? DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES
    ),
    snoozeCooldownMinutes: String(group.snoozeCooldownMinutes ?? DEFAULT_SNOOZE_COOLDOWN_MINUTES),
    snoozeConfirmations: String(group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS),
    activeDays: [...group.activeDays],
    timeWindowsText: group.timeWindowsText,
    sitesText: group.sites.join("\n"),
    platformVideoMode: normalizeVideoMode(group.platformVideoMode),
    platformAuthorMode: normalizePlatformAuthorMode(group.platformAuthorMode),
    platformAuthorsText: group.platformAuthors.join("\n"),
    platformAuthorTagsText: (group.platformAuthorTags ?? []).join("\n"),
    redditMode: normalizeRedditMode(group.redditMode, group.redditSubreddits),
    redditSubredditsText: group.redditSubreddits.join("\n"),
    discordMode: normalizeDiscordMode(group.discordMode, group.discordTargets),
    discordTargetsText: group.discordTargets.join("\n"),
    surfaceHides: normalizeSurfaceHides(group.surfaceHides, group.groupType),
    blockingRulesText: group.blockingRulesText,
    blockHomePage: Boolean(group.blockHomePage),
    effect: group.effect === "allow" ? "allow" : "block",
    fallbackUrl: group.fallbackUrl ?? "",
    skipToNextOnBlock: Boolean(group.skipToNextOnBlock),
    freezeModeChoice: normalizeFreezeModeChoice(group)
  };
}

function getSelectedGroup() {
  return state.groups.find((group) => group.id === state.selectedGroupId) ?? null;
}

function markCustomGroupSourceActive(groupId, source) {
  const activeSource = String(source ?? "");
  state.groups = state.groups.map((item) =>
    item.id === groupId
      ? {
          ...item,
          enabled: true,
          blockingRulesText: activeSource,
          activeEventSource: activeSource,
          lastAbortReason: null,
          lastAbortAt: null
        }
      : item
  );
  state.drafts[groupId] = {
    ...(state.drafts[groupId] ?? {}),
    blockingRulesText: activeSource,
    enabled: true
  };
}

function getDraftForGroup(groupId) {
  const group = state.groups.find((item) => item.id === groupId);
  return group ? state.drafts[groupId] ?? groupToDraft(group) : null;
}

function getDisplayUsageState(group, now = Date.now()) {
  const storedUsedMs = state.usageTimersMs[group.id] ?? 0;
  const storedResetAtMs = state.usageResetAtMs[group.id] ?? now;

  if (!isTimedBlockingMode(group.mode)) {
    return {
      usedMs: storedUsedMs,
      nextResetAtMs: storedResetAtMs
    };
  }

  const intervalMs = group.resetIntervalHours * MS_PER_HOUR;

  if (intervalMs <= 0) {
    return {
      usedMs: storedUsedMs,
      nextResetAtMs: storedResetAtMs
    };
  }

  const elapsedSinceReset = now - storedResetAtMs;

  if (elapsedSinceReset < intervalMs) {
    return {
      usedMs: storedUsedMs,
      nextResetAtMs: storedResetAtMs + intervalMs
    };
  }

  const elapsedIntervals = Math.floor(elapsedSinceReset / intervalMs);

  return {
    usedMs: 0,
    nextResetAtMs: storedResetAtMs + (elapsedIntervals + 1) * intervalMs
  };
}

function getSnoozePhase(snooze, now = Date.now()) {
  if (!snooze) return "none";
  if (Number.isFinite(snooze.startsAtMs) && now < snooze.startsAtMs) return "pending";
  if (Number.isFinite(snooze.untilMs) && now < snooze.untilMs) return "active";
  if (Number.isFinite(snooze.cooldownUntilMs) && now < snooze.cooldownUntilMs) return "cooldown";
  return "none";
}

function getCurrentSnooze(groupId, now = Date.now()) {
  const snooze = state.groupSnoozes[groupId];
  return getSnoozePhase(snooze, now) === "none" ? null : snooze;
}

function getActiveSnooze(groupId, now = Date.now()) {
  const snooze = state.groupSnoozes[groupId];
  return getSnoozePhase(snooze, now) === "active" ? snooze : null;
}

function getDisplayedSnoozeTotalMs(groupId, now = Date.now()) {
  const baseTotal = Math.max(
    Math.max(0, Number(state.groupSnoozeTotalsMs[groupId]) || 0),
    Math.max(0, Number(state.clusterSnoozeTotalsMs[groupId]) || 0)
  );
  const snooze = state.groupSnoozes[groupId];
  if (getSnoozePhase(snooze, now) !== "active") {
    return baseTotal;
  }
  return baseTotal + Math.max(0, now - snooze.startsAtMs);
}

function getFreezeStatus(group, now = Date.now()) {
  const isFrozen = group.freezeMode !== "none";
  const isStrict = group.freezeMode === "strict";
  const isParental = group.freezeMode === "parental";
  const unlockedAtMs =
    isStrict && group.frozenAtMs
      ? group.frozenAtMs + group.strictFreezeHours * MS_PER_HOUR
      : null;
  const lockedRemainingMs =
    unlockedAtMs && unlockedAtMs > now ? unlockedAtMs - now : 0;

  return {
    isFrozen,
    isStrict,
    isParental,
    hasParentalPassword: Boolean(group.parentalPasswordHash),
    unlockedAtMs,
    lockedRemainingMs,
    // Parental groups are gated by password (verified separately), not by a
    // time lock or the multi-step ritual.
    canUnfreeze: isFrozen && (!isStrict || lockedRemainingMs <= 0)
  };
}

function isGroupEditable(group, now = Date.now()) {
  return !getFreezeStatus(group, now).isFrozen;
}

// --- Parental password (per-group 6-digit PIN) ---------------------------
const PARENTAL_PIN_LENGTH = 6;

function isValidParentalPin(pin) {
  return typeof pin === "string" && new RegExp(`^\\d{${PARENTAL_PIN_LENGTH}}$`).test(pin);
}

function randomSaltHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  if (globalThis.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Non-crypto fallback hash (cyrb53) for contexts without crypto.subtle
// (e.g. WKWebView custom-scheme pages are not secure contexts). Only used
// to avoid storing the raw PIN; the real protection is the salted SHA-256.
function fallbackHashHex(str) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return "fb" + out.toString(16).padStart(14, "0");
}

async function hashParentalPin(pin, saltHex) {
  const data = String(saltHex) + ":" + String(pin);
  if (globalThis.crypto && crypto.subtle && crypto.subtle.digest) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (err) {
      // fall through to fallback
    }
  }
  return fallbackHashHex(data);
}

function constantTimeEqual(a, b) {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}

async function setGroupParentalPin(group, pin) {
  if (!group || !isValidParentalPin(pin)) return false;
  const salt = randomSaltHex();
  group.parentalPasswordSalt = salt;
  group.parentalPasswordHash = await hashParentalPin(pin, salt);
  return true;
}

function clearGroupParentalPin(group) {
  if (!group) return;
  group.parentalPasswordHash = null;
  group.parentalPasswordSalt = null;
}

async function verifyGroupParentalPin(group, pin) {
  if (!group || !group.parentalPasswordHash || !group.parentalPasswordSalt) return false;
  if (!isValidParentalPin(pin)) return false;
  const hash = await hashParentalPin(pin, group.parentalPasswordSalt);
  return constantTimeEqual(hash, group.parentalPasswordHash);
}

// --- Overlay panel channel ----------------------------------------------
// Opens an overlay panel (built from panel-control snapshots) and routes its
// interaction events to `onEvent`. On macOS this renders as a true native
// NSPanel overlay via the system-panel bridge; on the extensions / plain
// Safari it falls back to an in-popup overlay rendered here.
// Returns { update(nextSnapshot), close() }.
let __cbOverlayPanelSeq = 0;

function __cbIsNativeOverlayHost() {
  return (
    typeof window.__cbSystemPanelEvent === "function" &&
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    typeof chrome.runtime.sendMessage === "function"
  );
}

function openOverlayPanel(snapshot, onEvent, opts = {}) {
  const panelId = snapshot.id || "cb-overlay-" + ++__cbOverlayPanelSeq;
  const snap = { ...snapshot, id: panelId };
  if (!opts.internal && __cbIsNativeOverlayHost()) {
    return __cbOpenNativeOverlay(panelId, snap, onEvent);
  }
  return __cbOpenInPopupOverlay(panelId, snap, onEvent);
}

function __cbOpenNativeOverlay(panelId, snap, onEvent) {
  const handler = (ev) => {
    if (!ev || ev.panelId !== panelId) return;
    let values = {};
    if (ev.valuesJSON) {
      try {
        values = JSON.parse(ev.valuesJSON);
      } catch (_) {}
    }
    onEvent({
      controlId: ev.controlId || "",
      eventName: ev.eventName || "",
      value: ev.value,
      values
    });
  };
  window.__cbSystemPanelHandlers = window.__cbSystemPanelHandlers || [];
  window.__cbSystemPanelHandlers.push(handler);
  try {
    chrome.runtime.sendMessage({ type: "show-system-panel", snapshot: snap });
  } catch (_) {}
  let closed = false;
  return {
    update(nextSnapshot) {
      try {
        chrome.runtime.sendMessage({
          type: "show-system-panel",
          snapshot: { ...nextSnapshot, id: panelId }
        });
      } catch (_) {}
    },
    close() {
      if (closed) return;
      closed = true;
      const arr = window.__cbSystemPanelHandlers || [];
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
      try {
        chrome.runtime.sendMessage({ type: "dismiss-system-panel", id: panelId });
      } catch (_) {}
    }
  };
}

function __cbEnsureOverlayStyles() {
  if (document.getElementById("cb-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "cb-overlay-styles";
  style.textContent = [
    ".cb-overlay-backdrop{position:fixed;inset:0;background:rgba(15,23,42,0.42);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:20px;box-sizing:border-box;animation:cbOverlayFade .15s ease;}",
    ".cb-overlay-card{width:min(360px,100%);box-sizing:border-box;background:var(--surface,#fff);color:var(--text,#0f172a);border-radius:16px;padding:20px;box-shadow:0 18px 40px rgba(15,23,42,0.22);display:flex;flex-direction:column;gap:14px;animation:cbOverlayPop .18s cubic-bezier(.2,.8,.3,1);}",
    ".cb-overlay-title{font-size:18px;font-weight:600;margin:0;}",
    ".cb-overlay-text{font-size:13px;color:#475569;line-height:1.45;}",
    ".cb-overlay-label{font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;}",
    ".cb-overlay-row{display:flex;flex-direction:column;}",
    ".cb-overlay-pin{display:flex;gap:10px;align-items:center;justify-content:center;cursor:text;}",
    ".cb-overlay-pin-box{width:40px;height:50px;border-radius:10px;background:#f1f5f9;border:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font:600 22px ui-monospace,Menlo,monospace;color:#0f172a;transition:border-color .12s,background .12s,box-shadow .12s;}",
    ".cb-overlay-pin-box.filled{background:#fff;border-color:#cbd5e1;}",
    ".cb-overlay-pin-box.active{border-color:var(--navy-700,#1e3a8a);box-shadow:0 0 0 3px rgba(30,58,138,0.16);}",
    ".cb-overlay-pin-input{position:absolute;opacity:0;width:1px;height:1px;border:0;padding:0;}",
    ".cb-overlay-input{box-sizing:border-box;width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:13px;}",
    ".cb-overlay-input:focus{outline:none;border-color:var(--navy-700,#1e3a8a);box-shadow:0 0 0 3px rgba(30,58,138,0.16);}",
    ".cb-overlay-buttons{display:flex;gap:8px;justify-content:flex-end;margin-top:6px;}",
    ".cb-overlay-button{border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;background:#e2e8f0;color:#0f172a;transition:filter .12s;}",
    ".cb-overlay-button:hover{filter:brightness(0.96);}",
    ".cb-overlay-button-primary{background:var(--navy-700,#1e3a8a);color:#fff;}",
    "@keyframes cbOverlayFade{from{opacity:0}to{opacity:1}}",
    "@keyframes cbOverlayPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}"
  ].join("");
  document.head.appendChild(style);
}

function __cbOpenInPopupOverlay(panelId, snap, onEvent) {
  __cbEnsureOverlayStyles();
  let backdrop = document.getElementById(panelId + "-backdrop");
  if (backdrop) backdrop.remove();
  backdrop = document.createElement("div");
  backdrop.id = panelId + "-backdrop";
  backdrop.className = "cb-overlay-backdrop";
  const card = document.createElement("div");
  card.className = "cb-overlay-card";
  backdrop.appendChild(card);
  document.body.appendChild(backdrop);

  const values = {};
  const collect = () => ({ ...values });

  function renderControl(control) {
    const type = control.type;
    const row = document.createElement("div");
    row.className = "cb-overlay-row";
    if (type === "text" || type === "section") {
      const p = document.createElement("div");
      p.className = "cb-overlay-text";
      p.textContent = control.text || control.label || "";
      row.appendChild(p);
    } else if (type === "pin") {
      const len = Math.max(3, Math.min(12, Math.floor(Number(control.length)) || 6));
      const masked = control.masked !== false;
      values[control.id] = String(control.value || "").replace(/\D/g, "").slice(0, len);
      if (control.label) {
        const lbl = document.createElement("div");
        lbl.className = "cb-overlay-label";
        lbl.textContent = control.label;
        row.appendChild(lbl);
      }
      const wrap = document.createElement("div");
      wrap.className = "cb-overlay-pin";
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.maxLength = len;
      input.className = "cb-overlay-pin-input";
      input.value = values[control.id];
      const boxes = [];
      for (let i = 0; i < len; i++) {
        const b = document.createElement("div");
        b.className = "cb-overlay-pin-box";
        boxes.push(b);
        wrap.appendChild(b);
      }
      const draw = () => {
        const v = values[control.id];
        for (let i = 0; i < len; i++) {
          boxes[i].textContent = i < v.length ? (masked ? "\u2022" : v[i]) : "";
          boxes[i].classList.toggle("filled", i < v.length);
          boxes[i].classList.toggle("active", i === Math.min(v.length, len - 1));
        }
      };
      draw();
      input.addEventListener("input", () => {
        const d = input.value.replace(/\D/g, "").slice(0, len);
        if (d !== input.value) input.value = d;
        values[control.id] = d;
        draw();
        onEvent({ controlId: control.id, eventName: "change", value: d, values: collect() });
        if (control.autoSubmit === true && d.length === len) {
          onEvent({ controlId: control.id, eventName: "submit", value: d, values: collect() });
        }
      });
      wrap.addEventListener("click", () => input.focus());
      row.appendChild(wrap);
      row.appendChild(input);
      setTimeout(() => input.focus(), 30);
    } else if (type === "textInput") {
      if (control.label) {
        const lbl = document.createElement("div");
        lbl.className = "cb-overlay-label";
        lbl.textContent = control.label;
        row.appendChild(lbl);
      }
      const input = document.createElement("input");
      input.type = "text";
      input.className = "cb-overlay-input";
      input.placeholder = control.placeholder || "";
      input.value = control.value || "";
      values[control.id] = input.value;
      input.addEventListener("input", () => {
        values[control.id] = input.value;
        onEvent({ controlId: control.id, eventName: "change", value: input.value, values: collect() });
      });
      row.appendChild(input);
    } else if (type === "button") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cb-overlay-button";
      if (control.action === "submit") btn.classList.add("cb-overlay-button-primary");
      btn.textContent = control.label || "Button";
      btn.addEventListener("click", () => {
        const action =
          control.action === "submit" || control.action === "cancel" || control.action === "close"
            ? control.action
            : "click";
        onEvent({ controlId: control.id, eventName: action, value: control.value ?? true, values: collect() });
      });
      row.appendChild(btn);
    }
    return row;
  }

  function build(snapshot) {
    card.innerHTML = "";
    for (const k of Object.keys(values)) delete values[k];
    if (snapshot.title) {
      const h = document.createElement("div");
      h.className = "cb-overlay-title";
      h.textContent = snapshot.title;
      card.appendChild(h);
    }
    const buttonRow = document.createElement("div");
    buttonRow.className = "cb-overlay-buttons";
    for (const control of Array.isArray(snapshot.controls) ? snapshot.controls : []) {
      const el = renderControl(control);
      if (control.type === "button") buttonRow.appendChild(el);
      else card.appendChild(el);
    }
    if (buttonRow.childNodes.length) card.appendChild(buttonRow);
  }

  build(snap);
  let closed = false;
  return {
    update(nextSnapshot) {
      build({ ...nextSnapshot, id: panelId });
    },
    close() {
      if (closed) return;
      closed = true;
      const el = document.getElementById(panelId + "-backdrop");
      if (el) el.remove();
    }
  };
}

function collectSelectedDays() {
  return dayCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}

function getEffectiveGroup(group, draft) {
  const mode = normalizeBlockingMode(draft?.mode ?? group.mode);
  const allowedMinutes =
    mode === "timer"
      ? group.resetIntervalHours * 60
      : parseAllowedMinutes(draft?.allowedMinutes) ?? group.allowedMinutes;
  const resetIntervalHours =
    parseResetIntervalHours(draft?.resetIntervalHours) ?? group.resetIntervalHours;
  return {
    ...group,
    mode,
    allowedMinutes,
    resetIntervalHours
  };
}

function getGroupMetaText(group, draft, now = Date.now()) {
  const effectiveGroup = getEffectiveGroup(group, draft);
  const snooze = getCurrentSnooze(group.id, now);
  const snoozePhase = getSnoozePhase(snooze, now);
  const freezeStatus = getFreezeStatus(group, now);
  const pieces = [getGroupTypeLabel(group.groupType)];

  if (isPlatformVideoGroupType(group.groupType)) {
    const draftAuthors = parsePlatformAuthorsTextarea(
      group.groupType,
      draft?.platformAuthorsText ?? ""
    ).validAuthors;
    pieces.push(
      describePlatformVideoScope({
        groupType: group.groupType,
        platformVideoMode: draft?.platformVideoMode ?? group.platformVideoMode,
        platformAuthorMode: draft?.platformAuthorMode ?? group.platformAuthorMode,
        platformAuthors: draftAuthors.length > 0 ? draftAuthors : group.platformAuthors
      })
    );
  } else if (group.groupType === "reddit") {
    const draftSubreddits = parseRedditSubredditsTextarea(
      draft?.redditSubredditsText ?? ""
    ).validSubreddits;
    pieces.push(
      describeRedditScope({
        redditMode: draft?.redditMode ?? group.redditMode,
        redditSubreddits:
          draftSubreddits.length > 0 ? draftSubreddits : group.redditSubreddits
      })
    );
  } else if (group.groupType === "discord") {
    const draftTargets = parseDiscordTargetsTextarea(
      draft?.discordTargetsText ?? ""
    ).validTargets;
    pieces.push(
      describeDiscordScope({
        discordMode: draft?.discordMode ?? group.discordMode,
        discordTargets: draftTargets.length > 0 ? draftTargets : group.discordTargets
      })
    );
  } else if (group.groupType === "twitter") {
    const draftAccounts = parsePlatformAuthorsTextarea(
      group.groupType,
      draft?.platformAuthorsText ?? ""
    ).validAuthors;
    pieces.push(
      describeTwitterScope({
        platformAuthorMode: draft?.platformAuthorMode ?? group.platformAuthorMode,
        platformAuthors: draftAccounts.length > 0 ? draftAccounts : group.platformAuthors
      })
    );
  } else if (group.groupType === "custom") {
    pieces.push(t("meta.customRules"));
  } else {
    const siteCount = draft
      ? parseSiteTextareaValue(draft.sitesText).validSites.length
      : group.sites.length;
    pieces.push(`${siteCount} ${t("meta.siteCount", { suffix: siteCount === 1 ? "" : "s" })}`);
  }

  const blockHomePage = draft?.blockHomePage ?? group.blockHomePage;
  if (blockHomePage && group.groupType !== "site" && group.groupType !== "custom") {
    pieces.push(t("meta.homeFeed"));
  }

  if (snoozePhase === "pending") {
    pieces.push(`${t("meta.snoozePending")} ${formatDurationMs(snooze.startsAtMs - now)}`);
  } else if (snoozePhase === "active") {
    pieces.push(`${t("meta.snoozed")} ${formatDurationMs(snooze.untilMs - now)}`);
  } else if (snoozePhase === "cooldown") {
    pieces.push(`${t("meta.snoozeCooldown")} ${formatDurationMs(snooze.cooldownUntilMs - now)}`);
  } else if (effectiveGroup.mode === "instant") {
    pieces.push(t("meta.instantBlock"));
  } else if (effectiveGroup.mode === "timer") {
    // Count-up stopwatch: show elapsed time, not a countdown.
    const usageState = getDisplayUsageState(effectiveGroup, now);
    pieces.push(`${formatDurationMs(usageState.usedMs)} ${t("meta.elapsed")}`);
  } else {
    const remainingMs = Math.max(
      effectiveGroup.allowedMinutes * MS_PER_MINUTE - getDisplayUsageState(effectiveGroup, now).usedMs,
      0
    );
    pieces.push(`${formatDurationMs(remainingMs)} ${t("meta.left")}`);
  }

  if (freezeStatus.isStrict) {
    pieces.push(
      freezeStatus.lockedRemainingMs > 0
        ? `${t("meta.strictFrozen")} ${formatDurationMs(freezeStatus.lockedRemainingMs)}`
        : t("meta.strictFrozen")
    );
  } else if (freezeStatus.isFrozen) {
    pieces.push(t("meta.frozen"));
  }

  pieces.push(group.enabled ? t("meta.enabled") : t("meta.disabled"));
  return pieces.join(" • ");
}

function hasStrictLockedGroups(now = Date.now()) {
  return state.groups.some((group) => {
    const freezeStatus = getFreezeStatus(group, now);
    return freezeStatus.isStrict && freezeStatus.lockedRemainingMs > 0;
  });
}

function hasFrozenGroups(now = Date.now()) {
  return state.groups.some((group) => getFreezeStatus(group, now).isFrozen);
}

function confirmDeleteAllFrozenGroups() {
  state.unfreezeFlow = {
    kind: "delete-all",
    label: t("groups.deleteAllButton"),
    confirmationsLeft: UNFREEZE_CONFIRMATIONS_REQUIRED,
    nextAllowedAtMs: Date.now() + UNFREEZE_CONFIRMATION_INTERVAL_MS
  };

  if (state.confirmIntervalId !== null) {
    window.clearInterval(state.confirmIntervalId);
  }

  state.confirmIntervalId = window.setInterval(() => {
    renderUnfreezeModal();
  }, 250);

  renderUnfreezeModal();
  return false;
}

function updateBulkActionsUI(now = Date.now()) {
  const strictLocked = hasStrictLockedGroups(now);
  deleteAllGroupsButton.disabled = strictLocked || state.groups.length === 0;
  bulkActionNotice.textContent = strictLocked ? t("groups.deleteAllDisabled") : "";
}

function renderGroupList(now = Date.now()) {
  groupList.classList.remove("is-reordering");
  groupList.textContent = "";

  if (state.groups.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = t("empty.noGroups");
    groupList.appendChild(emptyState);
    return;
  }

  for (const group of state.groups) {
    const draft = getDraftForGroup(group.id);
    const freezeStatus = getFreezeStatus(group, now);
    const card = document.createElement("div");
    card.className = `group-card${group.id === state.selectedGroupId ? " active" : ""}`;
    card.dataset.groupId = group.id;

    if (group.id === state.draggedGroupId) {
      card.classList.add("dragging");
    }

    if (groupConnectionCluster(group)) {
      card.classList.add("bridge-connected");
    }

    const header = document.createElement("div");
    header.className = "group-card-header";

    const textWrap = document.createElement("div");
    const topline = document.createElement("div");
    topline.className = "group-card-topline";

    const dragHandle = document.createElement("span");
    dragHandle.className = "drag-handle";
    dragHandle.textContent = "::";
    dragHandle.setAttribute("aria-label", t("groups.reorderHandleAria", { name: group.name }));

    const name = document.createElement("p");
    name.className = "group-name";
    name.textContent = draft?.name?.trim() || group.name;

    const meta = document.createElement("p");
    meta.className = "group-meta";
    meta.textContent = getGroupMetaText(group, draft, now);

    const toggle = document.createElement("input");
    toggle.className = "group-toggle";
    toggle.type = "checkbox";
    toggle.checked = group.enabled;
    toggle.disabled = freezeStatus.isFrozen;
    toggle.setAttribute("aria-label", `${t("editor.enableGroup")}: ${group.name}`);

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    toggle.addEventListener("change", () => {
      updateGroupEnabled(group.id, toggle.checked);
    });

    topline.append(dragHandle, name);
    textWrap.append(topline, meta);
    header.append(textWrap, toggle);
    card.appendChild(header);

    // mousedown anywhere on the card (except on the toggle, which manages
    // its own clicks) starts a threshold-based reorder. A short click with
    // no movement falls through to the click handler below, which selects
    // the group as before.
    card.addEventListener("mousedown", (event) => {
      if (event.target === toggle) {
        return;
      }
      startGroupReorder(event, group.id);
    });

    card.addEventListener("click", (event) => {
      if (state.draggedGroupId || Date.now() < state.suppressGroupClickUntil) {
        // We just finished a drag; suppress the trailing synthetic click
        // so we don't accidentally re-select after reordering.
        event.preventDefault();
        return;
      }
      selectGroup(group.id);
    });

    groupList.appendChild(card);
  }
}

function updateUsageSummary(group, draft, now = Date.now()) {
  const mode = normalizeBlockingMode(draft?.mode ?? group?.mode);
  if (!group || !draft || !isTimedBlockingMode(mode)) {
    usageSummary.textContent = "";
    return;
  }

  const displayGroup = getEffectiveGroup(group, draft);
  const usageState = getDisplayUsageState(displayGroup, now);
  if (mode === "timer") {
    // Count-up stopwatch: show elapsed time used this window.
    usageSummary.textContent = t("timed.summaryTimer", {
      time: formatDurationMs(usageState.usedMs),
      hours: formatHours(displayGroup.resetIntervalHours),
      suffix: displayGroup.resetIntervalHours === 1 ? "" : "s"
    });
    return;
  }

  const remainingMs = Math.max(displayGroup.allowedMinutes * MS_PER_MINUTE - usageState.usedMs, 0);
  usageSummary.textContent = t("timed.summary", {
    time: formatDurationMs(remainingMs),
    hours: formatHours(displayGroup.resetIntervalHours),
    suffix: displayGroup.resetIntervalHours === 1 ? "" : "s"
  });
}

function updateFreezeUI(group, now = Date.now()) {
  if (!group) {
    freezeSummary.textContent = "";
    freezeSetup.classList.add("hidden");
    strictFreezeSettings.classList.add("hidden");
    if (parentalSettingsButton) parentalSettingsButton.classList.add("hidden");
    applyFreezeButton.disabled = true;
    unfreezeButton.classList.add("hidden");
    unfreezeButton.disabled = true;
    return;
  }

  const freezeStatus = getFreezeStatus(group, now);
  const strictDraftHours = parseStrictFreezeHours(strictFreezeHoursField.value);

  // When a group is linked into a cluster but any member is offline, freeze
  // state must NOT change (it can't be reconciled safely while disconnected).
  // Lock the whole freeze control set and explain why.
  const freezeCluster = groupConnectionCluster(group);
  const freezeBridgeLocked = Boolean(freezeCluster) && !clusterAllOnline(freezeCluster);
  if (freezeBridgeNotice) freezeBridgeNotice.classList.toggle("hidden", !freezeBridgeLocked);
  if (freezeBridgeLocked) {
    freezeSummary.textContent = freezeStatus.isFrozen
      ? t("freeze.summary.frozen")
      : t("freeze.summary.notFrozen");
    freezeSetup.classList.add("hidden");
    strictFreezeSettings.classList.add("hidden");
    if (parentalSettingsButton) parentalSettingsButton.classList.add("hidden");
    applyFreezeButton.disabled = true;
    unfreezeButton.classList.toggle("hidden", !freezeStatus.isFrozen);
    unfreezeButton.disabled = true;
    freezeModeField.disabled = true;
    return;
  }
  freezeModeField.disabled = false;

  if (!freezeStatus.isFrozen) {
    const draftMode = freezeModeField.value;
    freezeSummary.textContent = t("freeze.summary.notFrozen");
    freezeSetup.classList.remove("hidden");
    strictFreezeSettings.classList.toggle("hidden", draftMode !== "strict");
    if (parentalSettingsButton) {
      parentalSettingsButton.classList.toggle("hidden", draftMode !== "parental");
    }
    applyFreezeButton.disabled = draftMode === "strict" && strictDraftHours === null;
    unfreezeButton.classList.add("hidden");
    unfreezeButton.disabled = true;
    return;
  }

  freezeSetup.classList.add("hidden");
  unfreezeButton.classList.remove("hidden");
  unfreezeButton.disabled = !freezeStatus.canUnfreeze;
  if (parentalSettingsButton) {
    parentalSettingsButton.classList.toggle("hidden", !freezeStatus.isParental);
  }

  if (freezeStatus.isStrict && freezeStatus.lockedRemainingMs > 0) {
    freezeSummary.textContent = t("freeze.summary.strictLocked", {
      time: formatDurationMs(freezeStatus.lockedRemainingMs)
    });
    return;
  }

  freezeSummary.textContent = freezeStatus.isParental
    ? t("freeze.summary.parental")
    : freezeStatus.isStrict
      ? t("freeze.summary.strictReady")
      : t("freeze.summary.ready");
}

function updateSnoozeUI(group, now = Date.now()) {
  if (!group) {
    snoozeSummary.textContent = "";
    allowSnoozeField.checked = true;
    allowSnoozeField.disabled = true;
    snoozeMinutesField.disabled = true;
    snoozeActivationDelayField.disabled = true;
    snoozeCooldownField.disabled = true;
    snoozeConfirmationsField.disabled = true;
    startSnoozeButton.disabled = true;
    endSnoozeButton.classList.add("hidden");
    setSnoozeWarning("");
    return;
  }

  const snooze = getCurrentSnooze(group.id, now);
  const snoozePhase = getSnoozePhase(snooze, now);
  const freezeStatus = getFreezeStatus(group, now);
  // Prefer the draft so optimistic UI doesn't snap back during autosave.
  const draft = getDraftForGroup(group.id);
  const allowSnooze = draft?.allowSnooze ?? (group.allowSnooze !== false);
  const totalSnoozedMs = getDisplayedSnoozeTotalMs(group.id, now);
  const isCustomGroup = group.groupType === "custom";

  allowSnoozeField.checked = allowSnooze;
  allowSnoozeField.disabled = freezeStatus.isFrozen;
  snoozeMinutesField.disabled = freezeStatus.isFrozen || !allowSnooze;
  snoozeActivationDelayField.disabled = freezeStatus.isFrozen || !allowSnooze;
  snoozeCooldownField.disabled = freezeStatus.isFrozen || !allowSnooze;
  snoozeConfirmationsField.disabled = freezeStatus.isFrozen || !allowSnooze;

  // Custom groups own snooze semantics via the snoozePress handler, so
  // the numeric knobs are hidden and a copy line replaces them.
  if (snoozeNumericFields) {
    snoozeNumericFields.classList.toggle("hidden", isCustomGroup);
  }
  if (snoozeCustomCopy) {
    snoozeCustomCopy.classList.toggle("hidden", !isCustomGroup);
  }

  if (!snooze) {
    startSnoozeButton.disabled = !allowSnooze;
    snoozeSummary.textContent = !allowSnooze
      ? freezeStatus.isFrozen
        ? t("snooze.summary.disabledFrozen")
        : t("snooze.summary.disabled")
      : freezeStatus.isFrozen
        ? t("snooze.summary.frozen")
        : t("snooze.summary.normal");
    snoozeSummary.textContent += ` ${t("snooze.summary.total", {
      time: formatDurationMs(totalSnoozedMs)
    })}`;
    endSnoozeButton.classList.add("hidden");
    return;
  }

  startSnoozeButton.disabled = true;
  if (snoozePhase === "pending") {
    snoozeSummary.textContent = t("snooze.summary.pending", {
      delay: formatDurationMs(snooze.startsAtMs - now),
      time: formatDurationMs(snooze.untilMs - snooze.startsAtMs)
    });
    endSnoozeButton.classList.remove("hidden");
  } else if (snoozePhase === "active") {
    snoozeSummary.textContent = t("snooze.summary.active", {
      time: formatDurationMs(snooze.untilMs - now)
    });
    endSnoozeButton.classList.remove("hidden");
  } else {
    snoozeSummary.textContent = t("snooze.summary.cooldown", {
      time: formatDurationMs(snooze.cooldownUntilMs - now)
    });
    endSnoozeButton.classList.add("hidden");
  }
  snoozeSummary.textContent += ` ${t("snooze.summary.total", {
    time: formatDurationMs(totalSnoozedMs)
  })}`;
}

function renderEditor(now = Date.now()) {
  const group = getSelectedGroup();

  if (!group) {
    editorTitle.textContent = t("editor.title");
    editorCopy.textContent = t("editor.copy");
    groupTypeSummary.textContent = "";
    groupNameField.value = "";
    groupEnabledField.checked = false;
    blockModeField.value = "instant";
    allowedMinutesField.value = "";
    resetIntervalHoursField.value = "";
    snoozeMinutesField.value = "";
    snoozeActivationDelayField.value = "";
    snoozeCooldownField.value = "";
    snoozeConfirmationsField.value = "";
    scheduleWindowsField.value = "";
    blockedSitesField.value = "";
    blockingRulesField.value = "";
    platformAuthorsField.value = "";
    platformVideoModeField.value = "all";
    platformAuthorModeField.value = "none";
    redditModeField.value = "all";
    redditSubredditsField.value = "";
    discordModeField.value = "all";
    discordTargetsField.value = "";
    allowSnoozeField.checked = true;
    freezeModeField.value = "frozen";
    strictFreezeHoursField.value = "";
    usageSummary.textContent = "";
    platformBlockHomePageField.checked = false;
    redditBlockHomePageField.checked = false;
    discordBlockHomePageField.checked = false;
    fallbackUrlField.value = "";
    if (groupEffectField) groupEffectField.value = "block";
    if (groupEffectSection) groupEffectSection.classList.add("hidden");
    skipToNextOnBlockField.checked = false;
    skipToNextOnBlockRow.classList.add("hidden");
    blockModeSection.classList.remove("hidden");
    timedSettings.classList.add("hidden");
    customSettingsCard.classList.add("hidden");
    if (platformRulesCard) platformRulesCard.classList.add("hidden");
    platformVideoCard.classList.add("hidden");
    redditSettingsCard.classList.add("hidden");
    discordSettingsCard.classList.add("hidden");
    if (surfaceHidesSection) surfaceHidesSection.classList.add("hidden");
    scheduleSection.classList.remove("hidden");
    siteSettingsSection.classList.remove("hidden");
    dayCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
      checkbox.disabled = true;
    });
    groupNameField.disabled = true;
    groupEnabledField.disabled = true;
    blockModeField.disabled = true;
    allowedMinutesField.disabled = true;
    resetIntervalHoursField.disabled = true;
    snoozeMinutesField.disabled = true;
    snoozeActivationDelayField.disabled = true;
    snoozeCooldownField.disabled = true;
    snoozeConfirmationsField.disabled = true;
    scheduleWindowsField.disabled = true;
    blockedSitesField.disabled = true;
    blockingRulesField.disabled = true;
    platformAuthorsField.disabled = true;
    platformVideoModeField.disabled = true;
    platformAuthorModeField.disabled = true;
    redditModeField.disabled = true;
    redditSubredditsField.disabled = true;
    discordModeField.disabled = true;
    discordTargetsField.disabled = true;
    allowSnoozeField.disabled = true;
    snoozeConfirmationsField.disabled = true;
    clearSitesButton.disabled = true;
    deleteGroupButton.disabled = true;
    exportGroupButton.disabled = true;
    importGroupButton.disabled = true;
    applyFreezeButton.disabled = true;
    platformBlockHomePageField.disabled = true;
    redditBlockHomePageField.disabled = true;
    discordBlockHomePageField.disabled = true;
    fallbackUrlField.disabled = true;
    skipToNextOnBlockField.disabled = true;
    state.aiPromptGroupId = null;
    if (aiPromptPanel) {
      aiPromptPanel.classList.add("hidden");
    }
    if (aiPromptInput) {
      aiPromptInput.value = "";
      aiPromptInput.disabled = true;
    }
    if (aiPromptCopyButton) {
      aiPromptCopyButton.disabled = true;
    }
    if (aiPromptStatus) {
      aiPromptStatus.textContent = "";
      aiPromptStatus.className = "run-status";
    }
    updateFreezeUI(null, now);
    updateSnoozeUI(null, now);
    setSnoozeWarning("");
    updateBlockingRulesEditor();
    renderBlockedSites();
    if (connectionGroupSection) connectionGroupSection.classList.add("hidden");
    return;
  }

  const draft = getDraftForGroup(group.id);
  const editable = isGroupEditable(group, now);
  const freezeStatus = getFreezeStatus(group, now);
  const selectedMode = normalizeBlockingMode(draft?.mode ?? group.mode);
  const isTimedMode = isTimedBlockingMode(selectedMode);
  const isPlatformVideoGroup = isPlatformVideoGroupType(group.groupType);
  const isTwitterGroup = normalizeGroupType(group.groupType) === "twitter";
  // Twitter/X reuses the account (author) controls, minus the video-form axis.
  const usesAuthorAxis = isPlatformVideoGroup || isTwitterGroup;
  const isRedditGroup = group.groupType === "reddit";
  const isDiscordGroup = group.groupType === "discord";
  const isCustomGroup = group.groupType === "custom";
  const isPlatformProfileGroup = isPlatformProfileGroupType(group.groupType);

  if (aiPromptInput) {
    if (isCustomGroup) {
      if (state.aiPromptGroupId !== group.id) {
        aiPromptInput.value = loadAiPromptDraft(group.id);
        state.aiPromptGroupId = group.id;
      }
    } else {
      aiPromptInput.value = "";
      state.aiPromptGroupId = null;
    }
  }

  if (isPlatformProfileGroup) {
    applyPlatformRulesHeader(group.groupType);
  }
  if (usesAuthorAxis) {
    applyPlatformVideoUi(group.groupType);
  }
  chipsGroupType = normalizeGroupType(group.groupType);

  editorTitle.textContent = draft?.name?.trim() || group.name;
  editorCopy.textContent = isCustomGroup ? t("custom.editorCopy") : t("editor.copy");
  groupTypeSummary.textContent = getEditorTypeSummary(group.groupType);
  groupNameField.value = draft?.name ?? group.name;
  groupEnabledField.checked = draft?.enabled ?? group.enabled;
  blockModeField.value = draft?.mode ?? group.mode;
  allowedMinutesField.value = draft?.allowedMinutes ?? String(group.allowedMinutes);
  resetIntervalHoursField.value =
    draft?.resetIntervalHours ?? String(group.resetIntervalHours);
  allowSnoozeField.checked = draft?.allowSnooze ?? (group.allowSnooze !== false);
  snoozeMinutesField.value = draft?.snoozeMinutes ?? String(group.snoozeMinutes);
  snoozeActivationDelayField.value =
    draft?.snoozeActivationDelayMinutes ??
    String(group.snoozeActivationDelayMinutes ?? DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES);
  snoozeCooldownField.value =
    draft?.snoozeCooldownMinutes ??
    String(group.snoozeCooldownMinutes ?? DEFAULT_SNOOZE_COOLDOWN_MINUTES);
  snoozeConfirmationsField.value =
    draft?.snoozeConfirmations ?? String(group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS);
  scheduleWindowsField.value = draft?.timeWindowsText ?? group.timeWindowsText;
  blockedSitesField.value = draft?.sitesText ?? group.sites.join("\n");
  blockingRulesField.value = draft?.blockingRulesText ?? group.blockingRulesText;
  platformAuthorsField.value = draft?.platformAuthorsText ?? group.platformAuthors.join("\n");
  platformAuthorTagsField.value =
    draft?.platformAuthorTagsText ?? (group.platformAuthorTags ?? []).join("\n");
  platformVideoModeField.value = draft?.platformVideoMode ?? group.platformVideoMode;
  platformAuthorModeField.value = normalizePlatformAuthorMode(
    draft?.platformAuthorMode ?? group.platformAuthorMode
  );
  redditSubredditsField.value = draft?.redditSubredditsText ?? group.redditSubreddits.join("\n");
  redditModeField.value = normalizeRedditMode(
    draft?.redditMode ?? group.redditMode,
    group.redditSubreddits
  );
  discordModeField.value = normalizeDiscordMode(
    draft?.discordMode ?? group.discordMode,
    group.discordTargets
  );
  discordTargetsField.value = draft?.discordTargetsText ?? group.discordTargets.join("\n");

  const blockHomePageValue = Boolean(draft?.blockHomePage ?? group.blockHomePage);
  platformBlockHomePageField.checked = blockHomePageValue;
  redditBlockHomePageField.checked = blockHomePageValue;
  discordBlockHomePageField.checked = blockHomePageValue;

  fallbackUrlField.value = draft?.fallbackUrl ?? group.fallbackUrl ?? "";

  // Rule effect (block vs allow/exception) is a platform-profile-only feature:
  // those groups are coarse and can't express exceptions in JS the way custom
  // rules can.
  if (groupEffectSection) {
    groupEffectSection.classList.toggle("hidden", !isPlatformProfileGroup);
  }
  groupEffectField.value = (draft?.effect ?? group.effect) === "allow" ? "allow" : "block";

  const isScrollPlatform = ["youtube", "tiktok", "instagram"].includes(group.groupType);
  skipToNextOnBlockRow.classList.toggle("hidden", !isPlatformVideoGroup || !isScrollPlatform);
  skipToNextOnBlockField.checked = Boolean(draft?.skipToNextOnBlock ?? group.skipToNextOnBlock);

  freezeModeField.value = freezeStatus.isFrozen
    ? freezeStatus.isParental
      ? "parental"
      : freezeStatus.isStrict
        ? "strict"
        : "frozen"
    : draft?.freezeModeChoice ?? normalizeFreezeModeChoice(group);
  strictFreezeHoursField.value = String(group.strictFreezeHours);

  blockModeSection.classList.toggle("hidden", isCustomGroup);
  timedSettings.classList.toggle("hidden", !isTimedMode || isCustomGroup);
  allowedMinutesRow.classList.toggle("hidden", selectedMode === "timer");
  strictFreezeSettings.classList.toggle("hidden", freezeModeField.value !== "strict");
  customSettingsCard.classList.toggle("hidden", !isCustomGroup);
  if (platformRulesCard) {
    platformRulesCard.classList.toggle("hidden", !isPlatformProfileGroup);
  }
  platformVideoCard.classList.toggle("hidden", !usesAuthorAxis);
  redditSettingsCard.classList.toggle("hidden", !isRedditGroup);
  discordSettingsCard.classList.toggle("hidden", !isDiscordGroup);
  renderSurfaceHides(group, draft, editable);
  if (fallbackUrlSection) {
    fallbackUrlSection.classList.toggle("hidden", isCustomGroup);
  }
  scheduleSection.classList.toggle("hidden", isCustomGroup);
  siteSettingsSection.classList.toggle(
    "hidden",
    isPlatformProfileGroup || isCustomGroup
  );

  groupNameField.disabled = !editable;
  groupEnabledField.disabled = !editable;
  blockModeField.disabled = !editable || isCustomGroup;
  allowedMinutesField.disabled = !editable || !isTimedMode || selectedMode === "timer" || isCustomGroup;
  resetIntervalHoursField.disabled = !editable || !isTimedMode || isCustomGroup;
  snoozeMinutesField.disabled = !editable || !allowSnoozeField.checked || freezeStatus.isFrozen;
  snoozeActivationDelayField.disabled = !editable || !allowSnoozeField.checked || freezeStatus.isFrozen;
  snoozeCooldownField.disabled = !editable || !allowSnoozeField.checked || freezeStatus.isFrozen;
  snoozeConfirmationsField.disabled = !editable || !allowSnoozeField.checked;
  scheduleWindowsField.disabled = !editable || isCustomGroup;
  // When a Default group is clustered, only the domain-owner (browsers) may edit
  // the blocked-domain list; the Mac (app-owner) sees domains as a read-only
  // mirror in the connection panel.
  const domainsMirrored =
    group.groupType === "site" && bridgeOwnsApps() && Boolean(groupConnectionCluster(group));
  blockedSitesField.disabled =
    !editable || isPlatformProfileGroup || isCustomGroup || domainsMirrored;
  blockingRulesField.disabled = !editable || !isCustomGroup;
  const currentAuthorMode = normalizePlatformAuthorMode(platformAuthorModeField.value);
  const authorModeUsesList = platformAuthorModeUsesList(currentAuthorMode); // include/exclude
  const authorModeUsesTags = isPlatformAuthorTagMode(currentAuthorMode); // youtube tag stubs
  // Show the author list only for include/exclude; show the tag box only for the
  // YouTube tag modes; show neither for "all"/"no authors".
  platformAuthorsBlock.classList.toggle("hidden", !usesAuthorAxis || !authorModeUsesList);
  platformAuthorTagsBlock.classList.toggle("hidden", !usesAuthorAxis || !authorModeUsesTags);
  platformAuthorsField.disabled = !editable || !usesAuthorAxis || !authorModeUsesList;
  platformAuthorTagsField.disabled = !editable || !usesAuthorAxis || !authorModeUsesTags;
  platformVideoModeField.disabled = !editable || !isPlatformVideoGroup;
  platformAuthorModeField.disabled = !editable || !usesAuthorAxis;
  redditModeField.disabled = !editable || !isRedditGroup;
  redditSubredditsField.disabled =
    !editable || !isRedditGroup || redditModeField.value === "all";
  discordModeField.disabled = !editable || !isDiscordGroup;
  discordTargetsField.disabled = !editable || !isDiscordGroup || discordModeField.value === "all";
  clearSitesButton.disabled =
    !editable || isPlatformProfileGroup || isCustomGroup || domainsMirrored;
  renderBlockedSites();
  refreshChipField(platformAuthorsField);
  refreshChipField(platformAuthorTagsField);
  refreshChipField(redditSubredditsField);
  refreshChipField(discordTargetsField);
  deleteGroupButton.disabled = !editable;
  exportGroupButton.disabled = false;
  importGroupButton.disabled = !editable;
  platformBlockHomePageField.disabled = !editable || !usesAuthorAxis;
  redditBlockHomePageField.disabled = !editable || !isRedditGroup;
  discordBlockHomePageField.disabled = !editable || !isDiscordGroup;
  fallbackUrlField.disabled = !editable;
  if (groupEffectField) groupEffectField.disabled = !editable;
  skipToNextOnBlockField.disabled = !editable || !isPlatformVideoGroup || !isScrollPlatform;
  if (openRuleTemplatesButton) {
    openRuleTemplatesButton.disabled = !editable || !isCustomGroup;
  }
  if (runCustomGroupButton) {
    runCustomGroupButton.disabled = !editable || !isCustomGroup;
  }
  if (checkSyntaxButton) {
    checkSyntaxButton.disabled = !editable || !isCustomGroup;
  }
  if (aiPromptInput) {
    aiPromptInput.disabled = !editable || !isCustomGroup;
  }
  if (aiPromptCopyButton) {
    aiPromptCopyButton.disabled = !editable || !isCustomGroup;
  }
  if (!isCustomGroup && aiPromptPanel) {
    aiPromptPanel.classList.add("hidden");
  }
  if (aiPromptStatus && (!isCustomGroup || !editable)) {
    aiPromptStatus.textContent = "";
    aiPromptStatus.className = "run-status";
  }
  if (runCustomGroupStatus && (!isCustomGroup || !editable)) {
    runCustomGroupStatus.textContent = "";
    runCustomGroupStatus.className = "run-status";
  }

  dayCheckboxes.forEach((checkbox) => {
    checkbox.checked = (draft?.activeDays ?? group.activeDays).includes(checkbox.value);
    checkbox.disabled = !editable;
  });

  updateUsageSummary(group, draft, now);
  updateFreezeUI(group, now);
  updateSnoozeUI(group, now);
  renderConnectionGroupPanel(group, freezeStatus);
  renderBridgeMirror(group);
  updateBlockingRulesEditor();
}

function render(now = Date.now()) {
  applyStaticTranslations();
  renderGroupList(now);
  updateBulkActionsUI(now);
  renderEditor(now);
  renderUnfreezeModal(now);
  renderTemplateModal();
  filterLogFeedByGroup();
}

function renderDynamicView() {
  const now = Date.now();

  if (!state.draggedGroupId) {
    refreshGroupListInPlace(now);
  }

  updateBulkActionsUI(now);
  const group = getSelectedGroup();
  const draft = getDraftForGroup(state.selectedGroupId);
  updateUsageSummary(group, draft, now);
  updateFreezeUI(group, now);
  updateSnoozeUI(group, now);
  renderUnfreezeModal(now);
  // Push the latest local usage to the hub so clustered Default groups keep a
  // shared live counter. syncClusterForGroup only sends when something changed.
  syncAllClusters();
}

// Mutate the existing group cards in place instead of tearing them down and
// rebuilding. The 1 s tick fires renderDynamicView; rebuilding the DOM each
// tick caused two visible bugs:
//   1. The browser stops re-evaluating :hover on freshly inserted nodes
//      until the mouse moves, so a hovered card briefly snapped to its
//      .active border (dark navy) right after each tick.
//   2. Any in-flight click/mousedown that targeted a card was discarded
//      because the original DOM node was gone by mouseup.
// On any structural change (count or order differs from `state.groups`) we
// fall back to a full re-render via renderGroupList.
function refreshGroupListInPlace(now) {
  const cards = groupList.querySelectorAll(".group-card[data-group-id]");

  if (cards.length !== state.groups.length) {
    renderGroupList(now);
    return;
  }

  for (let i = 0; i < cards.length; i++) {
    if (cards[i].dataset.groupId !== state.groups[i].id) {
      renderGroupList(now);
      return;
    }
  }

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const group = state.groups[i];
    const draft = getDraftForGroup(group.id);
    const freezeStatus = getFreezeStatus(group, now);

    const wantsActive = group.id === state.selectedGroupId;
    if (card.classList.contains("active") !== wantsActive) {
      card.classList.toggle("active", wantsActive);
    }

    const nameEl = card.querySelector(".group-name");
    if (nameEl) {
      const nextName = (draft?.name?.trim() || group.name) ?? "";
      if (nameEl.textContent !== nextName) {
        nameEl.textContent = nextName;
      }
    }

    const metaEl = card.querySelector(".group-meta");
    if (metaEl) {
      const nextMeta = getGroupMetaText(group, draft, now);
      if (metaEl.textContent !== nextMeta) {
        metaEl.textContent = nextMeta;
      }
    }

    const toggle = card.querySelector(".group-toggle");
    if (toggle) {
      if (toggle.checked !== group.enabled) {
        toggle.checked = group.enabled;
      }
      if (toggle.disabled !== freezeStatus.isFrozen) {
        toggle.disabled = freezeStatus.isFrozen;
      }
    }
  }
}

function stashCurrentDraft() {
  const group = getSelectedGroup();

  if (!state.selectedGroupId || !group) {
    return;
  }

  const isPlatformVideoGroup = isPlatformVideoGroupType(group.groupType);
  const isTwitterGroup = normalizeGroupType(group.groupType) === "twitter";
  const usesAuthorAxis = isPlatformVideoGroup || isTwitterGroup;
  const isRedditGroup = group.groupType === "reddit";
  const isDiscordGroup = group.groupType === "discord";

  state.drafts[state.selectedGroupId] = {
    name: groupNameField.value,
    enabled: groupEnabledField.checked,
    mode: blockModeField.value,
    allowedMinutes: allowedMinutesField.value,
    resetIntervalHours: resetIntervalHoursField.value,
    allowSnooze: allowSnoozeField.checked,
    snoozeMinutes: snoozeMinutesField.value,
    snoozeActivationDelayMinutes: snoozeActivationDelayField.value,
    snoozeCooldownMinutes: snoozeCooldownField.value,
    snoozeConfirmations: snoozeConfirmationsField.value,
    activeDays: collectSelectedDays(),
    timeWindowsText: scheduleWindowsField.value,
    sitesText: blockedSitesField.value,
    blockingRulesText: blockingRulesField.value,
    platformVideoMode: platformVideoModeField.value,
    platformAuthorMode: platformAuthorModeField.value,
    platformAuthorsText: platformAuthorsField.value,
    platformAuthorTagsText: platformAuthorTagsField.value,
    redditMode: redditModeField.value,
    redditSubredditsText: redditSubredditsField.value,
    discordMode: discordModeField.value,
    discordTargetsText: discordTargetsField.value,
    blockHomePage: usesAuthorAxis
      ? platformBlockHomePageField.checked
      : isRedditGroup
        ? redditBlockHomePageField.checked
        : isDiscordGroup
          ? discordBlockHomePageField.checked
          : false,
    surfaceHides: readSurfaceHidesFromForm(),
    effect: groupEffectField.value === "allow" ? "allow" : "block",
    fallbackUrl: fallbackUrlField.value,
    skipToNextOnBlock: skipToNextOnBlockField.checked
  };
}

async function flushAutosave() {
  if (state.autosaveTimeoutId === null) {
    return;
  }

  window.clearTimeout(state.autosaveTimeoutId);
  state.autosaveTimeoutId = null;
  await autosaveSelectedGroup();
}

// Best-effort sync persist used from pagehide / visibilitychange.
// We can't await — Chrome's IPC layer forwards the unawaited set() before
// the popup tears down. Validation errors are swallowed so a half-typed
// draft never blocks exit; partial input is recovered from state.drafts.
function flushAutosaveOnExit() {
  if (state.autosaveTimeoutId !== null) {
    window.clearTimeout(state.autosaveTimeoutId);
    state.autosaveTimeoutId = null;
  }

  const group = getSelectedGroup();
  const draft = group ? getDraftForGroup(group.id) : null;
  if (group && draft && isGroupEditable(group)) {
    try {
      const result = buildUpdatedGroupFromDraft(group, draft);
      if (result && result.updatedGroup) {
        state.groups = state.groups.map((item) =>
          item.id === group.id ? result.updatedGroup : item
        );
      }
    } catch (_) {
      // Validation failed — persist current state.groups anyway.
    }
  }

  try {
    // globalSettings is intentionally omitted: it only changes via the
    // settings modal's Save button, and re-emitting on every teardown
    // would race two open popups against each other.
    chrome.storage.local.set({
      [BLOCKED_GROUPS_KEY]: state.groups,
      [USAGE_TIMERS_KEY]: state.usageTimersMs,
      [USAGE_RESET_AT_KEY]: state.usageResetAtMs,
      [GROUP_SNOOZES_KEY]: state.groupSnoozes,
      [GROUP_SNOOZE_TOTALS_KEY]: state.groupSnoozeTotalsMs
    });
  } catch (_) {}
}

function selectGroup(groupId) {
  if (groupId === state.selectedGroupId) {
    return;
  }

  closeUnfreezeFlow();
  closeTemplateModal();
  stashCurrentDraft();
  flushAutosave()
    .catch((error) => {
      console.error("Failed to flush autosave before selection change.", error);
    })
    .finally(() => {
      state.selectedGroupId = groupId;
      setSnoozeWarning("");
      render();
    });
}

async function loadStoredState() {
  const result = await chrome.storage.local.get({
    [BLOCKED_GROUPS_KEY]: [],
    [USAGE_TIMERS_KEY]: {},
    [USAGE_RESET_AT_KEY]: {},
    [GROUP_SNOOZES_KEY]: {},
    [GROUP_SNOOZE_TOTALS_KEY]: {},
    [GLOBAL_SETTINGS_KEY]: { ...DEFAULT_GLOBAL_SETTINGS }
  });

  const groups = sanitizeGroups(result[BLOCKED_GROUPS_KEY]);
  const settings = sanitizeGlobalSettings(result[GLOBAL_SETTINGS_KEY]);
  cbDebugMode = settings.debugMode === true;

  return {
    groups,
    usageTimersMs: sanitizeUsageTimers(result[USAGE_TIMERS_KEY], groups),
    usageResetAtMs: sanitizeResetTimes(result[USAGE_RESET_AT_KEY], groups),
    groupSnoozes: sanitizeSnoozes(result[GROUP_SNOOZES_KEY], groups),
    groupSnoozeTotalsMs: sanitizeSnoozeTotals(result[GROUP_SNOOZE_TOTALS_KEY], groups),
    globalSettings: settings
  };
}

async function persistState(message) {
  state.suppressGroupStorageUpdatesUntil = Date.now() + 1000;

  await chrome.storage.local.set({
    [BLOCKED_GROUPS_KEY]: state.groups,
    [USAGE_TIMERS_KEY]: state.usageTimersMs,
    [USAGE_RESET_AT_KEY]: state.usageResetAtMs,
    [GROUP_SNOOZES_KEY]: state.groupSnoozes,
    [GROUP_SNOOZE_TOTALS_KEY]: state.groupSnoozeTotalsMs
  });

  if (message) {
    setStatus(message);
  }

  // Keep the hub's roster current so name-based linking validates correctly,
  // and push any settings changes to clustered peers.
  announceGroups();
  syncAllClusters();
}

async function loadGroups() {
  const loaded = await loadStoredState();
  state.groups = loaded.groups;
  state.usageTimersMs = loaded.usageTimersMs;
  state.usageResetAtMs = loaded.usageResetAtMs;
  state.groupSnoozes = loaded.groupSnoozes;
  state.groupSnoozeTotalsMs = loaded.groupSnoozeTotalsMs;
  state.globalSettings = loaded.globalSettings;
  state.selectedGroupId = state.groups[0]?.id ?? null;
  state.drafts = {};
  render();
}

function updateGroupEnabled(groupId, enabled) {
  const group = state.groups.find((item) => item.id === groupId);

  if (!group || !isGroupEditable(group)) {
    setStatus(t("status.frozenCannotChange"), true);
    render();
    return;
  }

  // Optimistic UI; scheduleAutosave() debounces the actual storage write.
  state.groups = state.groups.map((item) =>
    item.id === groupId ? { ...item, enabled } : item
  );

  if (state.drafts[groupId]) {
    state.drafts[groupId].enabled = enabled;
  }

  if (groupId === state.selectedGroupId) {
    groupEnabledField.checked = enabled;
  }

  setStatus(t(enabled ? "status.enabled" : "status.disabled", { name: group.name }));
  renderGroupList();
  scheduleAutosave();
}

async function addGroup(groupType = DEFAULT_GROUP_TYPE) {
  stashCurrentDraft();
  await flushAutosave();

  const now = Date.now();
  const newGroup = createDefaultGroup(groupType);
  state.groups = [...state.groups, newGroup];
  state.usageTimersMs[newGroup.id] = 0;
  state.usageResetAtMs[newGroup.id] = now;
  state.groupSnoozeTotalsMs[newGroup.id] = 0;
  state.drafts[newGroup.id] = groupToDraft(newGroup);
  state.selectedGroupId = newGroup.id;

  await persistState(t("status.created", { name: newGroup.name }));
  render();
  groupNameField.focus();
  groupNameField.select();
}

async function deleteAllGroups() {
  await flushAutosave();

  if (hasStrictLockedGroups()) {
    setStatus(t("status.bulkDeleteStrictLocked"), true);
    render();
    return;
  }

  if (state.groups.length === 0) {
    return;
  }

  const confirmed = window.confirm(
    hasFrozenGroups() ? t("groups.deleteAllConfirmFrozen") : t("groups.deleteAllConfirm")
  );

  if (!confirmed) {
    return;
  }

  if (hasFrozenGroups() && !confirmDeleteAllFrozenGroups()) {
    return;
  }

  state.groups = [];
  state.drafts = {};
  state.usageTimersMs = {};
  state.usageResetAtMs = {};
  state.groupSnoozes = {};
  state.groupSnoozeTotalsMs = {};
  state.selectedGroupId = null;

  await persistState(t("status.bulkDeleted"));
  render();
}

async function deleteSelectedGroup() {
  await flushAutosave();
  const group = getSelectedGroup();

  if (!group) {
    return;
  }

  if (!isGroupEditable(group)) {
    setStatus(t("status.frozenCannotDelete"), true);
    render();
    return;
  }

  state.groups = state.groups.filter((item) => item.id !== group.id);
  delete state.drafts[group.id];
  delete state.usageTimersMs[group.id];
  delete state.usageResetAtMs[group.id];
  delete state.groupSnoozes[group.id];
  delete state.groupSnoozeTotalsMs[group.id];
  state.selectedGroupId = state.groups[0]?.id ?? null;

  await persistState(t("status.deleted", { name: group.name }));
  render();
}

async function exportSelectedGroup() {
  try {
    const group = getTransferReadySelectedGroup();
    const exportString = encodeGroupTransferString(group);
    let copiedToClipboard = false;

    try {
      await navigator.clipboard.writeText(exportString);
      copiedToClipboard = true;
    } catch (error) {
      console.warn("Failed to copy block group export string.", error);
    }

    window.prompt(
      t(copiedToClipboard ? "editor.exportGroupPromptCopied" : "editor.exportGroupPrompt"),
      exportString
    );
    setStatus(
      t(copiedToClipboard ? "status.exportedGroupCopied" : "status.exportedGroup", {
        name: group.name
      })
    );
  } catch (error) {
    console.error("Failed to export block group.", error);
    setStatus(error?.message || t("status.errorExportGroup"), true);
  }
}

async function importIntoSelectedGroup() {
  const group = getSelectedGroup();
  if (!group) {
    return;
  }

  if (!isGroupEditable(group)) {
    setStatus(t("status.frozenCannotChange"), true);
    render();
    return;
  }

  try {
    let clipboardText = "";
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (error) {
      console.warn("Failed to read block group import string from clipboard.", error);
      clipboardText = window.prompt(t("editor.importGroupPrompt"), "") ?? "";
    }

    const importedGroup = decodeGroupTransferString(clipboardText);
    const confirmed = window.confirm(
      t("editor.importGroupConfirm", {
        current: group.name,
        imported: importedGroup.name
      })
    );

    if (!confirmed) {
      return;
    }

    const replacementGroup = {
      ...importedGroup,
      id: group.id,
      frozenAtMs:
        importedGroup.freezeMode === "none"
          ? null
          : importedGroup.frozenAtMs ?? Date.now()
    };

    state.groups = state.groups.map((item) => (item.id === group.id ? replacementGroup : item));
    state.drafts[group.id] = groupToDraft(replacementGroup);
    state.usageTimersMs[group.id] = 0;
    state.usageResetAtMs[group.id] = Date.now();
    delete state.groupSnoozes[group.id];
    state.groupSnoozeTotalsMs[group.id] = 0;
    closeTemplateModal();

    await persistState(t("status.importedGroup", { name: replacementGroup.name }));
    render();
  } catch (error) {
    console.error("Failed to import block group.", error);
    setStatus(error?.message || t("status.errorImportGroup"), true);
  }
}

function buildUpdatedGroupFromDraft(group, draft) {
  const name = draft.name.trim();

  if (!name) {
    throw new Error(t("status.invalidName"));
  }

  // Names must be unique per endpoint (the web-app bridge links groups by name).
  const nameClash = state.groups.some(
    (other) =>
      other.id !== group.id && (other.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (nameClash) {
    throw new Error(t("status.duplicateName"));
  }

  const mode = normalizeBlockingMode(draft.mode);
  const allowedMinutes = parseAllowedMinutes(draft.allowedMinutes);
  const resetIntervalHours = parseResetIntervalHours(draft.resetIntervalHours);
  const allowSnooze = Boolean(draft.allowSnooze);
  const snoozeMinutes = parseSnoozeMinutes(draft.snoozeMinutes);
  const snoozeActivationDelayMinutes = parseSnoozeDelayMinutes(draft.snoozeActivationDelayMinutes);
  const snoozeCooldownMinutes = parseSnoozeCooldownMinutes(draft.snoozeCooldownMinutes);
  const snoozeConfirmations = parseSnoozeConfirmations(draft.snoozeConfirmations);
  const timeWindows = parseTimeWindowsText(draft.timeWindowsText);
  const siteResults = parseSiteTextareaValue(draft.sitesText);
  const authorResults = parsePlatformAuthorsTextarea(group.groupType, draft.platformAuthorsText);
  const authorMode = normalizePlatformAuthorMode(draft.platformAuthorMode);
  // Visual-only stub: tags are free-form, so every non-empty entry is kept.
  const authorTags = [
    ...new Set(
      String(draft.platformAuthorTagsText ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
  ];
  const redditResults = parseRedditSubredditsTextarea(draft.redditSubredditsText);
  const redditMode = normalizeRedditMode(draft.redditMode, redditResults.validSubreddits);
  const discordResults = parseDiscordTargetsTextarea(draft.discordTargetsText);
  const discordMode = normalizeDiscordMode(draft.discordMode, discordResults.validTargets);
  const blockingRulesText = draft.blockingRulesText?.trim() ?? "";
  const isCustomGroup = group.groupType === "custom";
  const nextMode = isCustomGroup ? "instant" : mode;

  if (nextMode === "after-minutes" && allowedMinutes === null) {
    throw new Error(t("status.invalidAllowedMinutes"));
  }

  if (isTimedBlockingMode(nextMode) && resetIntervalHours === null) {
    throw new Error(t("status.invalidResetHours"));
  }

  if (snoozeMinutes === null) {
    throw new Error(t("status.invalidSnoozeMinutes"));
  }

  if (snoozeActivationDelayMinutes === null) {
    throw new Error(t("status.invalidSnoozeActivationDelay"));
  }

  if (snoozeCooldownMinutes === null) {
    throw new Error(
      t("status.invalidSnoozeCooldown", { max: formatHours(MAX_SNOOZE_COOLDOWN_MINUTES) })
    );
  }

  if (snoozeConfirmations === null) {
    throw new Error(t("status.invalidSnoozeConfirmations"));
  }

  if (timeWindows.invalidLines.length > 0) {
    throw new Error(t("status.invalidTimeWindows", { list: timeWindows.invalidLines.join(", ") }));
  }

  if (group.groupType === "site" && siteResults.invalidSites.length > 0) {
    throw new Error(t("status.invalidSites", { list: siteResults.invalidSites.join(", ") }));
  }

  const usesAuthorAxis =
    isPlatformVideoGroupType(group.groupType) || normalizeGroupType(group.groupType) === "twitter";

  // Invalid platform entries are surfaced inline as red chips in the editor, so
  // we no longer abort the save — valid entries persist and the bad chips stay
  // visible (in the draft text) until the user fixes or removes them.

  // Custom rule source is not validated here — autosave fires mid-edit
  // and would always look broken. Real validation happens at Run time.

  return {
    updatedGroup: {
      ...group,
      name,
      enabled: draft.enabled,
      mode: nextMode,
      allowedMinutes: isCustomGroup
        ? group.allowedMinutes
        : allowedMinutes ?? group.allowedMinutes,
      resetIntervalHours: isCustomGroup
        ? group.resetIntervalHours
        : resetIntervalHours ?? group.resetIntervalHours,
      allowSnooze,
      snoozeMinutes: snoozeMinutes ?? group.snoozeMinutes,
      snoozeActivationDelayMinutes:
        snoozeActivationDelayMinutes ?? group.snoozeActivationDelayMinutes,
      snoozeCooldownMinutes: snoozeCooldownMinutes ?? group.snoozeCooldownMinutes,
      snoozeConfirmations: snoozeConfirmations ?? group.snoozeConfirmations,
      activeDays: isCustomGroup
        ? group.activeDays
        : draft.activeDays.filter((day) => DAY_NAMES.includes(day)),
      timeWindowsText: isCustomGroup ? group.timeWindowsText : timeWindows.normalizedLines.join("\n"),
      platformVideoMode: normalizeVideoMode(draft.platformVideoMode),
      platformAuthorMode: authorMode,
      platformAuthors: usesAuthorAxis ? authorResults.validAuthors : group.platformAuthors,
      platformAuthorTags: usesAuthorAxis ? authorTags : (group.platformAuthorTags ?? []),
      surfaceHides: normalizeSurfaceHides(
        Array.isArray(draft.surfaceHides) ? draft.surfaceHides : group.surfaceHides,
        group.groupType
      ),
      redditSubreddits:
        group.groupType === "reddit" ? redditResults.validSubreddits : group.redditSubreddits,
      redditMode: group.groupType === "reddit" ? redditMode : group.redditMode,
      discordTargets:
        group.groupType === "discord" ? discordResults.validTargets : group.discordTargets,
      discordMode: group.groupType === "discord" ? discordMode : group.discordMode,
      blockingRulesText: isCustomGroup ? blockingRulesText : group.blockingRulesText,
      sites: group.groupType === "site" ? siteResults.validSites : [],
      blockHomePage: Boolean(draft.blockHomePage),
      // Only platform-profile groups expose the effect toggle; force "block"
      // for everything else so custom/default groups can't become exceptions.
      effect:
        isPlatformProfileGroupType(group.groupType) && draft.effect === "allow"
          ? "allow"
          : "block",
      // Custom groups redirect via setRedirectLink() inside the rule;
      // strip any legacy fallbackUrl on save.
      fallbackUrl: isCustomGroup
        ? ""
        : typeof draft.fallbackUrl === "string"
        ? draft.fallbackUrl.trim()
        : "",
      skipToNextOnBlock: Boolean(draft.skipToNextOnBlock),
      freezeModeChoice: normalizeFreezeModeChoice({
        freezeModeChoice: draft.freezeModeChoice,
        freezeMode: group.freezeMode,
        parentalPasswordHash: group.parentalPasswordHash
      })
    },
    modeChanged: nextMode !== group.mode,
    resetIntervalChanged:
      isTimedBlockingMode(nextMode) &&
      (resetIntervalHours ?? group.resetIntervalHours) !== group.resetIntervalHours
  };
}

async function autosaveSelectedGroup() {
  const group = getSelectedGroup();
  const draft = getDraftForGroup(state.selectedGroupId);
  let validationError = null;
  let updatedGroup = null;

  // Fold the draft into state.groups. We never bail on failure: optimistic
  // edits to OTHER groups (e.g. sidebar toggles) still need to be persisted
  // even when the currently-selected group's draft is invalid.
  if (group && draft && isGroupEditable(group)) {
    try {
      const result = buildUpdatedGroupFromDraft(group, draft);
      updatedGroup = result.updatedGroup;

      state.groups = state.groups.map((item) =>
        item.id === group.id ? result.updatedGroup : item
      );
      state.drafts[group.id] = groupToDraft(result.updatedGroup);

      if (
        isTimedBlockingMode(result.updatedGroup.mode) &&
        (result.modeChanged || result.resetIntervalChanged)
      ) {
        state.usageResetAtMs[group.id] = Date.now();
        state.usageTimersMs[group.id] = 0;
      }
    } catch (error) {
      validationError = error;
    }
  }

  try {
    await persistState();
  } catch (error) {
    console.error("Failed to persist groups during autosave.", error);
    setStatus(t("status.errorSaveGroup"), true);
    return;
  }

  if (validationError) {
    setStatus(validationError.message || t("status.errorSaveGroup"), true);
    renderGroupList();
    updateUsageSummary(group, draft);
    return;
  }

  renderGroupList();
  if (group) {
    updateUsageSummary(updatedGroup ?? group, state.drafts[group.id] ?? draft);
  }
}

function scheduleAutosave() {
  if (state.autosaveTimeoutId !== null) {
    window.clearTimeout(state.autosaveTimeoutId);
  }

  // 0 means "next tick" (still merges synchronous writes into one).
  const delay = Math.max(
    0,
    Math.min(AUTOSAVE_DEBOUNCE_MAX_MS, Number(state.globalSettings?.autosaveDebounceMs) || 0)
  );
  state.autosaveTimeoutId = window.setTimeout(() => {
    state.autosaveTimeoutId = null;
    autosaveSelectedGroup().catch((error) => {
      console.error("Failed to autosave block group.", error);
      setStatus(t("status.errorSaveGroup"), true);
    });
  }, delay);
}

function clearSelectedSites() {
  const group = getSelectedGroup();

  if (!group || group.groupType !== "site" || !isGroupEditable(group)) {
    setStatus(t("status.frozenCannotChange"), true);
    return;
  }

  blockedSitesField.value = "";
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
  renderBlockedSites();
}

async function reorderGroups(draggedGroupId, insertIndex) {
  await flushAutosave();

  const draggedIndex = state.groups.findIndex((group) => group.id === draggedGroupId);

  if (draggedIndex === -1 || !Number.isInteger(insertIndex)) {
    state.draggedGroupId = null;
    state.dragInsertIndex = null;
    renderGroupList();
    return;
  }

  const reordered = [...state.groups];
  const [draggedGroup] = reordered.splice(draggedIndex, 1);
  const normalizedInsertIndex = Math.max(0, Math.min(insertIndex, reordered.length));

  reordered.splice(normalizedInsertIndex, 0, draggedGroup);
  state.groups = reordered;
  state.draggedGroupId = null;
  state.dragInsertIndex = null;

  await persistState();
  render();
}

async function applyFreeze() {
  const group = getSelectedGroup();

  if (!group || !isGroupEditable(group)) {
    setStatus(t("status.alreadyFrozen"), true);
    return;
  }

  await flushAutosave();

  if (freezeModeField.value === "parental") {
    await applyParentalFreeze(group);
    return;
  }

  const freezeMode = freezeModeField.value === "strict" ? "strict" : "frozen";
  const strictFreezeHours =
    freezeMode === "strict"
      ? parseStrictFreezeHours(strictFreezeHoursField.value)
      : group.strictFreezeHours;

  if (freezeMode === "strict" && strictFreezeHours === null) {
    setStatus(t("status.strictFreezeHours", { max: MAX_STRICT_FREEZE_HOURS }), true);
    return;
  }

  const now = Date.now();
  state.groups = state.groups.map((item) =>
    item.id === group.id
      ? {
          ...item,
          freezeMode,
          strictFreezeHours: strictFreezeHours ?? item.strictFreezeHours,
          frozenAtMs: now
        }
      : item
  );

  await persistState(t("status.frozen", { name: group.name }));
  render();
}

function openUnfreezeFlow() {
  const group = getSelectedGroup();

  if (!group) {
    return;
  }

  const freezeStatus = getFreezeStatus(group);

  if (!freezeStatus.isFrozen) {
    return;
  }

  if (freezeStatus.isParental) {
    openParentalUnfreezeFlow(group);
    return;
  }

  if (!freezeStatus.canUnfreeze) {
    setStatus(t("status.strictLocked"), true);
    render();
    return;
  }

  state.unfreezeFlow = {
    kind: "unfreeze",
    groupId: group.id,
    label: group.name,
    confirmationsLeft: UNFREEZE_CONFIRMATIONS_REQUIRED,
    nextAllowedAtMs: Date.now() + UNFREEZE_CONFIRMATION_INTERVAL_MS
  };

  if (state.confirmIntervalId !== null) {
    window.clearInterval(state.confirmIntervalId);
  }

  state.confirmIntervalId = window.setInterval(() => {
    renderUnfreezeModal();
  }, 250);

  renderUnfreezeModal();
}

// --- Parental (password-gated) freeze flow ------------------------------

async function persistGroupFields(groupId, fields, statusMsg) {
  state.groups = state.groups.map((item) =>
    item.id === groupId ? { ...item, ...fields } : item
  );
  await persistState(statusMsg);
  render();
}

function buildPinPanelSnapshot({ id, title, description, pinId, autoSubmit, submitLabel }) {
  const controls = [];
  if (description) {
    controls.push({ id: id + "-desc", type: "text", text: description });
  }
  controls.push({
    id: pinId,
    type: "pin",
    label: "",
    length: PARENTAL_PIN_LENGTH,
    masked: true,
    value: "",
    autoSubmit: autoSubmit === true
  });
  controls.push({
    id: id + "-submit",
    type: "button",
    label: submitLabel || t("freeze.pin.submit"),
    action: "submit"
  });
  controls.push({
    id: id + "-cancel",
    type: "button",
    label: t("freeze.pin.cancel"),
    action: "cancel"
  });
  return { id, title, position: "center", controls };
}

// Opens a PIN-entry overlay. `onSubmit(pin)` returns true to close, false to
// keep the panel open (e.g. wrong PIN) so the guardian can retry.
function openPinEntry({ title, description, onSubmit }) {
  const pinId = "pin-input";
  const vals = {};
  let handle = null;
  let busy = false;

  const trySubmit = async () => {
    if (busy) return;
    const pin = String(vals[pinId] || "");
    if (!isValidParentalPin(pin)) {
      setStatus(t("freeze.pin.invalid"), true);
      return;
    }
    busy = true;
    let ok = false;
    try {
      ok = await onSubmit(pin);
    } finally {
      busy = false;
    }
    if (ok && handle) handle.close();
  };

  handle = openOverlayPanel(
    buildPinPanelSnapshot({
      id: "parental-pin-entry",
      title,
      description,
      pinId,
      autoSubmit: true
    }),
    (ev) => {
      if (ev.values) {
        for (const k in ev.values) if (ev.values[k]) vals[k] = ev.values[k];
      }
      if (ev.controlId === pinId && (ev.eventName === "change" || ev.eventName === "submit")) {
        vals[pinId] = ev.value;
      }
      const isCancel =
        ev.eventName === "cancel" || (ev.eventName === "click" && ev.value === "cancel");
      const isSubmit =
        ev.eventName === "submit" || (ev.eventName === "click" && ev.value === "submit");
      if (isCancel) {
        if (handle) handle.close();
        return;
      }
      if (isSubmit) {
        trySubmit();
      }
    },
    { internal: true }
  );
  return handle;
}

async function applyParentalFreeze(group) {
  if (!group.parentalPasswordHash) {
    setStatus(t("freeze.pin.needPassword"), true);
    openParentalSettings(group);
    return;
  }
  openPinEntry({
    title: t("freeze.pin.freezeTitle"),
    description: t("freeze.pin.freezePrompt"),
    onSubmit: async (pin) => {
      const ok = await verifyGroupParentalPin(group, pin);
      if (!ok) {
        setStatus(t("freeze.pin.wrong"), true);
        return false;
      }
      await persistGroupFields(
        group.id,
        { freezeMode: "parental", frozenAtMs: Date.now() },
        t("status.frozen", { name: group.name })
      );
      return true;
    }
  });
}

function openParentalUnfreezeFlow(group) {
  if (!group.parentalPasswordHash) {
    // No password set: nothing to gate against, just unfreeze.
    persistGroupFields(
      group.id,
      { freezeMode: "none", frozenAtMs: null },
      t("status.unfrozen", { name: group.name })
    );
    return;
  }
  openPinEntry({
    title: t("freeze.pin.unfreezeTitle"),
    description: t("freeze.pin.unfreezePrompt"),
    onSubmit: async (pin) => {
      const ok = await verifyGroupParentalPin(group, pin);
      if (!ok) {
        setStatus(t("freeze.pin.wrong"), true);
        return false;
      }
      await persistGroupFields(
        group.id,
        { freezeMode: "none", frozenAtMs: null },
        t("status.unfrozen", { name: group.name })
      );
      return true;
    }
  });
}

// Guardian settings overlay: set / verify / clear the group's password.
function openParentalSettings(group) {
  const pinId = "settings-pin";
  const vals = {};
  let handle = null;

  const snapshotFor = (hasPassword) => {
    const controls = [];
    controls.push({
      id: "settings-desc",
      type: "text",
      text: hasPassword
        ? t("freeze.settings.managePrompt")
        : t("freeze.settings.setPrompt")
    });
    controls.push({
      id: pinId,
      type: "pin",
      label: "",
      length: PARENTAL_PIN_LENGTH,
      masked: true,
      value: ""
    });
    if (hasPassword) {
      controls.push({ id: "settings-verify", type: "button", label: t("freeze.settings.verify") });
      controls.push({ id: "settings-clear", type: "button", label: t("freeze.settings.clear") });
    } else {
      controls.push({ id: "settings-save", type: "button", label: t("freeze.settings.save"), action: "submit" });
    }
    controls.push({ id: "settings-close", type: "button", label: t("freeze.settings.close"), action: "cancel" });
    return { id: "parental-settings", title: t("freeze.settings.title"), position: "center", controls };
  };

  const currentGroup = () => state.groups.find((g) => g.id === group.id) || group;

  const rebuild = () => {
    vals[pinId] = "";
    const snap = snapshotFor(Boolean(currentGroup().parentalPasswordHash));
    if (handle) handle.update(snap);
  };

  const onEvent = async (ev) => {
    if (ev.values) {
      for (const k in ev.values) if (ev.values[k]) vals[k] = ev.values[k];
    }
    if (ev.controlId === pinId && ev.eventName === "change") vals[pinId] = ev.value;
    const id = ev.controlId;
    const pin = String(vals[pinId] || "");
    const g = currentGroup();

    if (id === "settings-close" || ev.eventName === "cancel" || (ev.eventName === "click" && ev.value === "cancel")) {
      if (handle) handle.close();
      return;
    }
    if (id === "settings-save") {
      if (!isValidParentalPin(pin)) {
        setStatus(t("freeze.pin.invalid"), true);
        return;
      }
      const updated = { ...g };
      await setGroupParentalPin(updated, pin);
      await persistGroupFields(
        g.id,
        {
          parentalPasswordHash: updated.parentalPasswordHash,
          parentalPasswordSalt: updated.parentalPasswordSalt
        },
        t("freeze.settings.saved")
      );
      rebuild();
      return;
    }
    if (id === "settings-verify") {
      const ok = await verifyGroupParentalPin(g, pin);
      setStatus(ok ? t("freeze.settings.verifyOk") : t("freeze.settings.verifyFail"), !ok);
      return;
    }
    if (id === "settings-clear") {
      const ok = await verifyGroupParentalPin(g, pin);
      if (!ok) {
        setStatus(t("freeze.pin.wrong"), true);
        return;
      }
      await persistGroupFields(
        g.id,
        { parentalPasswordHash: null, parentalPasswordSalt: null },
        t("freeze.settings.cleared")
      );
      rebuild();
      return;
    }
  };

  handle = openOverlayPanel(snapshotFor(Boolean(currentGroup().parentalPasswordHash)), onEvent, { internal: true });
}

function closeUnfreezeFlow() {
  state.unfreezeFlow = null;
  confirmModal.classList.add("hidden");

  if (state.confirmIntervalId !== null) {
    window.clearInterval(state.confirmIntervalId);
    state.confirmIntervalId = null;
  }
}

function createSnoozeEntry(
  group,
  { snoozeMinutes, activationDelayMinutes, cooldownMinutes, confirmationCount },
  now = Date.now()
) {
  const startsAtMs = now + activationDelayMinutes * MS_PER_MINUTE;
  const untilMs = startsAtMs + snoozeMinutes * MS_PER_MINUTE;
  return {
    startsAtMs,
    untilMs,
    cooldownUntilMs: untilMs + cooldownMinutes * MS_PER_MINUTE,
    confirmationCount,
    activeMsApplied: false,
    // Remember the freeze state at snooze time so we restore exactly that on
    // expiry. "none" means the group was unfrozen and must stay unfrozen.
    refreezeMode:
      group.freezeMode === "strict" ||
      group.freezeMode === "parental" ||
      group.freezeMode === "frozen"
        ? group.freezeMode
        : "none"
  };
}

function maybeRefreezeGroupAfterSnooze(groupId, snooze, now = Date.now()) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group || group.freezeMode !== "none") {
    return;
  }
  // Only refreeze if the group was actually frozen when it was snoozed.
  const refreezeMode = snooze?.refreezeMode;
  if (
    refreezeMode !== "strict" &&
    refreezeMode !== "parental" &&
    refreezeMode !== "frozen"
  ) {
    return;
  }
  const nextGroup = {
    ...group,
    freezeMode: refreezeMode,
    frozenAtMs: now
  };
  state.groups = state.groups.map((item) => (item.id === groupId ? nextGroup : item));
  state.drafts[groupId] = groupToDraft(nextGroup);
}

function showSnoozeNotice(group, snoozeEntry, totalBeforeMs) {
  const activationDelayMs = Math.max(0, snoozeEntry.startsAtMs - Date.now());
  window.alert(
    t("snooze.noticePopup", {
      name: group.name,
      total: formatDurationMs(totalBeforeMs),
      upcoming: formatDurationMs(snoozeEntry.untilMs - snoozeEntry.startsAtMs),
      delay: formatDurationMs(activationDelayMs)
    })
  );
}

function renderUnfreezeModal(now = Date.now()) {
  if (!state.unfreezeFlow) {
    confirmModal.classList.add("hidden");
    return;
  }

  if (state.unfreezeFlow.kind === "unfreeze") {
    const group = state.groups.find((item) => item.id === state.unfreezeFlow.groupId);

    if (!group) {
      closeUnfreezeFlow();
      return;
    }

    state.unfreezeFlow.label = group.name;
  }

  if (!state.unfreezeFlow.label) {
    closeUnfreezeFlow();
    return;
  }

  const completedCount =
    UNFREEZE_CONFIRMATIONS_REQUIRED - state.unfreezeFlow.confirmationsLeft;
  const remainingCooldownMs = Math.max(state.unfreezeFlow.nextAllowedAtMs - now, 0);

  confirmModal.classList.remove("hidden");
  if (state.unfreezeFlow.kind === "delete-all") {
    const localizedMessages = getLocalizedUnfreezeMessages();
    const messageIndex = Math.min(completedCount, localizedMessages.length - 1);
    confirmTitle.textContent = t("modal.deleteAllTitle");
    confirmMessage.textContent = localizedMessages[messageIndex];
  } else if (state.unfreezeFlow.kind === "snooze") {
    confirmTitle.textContent = t("modal.snoozeTitle");
    confirmMessage.textContent = t("snooze.confirmationMessage", {
      count: state.unfreezeFlow.confirmationsLeft,
      seconds: Math.ceil(UNFREEZE_CONFIRMATION_INTERVAL_MS / 1000)
    });
  } else {
    const localizedMessages = getLocalizedUnfreezeMessages();
    const messageIndex = Math.min(completedCount, localizedMessages.length - 1);
    confirmTitle.textContent = t("modal.unfreezeTitle");
    confirmMessage.textContent = localizedMessages[messageIndex];
  }
  confirmProgress.textContent = `${state.unfreezeFlow.confirmationsLeft} ${t("modal.confirm")} ${t("meta.left")} - "${state.unfreezeFlow.label}"`;
  confirmProceedButton.disabled = remainingCooldownMs > 0;
  confirmProceedButton.textContent =
    remainingCooldownMs > 0
      ? `${t("modal.confirm")} ${Math.ceil(remainingCooldownMs / 1000)}s`
      : `${t("modal.confirm")} (${state.unfreezeFlow.confirmationsLeft})`;
}

async function handleUnfreezeConfirm() {
  if (!state.unfreezeFlow) {
    return;
  }

  const now = Date.now();

  if (state.unfreezeFlow.nextAllowedAtMs > now) {
    return;
  }

  if (state.unfreezeFlow.confirmationsLeft <= 1) {
    if (state.unfreezeFlow.kind === "delete-all") {
      state.groups = [];
      state.drafts = {};
      state.usageTimersMs = {};
      state.usageResetAtMs = {};
      state.groupSnoozes = {};
      state.groupSnoozeTotalsMs = {};
      state.selectedGroupId = null;

      await persistState(t("status.bulkDeleted"));
      closeUnfreezeFlow();
      render();
      return;
    }

    if (state.unfreezeFlow.kind === "snooze") {
      const group = state.groups.find((item) => item.id === state.unfreezeFlow.groupId);
      if (!group) {
        closeUnfreezeFlow();
        return;
      }
      const snoozeMinutes = state.unfreezeFlow.snoozeMinutes ?? group.snoozeMinutes;
      const activationDelayMinutes =
        state.unfreezeFlow.snoozeActivationDelayMinutes ?? group.snoozeActivationDelayMinutes;
      const cooldownMinutes =
        state.unfreezeFlow.snoozeCooldownMinutes ?? group.snoozeCooldownMinutes;
      const confirmationCount = group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS;
      const totalBeforeMs = Math.max(0, Number(state.groupSnoozeTotalsMs[group.id]) || 0);
      const snoozeEntry = createSnoozeEntry(
        group,
        {
          snoozeMinutes,
          activationDelayMinutes,
          cooldownMinutes,
          confirmationCount
        },
        now
      );
      state.groupSnoozes[group.id] = snoozeEntry;
      await persistState(
        activationDelayMinutes > 0
          ? t("status.snoozeScheduled", {
              name: group.name,
              delay: formatDurationMs(snoozeEntry.startsAtMs - now)
            })
          : t("status.snoozed", {
              name: group.name,
              minutes: snoozeMinutes,
              suffix: snoozeMinutes === 1 ? "" : "s"
            })
      );
      closeUnfreezeFlow();
      render();
      showSnoozeNotice(group, snoozeEntry, totalBeforeMs);
      return;
    }

    const group = state.groups.find((item) => item.id === state.unfreezeFlow.groupId);

    if (!group) {
      closeUnfreezeFlow();
      return;
    }

    state.groups = state.groups.map((item) =>
      item.id === group.id
        ? {
            ...item,
            freezeMode: "none",
            frozenAtMs: null
          }
        : item
    );

    await persistState(t("status.unfrozen", { name: group.name }));
    closeUnfreezeFlow();
    render();
    return;
  }

  state.unfreezeFlow.confirmationsLeft -= 1;
  state.unfreezeFlow.nextAllowedAtMs = now + UNFREEZE_CONFIRMATION_INTERVAL_MS;
  renderUnfreezeModal();
}

async function startSnooze() {
  let group = getSelectedGroup();

  if (!group) {
    return;
  }

  if (isGroupEditable(group)) {
    await flushAutosave();
    group = getSelectedGroup();
    if (!group) {
      return;
    }
  }

  const freezeStatus = getFreezeStatus(group);
  const allowSnooze = group.allowSnooze !== false;
  const currentSnooze = getCurrentSnooze(group.id);
  const currentSnoozePhase = getSnoozePhase(currentSnooze);

  if (!allowSnooze) {
    setSnoozeWarning(
      freezeStatus.isFrozen ? t("snooze.warning.disabledFrozen") : t("snooze.warning.disabled")
    );
    return;
  }

  // Custom groups: Start Snooze fires a snoozePress event. The button
  // is purely a notification trigger; custom rules cannot programmatically
  // snooze the group.
  if (group.groupType === "custom") {
    setSnoozeWarning("");
    try {
      cbDebugLog("[CustomBlocker:trace] popup → fire-snooze-press", group.id);
      const response = await chrome.runtime.sendMessage({
        type: "fire-snooze-press",
        groupId: group.id
      });
      cbDebugLog("[CustomBlocker:trace] popup ← fire-snooze-press response", response);
      if (!response || !response.ok) {
        const err =
          (response && response.error) || t("snooze.warning.snoozePressFailed");
        setSnoozeWarning(err);
      }
    } catch (error) {
      cbDebugWarn("[CustomBlocker:trace] popup fire-snooze-press error", error);
      setSnoozeWarning(String(error && error.message ? error.message : error));
    }
    return;
  }

  if (currentSnoozePhase === "pending") {
    setSnoozeWarning(
      t("snooze.warning.pending", {
        time: formatDurationMs(currentSnooze.startsAtMs - Date.now())
      })
    );
    return;
  }

  if (currentSnoozePhase === "active") {
    setSnoozeWarning(
      t("snooze.warning.active", {
        time: formatDurationMs(currentSnooze.untilMs - Date.now())
      })
    );
    return;
  }

  if (currentSnoozePhase === "cooldown") {
    setSnoozeWarning(
      t("snooze.warning.cooldown", {
        time: formatDurationMs(currentSnooze.cooldownUntilMs - Date.now())
      })
    );
    return;
  }

  const snoozeMinutesValue = freezeStatus.isFrozen
    ? String(group.snoozeMinutes)
    : snoozeMinutesField.value;
  const snoozeMinutes = parseSnoozeMinutes(snoozeMinutesValue);
  const snoozeActivationDelayValue = freezeStatus.isFrozen
    ? String(group.snoozeActivationDelayMinutes ?? DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES)
    : snoozeActivationDelayField.value;
  const snoozeActivationDelayMinutes = parseSnoozeDelayMinutes(snoozeActivationDelayValue);
  const snoozeCooldownValue = freezeStatus.isFrozen
    ? String(group.snoozeCooldownMinutes ?? DEFAULT_SNOOZE_COOLDOWN_MINUTES)
    : snoozeCooldownField.value;
  const snoozeCooldownMinutes = parseSnoozeCooldownMinutes(snoozeCooldownValue);
  const snoozeConfirmationsValue = freezeStatus.isFrozen
    ? String(group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS)
    : snoozeConfirmationsField.value;
  const snoozeConfirmations = parseSnoozeConfirmations(snoozeConfirmationsValue);

  if (snoozeMinutes === null) {
    setSnoozeWarning(t("snooze.warning.invalidMinutes"));
    return;
  }

  if (snoozeConfirmations === null) {
    setSnoozeWarning(t("snooze.warning.invalidConfirmations"));
    return;
  }

  if (snoozeActivationDelayMinutes === null) {
    setSnoozeWarning(t("snooze.warning.invalidActivationDelay"));
    return;
  }

  if (snoozeCooldownMinutes === null) {
    setSnoozeWarning(
      t("snooze.warning.invalidCooldown", { max: formatHours(MAX_SNOOZE_COOLDOWN_MINUTES) })
    );
    return;
  }

  setSnoozeWarning("");
  const now = Date.now();
  const totalBeforeMs = Math.max(0, Number(state.groupSnoozeTotalsMs[group.id]) || 0);
  if (snoozeConfirmations === 0) {
    const snoozeEntry = createSnoozeEntry(
      group,
      {
        snoozeMinutes,
        activationDelayMinutes: snoozeActivationDelayMinutes,
        cooldownMinutes: snoozeCooldownMinutes,
        confirmationCount: 0
      },
      now
    );
    state.groupSnoozes[group.id] = snoozeEntry;
    await persistState(
      snoozeActivationDelayMinutes > 0
        ? t("status.snoozeScheduled", {
            name: group.name,
            delay: formatDurationMs(snoozeEntry.startsAtMs - now)
          })
        : t("status.snoozed", {
            name: group.name,
            minutes: snoozeMinutes,
            suffix: snoozeMinutes === 1 ? "" : "s"
          })
    );
    render();
    showSnoozeNotice(group, snoozeEntry, totalBeforeMs);
    return;
  }

  state.unfreezeFlow = {
    kind: "snooze",
    groupId: group.id,
    label: group.name,
    confirmationsLeft: snoozeConfirmations,
    nextAllowedAtMs: now + UNFREEZE_CONFIRMATION_INTERVAL_MS,
    snoozeMinutes,
    snoozeActivationDelayMinutes,
    snoozeCooldownMinutes
  };

  if (state.confirmIntervalId !== null) {
    window.clearInterval(state.confirmIntervalId);
  }
  state.confirmIntervalId = window.setInterval(() => {
    renderUnfreezeModal();
  }, 250);
  renderUnfreezeModal();
}

async function endSnooze() {
  const group = getSelectedGroup();
  const now = Date.now();
  const snooze = group ? getCurrentSnooze(group.id, now) : null;

  if (!group || !snooze) {
    return;
  }

  const phase = getSnoozePhase(snooze, now);
  if (phase === "pending") {
    delete state.groupSnoozes[group.id];
  } else if (phase === "active") {
    const elapsedActiveMs = Math.max(0, Math.min(now, snooze.untilMs) - snooze.startsAtMs);
    const cooldownDurationMs = Math.max(0, snooze.cooldownUntilMs - snooze.untilMs);
    state.groupSnoozeTotalsMs[group.id] =
      Math.max(0, Number(state.groupSnoozeTotalsMs[group.id]) || 0) + elapsedActiveMs;
    maybeRefreezeGroupAfterSnooze(group.id, snooze, now);
    if (cooldownDurationMs > 0) {
      state.groupSnoozes[group.id] = {
        ...snooze,
        untilMs: now,
        cooldownUntilMs: now + cooldownDurationMs,
        activeMsApplied: true
      };
    } else {
      delete state.groupSnoozes[group.id];
    }
  } else {
    return;
  }
  await persistState(t("status.endedSnooze", { name: group.name }));
  render();
}

function clampPanelWidth(width) {
  const layoutWidth = layout.getBoundingClientRect().width || 1200;
  return Math.max(
    MIN_GROUP_PANEL_WIDTH,
    Math.min(width, Math.min(MAX_GROUP_PANEL_WIDTH, layoutWidth - 320))
  );
}

function applyPanelWidth(width) {
  state.panelWidth = clampPanelWidth(width);
  document.documentElement.style.setProperty("--groups-panel-width", `${state.panelWidth}px`);
  try {
    window.localStorage.setItem(LAYOUT_WIDTH_STORAGE_KEY, String(state.panelWidth));
  } catch {}
}

function loadPanelWidth() {
  try {
    const stored = Number.parseInt(window.localStorage.getItem(LAYOUT_WIDTH_STORAGE_KEY), 10);
    return Number.isFinite(stored) ? stored : 300;
  } catch {
    return 300;
  }
}

function startResizingPanels(event) {
  event.preventDefault();
  layoutResizer.classList.add("dragging");

  const handleMove = (moveEvent) => {
    const layoutRect = layout.getBoundingClientRect();
    applyPanelWidth(moveEvent.clientX - layoutRect.left);
  };

  const handleUp = () => {
    layoutResizer.classList.remove("dragging");
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);
  };

  window.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleUp);
}

function syncExternalState(changes) {
  let shouldRenderDynamicOnly = false;

  if (changes[USAGE_TIMERS_KEY]) {
    state.usageTimersMs = sanitizeUsageTimers(changes[USAGE_TIMERS_KEY].newValue, state.groups);
    shouldRenderDynamicOnly = true;
  }

  if (changes[USAGE_RESET_AT_KEY]) {
    state.usageResetAtMs = sanitizeResetTimes(changes[USAGE_RESET_AT_KEY].newValue, state.groups);
    shouldRenderDynamicOnly = true;
  }

  if (changes[GROUP_SNOOZES_KEY]) {
    state.groupSnoozes = sanitizeSnoozes(changes[GROUP_SNOOZES_KEY].newValue, state.groups);
    shouldRenderDynamicOnly = true;
  }

  if (changes[GROUP_SNOOZE_TOTALS_KEY]) {
    state.groupSnoozeTotalsMs = sanitizeSnoozeTotals(
      changes[GROUP_SNOOZE_TOTALS_KEY].newValue,
      state.groups
    );
    shouldRenderDynamicOnly = true;
  }

  if (changes[GLOBAL_SETTINGS_KEY]) {
    state.globalSettings = sanitizeGlobalSettings(changes[GLOBAL_SETTINGS_KEY].newValue);
    cbDebugMode = state.globalSettings.debugMode === true;
    if (state.isSettingsOpen) {
      syncSettingsFormFromState();
    }
  }

  if (
    changes[BLOCKED_GROUPS_KEY] &&
    Date.now() > state.suppressGroupStorageUpdatesUntil
  ) {
    state.groups = sanitizeGroups(changes[BLOCKED_GROUPS_KEY].newValue);
    state.drafts = {};
    if (!state.groups.some((group) => group.id === state.selectedGroupId)) {
      state.selectedGroupId = state.groups[0]?.id ?? null;
    }
    render();
    return;
  }

  if (shouldRenderDynamicOnly) {
    renderDynamicView();
  }
}

groupNameField.addEventListener("input", () => {
  stashCurrentDraft();
  editorTitle.textContent = groupNameField.value.trim() || t("editor.title");
  renderGroupList();
  scheduleAutosave();
});

groupEnabledField.addEventListener("change", () => {
  stashCurrentDraft();
  if (!state.selectedGroupId) {
    return;
  }

  updateGroupEnabled(state.selectedGroupId, groupEnabledField.checked);
});

blockModeField.addEventListener("change", () => {
  stashCurrentDraft();
  render();
  scheduleAutosave();
});

allowedMinutesField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  updateUsageSummary(getSelectedGroup(), getDraftForGroup(state.selectedGroupId));
  scheduleAutosave();
});

resetIntervalHoursField.addEventListener("input", () => {
  stashCurrentDraft();
  updateUsageSummary(getSelectedGroup(), getDraftForGroup(state.selectedGroupId));
  scheduleAutosave();
});

snoozeMinutesField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

snoozeActivationDelayField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

snoozeCooldownField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

snoozeConfirmationsField.addEventListener("input", () => {
  stashCurrentDraft();
  if (snoozeWarning.textContent) {
    setSnoozeWarning("");
  }
  scheduleAutosave();
});

allowSnoozeField.addEventListener("change", () => {
  stashCurrentDraft();
  updateSnoozeUI(getSelectedGroup());
  scheduleAutosave();
});

scheduleWindowsField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

if (siteAddConfirmButton) {
  siteAddConfirmButton.addEventListener("click", () => confirmSiteAdd());
}
if (siteAddCancelButton) {
  siteAddCancelButton.addEventListener("click", () => closeSiteAddPanel());
}
if (siteAddInput) {
  siteAddInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      confirmSiteAdd();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSiteAddPanel();
    }
  });
}

blockingRulesField.addEventListener("input", () => {
  updateBlockingRulesEditor();
  stashCurrentDraft();
  scheduleAutosave();
});

blockingRulesField.addEventListener("scroll", syncBlockingRulesEditorScroll);

// Commit on blur so a user who types then immediately runs the rule
// doesn't lose the most recent keystrokes to the autosave debounce.
blockingRulesField.addEventListener("blur", () => {
  flushAutosave().catch((error) => {
    console.error("Failed to flush blocking rules on blur.", error);
  });
});

if (aiPromptInput) {
  aiPromptInput.addEventListener("input", () => {
    const group = getSelectedGroup();
    if (!group || group.groupType !== "custom") return;
    state.aiPromptGroupId = group.id;
    saveAiPromptDraft(group.id, aiPromptInput.value);
    if (aiPromptStatus) {
      aiPromptStatus.textContent = "";
      aiPromptStatus.className = "run-status";
    }
  });
}

// Wall-clock watchdog for the Run flow. If a previous custom rule
// already locked the sandbox iframe with an infinite loop, the
// background's `await chrome.runtime.sendMessage(... event-sandbox-request)`
// hangs until offscreen.js's hard timeout fires (~5s) and tears the
// iframe down. We give the whole round trip a generous 8s budget so the
// status pill can flip to "Halted" even in the worst case where the
// SW round trip + iframe reset both happen.
const RUN_CUSTOM_GROUP_TIMEOUT_MS = 8000;

function timeoutFallback(ms) {
  return new Promise((resolve) => setTimeout(() => resolve({
    __timedOut: true,
    ok: false,
    error: "timeout"
  }), ms));
}

async function requestCustomGroupSyntaxCheck(source) {
  const response = await Promise.race([
    chrome.runtime.sendMessage({
      type: "check-custom-group-syntax",
      source
    }),
    timeoutFallback(RUN_CUSTOM_GROUP_TIMEOUT_MS)
  ]);

  if (response && response.__timedOut) {
    return {
      ok: false,
      text:
        "Halted: syntax check took too long. Your code likely contains " +
        "an infinite loop in the registration body.",
      statusKey: "status.customSyntaxHaltedTimeBudget"
    };
  }

  if (response && response.ok && response.result && response.result.ok) {
    const handlers = response.result.handlers ?? 0;
    return {
      ok: true,
      handlers,
      text: t("custom.checkSyntaxOk", { count: String(handlers) })
    };
  }

  return {
    ok: false,
    text:
      (response && response.result && response.result.error) ||
      (response && response.error) ||
      t("custom.checkSyntaxFailed")
  };
}

function buildCustomRuleAiPrompt(userRequest, currentRule) {
  const demand = String(userRequest || "").trim() || "(No extra user request was provided.)";
  const existingRule = String(currentRule || "").trim() || "(No current rule.)";

  return [
    "TASK: generate custom-rule JavaScript for Chrome extension Screen Time Limiter: Custom Website Blocker & Focus Timer.",
    "OUTPUT_CONTRACT: put only the final valid JavaScript source inside one copyable fenced code block labeled javascript; no prose before or after the code block.",
    "TOP_LEVEL_SHAPE: (event, helpers) => { /* register handlers here */ }",
    "EXECUTION_MODEL: top-level function runs once per Run click or enable; it must register persistent handlers. Do not do the blocking work only at top level. Handlers persist until Run again, disable, delete, or same (type,id) re-register. Sandbox is long-lived and shared by groups. Keep synchronous work bounded. No infinite loops, network fetches, external packages, eval/new Function, DOM globals, chrome APIs, timers like setInterval for rule logic, or assumptions that browser/page globals exist.",
    "USER_REQUEST_BEGIN",
    demand,
    "USER_REQUEST_END",
    "API.EVENT_REGISTRY:",
    "event.register(type,id,handler,options?) -> boolean; event.getEvent(type,id) -> function|null; event.getEvents(type) -> object; event.countRegistered(type) -> number; event.unregister(type,id) -> boolean; event.unregisterAll(type) -> number; event.post(type,data?,{scope?}) -> void. Reserved event names starting '_' are rejected. options.priority default 0, higher runs first. options.intervalMs throttles tickEvent/pageHeartbeat-style frequent handlers. Same type+id replaces.",
    "BUILTIN_EVENT_TYPES: tickEvent, openWebEvent, closeWebEvent, switchWebEvent, switchDomainEvent, webChangedEvent, timerEnded, snoozePress, panelEvent, localFileEvent, pageHeartbeatEvent.",
    "TYPED_EVENT_METHODS: for each built-in type suffix S = TickEvent/OpenWebEvent/CloseWebEvent/SwitchWebEvent/SwitchDomainEvent/WebChangedEvent/TimerEnded/SnoozePress/PanelEvent/LocalFileEvent/PageHeartbeatEvent: event.registerS(id,handler,opts), event.getS(id), event.getSs(), count name as event.countTickRegistered/countOpenWebRegistered/countCloseWebRegistered/countSwitchWebRegistered/countSwitchDomainRegistered/countWebChangedRegistered/countTimerEndedRegistered/countSnoozePressRegistered/countPanelRegistered/countLocalFileRegistered/countPageHeartbeatRegistered. Also aliases: registerTimerEndedEvent/getTimerEndedEvent/getTimerEndedEvents/countTimerEndedEventRegistered; registerSnoozePressEvent/getSnoozePressEvent/getSnoozePressEvents/countSnoozePressEventRegistered; registerPanelEvent/getPanelEvent/getPanelEvents/countPanelEventRegistered; registerLocalFileEvent/getLocalFileEvent/getLocalFileEvents/countLocalFileEventRegistered.",
    "EVENT_SEMANTICS: tickEvent per-open-tab 1s tick data {intervalMs} with at most one tick per tab per second; pageHeartbeatEvent active visible tab heartbeat data {elapsedMs}; openWebEvent new tab created data {previousUrl,isNewTab}; closeWebEvent tab close data {reason,nextUrl}; switchWebEvent same-tab committed URL change data {previousUrl,previousHostname,sameDomain}; switchDomainEvent committed hostname boundary data {previousUrl,previousHostname}; webChangedEvent one committed top-level navigation/reload data {previousUrl,previousHostname,sameDomain,isFirstLoad,isReload,transition:'commit'}; timerEnded owning group only data {timerId,displayName,direction,currentMs}; snoozePress custom group only when Start Snooze clicked data {triggeredAt}; panelEvent owning group only data {panelId,controlId,eventName,value,values,key,code,keyInfo} and ev.panelId/ev.controlId/ev.eventName/ev.value/ev.values/ev.key/ev.code/ev.keyInfo shortcuts; localFileEvent owning group only data {eventName,action,path,directoryPath,requestId,ok,text,value,entries,exists,bytes,error} and same-name ev shortcuts. New tab/about blank exposed as ev.url === ''.",
    "HANDLER_SHAPE: (ev, helpers) => void. ev fields: type, groupId, tabId, pageId, url, hostname, time:{now,month,dayOfMonth,dayName,hour,minute}, data. ev methods: preventDefault(), stopPropagation(), setResult(number|string), getResult(), post(type,data,{scope?}), setRedirectLink(url), getRedirectLink(). setResult(-1)=block, 0=neutral/pass, 1=allow override; string result is redirect URL; setRedirectLink sets redirect target for blocked result; stopPropagation halts all later handlers across groups. ev is Proxy: custom fields can be assigned/read during same dispatch.",
    "HELPERS.TOP: helpers.now, helpers.currentUrl, helpers.groupId, helpers.log(...), helpers.warn(...), helpers.error(...), helpers.logScreen(...), helpers.warnScreen(...), helpers.errorScreen(...), helpers.logPopup(...), helpers.warnPopup(...), helpers.errorPopup(...), getLogHelper, getDomainHelper, getDomainUtility, getTimerHelper, getPanelHelper, getPersistenceHelper, getRedirectionHelper, getDOMHelper, getNavigationHelper, getStorageHelper, getLocalFolderHelper, getTabHelper, getPlatformHelper.",
    "HELPERS.LOG: log=helpers.getLogHelper(); log.log/warn/error write popup Log panel and follow Settings → Show custom rule logs on web pages for page toasts. log.logScreen/warnScreen/errorScreen write screen/page toast only. log.logPopup/warnPopup/errorPopup write popup only. Top-level helpers.log*, warn*, error* shortcuts mirror these. Logs are capped/rate-limited.",
    "HELPERS.DOMAIN: d=helpers.getDomainHelper(); d.hostnameOf(url); d.pathnameOf(url); d.matches(hostname,site); d.getPlatform(url); d.isYouTubeHost(host); d.isTikTokHost(host); d.isInstagramHost(host); d.isFacebookHost(host); d.isTwitchHost(host); d.isRedditHost(host); d.isDiscordHost(host); d.isEmptyStartPage(url); d.matchesAny(url,regexOrArrayOrString); d.pathStartsWith(url,path); d.queryHas(url,key,value?); d.queryGet(url,key); d.isSearchPage(url); d.isInfiniteFeedUrl(url); d.sameSection(a,b). Platform URL classifiers: d.youtube()/tiktok()/instagram()/facebook()/twitch() each expose isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url), extractVideoId(url).",
    "HELPERS.TIMER: tm=helpers.getTimerHelper(); tm.groupId; tm.create({id,displayName?,direction?,currentMs?,scope?,domain?}) resets; tm.getOrCreateTimer({id,displayName?,direction?,currentMs?,scope?,domain?}) creates only when missing and otherwise returns existing timer unchanged; init fields including scope/domain apply only on creation. direction forward/backward; currentMs ms; scope(url) auto-ticks on visible page heartbeat; domain(url) controls overlay display. To change an existing timer use setDirection/setCurrentMs/addMs/setDisplayName or create() to reset. tm.delete(id), pause(id), resume(id), setDirection(id,dir), setCurrentMs(id,ms), addMs(id,deltaMs), setDisplayName(id,name), getCurrentMs(id), isExpired(id), isPaused(id), getDirection(id), getDisplayName(id), exists(id), getState(id)->{id,displayName,direction,isPaused,currentMs,isExpired}|null, list()->array. Timers do not block by themselves; check isExpired in open/switch/webChanged handler and then block.",
    "HELPERS.PANEL: pn=helpers.getPanelHelper(); pn.create({id,title?,description?,position?,align?,layout?,priority?,width?,textSize?,theme?,ariaLabel?,role?,autoFocus?,scope?,domain?,controls?,onEvent?,onChange?,onClick?,onInput?,onFocus?,onBlur?,onSubmit?,onClose?,onMount?,onUnmount?,onKey?}) replaces/resets; pn.getOrCreatePanel(config) creates only when missing and otherwise returns existing panel unchanged; pn.update(id,patch), delete(id), show(id), hide(id), setValue(panelId,controlId,value), updateControl(panelId,controlId,patch), enable/disable(panelId,controlId), setOptions(panelId,controlId,options), setText(panelId,controlId,text), setTheme(panelId,theme), setTitle(panelId,title), setDescription(panelId,text), getValue(panelId,controlId), getValues(panelId), getState(id), list(); builders: notice(config), confirm(config), checklist(config), form(config). Controls: {id,type,label?,text?,placeholder?,value?,options?,min?,max?,step?,timerId?,timer?,format?,showExpired?,action?,layout?,priority?,width?,height?,rows?,disabled?,ariaLabel?,autoFocus?,onEvent?,onChange?,onClick?,onInput?,onFocus?,onBlur?,onSubmit?,onClose?,onMount?,onUnmount?,onKey?}; types text, checkbox, select, textInput, textarea, button, section, timer, numberInput, range, toggle, radio, date, time, color. section has nested controls and its own layout/priority. timer is display-only: use timerId to hydrate from getTimerHelper state, or timer: tm.getState(id) for a snapshot. numberInput/range support min/max/step; radio uses options; toggle is boolean. Layout presets: vertical, compact, comfortable, spacious, inline, row, wrap, twoColumn, grid, split, form, toolbar, stack. Higher priority panels/controls/sections appear earlier/closer to corner. Per-control width accepts px/%, full, auto; height accepts px/auto; rows affects textarea. If panel width is omitted, the outer panel auto-fits content tightly. Panel events include change/click/input/focus/blur/submit/close/mount/unmount/key; key events expose ev.key/ev.code/ev.keyInfo. scope/domain decide where shown.",
    "HELPERS.PERSISTENCE: p=helpers.getPersistenceHelper(); p.get(key,defaultValue?), set(key,valueJSON), delete(key), has(key), keys(), entries(), clear(), size(). Values JSON-serializable; scoped to group.",
    "HELPERS.REDIRECT: r=helpers.getRedirectionHelper(); r.get(); r.set(url); r.setRedirectLink(url); r.getRedirectLink(); r.createMessageUrl(message). ev.setRedirectLink can also be used directly.",
    "HELPERS.DOM: dom=helpers.getDOMHelper(); dom.hide(selector), show(selector), addClass(selector,className), removeClass(selector,className), setText(selector,text), click(selector), injectCss(css,id?), removeInjectedCss(id), scrollTo(selector). These enqueue content-script DOM intents, applied after handler returns.",
    "HELPERS.NAVIGATION: nav=helpers.getNavigationHelper(); nav.back(), forward(), reload(), goTo(url), closeTab(). These enqueue tab navigation intents for current event tab.",
    "HELPERS.STORAGE: s=helpers.getStorageHelper(); includes persistence methods plus s.requestAsyncGet(key), s.requestAsyncSet(key,valueJSON). Async results arrive via follow-up custom storage events; do not await.",
    "HELPERS.LOCAL_FOLDER: lf=helpers.getLocalFolderHelper(); requires Settings → Local File Folder. Supported files: .txt, .csv, .json inside the granted folder only. Request methods are async and return requestId: requestRead(path), requestWrite(path,text), requestAppend(path,text), requestList(directoryPath?), requestExists(path), requestReadJson(path), requestWriteJson(path,valueJSON). Results arrive via event.registerLocalFileEvent(id,(ev,h)=>{}) with ev.eventName read/write/append/list/exists/error, ev.path, ev.directoryPath, ev.requestId, ev.text, ev.value, ev.entries, ev.exists, ev.error.",
    "HELPERS.TAB: tab=helpers.getTabHelper(); tab.list(), getActiveTab(), getById(id), countOpen(), requestRefresh(). Uses snapshot bundled with dispatch.",
    "HELPERS.PLATFORM: ph=helpers.getPlatformHelper(); ph.youtube(), ph.tiktok(), ph.instagram(), ph.facebook(), ph.twitch(); ph.listMethods(platform); ph.hasMethod(platform,methodName). Each platform API always has URL classifiers isPlatformUrl,isShortUrl,isVideoUrl,isPostUrl,isHomePage,extractAuthor,extractVideoId.",
    "PLATFORM_METHODS.YOUTUBE: hideShorts(predicate,{blockPageOnVisit?}), showShorts(), hideVideos(predicate,opts), showVideos(), hidePosts(predicate,opts), showPosts(), hideShortButton(), showShortButton(), hideHomePage(), showHomePage(), hideComments(), showComments(), filterComments(predicate,opts), hideLive(), showLive(), filterLive(predicate,opts), isCurrentChannelSubscribed(), isChannelSubscribed(id), isCurrentChannelVerified(), isLiveNow(), isItemLive(item), isAlgorithmicRecommendation(item), isSponsored(item), setShortsTimer(opts), setVideosTimer(opts), setPostsTimer(opts).",
    "PLATFORM_METHODS.TIKTOK: hideVideos(predicate,opts), showVideos(), hideHomePage(), showHomePage(), hideComments(), showComments(), filterComments(predicate,opts), hideLive(), showLive(), filterLive(predicate,opts), isLiveNow(), isItemLive(item), isAlgorithmicRecommendation(item), isSponsored(item), setVideosTimer(opts).",
    "PLATFORM_METHODS.INSTAGRAM: hideReels(predicate,opts), showReels(), hidePosts(predicate,opts), showPosts(), hideHomePage(), showHomePage(), hideComments(), showComments(), filterComments(predicate,opts), isAlgorithmicRecommendation(item), isSponsored(item), setReelsTimer(opts), setPostsTimer(opts).",
    "PLATFORM_METHODS.FACEBOOK: hideReels(predicate,opts), showReels(), hideVideos(predicate,opts), showVideos(), hidePosts(predicate,opts), showPosts(), hideHomePage(), showHomePage(), hideComments(), showComments(), filterComments(predicate,opts), hideLive(), showLive(), filterLive(predicate,opts), isLiveNow(), isItemLive(item), isAlgorithmicRecommendation(item), isSponsored(item), setReelsTimer(opts), setVideosTimer(opts), setPostsTimer(opts).",
    "PLATFORM_METHODS.TWITCH: hideComments(), showComments(), hideClips(predicate,opts), showClips(), hideStreams(predicate,opts), showStreams(), hideVideos(predicate,opts), showVideos(), hideHomePage(), showHomePage(), hideLive(), showLive(), filterLive(predicate,opts), isCurrentChannelSubscribed(), isChannelSubscribed(id), isLiveNow(), isItemLive(item), isAlgorithmicRecommendation(item), setClipsTimer(opts), setStreamsTimer(opts), setVideosTimer(opts).",
    "PLATFORM_PREDICATE_ITEM: item={url,name,author,length,views,publishedAt,description,live?,sponsored?,algorithmic?}; fields may be null. Predicate methods keep one persistent predicate per group+platform+slot; each call replaces previous predicate; show* clears. opts.blockPageOnVisit can block page visits when predicate matches.",
    "COMMON_PATTERNS: immediate block -> registerOpenWebEvent and registerSwitchWebEvent or registerWebChangedEvent; if condition matches ev.url then ev.setRedirectLink(optional), ev.preventDefault(), ev.setResult(-1). Reload-sensitive logic -> webChangedEvent. Time budgets -> getOrCreateTimer with scope/domain plus block handler checking isExpired. DOM hiding -> run on open/switch/webChanged and call platform/DOM helper.",
    "CURRENT_RULE_BEGIN",
    "BEGIN_CURRENT_RULE",
    existingRule,
    "END_CURRENT_RULE",
    "CURRENT_RULE_END"
  ].join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error(t("custom.aiPromptCopyFailed"));
  }
}

async function runSelectedCustomGroup() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom") return;
  await flushAutosave();
  const source = String(blockingRulesField?.value ?? "").trim();
  if (runCustomGroupStatus) {
    runCustomGroupStatus.textContent = t("custom.checkSyntaxRunning");
    runCustomGroupStatus.className = "run-status";
  }
  try {
    const syntaxResult = await requestCustomGroupSyntaxCheck(source);
    if (!syntaxResult.ok) {
      if (runCustomGroupStatus) {
        runCustomGroupStatus.textContent = syntaxResult.text;
        runCustomGroupStatus.className = "run-status error";
      }
      setStatus(syntaxResult.statusKey ? t(syntaxResult.statusKey) : syntaxResult.text, true);
      return;
    }

    if (runCustomGroupStatus) {
      runCustomGroupStatus.textContent = t("custom.runStatusRunning");
      runCustomGroupStatus.className = "run-status";
    }

    const response = await Promise.race([
      chrome.runtime.sendMessage({
        type: "run-custom-group",
        groupId: group.id,
        source
      }),
      timeoutFallback(RUN_CUSTOM_GROUP_TIMEOUT_MS)
    ]);
    if (response && response.__timedOut) {
      if (runCustomGroupStatus) {
        runCustomGroupStatus.textContent =
          "Halted: the rule took too long to load and was force-aborted. " +
          "Check the Log panel for details.";
        runCustomGroupStatus.className = "run-status error";
      }
      setStatus(t("status.customRunHaltedTimeBudget"), true);
      return;
    }
    if (response && response.ok && response.loadResult) {
      const lr = response.loadResult;
      if (lr.ok) {
        markCustomGroupSourceActive(group.id, source);
        if (runCustomGroupStatus) {
          // Append a reload reminder so the user knows that already-
          // open tabs need a refresh before content-script-driven
          // behaviors (overlay, blockPageOnVisit) reflect the new
          // rule. Newly-opened tabs pick it up automatically.
          runCustomGroupStatus.textContent =
            t("custom.runStatusOk", { count: String(lr.handlers ?? 0) }) +
            " — " + t("custom.runReloadReminder");
          runCustomGroupStatus.className = "run-status success";
        }
        setStatus(t("status.customGroupRan", { name: group.name, count: String(lr.handlers ?? 0) }));
      } else {
        // Hard-timeout from offscreen surfaces as error="sandbox-timeout"
        // with a quarantine hint. Display the reason in human terms so
        // the user knows their rule was force-disabled.
        let displayError = lr.error || t("custom.runStatusError");
        if (lr.error === "sandbox-timeout") {
          displayError = "Halted: rule was running for >5s without yielding. " +
            "It has been auto-disabled. Edit the code (look for an infinite loop) " +
            "and click Run again to re-enable.";
        } else if (lr.quarantine && lr.quarantine.reason) {
          displayError = "Halted: " + lr.quarantine.reason +
            ". The rule has been auto-disabled.";
        }
        if (runCustomGroupStatus) {
          runCustomGroupStatus.textContent = displayError;
          runCustomGroupStatus.className = "run-status error";
        }
        setStatus(displayError, true);
      }
    } else {
      if (runCustomGroupStatus) {
        runCustomGroupStatus.textContent = t("custom.runStatusError");
        runCustomGroupStatus.className = "run-status error";
      }
      setStatus(t("status.errorRunCustomGroup"), true);
    }
  } catch (error) {
    console.error("Failed to run custom group.", error);
    if (runCustomGroupStatus) {
      runCustomGroupStatus.textContent = String(error && error.message ? error.message : error);
      runCustomGroupStatus.className = "run-status error";
    }
    setStatus(t("status.errorRunCustomGroup"), true);
  }
}

if (runCustomGroupButton) {
  runCustomGroupButton.addEventListener("click", () => {
    runSelectedCustomGroup();
  });
}

async function checkSelectedCustomGroupSyntax() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom") return;
  const source = String(blockingRulesField?.value ?? "").trim();
  if (runCustomGroupStatus) {
    runCustomGroupStatus.textContent = t("custom.checkSyntaxRunning");
    runCustomGroupStatus.className = "run-status";
  }
  try {
    const syntaxResult = await requestCustomGroupSyntaxCheck(source);
    if (syntaxResult.ok) {
      if (runCustomGroupStatus) {
        runCustomGroupStatus.textContent = syntaxResult.text;
        runCustomGroupStatus.className = "run-status success";
      }
      setStatus(syntaxResult.text);
      return;
    }

    if (syntaxResult.statusKey) {
      if (runCustomGroupStatus) {
        runCustomGroupStatus.textContent = syntaxResult.text;
        runCustomGroupStatus.className = "run-status error";
      }
      setStatus(t(syntaxResult.statusKey), true);
      return;
    }

    if (runCustomGroupStatus) {
      runCustomGroupStatus.textContent = syntaxResult.text;
      runCustomGroupStatus.className = "run-status error";
    }
    setStatus(syntaxResult.text, true);
  } catch (error) {
    const text = String(error && error.message ? error.message : error);
    if (runCustomGroupStatus) {
      runCustomGroupStatus.textContent = text;
      runCustomGroupStatus.className = "run-status error";
    }
    setStatus(text, true);
  }
}

function toggleAiPromptPanel() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom") return;
  if (!aiPromptPanel) return;
  const shouldOpen = aiPromptPanel.classList.contains("hidden");
  aiPromptPanel.classList.toggle("hidden", !shouldOpen);
  if (aiPromptStatus) {
    aiPromptStatus.textContent = "";
    aiPromptStatus.className = "run-status";
  }
  if (shouldOpen) {
    aiPromptInput?.focus();
  }
}

async function copyAiPromptForCustomRule() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom") return;

  const prompt = buildCustomRuleAiPrompt(
    aiPromptInput?.value ?? "",
    blockingRulesField?.value ?? group.blockingRulesText
  );

  try {
    await copyTextToClipboard(prompt);
    if (aiPromptStatus) {
      aiPromptStatus.textContent = t("custom.aiPromptCopied");
      aiPromptStatus.className = "run-status success";
    }
    setStatus(t("custom.aiPromptCopied"));
  } catch (error) {
    const text = error?.message || t("custom.aiPromptCopyFailed");
    if (aiPromptStatus) {
      aiPromptStatus.textContent = text;
      aiPromptStatus.className = "run-status error";
    }
    setStatus(text, true);
  }
}

if (checkSyntaxButton) {
  checkSyntaxButton.addEventListener("click", () => {
    toggleAiPromptPanel();
  });
}

if (aiPromptCopyButton) {
  aiPromptCopyButton.addEventListener("click", () => {
    copyAiPromptForCustomRule();
  });
}

if (openRuleTemplatesButton) {
  openRuleTemplatesButton.addEventListener("click", () => {
    try {
      openTemplateModal();
    } catch (error) {
      console.error("Failed to open custom rule templates.", error);
      setStatus(t("status.errorApplyTemplate"), true);
    }
  });
}

if (templateFilterField) {
  templateFilterField.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-template-filter-tag]");
    if (!chip) {
      return;
    }
    const tag = normalizeTemplateTag(chip.dataset.templateFilterTag);
    if (!tag) {
      return;
    }
    const nextTags = new Set(state.templateFilterTags);
    if (nextTags.has(tag)) {
      nextTags.delete(tag);
    } else {
      nextTags.add(tag);
    }
    state.templateFilterTags = [...nextTags];
    renderTemplateModal();
  });
}

if (templateGrid) {
  templateGrid.addEventListener("click", (event) => {
    if (event.target.closest("input, label, button, textarea, select")) {
      return;
    }
    const card = event.target.closest("[data-template-card]");
    if (!card) return;
    state.selectedTemplateId = card.dataset.templateCard;
    renderTemplateModal();
  });

  templateGrid.addEventListener("input", (event) => {
    const field = event.target.closest("[data-template-id][data-param-id]");
    if (!field) return;
    const templateId = field.dataset.templateId;
    const paramId = field.dataset.paramId;
    const template = getTemplateById(templateId);
    if (!template) return;
    const param = template.params.find((item) => item.id === paramId);
    if (!param) return;
    const selectionStart = typeof field.selectionStart === "number" ? field.selectionStart : null;
    const selectionEnd = typeof field.selectionEnd === "number" ? field.selectionEnd : null;
    const previousScrollTop = templateGrid.scrollTop;
    const draft = getTemplateDraft(templateId);
    draft[paramId] = param.type === "checkbox" ? field.checked : field.value;
    state.selectedTemplateId = templateId;
    renderTemplateModal();
    templateGrid.scrollTop = previousScrollTop;
    const nextField = templateGrid.querySelector(
      `[data-template-id="${templateId}"][data-param-id="${paramId}"]`
    );
    if (nextField) {
      if (typeof nextField.focus === "function") {
        nextField.focus({ preventScroll: true });
      }
      if (
        selectionStart !== null &&
        typeof nextField.setSelectionRange === "function" &&
        document.activeElement === nextField
      ) {
        nextField.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
      }
    }
  });
}

setupPlatformChipInputs();

platformAuthorsField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

platformAuthorTagsField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

platformVideoModeField.addEventListener("change", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

platformAuthorModeField.addEventListener("change", () => {
  if (platformAuthorModeField.value === "exclude") {
    setStatus(t("status.allowlistWarning"));
  }
  stashCurrentDraft();
  render();
  renderGroupList();
  scheduleAutosave();
});

redditSubredditsField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

redditModeField.addEventListener("change", () => {
  if (redditModeField.value === "exclude") {
    setStatus(t("status.redditAllowlistWarning"));
  }
  stashCurrentDraft();
  render();
  renderGroupList();
  scheduleAutosave();
});

discordTargetsField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

discordModeField.addEventListener("change", () => {
  if (discordModeField.value === "exclude") {
    setStatus(t("status.discordAllowlistWarning"));
  }
  stashCurrentDraft();
  render();
  renderGroupList();
  scheduleAutosave();
});

for (const field of [platformBlockHomePageField, redditBlockHomePageField, discordBlockHomePageField, skipToNextOnBlockField]) {
  field.addEventListener("change", () => {
    stashCurrentDraft();
    renderGroupList();
    scheduleAutosave();
  });
}

if (groupEffectField) {
  groupEffectField.addEventListener("change", () => {
    stashCurrentDraft();
    render();
    renderGroupList();
    scheduleAutosave();
  });
}

fallbackUrlField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

dayCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    stashCurrentDraft();
    scheduleAutosave();
  });
});

freezeModeField.addEventListener("change", () => {
  const selected = getSelectedGroup();
  if (selected) {
    state.drafts[selected.id] = {
      ...(state.drafts[selected.id] ?? groupToDraft(selected)),
      freezeModeChoice: freezeModeField.value
    };
    scheduleAutosave();
  }
  strictFreezeSettings.classList.toggle("hidden", freezeModeField.value !== "strict");
  updateFreezeUI(selected);
});

strictFreezeHoursField.addEventListener("input", () => {
  updateFreezeUI(getSelectedGroup());
});

addGroupButton.addEventListener("click", () => {
  addGroup(addGroupTypeField.value).catch((error) => {
    console.error("Failed to add block group.", error);
    setStatus(t("status.errorCreateGroup"), true);
  });
});

manualButton.addEventListener("click", () => {
  openManual();
});

if (settingsButton) {
  settingsButton.addEventListener("click", () => {
    openSettings();
  });
}

if (settingsCloseButton) {
  settingsCloseButton.addEventListener("click", () => {
    closeSettings();
  });
}

if (settingsModal) {
  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      closeSettings();
    }
  });
}

// Global settings auto-save: persist on every committed edit (no Save button).
{
  const settingsAutoSaveFields = [
    settingsTickRateField,
    settingsAutosaveDebounceField,
    settingsDebugModeField,
    settingsShowOnPageLogToastsField,
    settingsDefaultSnoozeMinutesField,
    settingsDefaultFallbackUrlField
  ];
  const autoSaveSettings = () => {
    saveSettingsFromForm().catch((error) => {
      console.error("Failed to save global settings.", error);
    });
  };
  for (const field of settingsAutoSaveFields) {
    if (!field) continue;
    field.addEventListener("change", autoSaveSettings);
  }
}

if (connectionServerToggle) {
  connectionServerToggle.addEventListener("change", () => {
    const enabled = connectionServerToggle.checked;
    updateConnectionSettings({ serverEnabled: enabled })
      .then(() => {
        try {
          chrome.runtime.sendMessage({
            type: enabled ? "connection-server-start" : "connection-server-stop"
          });
        } catch (_) {}
      })
      .catch(() => {});
  });
}

if (connectionConnectButton) {
  connectionConnectButton.addEventListener("click", () => {
    updateConnectionSettings({ clientEnabled: true })
      .then(() => {
        try {
          chrome.runtime.sendMessage({ type: "connection-connect" });
        } catch (_) {}
        applyConnectionStatus({ ...state.connectionStatus, state: "connecting" });
      })
      .catch(() => {});
  });
}

if (connectionDisconnectButton) {
  connectionDisconnectButton.addEventListener("click", () => {
    updateConnectionSettings({ clientEnabled: false })
      .then(() => {
        try {
          chrome.runtime.sendMessage({ type: "connection-disconnect" });
        } catch (_) {}
        applyConnectionStatus({ state: "off" });
      })
      .catch(() => {});
  });
}

if (connectionGroupConnectButton) {
  connectionGroupConnectButton.addEventListener("click", () => {
    const group = getSelectedGroup();
    if (!group || !isBridgeEligibleGroup(group)) return;
    const toProgram = connectionGroupProgram?.value || "";
    if (!toProgram) return;
    // The initiator's settings win the first merge for this group.
    state.pendingPriorityGroups.add(group.id);
    try {
      chrome.runtime.sendMessage({
        type: "group-connect",
        groupName: group.name,
        groupType: group.groupType,
        fromProgram: LOCAL_PROGRAM_ID,
        toProgram
      });
    } catch (_) {}
    if (connectionGroupHint) connectionGroupHint.textContent = t("connectionGroup.connecting");
  });
}

if (connectionGroupDisconnectButton) {
  connectionGroupDisconnectButton.addEventListener("click", () => {
    const group = getSelectedGroup();
    const cluster = group ? groupConnectionCluster(group) : null;
    if (!cluster) return;
    try {
      chrome.runtime.sendMessage({
        type: "group-disconnect",
        clusterId: cluster.id,
        groupName: group.name,
        program: LOCAL_PROGRAM_ID
      });
    } catch (_) {}
  });
}

if (localFolderChooseButton) {
  localFolderChooseButton.addEventListener("click", () => {
    chooseLocalFolder().catch((error) => {
      if (localFolderStatus) localFolderStatus.textContent = String(error?.message ?? error);
    });
  });
}

if (localFolderRevokeButton) {
  localFolderRevokeButton.addEventListener("click", () => {
    revokeLocalFolder().catch((error) => {
      if (localFolderStatus) localFolderStatus.textContent = String(error?.message ?? error);
    });
  });
}

if (settingsResetButton) {
  settingsResetButton.addEventListener("click", () => {
    resetSettingsToDefaults();
  });
}

deleteAllGroupsButton.addEventListener("click", () => {
  deleteAllGroups().catch((error) => {
    console.error("Failed to delete all groups.", error);
    setStatus(t("status.errorDeleteAllGroups"), true);
  });
});

exportGroupButton.addEventListener("click", () => {
  exportSelectedGroup().catch((error) => {
    console.error("Failed to export block group.", error);
    setStatus(t("status.errorExportGroup"), true);
  });
});

importGroupButton.addEventListener("click", () => {
  importIntoSelectedGroup().catch((error) => {
    console.error("Failed to import block group.", error);
    setStatus(t("status.errorImportGroup"), true);
  });
});

deleteGroupButton.addEventListener("click", () => {
  deleteSelectedGroup().catch((error) => {
    console.error("Failed to delete block group.", error);
    setStatus(t("status.errorDeleteGroup"), true);
  });
});

clearSitesButton.addEventListener("click", () => {
  clearSelectedSites();
});

applyFreezeButton.addEventListener("click", () => {
  applyFreeze().catch((error) => {
    console.error("Failed to freeze block group.", error);
    setStatus(t("status.errorFreezeGroup"), true);
  });
});

unfreezeButton.addEventListener("click", () => {
  openUnfreezeFlow();
});

if (parentalSettingsButton) {
  parentalSettingsButton.addEventListener("click", () => {
    const group = getSelectedGroup();
    if (group) openParentalSettings(group);
  });
}

startSnoozeButton.addEventListener("click", () => {
  startSnooze().catch((error) => {
    console.error("Failed to start snooze.", error);
    setStatus(t("status.errorStartSnooze"), true);
  });
});

endSnoozeButton.addEventListener("click", () => {
  endSnooze().catch((error) => {
    console.error("Failed to end snooze.", error);
    setStatus(t("status.errorEndSnooze"), true);
  });
});

layoutResizer.addEventListener("mousedown", startResizingPanels);
layoutResizer.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    applyPanelWidth(state.panelWidth - 20);
  } else if (event.key === "ArrowRight") {
    applyPanelWidth(state.panelWidth + 20);
  }
});

languageSelect.addEventListener("change", () => {
  setLanguage(languageSelect.value).catch((error) => {
    console.error("Failed to switch language.", error);
    setStatus(t("manual.error"), true);
  });
});

confirmCancelButton.addEventListener("click", () => {
  closeUnfreezeFlow();
});

manualCloseButton.addEventListener("click", () => {
  closeManual();
});

if (templateCloseButton) {
  templateCloseButton.addEventListener("click", () => {
    closeTemplateModal();
  });
}

if (templateApplyButton) {
  templateApplyButton.addEventListener("click", () => {
    applyTemplatePreset().catch((error) => {
      console.error("Failed to apply custom rule template.", error);
      setStatus(t("status.errorApplyTemplate"), true);
    });
  });
}

manualModal.addEventListener("click", (event) => {
  if (event.target === manualModal) {
    closeManual();
  }
});

if (templateModal) {
  templateModal.addEventListener("click", (event) => {
    if (event.target === templateModal) {
      closeTemplateModal();
    }
  });
}

confirmProceedButton.addEventListener("click", () => {
  const confirmationKind = state.unfreezeFlow?.kind;
  handleUnfreezeConfirm().catch((error) => {
    console.error("Failed during unfreeze confirmation.", error);
    setStatus(
      t(
        confirmationKind === "delete-all"
          ? "status.errorDeleteAllGroups"
          : confirmationKind === "snooze"
            ? "status.errorStartSnooze"
            : "status.errorUnfreezeGroup"
      ),
      true
    );
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  syncExternalState(changes);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.isSettingsOpen) {
      closeSettings();
    } else if (state.isManualOpen) {
      closeManual();
    } else if (state.isTemplateOpen) {
      closeTemplateModal();
    } else if (state.unfreezeFlow) {
      closeUnfreezeFlow();
    }
  }
});

// Persist editor state on popup teardown — popups close on any click
// outside, which can happen mid-debounce. Hook both pagehide (real
// teardown) and visibilitychange→hidden (fires earlier).
window.addEventListener("pagehide", () => {
  flushAutosaveOnExit();
});
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushAutosaveOnExit();
  }
});

// ────────────────────────────────────────────────────────────────────────
// Activity log feed — displays sandbox getLogHelper() output inside the
// popup itself. Pulls a buffer from background on open and subscribes to
// live "log-feed-entry" broadcasts.
// ────────────────────────────────────────────────────────────────────────

const LOG_FEED_MAX_RENDER = 200;
const logFeedSection = document.getElementById("logFeedSection");
const logFeedList = document.getElementById("logFeedList");
const logFeedEmpty = document.getElementById("logFeedEmpty");
const logFeedCount = document.getElementById("logFeedCount");
const logFeedClear = document.getElementById("logFeedClear");
const logFeedDownload = document.getElementById("logFeedDownload");
const logFeedSeenIds = new Set();

function formatLogFeedTime(ts) {
  if (!Number.isFinite(ts)) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

function renderLogFeedEntry(entry) {
  if (!entry || !logFeedList) return;
  if (entry.id != null && logFeedSeenIds.has(entry.id)) return;
  if (entry.id != null) logFeedSeenIds.add(entry.id);

  const gn = entry.groupName || entry.eventType || "";
  const selectedGroup = getSelectedGroup();
  const selectedName = selectedGroup ? selectedGroup.name : "";

  const row = document.createElement("div");
  row.className = "log-feed-entry " + (entry.level === "warn" ? "warn" : entry.level === "error" ? "error" : "");
  if (gn) row.setAttribute("data-group-name", gn);
  if (gn && selectedName && gn !== selectedName) {
    row.style.display = "none";
  }
  const meta = document.createElement("span");
  meta.className = "log-feed-meta";
  const parts = [];
  parts.push(formatLogFeedTime(entry.ts));
  if (entry.eventType) parts.push(entry.eventType);
  if (entry.level && entry.level !== "log") parts.push(entry.level.toUpperCase());
  meta.textContent = parts.filter(Boolean).join(" · ");
  row.appendChild(meta);
  const body = document.createElement("span");
  body.textContent = entry.message;
  row.appendChild(body);
  logFeedList.appendChild(row);

  while (logFeedList.children.length > LOG_FEED_MAX_RENDER) {
    logFeedList.removeChild(logFeedList.firstChild);
  }
  logFeedList.scrollTop = logFeedList.scrollHeight;
  updateLogFeedVisibleCount();
}

function updateLogFeedVisibleCount() {
  if (!logFeedCount || !logFeedList) return;
  let count = 0;
  for (const child of logFeedList.children) {
    if (child.style.display !== "none") count++;
  }
  logFeedCount.textContent = String(count);
}

function filterLogFeedByGroup() {
  if (!logFeedList) return;
  const selectedGroup = getSelectedGroup();
  const selectedName = selectedGroup ? selectedGroup.name : "";
  for (const row of logFeedList.children) {
    const gn = row.getAttribute("data-group-name") || "";
    if (!gn || !selectedName || gn === selectedName) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  }
  updateLogFeedVisibleCount();
}

async function loadLogFeedSnapshot() {
  if (!logFeedList) return;
  try {
    const response = await chrome.runtime.sendMessage({ type: "get-log-feed" });
    if (!response || !response.ok) return;
    const entries = Array.isArray(response.entries) ? response.entries : [];
    for (const entry of entries) renderLogFeedEntry(entry);
  } catch (_) {}
}

function clearLogFeed() {
  if (!logFeedList) return;
  while (logFeedList.firstChild) logFeedList.removeChild(logFeedList.firstChild);
  logFeedSeenIds.clear();
  if (logFeedCount) logFeedCount.textContent = "0";
  try { chrome.runtime.sendMessage({ type: "clear-log-feed" }).catch(() => {}); } catch (_) {}
}

if (logFeedClear) {
  logFeedClear.addEventListener("click", clearLogFeed);
}

if (logFeedDownload) {
  logFeedDownload.addEventListener("click", () => {
    const entries = [];
    if (logFeedList) {
      logFeedList.querySelectorAll(".log-feed-entry").forEach((el) => {
        const meta = el.querySelector(".log-feed-entry-meta");
        const msg = el.querySelector(".log-feed-entry-message");
        entries.push((meta ? meta.textContent : "") + " " + (msg ? msg.textContent : ""));
      });
    }
    if (entries.length === 0) { entries.push("(no log entries)"); }
    const blob = new Blob([entries.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blocker-logs-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  });
}

if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.type === "log-feed-entry") {
      renderLogFeedEntry(message.entry);
      return;
    }
    if (message.type === "connection-status-push") {
      applyConnectionStatus(message.status);
      return;
    }
    if (message.type === "clusters-push") {
      applyClusters(message.clusters);
      return;
    }
    if (message.type === "group-rejected") {
      applyGroupRejection(message.reason);
    }
  });
}

// Storage key for the site-access banner dismissal state. Stored in
// chrome.storage.local rather than localStorage so it survives popup
// reloads, Chrome restarts, and so the same dismissal is honoured if
// the popup is ever embedded somewhere other than a tab.
const SITE_ACCESS_BANNER_DISMISSED_KEY = "siteAccessBannerDismissedV1";

async function readSiteAccessBannerDismissed() {
  try {
    if (!chrome?.storage?.local?.get) return false;
    const r = await chrome.storage.local.get({ [SITE_ACCESS_BANNER_DISMISSED_KEY]: false });
    return r[SITE_ACCESS_BANNER_DISMISSED_KEY] === true;
  } catch (_) {
    return false;
  }
}

async function writeSiteAccessBannerDismissed(value) {
  try {
    if (!chrome?.storage?.local?.set) return;
    await chrome.storage.local.set({ [SITE_ACCESS_BANNER_DISMISSED_KEY]: Boolean(value) });
  } catch (_) {}
}

// Returns true iff the extension currently has the manifest-declared
// <all_urls> host permission granted by the user. Chrome treats site
// access UI ("On all sites" / "On click" / "On specific sites") as
// effective grants of host permissions; switching to "On click" causes
// this check to return false even though <all_urls> is declared.
async function hasAllUrlsHostAccess() {
  try {
    if (!chrome?.permissions?.contains) return true;
    return await chrome.permissions.contains({ origins: ["<all_urls>"] });
  } catch (_) {
    return true;
  }
}

async function initializeSiteAccessBanner() {
  if (!siteAccessBanner) return;
  const dismissed = await readSiteAccessBannerDismissed();
  const granted = await hasAllUrlsHostAccess();
  if (granted || dismissed) {
    siteAccessBanner.hidden = true;
    return;
  }
  siteAccessBanner.hidden = false;

  if (siteAccessGrantButton && !siteAccessGrantButton.__cbWired) {
    siteAccessGrantButton.__cbWired = true;
    siteAccessGrantButton.addEventListener("click", async () => {
      try {
        if (!chrome?.permissions?.request) {
          setStatus(t("siteAccess.grantFailed"), true);
          return;
        }
        const ok = await chrome.permissions.request({ origins: ["<all_urls>"] });
        if (ok) {
          siteAccessBanner.hidden = true;
          await writeSiteAccessBannerDismissed(true);
        } else {
          setStatus(t("siteAccess.grantFailed"), true);
        }
      } catch (error) {
        cbDebugError("siteAccess request failed", error);
        setStatus(t("siteAccess.grantFailed"), true);
      }
    });
  }

  if (siteAccessDismissButton && !siteAccessDismissButton.__cbWired) {
    siteAccessDismissButton.__cbWired = true;
    siteAccessDismissButton.addEventListener("click", async () => {
      siteAccessBanner.hidden = true;
      await writeSiteAccessBannerDismissed(true);
    });
  }
}

async function initializePopupApp() {
  const defaultLanguage = getDefaultLanguageCode();
  state.language = loadLanguage();

  await ensureLanguageMessages(defaultLanguage).catch(() => {
    state.translationMessages[defaultLanguage] = {};
  });

  if (state.language !== defaultLanguage) {
    await ensureLanguageMessages(state.language).catch(() => {
      state.translationMessages[state.language] = {};
    });
  }

  populateLanguageOptions();
  applyStaticTranslations();
  applyPanelWidth(loadPanelWidth());

  await loadGroups();
  await loadLogFeedSnapshot();
  // Banner runs after translations are applied so the labels read in
  // the user's language, and runs after loadGroups so the popup is in a
  // visible-and-laid-out state before the banner pops in.
  initializeSiteAccessBanner().catch((error) => {
    cbDebugError("site access banner init failed", error);
  });
  state.tickIntervalId = window.setInterval(() => {
    renderDynamicView();
  }, 1000);

  // Bring up the per-group web-app bridge panel state: current transport
  // status, current clusters, and announce our groups to the hub.
  requestConnectionStatus();
  requestClusters();
  announceGroups();
}

initializePopupApp().catch((error) => {
  console.error("Failed to initialize popup.", error);
  setStatus(t("status.errorLoadGroups"), true);
});
