const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
const USAGE_BUCKETS_KEY = "usageBucketsMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";
const GLOBAL_SETTINGS_KEY = "globalSettings";
// The group the quick-add "+" appends to (chosen by its card's badge).
const QUICK_ADD_GROUP_KEY = "quickAddGroupId";
const LAYOUT_WIDTH_STORAGE_KEY = "custom-blocker-groups-panel-width";
const LANGUAGE_STORAGE_KEY = "custom-blocker-language";
const LANGUAGE_FALLBACKS = Object.freeze({
  en: { label: "English", nativeLabel: "English" },
  zh: { label: "Chinese (Simplified)", nativeLabel: "简体中文" },
  es: { label: "Spanish", nativeLabel: "Espanol" },
  hi: { label: "Hindi", nativeLabel: "हिन्दी" },
  ar: { label: "Arabic", nativeLabel: "العربية" },
  bn: { label: "Bengali", nativeLabel: "বাংলা" },
  pt: { label: "Portuguese", nativeLabel: "Portugues" },
  ru: { label: "Russian", nativeLabel: "Русский" },
  ja: { label: "Japanese", nativeLabel: "日本語" },
  pa: { label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  de: { label: "German", nativeLabel: "Deutsch" },
  fr: { label: "French", nativeLabel: "Francais" },
  ko: { label: "Korean", nativeLabel: "한국어" },
  tr: { label: "Turkish", nativeLabel: "Turkce" },
  vi: { label: "Vietnamese", nativeLabel: "Tieng Viet" },
  it: { label: "Italian", nativeLabel: "Italiano" },
  th: { label: "Thai", nativeLabel: "ไทย" },
  nl: { label: "Dutch", nativeLabel: "Nederlands" },
  pl: { label: "Polish", nativeLabel: "Polski" },
  id: { label: "Indonesian", nativeLabel: "Bahasa Indonesia" }
});
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

// In-app dialog — replaces window.alert / confirm / prompt so we never raise a
// blunt OS script dialog (which, in the native hosts, surfaces as an NSAlert /
// MessageBox). Renders a small overlay inside the editor instead. Promise-based
// so callers can `await` the result; destructive confirms pass { danger: true }
// to get a red confirm button. Styles are injected once — no popup.css needed.
const cbDialog = (function () {
  let styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement("style");
    style.textContent = [
      ".cbdlg-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;",
      "justify-content:center;padding:20px;background:rgba(15,23,42,0.32);opacity:0;",
      "transition:opacity .15s ease;}",
      ".cbdlg-overlay.cbdlg-show{opacity:1;}",
      ".cbdlg-card{background:#fff;color:#0f172a;max-width:380px;width:100%;border-radius:14px;",
      "padding:18px 18px 14px;box-shadow:0 18px 48px rgba(15,23,42,.32);",
      "transform:translateY(8px) scale(.98);transition:transform .18s ease;font-family:inherit;}",
      ".cbdlg-overlay.cbdlg-show .cbdlg-card{transform:none;}",
      ".cbdlg-msg{margin:0 0 14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;}",
      ".cbdlg-input{width:100%;box-sizing:border-box;font-size:13px;padding:8px 10px;",
      "border:1px solid #cbd5e1;border-radius:8px;margin:0 0 14px;font-family:inherit;}",
      ".cbdlg-actions{display:flex;justify-content:flex-end;gap:8px;}",
      ".cbdlg-btn{border:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:12.5px;",
      "cursor:pointer;font-family:inherit;}",
      ".cbdlg-cancel{background:#e2e8f0;color:#0f172a;}",
      ".cbdlg-ok{background:#1e293b;color:#fff;}",
      ".cbdlg-ok.cbdlg-danger{background:#dc2626;color:#fff;}",
      ".cbdlg-btn:hover{filter:brightness(.95);}",
      "@media (prefers-color-scheme:dark){",
      ".cbdlg-card{background:#1e293b;color:#e2e8f0;}",
      ".cbdlg-input{background:#0f172a;color:#e2e8f0;border-color:#334155;}",
      ".cbdlg-cancel{background:#334155;color:#e2e8f0;}",
      ".cbdlg-ok{background:#475569;}}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function open(opts) {
    injectStyle();
    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.className = "cbdlg-overlay";
      const card = document.createElement("div");
      card.className = "cbdlg-card";
      card.setAttribute("role", opts.kind === "alert" ? "alertdialog" : "dialog");
      card.setAttribute("aria-modal", "true");

      const msg = document.createElement("p");
      msg.className = "cbdlg-msg";
      msg.textContent = opts.message || "";
      card.appendChild(msg);

      let input = null;
      if (opts.kind === "prompt") {
        input = document.createElement("input");
        input.className = "cbdlg-input";
        input.type = "text";
        input.value = opts.defaultValue != null ? String(opts.defaultValue) : "";
        card.appendChild(input);
      }

      const actions = document.createElement("div");
      actions.className = "cbdlg-actions";

      let cancelBtn = null;
      if (opts.kind !== "alert") {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "cbdlg-btn cbdlg-cancel";
        cancelBtn.textContent = opts.cancelText || "Cancel";
        actions.appendChild(cancelBtn);
      }

      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "cbdlg-btn cbdlg-ok" + (opts.danger ? " cbdlg-danger" : "");
      okBtn.textContent = opts.confirmText || "OK";
      actions.appendChild(okBtn);

      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add("cbdlg-show"); });

      function cleanup() {
        document.removeEventListener("keydown", onKey, true);
        overlay.classList.remove("cbdlg-show");
        setTimeout(function () { overlay.remove(); }, 180);
      }
      function done(result) { cleanup(); resolve(result); }
      function onOk() {
        if (opts.kind === "prompt") done(input ? input.value : "");
        else if (opts.kind === "alert") done(undefined);
        else done(true);
      }
      function onCancel() { done(opts.kind === "prompt" ? null : false); }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
        else if (e.key === "Enter") { e.preventDefault(); onOk(); }
      }

      okBtn.addEventListener("click", onOk);
      if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) onCancel(); });
      document.addEventListener("keydown", onKey, true);

      (input || okBtn).focus();
      if (input) input.select();
    });
  }

  return {
    alert: function (message, o) {
      o = o || {};
      return open({ kind: "alert", message: message, confirmText: o.confirmText || "OK" });
    },
    confirm: function (message, o) {
      o = o || {};
      return open({
        kind: "confirm", message: message, danger: !!o.danger,
        confirmText: o.confirmText || "OK", cancelText: o.cancelText || "Cancel"
      });
    },
    prompt: function (message, defaultValue, o) {
      o = o || {};
      return open({
        kind: "prompt", message: message, defaultValue: defaultValue,
        confirmText: o.confirmText || "OK", cancelText: o.cancelText || "Cancel"
      });
    }
  };
})();

// Extension-wide preferences. Keep these defaults in sync with the
// placeholder text in popup.html's Settings modal.
const DEFAULT_GLOBAL_SETTINGS = {
  tickRateMs: 1000,
  autosaveDebounceMs: 400,
  // Debug mode is off by default. When on it (a) shows the on-page
  // debug log overlay for custom rules and (b) emits the
  // [CustomBlocker:trace] / [CustomBlocker] dispatch console lines.
  // The user-facing helpers.log() output continues to flow regardless.
  debugMode: false,
  showOnPageLogToasts: true,
  // The tiny floating "+" on pages and in the desktop app (off by default).
  quickAddEnabled: false,
  defaultSnoozeMinutes: 30,
  // Desktop: how often a custom rule's "close" asks an app that stayed open
  // to quit again; 0 = ask once (owner 2026-09-26).
  closeRetrySeconds: 0
};
const TICK_RATE_MIN_MS = 250;
const TICK_RATE_MAX_MS = 60_000;
const AUTOSAVE_DEBOUNCE_MAX_MS = 5_000;

// Native and browser clients both connect out to the shared broker.
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
  if (isNativeHost()) return window.CBBridgeProtocol.nativeProgramId(window.__CB_DESKTOP_PROGRAM_ID);
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
const IS_NATIVE_DESKTOP = isNativeHost();
// The desktop app hosts this same editor; `.desktop-only` / `.browser-only`
// markup is shown or hidden by this one class (see popup.css).
document.body.classList.toggle("is-native-desktop", IS_NATIVE_DESKTOP);

const DEFAULT_ALLOWED_MINUTES = 15;
const DEFAULT_RESET_INTERVAL_HOURS = 24;
const DEFAULT_SNOOZE_MINUTES = 30;
const DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES = 0;
const DEFAULT_SNOOZE_COOLDOWN_MINUTES = 0;
const DEFAULT_GROUP_TYPE = "site";
const DEFAULT_PLATFORM_RULE_GROUP_TYPE = "youtube";
const MAX_SNOOZE_COOLDOWN_MINUTES = 5;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
// Every unlock and "delete all" ends with this confirmation (group-actions.js).
const UNFREEZE_CONFIRMATIONS_REQUIRED = CBGroupActions.CONFIRMATIONS;
const UNFREEZE_CONFIRMATION_INTERVAL_MS = CBGroupActions.CONFIRM_INTERVAL_MS;
const DEFAULT_SNOOZE_CONFIRMATIONS = 0;
// The pause action's countdown (seconds a page is held before Continue).
const DEFAULT_PAUSE_SECONDS = 10;
const MAX_PAUSE_SECONDS = 600;
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
const resetAtMidnightField = document.getElementById("resetAtMidnight");
const rollingLimitField = document.getElementById("rollingLimit");
const usageSummary = document.getElementById("usageSummary");
const scheduleSection = document.getElementById("scheduleSection");
const daysGrid = document.getElementById("daysGrid");
const scheduleWindowsField = document.getElementById("scheduleWindows");
const customSettingsCard = document.getElementById("customSettingsCard");
const blockingRulesEditor = document.getElementById("blockingRulesEditor");
const blockingRulesHighlight = document.getElementById("blockingRulesHighlight");
const blockingRulesField = document.getElementById("blockingRules");
const blockingRulesLint = document.getElementById("blockingRulesLint");
const platformRulesCard = document.getElementById("platformRulesCard");
const groupScopesSection = document.getElementById("groupScopesSection");
const appsSettingsSection = document.getElementById("appsSettingsSection");
const appsHelp = document.getElementById("appsHelp");
const blockedAppsData = document.getElementById("blockedAppsData");
const blockedAppsList = document.getElementById("blockedAppsList");
const appsAllowlistField = document.getElementById("appsAllowlist");
const clearAppsButton = document.getElementById("clearAppsButton");
const appPickerModal = document.getElementById("appPickerModal");
const appPickerSearch = document.getElementById("appPickerSearch");
const appPickerResults = document.getElementById("appPickerResults");
const appPickerEmpty = document.getElementById("appPickerEmpty");
const appPickerCloseButton = document.getElementById("appPickerCloseButton");
const deviceControlButton = document.getElementById("deviceControlButton");
const deviceControlCopy = document.getElementById("deviceControlCopy");
const deviceControlStatus = document.getElementById("deviceControlStatus");
const permissionModal = document.getElementById("permissionModal");
const permissionGrantButton = document.getElementById("permissionGrantButton");
const permissionCancelButton = document.getElementById("permissionCancelButton");
let blockedAppsEditable = false;
const groupScopesList = document.getElementById("groupScopesList");
const groupScopesAdd = document.getElementById("groupScopesAdd");
const pageActionRow = document.getElementById("pageActionRow");
const pageActionField = document.getElementById("pageAction");
const pauseSecondsRow = document.getElementById("pauseSecondsRow");
const pauseSecondsField = document.getElementById("pauseSeconds");
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
// Content-tag filter (platform rules).
const platformTagFields = document.getElementById("platformTagFields");
const platformTagModeField = document.getElementById("platformTagMode");
const platformTagListBlock = document.getElementById("platformTagListBlock");
const platformTagsField = document.getElementById("platformTags");
const platformTagDefaultConfidenceField = document.getElementById("platformTagDefaultConfidence");
const platformTagEffectField = document.getElementById("platformTagEffect");
const platformTagBlockUntaggedRow = document.getElementById("platformTagBlockUntaggedRow");
const platformTagBlockUntaggedField = document.getElementById("platformTagBlockUntagged");
const platformTagBlockPageField = document.getElementById("platformTagBlockPage");
const platformTagCoverUntilTaggedField = document.getElementById("platformTagCoverUntilTagged");
const platformBlockHomePageField = document.getElementById("platformBlockHomePage");
const discordSettingsCard = document.getElementById("discordFields");
const discordModeField = document.getElementById("discordMode");
const discordTargetsField = document.getElementById("discordTargets");
const discordBlockHomePageField = document.getElementById("discordBlockHomePage");
const surfaceHidesSection = document.getElementById("surfaceHidesSection");
const surfaceHidesList = document.getElementById("surfaceHidesList");
const surfaceHidesTitle = document.getElementById("surfaceHidesTitle");
const surfaceHidesHelp = document.getElementById("surfaceHidesHelp");
const fallbackUrlSection = document.getElementById("fallbackUrlSection");
const fallbackUrlField = document.getElementById("fallbackUrl");
const freezeSummary = document.getElementById("freezeSummary");
const freezeSetup = document.getElementById("freezeSetup");
const lockWaitHoursField = document.getElementById("lockWaitHours");
const lockPinStatus = document.getElementById("lockPinStatus");
const applyFreezeButton = document.getElementById("applyFreezeButton");
const unfreezeButton = document.getElementById("unfreezeButton");
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
const siteSettingsLabel = document.getElementById("siteSettingsLabel");
const siteAllowlistField = document.getElementById("siteAllowlist");
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
// No-code content-tag rule builder (inside the custom editor).
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
const settingsButton = document.getElementById("settingsButton");
const settingsModal = document.getElementById("settingsModal");
const settingsCloseButton = document.getElementById("settingsCloseButton");
const settingsDefaultSnoozeMinutesField = document.getElementById("settingsDefaultSnoozeMinutes");
const settingsCloseRetrySecondsField = document.getElementById("settingsCloseRetrySeconds");
const settingsQuickAddField = document.getElementById("settingsQuickAdd");
const localFolderChooseButton = document.getElementById("localFolderChooseButton");
const localFolderRevokeButton = document.getElementById("localFolderRevokeButton");
const localFolderStatus = document.getElementById("localFolderStatus");
let localFolderHandle = null;
const settingsResetButton = document.getElementById("settingsResetButton");
const settingsStatus = document.getElementById("settingsStatus");
const classifierCollectionToggle = document.getElementById("classifierCollectionToggle");
const classifierTaggingModeField = document.getElementById("classifierTaggingMode");
const dayCheckboxes = Array.from(daysGrid.querySelectorAll('input[type="checkbox"]'));

const state = {
  groups: [],
  usageTimersMs: {},
  usageResetAtMs: {},
  usageBucketsMs: {},
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
  manualCache: {},
  suppressGroupStorageUpdatesUntil: 0,
  // The worker's copy of this browser's links (cbClusterCopy), for isEnforceOnly.
  linkCopy: [],
  nameEditing: null,
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
  // Hub's shared cumulative snooze total per clustered group (display only). We
  // show max(local total, this) so the figure reflects snoozes accrued on any
  // member without merging into — and thus double-counting — the local counter.
  // Last contribution JSON we sent per group, so we don't echo applied state
  // back to the hub (loop suppression mirrors the hub's broadcast-on-change).
  clusterSyncSent: {},
  // Logical edit timestamp per group, used for scalar last-writer-wins.
  groupEditTs: {},
  // Group ids whose next sync should win the merge (the initiator of a link).
  pendingPriorityGroups: new Set(),
  // Serialized last-applied cluster list, so repeated identical pushes (the Mac
  // hub re-pushes every second) don't trigger needless re-renders.
  clustersLastJSON: "",
  quickAddGroupId: ""
};

// This remains separate from the group-sync connection. Its browser evidence
// requests share the public broker but never receive a group definition.
const CLASSIFIER_BRIDGE_SETTINGS_KEY = "vaultClassifierSettings";
const CLASSIFIER_TAGGING_MODES = ["whenFiltering", "always", "paused"];
const DEFAULT_CLASSIFIER_BRIDGE_SETTINGS = Object.freeze({
  collectionEnabled: true,
  taggingMode: "whenFiltering"
});
let classifierBridgeSettings = { ...DEFAULT_CLASSIFIER_BRIDGE_SETTINGS };

function sanitizeClassifierBridgeSettings(raw) {
  return {
    // Existing deliberate opt-outs stay off; new extension settings collect by
    // default once the matching local app platform is enabled.
    collectionEnabled: !raw || raw.collectionEnabled !== false,
    taggingMode: raw && CLASSIFIER_TAGGING_MODES.includes(raw.taggingMode) ? raw.taggingMode : "whenFiltering"
  };
}

function classifierBridgeStorageGet() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CLASSIFIER_BRIDGE_SETTINGS_KEY], (result) => {
      resolve(sanitizeClassifierBridgeSettings(result && result[CLASSIFIER_BRIDGE_SETTINGS_KEY]));
    });
  });
}

function classifierBridgeStorageSet(next) {
  classifierBridgeSettings = sanitizeClassifierBridgeSettings(next);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CLASSIFIER_BRIDGE_SETTINGS_KEY]: classifierBridgeSettings }, () => {
      const error = chrome.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve(classifierBridgeSettings);
    });
  });
}

function renderClassifierBridgeSettings() {
  if (classifierCollectionToggle) classifierCollectionToggle.checked = classifierBridgeSettings.collectionEnabled;
  if (classifierTaggingModeField) classifierTaggingModeField.value = classifierBridgeSettings.taggingMode;
}

async function loadClassifierBridgeSettings() {
  classifierBridgeSettings = await classifierBridgeStorageGet();
  renderClassifierBridgeSettings();
}

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
    languages: LANGUAGE_FALLBACKS
  };
}

function getAvailableLanguages() {
  const languages = getTranslationsConfig().languages;
  return languages && typeof languages === "object" && Object.keys(languages).length
    ? languages
    : LANGUAGE_FALLBACKS;
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
    if (state.manualCache[candidate]) return state.manualCache[candidate];
    try {
      const response = await fetch(chrome.runtime.getURL(`manual/${candidate}.md`));
      if (!response.ok) continue;
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
    if (state.language && state.language !== "en") {
      html = `<blockquote class="mt-banner">${escapeHtml(t("manual.mtBanner"))}</blockquote>${html}`;
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

function setLocalFolderChooseButtonLabel(key) {
  if (!localFolderChooseButton) return;
  localFolderChooseButton.textContent = t(key);
}

// The desktop host pushes the local-folder grant state here (connected + name).
window.__cbLocalFolderStatus = function (payload) {
  if (!localFolderStatus) return;
  const connected = Boolean(payload && payload.connected);
  const name = payload && typeof payload.name === "string" ? payload.name : "";
  if (localFolderChooseButton) {
    localFolderChooseButton.disabled = false;
    localFolderChooseButton.textContent = t("settings.localFolderChoose");
  }
  if (localFolderRevokeButton) {
    localFolderRevokeButton.classList.remove("hidden");
    localFolderRevokeButton.disabled = !connected;
  }
  localFolderStatus.textContent = connected
    ? t("settings.localFolderStatusConnected").replace("{name}", name || t("settings.localFolderUnknownName"))
    : t("settings.localFolderStatusNone");
};

async function renderLocalFolderStatus() {
  if (!localFolderStatus) return;
  // Desktop: the folder grant is native (the web view has no directory picker);
  // ask the host for the current grant and let __cbLocalFolderStatus render it.
  if (IS_NATIVE_DESKTOP) {
    postToNativeShell({ kind: "local-folder-status" });
    return;
  }
  if (!("showDirectoryPicker" in window)) {
    localFolderHandle = null;
    localFolderStatus.textContent = t("settings.localFolderUnsupported");
    if (localFolderChooseButton) localFolderChooseButton.disabled = true;
    if (localFolderRevokeButton) localFolderRevokeButton.disabled = true;
    return;
  }
  if (localFolderChooseButton) localFolderChooseButton.disabled = false;
  setLocalFolderChooseButtonLabel("settings.localFolderChoose");
  try {
    const handle = await localFolderDbGet(LOCAL_FOLDER_ROOT_KEY);
    const metadata = await localFolderDbGet(LOCAL_FOLDER_META_KEY);
    if (!handle || handle.kind !== "directory") {
      localFolderHandle = null;
      localFolderStatus.textContent = t("settings.localFolderStatusNone");
      if (localFolderRevokeButton) localFolderRevokeButton.disabled = true;
      return;
    }
    localFolderHandle = handle;
    if (localFolderRevokeButton) localFolderRevokeButton.disabled = false;
    const name = handle.name || metadata?.name || t("settings.localFolderUnknownName");
    let permission = "granted";
    if (typeof handle.queryPermission === "function") {
      permission = await handle.queryPermission({ mode: "readwrite" });
    }
    if (permission === "granted") {
      localFolderStatus.textContent = t("settings.localFolderStatusConnected").replace("{name}", name);
    } else {
      setLocalFolderChooseButtonLabel("settings.localFolderReconnect");
      localFolderStatus.textContent = t("settings.localFolderStatusNeedsPermission").replace("{name}", name);
    }
  } catch (error) {
    localFolderHandle = null;
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
    // A stored handle commonly becomes "prompt" after Chrome restarts. Ask
    // for that same handle first, from this button's user gesture, so a user
    // can restore access without selecting the folder all over again.
    const existingHandle = localFolderHandle;
    if (existingHandle?.kind === "directory" && typeof existingHandle.requestPermission === "function") {
      const existingPermission = await existingHandle.requestPermission({ mode: "readwrite" });
      if (existingPermission === "granted") {
        await renderLocalFolderStatus();
        return;
      }
      if (localFolderStatus) localFolderStatus.textContent = t("settings.localFolderPermissionDenied");
      return;
    }

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
    localFolderHandle = handle;
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
  localFolderHandle = null;
  await renderLocalFolderStatus();
}

// The transport layer pushes the live connection status here (native server on
// macOS via window.__cbConnectionState, background worker in the browser).
function applyConnectionStatus(raw) {
  const incoming = raw && typeof raw === "object" ? raw : {};
  const wasOnline = bridgeIsOnline();
  const wasAway = macVaultAway();
  state.connectionStatus = {
    running: Boolean(incoming.running),
    state: typeof incoming.state === "string" ? incoming.state : "off",
    address: typeof incoming.address === "string" ? incoming.address : "",
    peers: Array.isArray(incoming.peers) ? incoming.peers : [],
    error: typeof incoming.error === "string" ? incoming.error : "",
    hubProgram: window.CBBridgeProtocol.hubProgramFromStatus(incoming)
  };
  // Linked groups turn enforce-only (or editable again) with Mac Vault.
  if (wasAway !== macVaultAway()) render();
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
// Web-app bridge: same-named Default/Custom groups auto-link into one shared
// "cluster" across every connected program whenever a peer is present. The hub
// is the single source of truth for cluster membership; there is no manual
// link/unlink — this layer only renders the read-only mirror of a cluster.
// ---------------------------------------------------------------------------

function bridgeIsOnline() {
  const s = state.connectionStatus || {};
  return s.state === "connected" || s.state === "running";
}

// Every group can link with a same-named group on another program (owner
// 2026-09-24: the whole definition — policy and every entry — is shared).
function isBridgeEligibleGroup(group) {
  return Boolean(group);
}

// The cluster (if any) this group currently belongs to, matched by this
// endpoint's program id + the member's pinned group id. Membership is pinned to
// the specific group instance that was linked, so deleting a group and later
// re-creating one with the same name does NOT re-adopt the old cluster. Falls
// back to the saved name for pre-id-pinning hubs that don't send a groupId.
function groupConnectionCluster(group) {
  return window.CBBridgeProtocol.clusterForGroup(state.clusters, group, LOCAL_PROGRAM_ID);
}

// This endpoint's local group for a cluster, resolved via the member's pinned
// group id (falling back to the saved name for pre-id-pinning hubs).
function clusterLocalGroup(cluster) {
  return window.CBBridgeProtocol.groupForCluster(state.groups, cluster, LOCAL_PROGRAM_ID);
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

function isUserEditing() {
  const active = document.activeElement;
  return Boolean(active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT"));
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
    const group = clusterLocalGroup(cluster);
    if (!group) continue;
    if (cluster.shared) {
      applyClusterShared(group, cluster.shared);
    } else {
      // Freshly-formed cluster: the hub's first snapshot carries no `shared`
      // until a member has contributed. Force our contribution to be (re)sent
      // so the group definition is shared on the FIRST connect.
      delete state.clusterSyncSent[group.id];
    }
  }
  updateGroupCardBridgeBadges();
  // Re-render the editor so synced changes show, unless the user is actively
  // typing in a field (don't clobber in-progress input).
  const editing = isUserEditing();
  if (getSelectedGroup() && !editing) {
    renderEditor();
  } else {
    renderGroupList();
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

// Native (macOS) pushes cluster membership here; the browser uses the
// "clusters-push" runtime message instead.
window.__cbClustersState = function (json) {
  try {
    const incoming = typeof json === "string" ? JSON.parse(json) : json;
    applyClusters(incoming);
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

// Tell the hub which groups exist here (by saved name + freeze state) so it
// links same-named groups. Sent on load, after group edits, and when the
// bridge comes online.
function announceGroups() {
  const groups = (Array.isArray(state.groups) ? state.groups : [])
    .filter(isBridgeEligibleGroup)
    .map((g) => ({
      // The stable per-program group id pins cluster membership to this
      // instance, so a same-named group created after a delete won't re-join.
      id: g.id,
      name: announcedName(g),
      frozen: CBGroupActions.isLocked(g)
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

const SYNC_SCALAR_FIELDS = CBGroupScopes.SYNC_SCALAR_FIELDS;

// A member's contribution is the whole group definition: the policy scalars and
// every entry's lines (websites, apps, platforms). Each member enforces the
// lines it can and forwards the rest. The live usage budget is NOT in here: it
// is reported as deltas by the accrual owner only (the browser's background
// heartbeat, the Mac's frontmost-app sampler), and the popup only folds the
// hub's shared total back into the local counter (applyClusterShared).
function buildSyncContribution(group) {
  const scalars = {};
  for (const field of SYNC_SCALAR_FIELDS) scalars[field] = group[field];
  // The lock travels as one unit with the version it was made from (see
  // group-actions.js): the hub takes it only on top of its current version.
  const contribution = { scalars, scopes: toStoredGroup(group).scopes, ...CBGroupActions.lockContribution(group) };
  // Active snooze runtime is shared so a snooze started on any member applies to
  // every linked member (newest start wins). The entry carries all of its own
  // timing (start/until/cooldown), so each side enforces and expires it
  // identically without needing to propagate the eventual clear.
  // The newest change (a start OR an end) wins, so ending a snooze early ends
  // it on every linked device.
  const snoozeEntry = state.groupSnoozes[group.id];
  if (snoozeEntry && Number.isFinite(Number(snoozeEntry.startsAtMs))) {
    contribution.snooze = snoozeEntry;
    contribution.snoozeTs = Number(snoozeEntry.changedAtMs || snoozeEntry.startsAtMs) || 0;
  }
  return contribution;
}

// Writes the hub's shared definition onto a local member group: the policy
// scalars and, when the hub carries them, every entry's lines. The lines
// replace ours wholesale (every member edits the one shared definition, so a
// deletion elsewhere is a deletion here); the entry in view is re-read.
function applyClusterShared(group, shared) {
  if (!group || !shared || typeof shared !== "object") return;
  const scalars = shared.scalars && typeof shared.scalars === "object" ? shared.scalars : {};
  const idx = state.groups.findIndex((g) => g.id === group.id);
  if (idx < 0) return;
  let next = { ...state.groups[idx] };
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
  // The link's one lock (owned by the hub).
  const withLock = CBGroupActions.adoptLock(next, shared.lock);
  if (withLock !== next) {
    next = withLock;
    changed = true;
  }
  // The hub carries lines only once a member has contributed them; an empty
  // list is "nothing shared yet", never "delete every entry" (a group always
  // keeps at least one entry), so it is not adopted.
  if (Array.isArray(shared.scopes) && shared.scopes.length > 0) {
    const stored = toStoredGroup(next);
    const incoming = CBGroupScopes.sanitizeScopeLines(shared.scopes, stored.groupType, cbScopeNormalizers);
    if (JSON.stringify(incoming) !== JSON.stringify(stored.scopes)) {
      next = viewGroupOnPlatform({ ...stored, scopes: incoming }, activeEntryKey(next));
      changed = true;
      // The form's draft describes the entry in view; refresh it unless the
      // user is typing in it right now (their edit then wins, latest-edit-wins).
      if (!(group.id === state.selectedGroupId && isUserEditing())) {
        state.drafts[group.id] = groupToDraft(next);
      }
    }
  }
  state.groups[idx] = next;
  if (Number.isFinite(shared.ts)) state.groupEditTs[group.id] = shared.ts;

  // The link's snooze total is the hub's count: each snooze once, however
  // many devices saw it.
  if (Number.isFinite(Number(shared.snoozeTotalMs)) && Number(state.groupSnoozeTotalsMs[group.id]) !== Number(shared.snoozeTotalMs)) {
    state.groupSnoozeTotalsMs[group.id] = Number(shared.snoozeTotalMs);
    chrome.storage.local.set({ [GROUP_SNOOZE_TOTALS_KEY]: state.groupSnoozeTotalsMs }).catch(() => {});
  }

  // Fold the hub's shared usage budget into our local counter so the live
  // elapsed timer (display + enforcement) reflects time spent on every member.
  // We never overwrite our own future accrual — the background keeps adding to
  // this value and reporting it back, and the hub measures only the new delta.
  if (!next.rollingLimit && Number.isFinite(shared.usageMs)) {
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

  // Adopt a newer shared snooze change (a start or an end) from a linked member.
  const sharedSnoozeTs = Number(shared.snoozeTs) || 0;
  if (sharedSnoozeTs > 0 && shared.snooze && typeof shared.snooze === "object") {
    const adopted = CBGroupActions.adoptSnooze(state.groupSnoozes[group.id], shared.snooze, sharedSnoozeTs);
    if (adopted) {
      state.groupSnoozes[group.id] = adopted;
      chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: state.groupSnoozes }).catch(() => {});
    }
  }

  // Mark our contribution as up to date so we don't echo it back to the hub.
  state.clusterSyncSent[group.id] = JSON.stringify(buildSyncContribution(next));
  if (changed) {
    chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: toStoredGroups(state.groups) }).catch(() => {});
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
      groupName: announcedName(group),
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
  if (settingsDefaultSnoozeMinutesField) settingsDefaultSnoozeMinutesField.value = String(s.defaultSnoozeMinutes);
  if (settingsQuickAddField) settingsQuickAddField.checked = s.quickAddEnabled === true;
  if (settingsCloseRetrySecondsField) settingsCloseRetrySecondsField.value = String(s.closeRetrySeconds ?? 0);
  if (settingsStatus) settingsStatus.textContent = "";
}

function openSettings() {
  state.isSettingsOpen = true;
  syncSettingsFormFromState();
  requestConnectionStatus();
  loadClassifierBridgeSettings().catch(() => renderClassifierBridgeSettings());
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
    // Dev/engine values are no longer surfaced in the UI (debug + tick/debounce
    // are dev-only / fixed defaults); carry the stored values through a save so a
    // developer's storage-set debug flag is not reset.
    tickRateMs: state.globalSettings?.tickRateMs,
    autosaveDebounceMs: state.globalSettings?.autosaveDebounceMs,
    debugMode: state.globalSettings?.debugMode,
    showOnPageLogToasts: state.globalSettings?.showOnPageLogToasts,
    defaultSnoozeMinutes: settingsDefaultSnoozeMinutesField?.value,
    quickAddEnabled: settingsQuickAddField ? settingsQuickAddField.checked : state.globalSettings?.quickAddEnabled,
    closeRetrySeconds: settingsCloseRetrySecondsField ? settingsCloseRetrySecondsField.value : state.globalSettings?.closeRetrySeconds
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
    renderGroupList();
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
    option.setAttribute("translate", "no");
    option.classList.add("notranslate");
    option.textContent = language.nativeLabel || language.label || code;
    languageSelect.appendChild(option);
  }

  const selectedLanguage = languages[state.language]
    ? state.language
    : getDefaultLanguageCode();
  languageSelect.value = selectedLanguage;

  // A browser can discard an invalid selected value. Keep a visible option in
  // that case rather than leaving the language control blank.
  if (!languageSelect.value) {
    languageSelect.value = Object.keys(languages)[0] || "en";
  }
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

    // A path prefix scopes the entry to that path and everything under it
    // ("youtube.com/shorts"); a bare host covers the host and its subdomains.
    const path = parsedUrl.pathname.replace(/\/+$/, "");
    return path && path !== "/" ? hostname + path : hostname;
  } catch {
    return null;
  }
}

function siteEntryHost(entry) {
  const text = String(entry ?? "");
  const slash = text.indexOf("/");
  return slash < 0 ? text : text.slice(0, slash);
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

// ── Apps entry (desktop applications) ───────────────────────────────────────
// An app is { id: <bundle id>, name: <display name> }. The list is editable only
// where an installed-app inventory exists (the desktop app seeds
// window.__cbAppInventory: id + name + icon); elsewhere the chips are read-only
// and the entry arrives through a linked group.

function getAppInventory() {
  return Array.isArray(window.__cbAppInventory) ? window.__cbAppInventory : [];
}

function findInventoryApp(bundleId) {
  if (!bundleId) return null;
  return getAppInventory().find((entry) => entry && entry.id === bundleId) || null;
}

function appDisplayName(app) {
  if (!app) return "";
  if (typeof app.name === "string" && app.name.trim()) return app.name.trim();
  const fromInventory = findInventoryApp(app.id);
  if (fromInventory && fromInventory.name) return fromInventory.name;
  return app.id || "";
}

function parseAppsData(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return CBGroupScopes.normalizeAppList(JSON.parse(value));
  } catch {
    return [];
  }
}

function serializeApps(apps) {
  return JSON.stringify(CBGroupScopes.normalizeAppList(apps));
}

function getDraftApps() {
  return blockedAppsData ? parseAppsData(blockedAppsData.value) : [];
}

// Writes the working app list into the hidden backing field and runs the same
// stash + autosave path the site list uses.
function commitBlockedApps(apps) {
  if (!blockedAppsData) return;
  blockedAppsData.value = serializeApps(apps);
  stashCurrentDraft();
  renderBlockedApps();
  renderGroupList();
  scheduleAutosave();
}

function makeAppIconElement(app) {
  const inventoryApp = findInventoryApp(app.id) || app;
  const iconUrl = inventoryApp && typeof inventoryApp.icon === "string" ? inventoryApp.icon : "";
  if (iconUrl) {
    const img = document.createElement("img");
    img.className = "app-chip-icon";
    img.src = iconUrl;
    img.alt = "";
    return img;
  }
  const monogram = document.createElement("span");
  monogram.className = "app-chip-icon app-chip-monogram";
  monogram.textContent = (appDisplayName(app) || "?").charAt(0).toUpperCase();
  return monogram;
}

function renderBlockedApps() {
  if (!blockedAppsList) return;
  blockedAppsList.innerHTML = "";
  for (const app of getDraftApps()) {
    const chip = document.createElement("div");
    chip.className = "app-chip";
    chip.setAttribute("role", "listitem");
    chip.title = app.id;
    chip.appendChild(makeAppIconElement(app));
    const label = document.createElement("span");
    label.className = "app-chip-name";
    label.textContent = appDisplayName(app);
    chip.appendChild(label);
    if (blockedAppsEditable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "app-chip-remove";
      remove.setAttribute("aria-label", t("apps.removeAria", { name: appDisplayName(app) }));
      remove.textContent = "−"; // minus sign
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        commitBlockedApps(getDraftApps().filter((item) => item.id !== app.id));
      });
      chip.appendChild(remove);
    }
    blockedAppsList.appendChild(chip);
  }
  if (!blockedAppsEditable) return;
  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "app-chip-add";
  addTile.setAttribute("aria-label", t("apps.addAria"));
  addTile.textContent = "+";
  addTile.addEventListener("click", () => openAppPicker());
  blockedAppsList.appendChild(addTile);
}

function openAppPicker() {
  if (!blockedAppsEditable || !appPickerModal) return;
  appPickerSearch.value = "";
  renderAppPickerResults("");
  appPickerModal.classList.remove("hidden");
  window.setTimeout(() => appPickerSearch.focus(), 0);
}

function closeAppPicker() {
  if (appPickerModal) appPickerModal.classList.add("hidden");
}

function renderAppPickerResults(query) {
  if (!appPickerResults) return;
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const alreadyBlocked = new Set(getDraftApps().map((app) => app.id));
  const matches = getAppInventory()
    .filter((app) => {
      if (!app || !app.id || alreadyBlocked.has(app.id)) return false;
      if (!normalizedQuery) return true;
      const name = (app.name || "").toLowerCase();
      return name.includes(normalizedQuery) || app.id.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 60);
  appPickerResults.innerHTML = "";
  for (const app of matches) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "app-picker-row";
    row.setAttribute("role", "option");
    row.appendChild(makeAppIconElement(app));
    const text = document.createElement("span");
    text.className = "app-picker-row-text";
    const name = document.createElement("span");
    name.className = "app-picker-row-name";
    name.textContent = app.name || app.id;
    const sub = document.createElement("span");
    sub.className = "app-picker-row-id";
    sub.textContent = app.id;
    text.appendChild(name);
    text.appendChild(sub);
    row.appendChild(text);
    row.addEventListener("click", () => {
      commitBlockedApps([...getDraftApps(), { id: app.id, name: app.name || app.id }]);
      closeAppPicker();
    });
    appPickerResults.appendChild(row);
  }
  if (appPickerEmpty) appPickerEmpty.classList.toggle("hidden", matches.length > 0);
}

if (appPickerSearch) {
  appPickerSearch.addEventListener("input", () => renderAppPickerResults(appPickerSearch.value));
}
if (appPickerCloseButton) {
  appPickerCloseButton.addEventListener("click", () => closeAppPicker());
}
if (appPickerModal) {
  appPickerModal.addEventListener("click", (event) => {
    if (event.target === appPickerModal) closeAppPicker();
  });
}
if (clearAppsButton) {
  clearAppsButton.addEventListener("click", () => {
    if (blockedAppsEditable) commitBlockedApps([]);
  });
}
if (appsAllowlistField) {
  appsAllowlistField.addEventListener("change", () => {
    stashCurrentDraft();
    renderGroupList();
    scheduleAutosave();
  });
}
// Re-render chips when the desktop host (re)seeds the app inventory so icons
// and names resolve once the data arrives.
window.__cbOnAppInventory = function () {
  try {
    renderBlockedApps();
  } catch (_) {}
};

// ── Desktop shell (the desktop app hosts this editor in a web view) ─────────
// Scene tabs (Vault / Classifier / Activity), the app-blocking permission gate
// and the Device Control settings section exist only there; the markup is
// `.desktop-only` and these hooks are no-ops in a browser.

function postToNativeShell(payload) {
  try {
    window.webkit.messageHandlers.cbBridge.postMessage(payload);
  } catch (_) {}
}

let __cbAppBlockingGranted = null;

function applyPermissionState(granted) {
  __cbAppBlockingGranted = granted;
  const isGranted = granted === true;
  // The native host is the authority: once macOS granted Accessibility, clear
  // the request modal instead of leaving a stale prompt.
  if (isGranted && permissionModal) permissionModal.classList.add("hidden");
  if (deviceControlCopy) {
    deviceControlCopy.textContent = t(isGranted ? "settings.deviceControlCopyGranted" : "settings.deviceControlCopyMissing");
  }
  if (deviceControlStatus) {
    deviceControlStatus.textContent = t(isGranted ? "settings.deviceControlStatusGranted" : "settings.deviceControlStatusMissing");
  }
}

// Shows the grant modal only when permission is currently missing. Invoked by
// the native host when the app is opened/activated.
window.__cbPromptPermissionOnOpen = function () {
  if (permissionModal && __cbAppBlockingGranted === false) permissionModal.classList.remove("hidden");
};

// The native host pushes the current permission state here (~1x/second).
window.__cbPermissionState = (payload) => {
  try {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    applyPermissionState(data?.appBlockingGranted === true ? true : data?.appBlockingGranted === false ? false : null);
  } catch (error) {
    console.error("Failed to apply permission state.", error);
  }
};

if (permissionGrantButton) {
  permissionGrantButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "request-app-blocking-permission" });
  });
}
if (permissionCancelButton) {
  permissionCancelButton.addEventListener("click", () => {
    if (permissionModal) permissionModal.classList.add("hidden");
  });
}
if (deviceControlButton) {
  deviceControlButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-permission-settings" });
  });
}

// Scene switch in the hero header: tapping another scene posts to the native
// shell, which swaps the visible web view. The underline tracks the active tab.
(function initSceneTabs() {
  const tabs = document.getElementById("sceneTabs");
  if (!tabs || !IS_NATIVE_DESKTOP) return;
  const underline = tabs.querySelector(".scene-underline");
  function position() {
    const active = tabs.querySelector(".scene-tab.is-active");
    if (!active || !underline) return;
    underline.style.width = active.offsetWidth + "px";
    underline.style.transform = "translateX(" + active.offsetLeft + "px)";
  }
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest(".scene-tab");
    if (!button || button.classList.contains("is-active")) return;
    postToNativeShell({ kind: "switch-scene", scene: button.dataset.scene });
  });
  position();
  window.addEventListener("resize", position);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(position);
  setTimeout(position, 60);
})();

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

    chip.appendChild(makeSiteIconElement(siteEntryHost(host)));

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
    normalize: (value) => normalizeSourceInput(value, chipsGroupType)
  });
  setupChipField(discordTargetsField, {
    normalize: (value) => normalizeDiscordTargetInput(value)
  });
}

// ── Content-tag filter helpers (platform rules) ──────────────────────────
// Tag controls show only where tagging exists (platform-profiles.js
// TAGGING_PLATFORMS); the desktop app hosts the tagger. Saved tag filters are
// kept either way, for linked devices that can tag.
function isTagFilterCompatible(groupType) {
  return isTaggingPlatform(groupType) && (IS_NATIVE_DESKTOP || taggingAvailableFor(LOCAL_PROGRAM_ID));
}
function normalizeTagFilterModeChoice(value) {
  return value === "include" || value === "exclude" ? value : "all";
}
function clampTagFilterConfidence(value, fallback) {
  const c = Number(value);
  return Number.isFinite(c) ? Math.min(5, Math.max(1, Math.round(c))) : fallback;
}
// One rule per line:
//   Gaming            a tag
//   Gaming @3         …with its own minimum confidence ("@N", ">=N", ">N", ":N")
//   Gaming + Drama    AND — every tag on the line must be present (" + ", spaced;
//                     "&" is left alone because real tag names contain it)
//   !Tutorial         a carve-out — the list matches only if no "!" line does
function parseTagListTextarea(value) {
  if (typeof value !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const rawLine of value.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    let except = false;
    if (line.startsWith("!")) {
      except = true;
      line = line.slice(1).trim();
    }
    let confidence;
    const m = line.match(/\s*(?:@|>=?|:)\s*([1-5])\s*$/);
    if (m) {
      confidence = Number(m[1]);
      line = line.slice(0, m.index).trim();
    }
    // A dangling AND operator ("Gaming +", a lone "+") is not a tag.
    line = line.replace(/^(?:\+\s*)+|(?:\s*\+)+$/g, "").trim();
    if (!line) continue;
    const names = [];
    const nameKeys = new Set();
    for (const part of line.split(/\s+\+\s+/)) {
      const partName = part.trim().slice(0, 100);
      if (!partName || nameKeys.has(partName.toLowerCase())) continue;
      nameKeys.add(partName.toLowerCase());
      names.push(partName);
      if (names.length >= 6) break;
    }
    if (!names.length) continue;
    const key = (except ? "!" : "") + [...nameKeys].sort().join("+");
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = { name: names[0] };
    if (confidence) entry.confidence = confidence;
    if (names.length > 1) entry.also = names.slice(1);
    if (except) entry.except = true;
    out.push(entry);
    if (out.length >= 100) break;
  }
  return out;
}
function tagListToText(list) {
  if (!Array.isArray(list)) return "";
  return list
    .map((e) => {
      if (!e || typeof e.name !== "string") return "";
      const names = [e.name, ...(Array.isArray(e.also) ? e.also : [])].join(" + ");
      return (e.except ? "!" : "") + names + (e.confidence ? ` @${e.confidence}` : "");
    })
    .filter(Boolean)
    .join("\n");
}

function parsePlatformAuthorsTextarea(groupType, value) {
  const validAuthors = [];
  const invalidAuthors = [];

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const normalized = normalizeSourceInput(trimmedLine, groupType);

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

function parsePauseSeconds(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_PAUSE_SECONDS) return null;
  return parsed;
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
  // Migrate the old `showDebugOverlay` key (which defaulted to true)
  // to the new `debugMode` key (which defaults to false). If the user
  // had previously SET showDebugOverlay we honor it; otherwise we
  // start fresh with debug off.
  const debugMode =
    src.debugMode === true ||
    (src.debugMode === undefined && src.showDebugOverlay === true);
  const showOnPageLogToasts = src.showOnPageLogToasts !== false;
  const out = {
    tickRateMs,
    autosaveDebounceMs,
    debugMode,
    showOnPageLogToasts,
    defaultSnoozeMinutes,
    quickAddEnabled: src.quickAddEnabled === true,
    closeRetrySeconds: Math.round(clampNumber(src.closeRetrySeconds, 0, 86400, 0))
  };
  return out;
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
    startTotalMinutes === endTotalMinutes
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
  if (value === "after-minutes") return value;
  // Crash guard: the count-up "timer" mode was removed 2026-09-25; such a
  // group carries on as a normal timed group with its stored allowance.
  if (value === "timer") return "after-minutes";
  return "instant";
}

function isTimedBlockingMode(mode) {
  return mode === "after-minutes";
}

function getGroupTypeLabel(groupType) {
  const profile = PLATFORM_PROFILES?.[normalizeGroupType(groupType)];
  if (profile?.displayName) return profile.displayName;

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
  if (isPlatformFeedGroupType(groupType) && normalizeGroupType(groupType) !== "twitter") {
    return t("platform.rulesCopy", { platform: getPlatformDisplayName(groupType) });
  }

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
  const profile = PLATFORM_PROFILES?.[normalizeGroupType(groupType)];
  if (profile?.displayName) return profile.displayName;

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
  const key = `platform.placeholder.${normalizeGroupType(groupType)}`;
  const translated = t(key);
  return translated === key ? "" : translated;
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

// Builds the author/account mode dropdown for the current platform.
function rebuildAuthorModeOptions(type) {
  const isTwitter = type === "twitter";
  const noun = type === "reddit" ? t("platform.nounSubreddits") : isTwitter ? t("platform.nounAccounts") : t("platform.nounAuthors");
  const modes = ["all", "include", "exclude", "nobody"];

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

  const isReddit = type === "reddit";
  const isFeedPlatform = isPlatformFeedGroupType(type);

  // Feed platforms and Reddit have no video-form axis. Twitter/X keeps its
  // account wording, Reddit its subreddit wording; the rest say "authors".
  platformVideoModeRow.classList.toggle("hidden", isFeedPlatform || isReddit);

  platformVideoModeLabel.textContent = t("platform.videoMode");
  if (platformVideoModeHelp) platformVideoModeHelp.textContent = t("platform.videoModeHelp");
  platformVideoModeAllOption.textContent = t("platform.videoModeAll", { platform });
  platformVideoModeShortOption.textContent = t("platform.videoModeShort", { content: shortLabel });
  platformVideoModeLongOption.textContent = t("platform.videoModeLong", { content: longLabel });
  platformVideoModePostOption.textContent = t("platform.videoModePost", { content: postLabel });

  platformAuthorModeLabel.textContent = isReddit
    ? t("reddit.mode")
    : isTwitter ? t("platform.accountMode") : t("platform.authorMode");
  rebuildAuthorModeOptions(type);
  platformAuthorModeHelp.textContent = isReddit
    ? t("platform.sourceModeHelp.reddit")
    : isTwitter ? t("platform.accountModeHelp") : t("platform.authorModeHelp");

  platformAuthorsLabel.textContent = isReddit
    ? t("reddit.subreddits")
    : isTwitter ? t("platform.accounts") : t("platform.authors");
  platformAuthorsField.setAttribute("placeholder", getPlatformAuthorsPlaceholder(type));
  platformVideoHelp.textContent = isYouTube
    ? t("platform.help.youtube", { platform })
    : isReddit
      ? t("platform.help.reddit", { platform })
    : isTwitter
      ? t("platform.help.twitter", { platform })
      : isFeedPlatform
        ? t("platform.rulesCopy", { platform })
      : t("platform.help.generic", { platform, shortLabel, longLabel, postLabel });

}

function getProfileSurfaceHideEntries(groupType) {
  return getSurfaceHideEntries(groupType);
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

// Render the platform's verified content-control matrix. Each entry maps to a
// registry surfaceHides id; toggling persists into the group's draft.
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
  if (surfaceHidesTitle) surfaceHidesTitle.textContent = t("surfaceHide.contentTitle");
  if (surfaceHidesHelp) surfaceHidesHelp.textContent = t("surfaceHide.contentHelp");
  const enabled = new Set(getDraftSurfaceHides(group, draft));

  for (const entry of entries) {
    const row = document.createElement("label");
    row.className = "surface-hide-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = entry.id;
    input.checked = enabled.has(entry.id);
    input.disabled = !editable;
    input.addEventListener("change", async () => {
      // Some hides (e.g. hiding ads) can violate platform Terms of Service and
      // risk the account — warn and require confirmation every time they're
      // turned on. Cancelling reverts the checkbox without saving.
      if (input.checked && entry.warnOnEnableKey) {
        const accepted = await cbDialog.confirm(t(entry.warnOnEnableKey), {
          danger: true,
          confirmText: t("modal.confirm"),
          cancelText: t("modal.cancel")
        });
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

// normalizeSourceMode, normalizeDiscordMode,
// isPlatformVideoGroupType, normalizeSourceInput, normalizeVideoMode,
// normalizeRedditSubredditInput and normalizeDiscordTargetInput now come from
// platform-profiles.js (loaded before this script).

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
  const authors = Array.isArray(groupLike.sources) ? groupLike.sources : [];
  const scopes = [];
  const videoMode = normalizeVideoMode(groupLike.platformVideoMode);
  const groupType = normalizeGroupType(groupLike.groupType);

  if (videoMode === "short" || videoMode === "long" || videoMode === "post") {
    scopes.push(getPlatformTypeLabel(groupType, videoMode));
  }

  const authorMode = normalizeSourceMode(groupLike.sourceMode, groupLike.sources);
  if (authorMode === "include") {
    scopes.push(`${authors.length} ${t("meta.creators")}`);
  } else if (authorMode === "exclude") {
    scopes.push(t("meta.allExceptCreators", { count: authors.length }));
  } else if (authorMode === "nobody") {
    scopes.push(t("meta.noAuthors"));
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
  const accounts = Array.isArray(groupLike.sources) ? groupLike.sources : [];
  const mode = normalizeSourceMode(groupLike.sourceMode, groupLike.sources);

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

function describeFeedPlatformScope(groupLike) {
  const authors = Array.isArray(groupLike.sources) ? groupLike.sources : [];
  const mode = normalizeSourceMode(groupLike.sourceMode, groupLike.sources);
  if (mode === "include") return `${authors.length} ${t("meta.creators")}`;
  if (mode === "exclude") return t("meta.allExceptCreators", { count: authors.length });
  if (mode === "nobody") return t("meta.noAuthors");
  return getPlatformDisplayName(groupLike.groupType);
}

function describeRedditScope(groupLike) {
  const subreddits = Array.isArray(groupLike.sources) ? groupLike.sources : [];
  const mode = normalizeSourceMode(groupLike.sourceMode, subreddits);

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
  // A locked group stays where it is (its place decides which group's look a
  // page it blocks takes), like every other setting of a locked group.
  const lockedGroup = state.groups.find((group) => group.id === groupId);
  if (lockedGroup && !isGroupEditable(lockedGroup)) {
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

const DEFAULT_NAME_PATTERN_TYPES = new Set(["youtube", "tiktok", "facebook", "instagram", "twitch", "reddit", "discord", "twitter", "custom"]);

// "YouTube group 3": numbered after the groups of that kind, skipping any
// number whose name is already taken (names are unique, case-insensitively).
function uniqueDefaultGroupName(groupType) {
  const key = DEFAULT_NAME_PATTERN_TYPES.has(groupType) ? groupType : "site";
  const taken = new Set(state.groups.map((group) => (group.name || "").trim().toLowerCase()));
  let number = state.groups.filter((group) => (DEFAULT_NAME_PATTERN_TYPES.has(group.groupType) ? group.groupType : "site") === key).length + 1;
  while (taken.has(t(`groupName.${key}Pattern`, { number }).trim().toLowerCase())) number += 1;
  return t(`groupName.${key}Pattern`, { number });
}

function createDefaultGroup(groupType = DEFAULT_GROUP_TYPE) {
  // The add menu offers one unified Platform rule. It starts with YouTube only
  // as a safe first profile; the cyan Rule box owns the actual platform choice.
  const normalizedGroupType = normalizeGroupType(
    groupType === "platform" ? DEFAULT_PLATFORM_RULE_GROUP_TYPE : groupType
  );

  return {
    id: createGroupId(),
    groupType: normalizedGroupType,
    name: uniqueDefaultGroupName(normalizedGroupType),
    enabled: true,
    mode: "instant",
    allowedMinutes: DEFAULT_ALLOWED_MINUTES,
    resetIntervalHours: DEFAULT_RESET_INTERVAL_HOURS,
    resetAtMidnight: false,
    rollingLimit: false,
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
    sourceMode: "all",
    sources: [],
    platformTagMode: "all",
    platformTags: [],
    platformTagDefaultConfidence: 4,
    platformTagBlockUntagged: false,
    platformTagBlockPage: true,
    platformTagCoverUntilTagged: false,
    platformTagEffect: "dim",
    discordMode: "all",
    discordTargets: [],
    surfaceHides: [],
    blockingRulesText: t("custom.defaultRule"),
    activeEventSource: "",
    ...CBGroupActions.normalizeLock({}),
    sites: [],
    // false → `sites` is a blocklist; true → `sites` is an allowlist
    // ("block everything except these").
    allowlist: false,
    apps: [],
    appsAllowlist: false,
    // The entry the cards edit: a new Default group opens on its Websites
    // entry in the browser and on its Apps entry in the desktop app.
    entryView: normalizedGroupType === "custom"
      ? "custom"
      : normalizedGroupType === "site" && IS_NATIVE_DESKTOP ? "apps" : normalizedGroupType,
    blockHomePage: false,
    pageAction: "block",
    fallbackUrl: "",
    pauseSeconds: DEFAULT_PAUSE_SECONDS
  };
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

  const sanitized = groups.map((input) => {
    // Stored groups are canonical (policy + scope lines, see group-scopes.js);
    // the editor works on the flat form model, so lines are flattened here and
    // re-lined by toStoredGroup() on every save.
    // The entry in view ("site" | "apps" | platform): in-memory only, defaults
    // to the stored type (the desktop opens a Default group on its Apps entry).
    const rawType = normalizeGroupType(input?.groupType);
    const entryView = rawType === "custom"
      ? "custom"
      : typeof input?.entryView === "string" && input.entryView
        ? CBGroupScopes.normalizeEntryKey(input.entryView)
        : rawType === "site" && IS_NATIVE_DESKTOP
          ? "apps"
          : rawType;
    const group = CBGroupScopes.hasScopeLines(input) ? { ...CBGroupScopes.flatFromScopes(input, entryView), ...input } : input;
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
    // Sources (creators / accounts / subreddits): read the legacy pairs once.
    const legacySources = normalizedGroupType === "reddit" ? group?.redditSubreddits : group?.platformAuthors;
    const legacyMode = normalizedGroupType === "reddit" ? group?.redditMode : group?.platformAuthorMode;
    // The legacy pair only exists in old stores and old-style patches, so when
    // it is present it wins over a default-valued modern pair merged underneath.
    const hasLegacy = Array.isArray(legacySources) || typeof legacyMode === "string";
    const rawSources = hasLegacy
      ? (Array.isArray(legacySources) ? legacySources : [])
      : Array.isArray(group?.sources) ? group.sources : [];
    const rawSourceMode = hasLegacy ? legacyMode : group?.sourceMode;
    const rawDiscordTargets = Array.isArray(group?.discordTargets) ? group.discordTargets : [];
    const ownsSiteList = true;

    const normalized = {
      ...baseGroup,
      id: typeof group?.id === "string" && group.id ? group.id : baseGroup.id,
      name:
        typeof group?.name === "string" && group.name.trim()
          ? group.name.trim()
          : baseGroup.name,
      // Legacy "allow" exception groups stay disabled rather than turning
      // into blocking groups (the effect was removed 2026-09-24).
      enabled: Boolean(group?.enabled) && group?.effect !== "allow",
      groupType: normalizedGroupType,
      mode: normalizeBlockingMode(group?.mode),
      allowedMinutes:
        parseAllowedMinutes(group?.allowedMinutes) ?? DEFAULT_ALLOWED_MINUTES,
      resetIntervalHours:
        parseResetIntervalHours(group?.resetIntervalHours) ??
        DEFAULT_RESET_INTERVAL_HOURS,
      resetAtMidnight: group?.resetAtMidnight === true,
      rollingLimit: group?.rollingLimit === true,
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
      sourceMode: normalizeSourceMode(rawSourceMode, rawSources),
      sources: [
        ...new Set(
          rawSources
            .map((source) => normalizeSourceInput(source, normalizedGroupType))
            .filter(Boolean)
        )
      ],
      platformTagMode: normalizeTagFilterModeChoice(group?.platformTagMode),
      platformTags: parseTagListTextarea(
        Array.isArray(group?.platformTags) ? tagListToText(group.platformTags) : String(group?.platformTags ?? "")
      ),
      platformTagDefaultConfidence: clampTagFilterConfidence(group?.platformTagDefaultConfidence, 4),
      platformTagBlockUntagged: Boolean(group?.platformTagBlockUntagged),
      platformTagBlockPage: group?.platformTagBlockPage !== false,
      platformTagCoverUntilTagged: group?.platformTagCoverUntilTagged === true,
      platformTagEffect: group?.platformTagEffect === "block" ? "block" : "dim",
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
      // The lock: parallel gates (wait / PIN), see group-actions.js.
      ...CBGroupActions.normalizeLock(group),
      sites: ownsSiteList && Array.isArray(group?.sites)
        ? [...new Set(group.sites.map(normalizeSiteInput).filter(Boolean))]
        : [],
      allowlist: ownsSiteList && Boolean(group?.allowlist),
      apps: CBGroupScopes.normalizeAppList(group?.apps),
      appsAllowlist: Boolean(group?.appsAllowlist),
      blockHomePage: Boolean(group?.blockHomePage),
      pageAction: group?.pageAction === "pause" ? "pause" : "block",
      fallbackUrl: typeof group?.fallbackUrl === "string" ? group.fallbackUrl.trim() : "",
      pauseSeconds: parsePauseSeconds(group?.pauseSeconds) ?? DEFAULT_PAUSE_SECONDS
    };
    // Every entry's lines. A stored group carries them; a flat group (an older
    // store, an import) gets its type's lines plus an Apps entry when it has a
    // legacy app list — nothing a legacy shape held is lost. The flat fields
    // above are then re-read as the view of the entry in view, so the form and
    // the lines always agree (toStoredGroup merges the form back).
    const scopes = CBGroupScopes.hasScopeLines(input)
      ? CBGroupScopes.sanitizeScopeLines(input.scopes, normalizedGroupType, cbScopeNormalizers)
      : normalized.apps.length > 0 && normalizedGroupType !== "custom"
        ? CBGroupScopes.mergeFlatIntoScopes(CBGroupScopes.scopeLinesFromFlat(normalized, normalizedGroupType), normalized, "apps")
        : CBGroupScopes.scopeLinesFromFlat(normalized, normalizedGroupType);
    const view = entryView === "custom" ? {} : CBGroupScopes.flatFromScopes({ scopes }, entryView);
    return { ...normalized, ...view, scopes, entryView };
  });

  return dedupeGroupNames(sanitized);
}

// The popup's own normalizers for the line fields whose normalization differs
// between the worker and the popup (see group-scopes.js).
const cbScopeNormalizers = {
  normalizeSiteInput: (value) => normalizeSiteInput(value),
  normalizeTagFilterMode: (value) => normalizeTagFilterModeChoice(value),
  normalizeTagList: (value) => parseTagListTextarea(Array.isArray(value) ? tagListToText(value) : String(value ?? "")),
  clampTagConfidence: (value, fallback) => clampTagFilterConfidence(value, fallback)
};

// Flat form model → the canonical stored shape (policy fields + scope lines).
// The form describes the platform in view (group.groupType); its lines replace
// that platform's, the group's other platforms keep theirs.
function toStoredGroup(group) {
  const scopes = CBGroupScopes.mergeFlatIntoScopes(group.scopes, group, activeEntryKey(group));
  const { entryView, ...rest } = CBGroupScopes.withoutFlatScopeFields(group);
  return {
    ...rest,
    groupType: CBGroupScopes.deriveGroupType(scopes, group.groupType),
    scopes
  };
}

// The entry whose lines the cards edit: "site", "apps", a platform id, or
// "custom" (custom groups have no entries).
function activeEntryKey(group) {
  if (!group || group.groupType === "custom") return "custom";
  return CBGroupScopes.normalizeEntryKey(group.entryView || group.groupType);
}

function toStoredGroups(groups) {
  return (Array.isArray(groups) ? groups : []).map(toStoredGroup);
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
  for (const [groupId, raw] of Object.entries(value ?? {})) {
    if (!groupIds.has(groupId)) continue;
    const entry = CBGroupActions.sanitizeSnoozeEntry(raw);
    if (entry) snoozes[groupId] = entry;
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

// The transfer string carries the canonical shape: the policy and every
// platform's lines (an older flat string still imports through the sanitizer).
function getSerializableGroupSnapshot(group) {
  const stored = toStoredGroup(group);
  return {
    scopes: stored.scopes,
    name: group.name,
    enabled: group.enabled,
    groupType: stored.groupType,
    mode: group.mode,
    allowedMinutes: group.allowedMinutes,
    resetIntervalHours: group.resetIntervalHours,
    resetAtMidnight: group.resetAtMidnight === true,
    rollingLimit: group.rollingLimit === true,
    allowSnooze: group.allowSnooze !== false,
    snoozeMinutes: group.snoozeMinutes,
    snoozeActivationDelayMinutes:
      group.snoozeActivationDelayMinutes ?? DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
    snoozeCooldownMinutes: group.snoozeCooldownMinutes ?? DEFAULT_SNOOZE_COOLDOWN_MINUTES,
    snoozeConfirmations: group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS,
    activeDays: [...group.activeDays],
    timeWindowsText: group.timeWindowsText,
    blockingRulesText: group.blockingRulesText,
    // The lock (and its PIN) is not part of an exported definition.
    fallbackUrl: group.fallbackUrl ?? "",
    pauseSeconds: group.pauseSeconds ?? DEFAULT_PAUSE_SECONDS
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
    resetAtMidnight: group.resetAtMidnight === true,
    rollingLimit: group.rollingLimit === true,
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
    appsData: serializeApps(group.apps || []),
    appsAllowlist: Boolean(group.appsAllowlist),
    platformVideoMode: normalizeVideoMode(group.platformVideoMode),
    sourceMode: normalizeSourceMode(group.sourceMode, group.sources),
    sourcesText: group.sources.join("\n"),
    platformTagMode: normalizeTagFilterModeChoice(group.platformTagMode),
    platformTagsText: tagListToText(group.platformTags),
    platformTagDefaultConfidence: clampTagFilterConfidence(group.platformTagDefaultConfidence, 4),
    platformTagBlockUntagged: Boolean(group.platformTagBlockUntagged),
    platformTagBlockPage: group.platformTagBlockPage !== false,
    platformTagCoverUntilTagged: group.platformTagCoverUntilTagged === true,
    platformTagEffect: group.platformTagEffect === "block" ? "block" : "dim",
    discordMode: normalizeDiscordMode(group.discordMode, group.discordTargets),
    discordTargetsText: group.discordTargets.join("\n"),
    surfaceHides: normalizeSurfaceHides(group.surfaceHides, group.groupType),
    blockingRulesText: group.blockingRulesText,
    blockHomePage: Boolean(group.blockHomePage),
    allowlist: Boolean(group.allowlist),
    fallbackUrl: group.fallbackUrl ?? "",
    pageAction: group.pageAction === "pause" ? "pause" : "block",
    pauseSeconds: String(group.pauseSeconds ?? DEFAULT_PAUSE_SECONDS)
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

function getResetIntervalMs(group) {
  return group.resetIntervalHours * MS_PER_HOUR;
}

// Timed-group budget periods — kept identical to background.js (parity-tested).
const USAGE_BUCKET_MS = MS_PER_MINUTE;

function cbStartOfDayMs(nowMs) {
  const day = new Date(nowMs);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function cbNextMidnightMs(nowMs) {
  const day = new Date(cbStartOfDayMs(nowMs));
  day.setDate(day.getDate() + 1);
  return day.getTime();
}

function cbPeriodStartMs(anchorMs, group, nowMs) {
  const interval = Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) {
    const dayStart = cbStartOfDayMs(nowMs);
    if (interval <= 0) return dayStart;
    return dayStart + Math.floor((nowMs - dayStart) / interval) * interval;
  }
  if (interval <= 0 || nowMs - anchorMs < interval) return anchorMs;
  return anchorMs + Math.floor((nowMs - anchorMs) / interval) * interval;
}

function cbNextResetMs(periodStartMs, group, nowMs) {
  const interval = Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) {
    const midnight = cbNextMidnightMs(nowMs);
    return interval > 0 ? Math.min(periodStartMs + interval, midnight) : midnight;
  }
  return interval > 0 ? periodStartMs + interval : null;
}

function cbUsageBucketStartMs(nowMs) {
  return Math.floor(nowMs / USAGE_BUCKET_MS) * USAGE_BUCKET_MS;
}

function cbPruneUsageBuckets(buckets, group, nowMs) {
  let windowStart = nowMs - Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) windowStart = Math.max(windowStart, cbStartOfDayMs(nowMs));
  const kept = {};
  for (const [minute, used] of Object.entries(buckets ?? {})) {
    const start = Number(minute);
    const ms = Number(used);
    // A minute counts until the whole minute has aged out of the window.
    if (Number.isFinite(start) && Number.isFinite(ms) && ms > 0 && start + USAGE_BUCKET_MS > windowStart) {
      kept[String(start)] = ms;
    }
  }
  return kept;
}

function cbBucketsUsedMs(buckets) {
  return Object.values(buckets ?? {}).reduce((sum, used) => sum + (Number(used) || 0), 0);
}

// When rolling time starts coming back: the oldest counted minute leaving the
// window (or midnight clearing it). Null when nothing is counted.
function cbNextReturnMs(buckets, group, nowMs) {
  const minutes = Object.keys(buckets ?? {}).map(Number).filter(Number.isFinite);
  if (minutes.length === 0) return null;
  let next = Math.min(...minutes) + USAGE_BUCKET_MS + Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) next = Math.min(next, cbNextMidnightMs(nowMs));
  return next;
}

function getDisplayUsageState(group, now = Date.now()) {
  const storedUsedMs = state.usageTimersMs[group.id] ?? 0;
  const storedResetAtMs = state.usageResetAtMs[group.id] ?? now;

  if (!isTimedBlockingMode(group.mode)) {
    return { usedMs: storedUsedMs, nextResetAtMs: null };
  }

  if (group.rollingLimit) {
    const buckets = cbPruneUsageBuckets(state.usageBucketsMs[group.id], group, now);
    return {
      usedMs: cbBucketsUsedMs(buckets),
      nextResetAtMs: cbNextReturnMs(buckets, group, now)
    };
  }

  const periodStartMs = cbPeriodStartMs(storedResetAtMs, group, now);
  return {
    usedMs: periodStartMs === storedResetAtMs ? storedUsedMs : 0,
    nextResetAtMs: cbNextResetMs(periodStartMs, group, now)
  };
}

function getSnoozePhase(snooze, now = Date.now()) {
  return CBGroupActions.snoozePhase(snooze, now);
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
  const baseTotal = Math.max(0, Number(state.groupSnoozeTotalsMs[groupId]) || 0);
  const snooze = state.groupSnoozes[groupId];
  if (getSnoozePhase(snooze, now) !== "active") {
    return baseTotal;
  }
  return baseTotal + Math.max(0, now - snooze.startsAtMs);
}

// The lock's state for the editor (the UI calls it "freeze"): locked or not,
// and whether its wait gate still holds. The rules are group-actions.js.
function getFreezeStatus(group, now = Date.now()) {
  const status = CBGroupActions.status(group, now);
  return {
    isFrozen: status.locked,
    hasParentalPassword: status.hasPin,
    waitHours: status.waitHours,
    lockedRemainingMs: status.waitRemainingMs,
    canUnfreeze: status.locked && status.waitRemainingMs <= 0
  };
}

function isGroupEditable(group, now = Date.now()) {
  return !getFreezeStatus(group, now).isFrozen && !isEnforceOnly(group);
}

// Owner 2026-09-26: Mac Vault holds a linked group's real state. While it is
// away this browser only ENFORCES a linked group (from its copy of the links,
// kept by the worker): nothing about the group can change — settings, entries,
// freeze, snooze, delete — until Mac Vault is back.
function macVaultAway() {
  if (IS_NATIVE_DESKTOP) return false;
  const s = state.connectionStatus || {};
  return !((s.state === "connected" || s.state === "running") && s.hubProgram === "macapp");
}

// True (and says why) when the group is enforce-only right now.
function refuseWhileMacVaultAway(group) {
  if (!isEnforceOnly(group)) return false;
  setStatus(t("link.enforceOnly"), true);
  render();
  return true;
}

function isEnforceOnly(group) {
  if (!group || !macVaultAway()) return false;
  const links = Array.isArray(state.linkCopy) ? state.linkCopy : [];
  return links.some((cluster) => window.CBBridgeProtocol.clusterForGroup([cluster], group, LOCAL_PROGRAM_ID) === cluster);
}

// --- Parental password (per-group 6-digit PIN) ---------------------------
// Hashing, verification and the retry wait live in parental-pin.js (shared
// with the service worker's AI-tool operations).
const PARENTAL_PIN_LENGTH = CBParentalPin.PARENTAL_PIN_LENGTH;
const isValidParentalPin = CBParentalPin.isValidParentalPin;

// Every PIN prompt goes through this gate: a wrong PIN makes the next try wait
// 1 s, 2 s, 4 s … up to 64 s; a PIN stored in an old format is upgraded.
async function checkParentalPin(group, pin) {
  let attempts = {};
  try {
    const stored = (await chrome.storage.local.get({ [CBParentalPin.ATTEMPTS_KEY]: {} }))[CBParentalPin.ATTEMPTS_KEY];
    if (stored && typeof stored === "object") attempts = stored;
  } catch (_) {}
  const result = await CBParentalPin.check(attempts, group, pin, Date.now());
  if (result.waiting) {
    setStatus(t("freeze.pin.wait", { seconds: Math.ceil(result.waitMs / 1000) }), true);
    return false;
  }
  if (!result.ok) setStatus(t("freeze.pin.wrongWait", { seconds: Math.ceil(result.waitMs / 1000) }), true);
  try { await chrome.storage.local.set({ [CBParentalPin.ATTEMPTS_KEY]: result.attempts }); } catch (_) {}
  if (result.upgradedHash) {
    const upgraded = CBGroupActions.upgradePinHash(state.groups.find((g) => g.id === group.id) || group, result.upgradedHash);
    Object.assign(group, CBGroupActions.lockUnit(upgraded));
    Promise.resolve(persistGroupFields(group.id, CBGroupActions.lockUnit(upgraded), "")).catch(() => {});
  }
  return result.ok;
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
  const allowedMinutes = parseAllowedMinutes(draft?.allowedMinutes) ?? group.allowedMinutes;
  const resetIntervalHours =
    parseResetIntervalHours(draft?.resetIntervalHours) ?? group.resetIntervalHours;
  return {
    ...group,
    mode,
    allowedMinutes,
    resetIntervalHours,
    resetAtMidnight: draft?.resetAtMidnight ?? group.resetAtMidnight === true,
    rollingLimit: draft?.rollingLimit ?? group.rollingLimit === true
  };
}

function getGroupMetaText(group, draft, now = Date.now()) {
  const effectiveGroup = getEffectiveGroup(group, draft);
  const snooze = getCurrentSnooze(group.id, now);
  const snoozePhase = getSnoozePhase(snooze, now);
  const freezeStatus = getFreezeStatus(group, now);
  const platformKeys = group.groupType === "custom" ? [] : groupPlatformKeys(group);
  const pieces = [
    platformKeys.length > 1 ? platformKeys.map(platformKeyLabel).join(" + ") : getGroupTypeLabel(group.groupType)
  ];

  if (isPlatformVideoGroupType(group.groupType)) {
    const draftAuthors = parsePlatformAuthorsTextarea(
      group.groupType,
      draft?.sourcesText ?? ""
    ).validAuthors;
    pieces.push(
      describePlatformVideoScope({
        groupType: group.groupType,
        platformVideoMode: draft?.platformVideoMode ?? group.platformVideoMode,
        sourceMode: draft?.sourceMode ?? group.sourceMode,
        sources: draftAuthors.length > 0 ? draftAuthors : group.sources
      })
    );
  } else if (group.groupType === "reddit") {
    const draftSubreddits = parsePlatformAuthorsTextarea(
      "reddit",
      draft?.sourcesText ?? ""
    ).validAuthors;
    pieces.push(
      describeRedditScope({
        sourceMode: draft?.sourceMode ?? group.sourceMode,
        sources: draftSubreddits.length > 0 ? draftSubreddits : group.sources
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
  } else if (isPlatformFeedGroupType(group.groupType)) {
    const draftAuthors = parsePlatformAuthorsTextarea(
      group.groupType,
      draft?.sourcesText ?? ""
    ).validAuthors;
    const scopeGroup = {
      groupType: group.groupType,
        sourceMode: draft?.sourceMode ?? group.sourceMode,
        sources: draftAuthors.length > 0 ? draftAuthors : group.sources
    };
    pieces.push(
      group.groupType === "twitter"
        ? describeTwitterScope(scopeGroup)
        : describeFeedPlatformScope(scopeGroup)
    );
  } else if (group.groupType === "custom") {
    pieces.push(t("meta.customRules"));
  } else if (activeEntryKey(group) === "apps") {
    const appCount = draft ? parseAppsData(draft.appsData).length : (group.apps || []).length;
    pieces.push(`${appCount} ${t("meta.appCount", { suffix: appCount === 1 ? "" : "s" })}`);
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
  } else {
    const remainingMs = Math.max(
      effectiveGroup.allowedMinutes * MS_PER_MINUTE - getDisplayUsageState(effectiveGroup, now).usedMs,
      0
    );
    pieces.push(`${formatDurationMs(remainingMs)} ${t("meta.left")}`);
  }

  if (freezeStatus.isFrozen) {
    pieces.push(
      freezeStatus.lockedRemainingMs > 0
        ? `${t("meta.frozen")} ${formatDurationMs(freezeStatus.lockedRemainingMs)}`
        : t("meta.frozen")
    );
  }

  pieces.push(group.enabled ? t("meta.enabled") : t("meta.disabled"));
  return pieces.join(" • ");
}

// A lock whose wait still holds keeps "delete all" closed (group-actions.js).
function hasStrictLockedGroups(now = Date.now()) {
  return Boolean(CBGroupActions.deleteAllPlan(state.groups, now).error);
}

function hasFrozenGroups(now = Date.now()) {
  return state.groups.some((group) => getFreezeStatus(group, now).isFrozen);
}

function confirmDeleteAllFrozenGroups(pinHashes = []) {
  state.unfreezeFlow = {
    kind: "delete-all",
    pinHashes,
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
    const quickAddOn = state.globalSettings?.quickAddEnabled === true && group.groupType !== "custom";
    if (quickAddOn && group.id === state.quickAddGroupId) {
      card.classList.add("quick-add-target");
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
    if (quickAddOn && isGroupEditable(group)) {
      // The badge chooses this group as the quick-add target: the tiny "+" on
      // pages and in the desktop app appends the current site / app here. A
      // locked group takes no edits, so it offers no badge.
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "quick-add-badge";
      badge.textContent = "+";
      badge.title = t("groups.quickAddBadge");
      badge.setAttribute("aria-label", t("groups.quickAddBadge") + ": " + group.name);
      badge.setAttribute("aria-pressed", group.id === state.quickAddGroupId ? "true" : "false");
      badge.addEventListener("mousedown", (event) => event.stopPropagation());
      badge.addEventListener("click", (event) => {
        event.stopPropagation();
        setQuickAddGroup(group.id);
      });
      header.append(textWrap, badge, toggle);
    } else {
      header.append(textWrap, toggle);
    }
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

// The chosen quick-add group: persistent until another badge is clicked; the
// editor shows it (owner 2026-09-25).
function setQuickAddGroup(groupId) {
  state.quickAddGroupId = groupId;
  chrome.storage.local.set({ [QUICK_ADD_GROUP_KEY]: groupId }).catch(() => {});
  selectGroup(groupId);
}

function formatResetClock(ms, now) {
  const at = new Date(ms);
  const sameDay = cbStartOfDayMs(ms) === cbStartOfDayMs(now);
  const options = sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { weekday: "short", hour: "numeric", minute: "2-digit" };
  try {
    return at.toLocaleString(state.language || undefined, options);
  } catch (_) {
    return at.toLocaleString(undefined, options);
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
  const rolling = displayGroup.rollingLimit === true;
  const vars = {
    hours: formatHours(displayGroup.resetIntervalHours),
    suffix: displayGroup.resetIntervalHours === 1 ? "" : "s"
  };
  const remainingMs = Math.max(displayGroup.allowedMinutes * MS_PER_MINUTE - usageState.usedMs, 0);
  let text = t(rolling ? "timed.summaryRolling" : "timed.summary", {
    ...vars,
    time: formatDurationMs(remainingMs)
  });
  if (Number.isFinite(usageState.nextResetAtMs)) {
    text += " " + t(rolling ? "timed.nextReturn" : "timed.nextReset", {
      time: formatResetClock(usageState.nextResetAtMs, now)
    });
  }
  usageSummary.textContent = text;
}

function updateFreezeUI(group, now = Date.now()) {
  if (!group) {
    freezeSummary.textContent = "";
    freezeSetup.classList.add("hidden");
    applyFreezeButton.disabled = true;
    unfreezeButton.classList.add("hidden");
    unfreezeButton.disabled = true;
    return;
  }

  // One lock with parallel gates: a wait and/or a PIN, and always the
  // confirmation. While frozen, the same controls only make it stricter.
  const freezeStatus = getFreezeStatus(group, now);
  const enforceOnly = isEnforceOnly(group);
  lockWaitHoursField.disabled = enforceOnly;
  if (parentalSettingsButton) parentalSettingsButton.disabled = enforceOnly;
  freezeSetup.classList.remove("hidden");
  if (document.activeElement !== lockWaitHoursField) {
    lockWaitHoursField.value = freezeStatus.waitHours > 0 ? String(freezeStatus.waitHours) : "";
  }
  lockPinStatus.textContent = freezeStatus.hasParentalPassword ? t("freeze.pinSet") : t("freeze.pinNone");
  applyFreezeButton.textContent = freezeStatus.isFrozen ? t("freeze.tightenButton") : t("freeze.applyButton");
  applyFreezeButton.disabled = enforceOnly;
  unfreezeButton.classList.toggle("hidden", !freezeStatus.isFrozen);
  unfreezeButton.disabled = !freezeStatus.canUnfreeze || enforceOnly;

  if (enforceOnly) {
    freezeSummary.textContent = t("link.enforceOnly");
    return;
  }
  if (!freezeStatus.isFrozen) {
    freezeSummary.textContent = t("freeze.summary.notFrozen");
    return;
  }
  const gates = [];
  if (freezeStatus.lockedRemainingMs > 0) {
    gates.push(t("freeze.gate.wait", { time: formatDurationMs(freezeStatus.lockedRemainingMs) }));
  }
  if (freezeStatus.hasParentalPassword) gates.push(t("freeze.gate.pin"));
  gates.push(t("freeze.gate.confirm", { count: UNFREEZE_CONFIRMATIONS_REQUIRED }));
  freezeSummary.textContent = t("freeze.summary.locked", { gates: gates.join(" · ") });
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
    startSnoozeButton.disabled = !allowSnooze || isEnforceOnly(group);
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
    endSnoozeButton.disabled = isEnforceOnly(group);
  } else if (snoozePhase === "active") {
    snoozeSummary.textContent = t("snooze.summary.active", {
      time: formatDurationMs(snooze.untilMs - now)
    });
    endSnoozeButton.classList.remove("hidden");
    endSnoozeButton.disabled = isEnforceOnly(group);
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
    resetAtMidnightField.checked = false;
    rollingLimitField.checked = false;
    snoozeMinutesField.value = "";
    snoozeActivationDelayField.value = "";
    snoozeCooldownField.value = "";
    snoozeConfirmationsField.value = "";
    scheduleWindowsField.value = "";
    blockedSitesField.value = "";
    if (siteAllowlistField) siteAllowlistField.checked = false;
    if (siteSettingsLabel) siteSettingsLabel.textContent = t("sites.label");
    blockingRulesField.value = "";
    platformAuthorsField.value = "";
    platformVideoModeField.value = "all";
    platformAuthorModeField.value = "all";
    discordModeField.value = "all";
    discordTargetsField.value = "";
    allowSnoozeField.checked = true;
    lockWaitHoursField.value = "";
    usageSummary.textContent = "";
    platformBlockHomePageField.checked = false;
    discordBlockHomePageField.checked = false;
    fallbackUrlField.value = "";
    blockModeSection.classList.remove("hidden");
    timedSettings.classList.add("hidden");
    customSettingsCard.classList.add("hidden");
    if (platformRulesCard) platformRulesCard.classList.add("hidden");
    if (groupScopesSection) groupScopesSection.classList.add("hidden");
    if (pageActionRow) pageActionRow.classList.add("hidden");
    if (appsSettingsSection) appsSettingsSection.classList.add("hidden");
    blockedAppsEditable = false;
    platformVideoCard.classList.add("hidden");
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
    resetAtMidnightField.disabled = true;
    rollingLimitField.disabled = true;
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
    discordBlockHomePageField.disabled = true;
    fallbackUrlField.disabled = true;
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
    return;
  }

  const draft = getDraftForGroup(group.id);
  const editable = isGroupEditable(group, now);
  const freezeStatus = getFreezeStatus(group, now);
  const selectedMode = normalizeBlockingMode(draft?.mode ?? group.mode);
  const isTimedMode = isTimedBlockingMode(selectedMode);
  const isPlatformVideoGroup = isPlatformVideoGroupType(group.groupType);
  const usesAuthorAxis = isPlatformAuthorGroupType(group.groupType);
  const isRedditGroup = group.groupType === "reddit";
  const isDiscordGroup = group.groupType === "discord";
  const isCustomGroup = group.groupType === "custom";
  const isPlatformProfileGroup = isPlatformProfileGroupType(group.groupType);
  const entryKey = activeEntryKey(group);
  const isSiteView = entryKey === "site";
  const isAppsView = entryKey === "apps";

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
  resetAtMidnightField.checked = draft?.resetAtMidnight ?? group.resetAtMidnight === true;
  rollingLimitField.checked = draft?.rollingLimit ?? group.rollingLimit === true;
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
  if (blockedAppsData) blockedAppsData.value = draft?.appsData ?? serializeApps(group.apps || []);
  if (appsAllowlistField) appsAllowlistField.checked = Boolean(draft?.appsAllowlist ?? group.appsAllowlist);
  blockingRulesField.value = draft?.blockingRulesText ?? group.blockingRulesText;
  platformAuthorsField.value = draft?.sourcesText ?? group.sources.join("\n");
  platformVideoModeField.value = draft?.platformVideoMode ?? group.platformVideoMode;
  platformAuthorModeField.value = normalizeSourceMode(
    draft?.sourceMode ?? group.sourceMode,
    group.sources
  );
  // Content-tag filter fields.
  const tagCompatible = isTagFilterCompatible(group.groupType);
  const tagMode = normalizeTagFilterModeChoice(draft?.platformTagMode ?? group.platformTagMode);
  platformTagModeField.value = tagMode;
  platformTagsField.value = draft?.platformTagsText ?? tagListToText(group.platformTags);
  platformTagDefaultConfidenceField.value = String(
    clampTagFilterConfidence(draft?.platformTagDefaultConfidence ?? group.platformTagDefaultConfidence, 4)
  );
  platformTagEffectField.value =
    (draft?.platformTagEffect ?? group.platformTagEffect) === "block" ? "block" : "dim";
  platformTagBlockUntaggedField.checked = Boolean(
    draft?.platformTagBlockUntagged ?? group.platformTagBlockUntagged
  );
  if (platformTagBlockPageField) {
    platformTagBlockPageField.checked = (draft?.platformTagBlockPage ?? group.platformTagBlockPage) !== false;
  }
  if (platformTagCoverUntilTaggedField) {
    platformTagCoverUntilTaggedField.checked = (draft?.platformTagCoverUntilTagged ?? group.platformTagCoverUntilTagged) === true;
  }
  if (platformTagFields) platformTagFields.classList.toggle("hidden", !tagCompatible);
  if (platformTagListBlock) platformTagListBlock.classList.toggle("hidden", tagMode === "all");
  refreshTagSuggestions(
    document.getElementById("platformTagSuggestions"), platformTagsField,
    tagCompatible && tagMode !== "all" ? group.groupType : ""
  );
  // Honoured in both modes now (it lives inside the list block, hidden for "all").
  if (platformTagBlockUntaggedRow) platformTagBlockUntaggedRow.classList.remove("hidden");
  discordModeField.value = normalizeDiscordMode(
    draft?.discordMode ?? group.discordMode,
    group.discordTargets
  );
  discordTargetsField.value = draft?.discordTargetsText ?? group.discordTargets.join("\n");

  const blockHomePageValue = Boolean(draft?.blockHomePage ?? group.blockHomePage);
  platformBlockHomePageField.checked = blockHomePageValue;
  discordBlockHomePageField.checked = blockHomePageValue;

  fallbackUrlField.value = draft?.fallbackUrl ?? group.fallbackUrl ?? "";
  if (pageActionField) pageActionField.value = (draft?.pageAction ?? group.pageAction) === "pause" ? "pause" : "block";
  if (pauseSecondsField) pauseSecondsField.value = draft?.pauseSeconds ?? String(group.pauseSeconds ?? DEFAULT_PAUSE_SECONDS);



  blockModeSection.classList.toggle("hidden", isCustomGroup);
  timedSettings.classList.toggle("hidden", !isTimedMode || isCustomGroup);
  customSettingsCard.classList.toggle("hidden", !isCustomGroup);
  if (platformRulesCard) {
    platformRulesCard.classList.toggle("hidden", !isPlatformProfileGroup);
  }
  renderGroupScopes(group, editable);
  // The page action belongs to entries that have pages: the website list and
  // platforms (apps have none; custom rules decide for themselves).
  if (pageActionRow) {
    pageActionRow.classList.toggle("hidden", isCustomGroup || isAppsView);
    if (pageActionField) pageActionField.disabled = !editable;
    if (pauseSecondsField) pauseSecondsField.disabled = !editable;
    if (pauseSecondsRow) pauseSecondsRow.classList.toggle("hidden", (pageActionField ? pageActionField.value : "block") !== "pause");
  }
  platformVideoCard.classList.toggle("hidden", !usesAuthorAxis);
  discordSettingsCard.classList.toggle("hidden", !isDiscordGroup);
  renderSurfaceHides(group, draft, editable);
  if (fallbackUrlSection) {
    fallbackUrlSection.classList.toggle("hidden", isCustomGroup);
  }
  scheduleSection.classList.toggle("hidden", isCustomGroup);
  // The cards show the entry in view: the website list, the app list, or the
  // platform card. Custom rules define their own behavior and have no entries.
  siteSettingsSection.classList.toggle("hidden", !isSiteView);
  if (appsSettingsSection) appsSettingsSection.classList.toggle("hidden", !isAppsView);
  blockedAppsEditable = editable && isAppsView && IS_NATIVE_DESKTOP;
  if (appsAllowlistField) appsAllowlistField.disabled = !blockedAppsEditable;
  if (appsHelp) appsHelp.textContent = t(IS_NATIVE_DESKTOP ? "apps.help" : "apps.readOnlyHint");
  if (clearAppsButton) clearAppsButton.disabled = !blockedAppsEditable;
  renderBlockedApps();

  const allowlistOn = Boolean(draft?.allowlist ?? group.allowlist);
  if (siteAllowlistField) siteAllowlistField.checked = allowlistOn;
  if (siteSettingsLabel) {
    siteSettingsLabel.textContent = allowlistOn ? t("sites.allowlistedLabel") : t("sites.label");
  }

  groupNameField.disabled = !editable;
  groupEnabledField.disabled = !editable;
  blockModeField.disabled = !editable || isCustomGroup;
  allowedMinutesField.disabled = !editable || !isTimedMode || isCustomGroup;
  resetIntervalHoursField.disabled = !editable || !isTimedMode || isCustomGroup;
  resetAtMidnightField.disabled = !editable || !isTimedMode || isCustomGroup;
  rollingLimitField.disabled = !editable || !isTimedMode || isCustomGroup;
  snoozeMinutesField.disabled = !editable || !allowSnoozeField.checked || freezeStatus.isFrozen;
  snoozeActivationDelayField.disabled = !editable || !allowSnoozeField.checked || freezeStatus.isFrozen;
  snoozeCooldownField.disabled = !editable || !allowSnoozeField.checked || freezeStatus.isFrozen;
  snoozeConfirmationsField.disabled = !editable || !allowSnoozeField.checked;
  scheduleWindowsField.disabled = !editable || isCustomGroup;
  blockedSitesField.disabled = !editable || !isSiteView;
  if (siteAllowlistField) {
    siteAllowlistField.disabled = !editable || !isSiteView;
  }
  blockingRulesField.disabled = !editable || !isCustomGroup;
  const currentAuthorMode = normalizeSourceMode(platformAuthorModeField.value);
  const authorModeUsesList = sourceModeUsesList(currentAuthorMode); // include/exclude
  // Show the author list only for include/exclude.
  platformAuthorsBlock.classList.toggle("hidden", !usesAuthorAxis || !authorModeUsesList);
  platformAuthorsField.disabled = !editable || !usesAuthorAxis || !authorModeUsesList;
  platformVideoModeField.disabled = !editable || !isPlatformVideoGroup;
  platformAuthorModeField.disabled = !editable || !usesAuthorAxis;
  discordModeField.disabled = !editable || !isDiscordGroup;
  discordTargetsField.disabled = !editable || !isDiscordGroup || discordModeField.value === "all";
  clearSitesButton.disabled =
    !editable || !isSiteView;
  renderBlockedSites();
  refreshChipField(platformAuthorsField);
  refreshChipField(discordTargetsField);
  deleteGroupButton.disabled = !editable;
  exportGroupButton.disabled = false;
  importGroupButton.disabled = !editable;
  platformBlockHomePageField.disabled = !editable || !usesAuthorAxis;
  discordBlockHomePageField.disabled = !editable || !isDiscordGroup;
  fallbackUrlField.disabled = !editable;
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
  updateBlockingRulesEditor();
}

function render(now = Date.now()) {
  applyStaticTranslations();
  renderGroupList(now);
  updateBulkActionsUI(now);
  renderEditor(now);
  renderUnfreezeModal(now);
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
  const usesAuthorAxis = isPlatformAuthorGroupType(group.groupType);
  const isRedditGroup = group.groupType === "reddit";
  const isDiscordGroup = group.groupType === "discord";

  state.drafts[state.selectedGroupId] = {
    name: groupNameField.value,
    enabled: groupEnabledField.checked,
    mode: blockModeField.value,
    allowedMinutes: allowedMinutesField.value,
    resetIntervalHours: resetIntervalHoursField.value,
    resetAtMidnight: resetAtMidnightField.checked,
    rollingLimit: rollingLimitField.checked,
    allowSnooze: allowSnoozeField.checked,
    snoozeMinutes: snoozeMinutesField.value,
    snoozeActivationDelayMinutes: snoozeActivationDelayField.value,
    snoozeCooldownMinutes: snoozeCooldownField.value,
    snoozeConfirmations: snoozeConfirmationsField.value,
    activeDays: collectSelectedDays(),
    timeWindowsText: scheduleWindowsField.value,
    sitesText: blockedSitesField.value,
    allowlist: siteAllowlistField.checked,
    appsData: blockedAppsData ? blockedAppsData.value : "[]",
    appsAllowlist: appsAllowlistField ? appsAllowlistField.checked : false,
    blockingRulesText: blockingRulesField.value,
    platformVideoMode: platformVideoModeField.value,
    sourceMode: platformAuthorModeField.value,
    sourcesText: platformAuthorsField.value,
    platformTagMode: platformTagModeField.value,
    platformTagsText: platformTagsField.value,
    platformTagDefaultConfidence: platformTagDefaultConfidenceField.value,
    platformTagBlockUntagged: platformTagBlockUntaggedField.checked,
    platformTagBlockPage: platformTagBlockPageField ? platformTagBlockPageField.checked : true,
    platformTagCoverUntilTagged: platformTagCoverUntilTaggedField ? platformTagCoverUntilTaggedField.checked : false,
    platformTagEffect: platformTagEffectField.value,
    discordMode: discordModeField.value,
    discordTargetsText: discordTargetsField.value,
    blockHomePage: usesAuthorAxis
      ? platformBlockHomePageField.checked
      : isDiscordGroup
        ? discordBlockHomePageField.checked
        : false,
    surfaceHides: readSurfaceHidesFromForm(),
    fallbackUrl: fallbackUrlField.value,
    pageAction: pageActionField ? pageActionField.value : "block",
    pauseSeconds: pauseSecondsField ? pauseSecondsField.value : ""
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
  // Closing the popup before the store was read must not write the empty
  // in-memory list back (that erased every group).
  if (!state.groupsLoaded) return;

  const group = getSelectedGroup();
  const draft = group ? getDraftForGroup(group.id) : null;
  if (group && draft && isGroupEditable(group)) {
    try {
      // Non-strict: commit every valid field (tags included) on teardown even
      // if a sibling field is mid-edit/invalid.
      const result = buildUpdatedGroupFromDraft(group, draft, { strict: false });
      if (result && result.updatedGroup) {
        state.groups = state.groups.map((item) =>
          item.id === group.id ? result.updatedGroup : item
        );
      }
    } catch (_) {
      // Unexpected error — persist current state.groups anyway.
    }
  }

  try {
    // globalSettings is intentionally omitted: it only changes via the
    // settings modal's Save button, and re-emitting on every teardown
    // would race two open popups against each other.
    chrome.storage.local.set({
      [BLOCKED_GROUPS_KEY]: toStoredGroups(state.groups),
      [USAGE_TIMERS_KEY]: state.usageTimersMs,
      [USAGE_RESET_AT_KEY]: state.usageResetAtMs,
      [USAGE_BUCKETS_KEY]: state.usageBucketsMs,
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

function sanitizeUsageBuckets(value, groups) {
  const sanitized = {};
  for (const group of groups) {
    const raw = value?.[group.id];
    if (!raw || typeof raw !== "object") continue;
    const buckets = {};
    for (const [minute, used] of Object.entries(raw)) {
      const start = Number(minute);
      const ms = Number(used);
      if (Number.isFinite(start) && Number.isFinite(ms) && ms > 0) buckets[String(start)] = ms;
    }
    sanitized[group.id] = buckets;
  }
  return sanitized;
}

async function loadStoredState() {
  const result = await chrome.storage.local.get({
    [BLOCKED_GROUPS_KEY]: [],
    [USAGE_TIMERS_KEY]: {},
    [USAGE_RESET_AT_KEY]: {},
    [USAGE_BUCKETS_KEY]: {},
    [GROUP_SNOOZES_KEY]: {},
    [GROUP_SNOOZE_TOTALS_KEY]: {},
    [GLOBAL_SETTINGS_KEY]: { ...DEFAULT_GLOBAL_SETTINGS },
    [QUICK_ADD_GROUP_KEY]: "",
    cbClusterCopy: []
  });

  const groups = sanitizeGroups(result[BLOCKED_GROUPS_KEY]);
  const settings = sanitizeGlobalSettings(result[GLOBAL_SETTINGS_KEY]);
  cbDebugMode = settings.debugMode === true;

  return {
    quickAddGroupId: typeof result[QUICK_ADD_GROUP_KEY] === "string" ? result[QUICK_ADD_GROUP_KEY] : "",
    groups,
    usageTimersMs: sanitizeUsageTimers(result[USAGE_TIMERS_KEY], groups),
    usageResetAtMs: sanitizeResetTimes(result[USAGE_RESET_AT_KEY], groups),
    usageBucketsMs: sanitizeUsageBuckets(result[USAGE_BUCKETS_KEY], groups),
    groupSnoozes: sanitizeSnoozes(result[GROUP_SNOOZES_KEY], groups),
    groupSnoozeTotalsMs: sanitizeSnoozeTotals(result[GROUP_SNOOZE_TOTALS_KEY], groups),
    globalSettings: settings,
    linkCopy: Array.isArray(result.cbClusterCopy) ? result.cbClusterCopy : []
  };
}

async function persistState(message) {
  state.suppressGroupStorageUpdatesUntil = Date.now() + 1000;

  await chrome.storage.local.set({
    [BLOCKED_GROUPS_KEY]: toStoredGroups(state.groups),
    [USAGE_TIMERS_KEY]: state.usageTimersMs,
    [USAGE_RESET_AT_KEY]: state.usageResetAtMs,
    [USAGE_BUCKETS_KEY]: state.usageBucketsMs,
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
  state.groupsLoaded = true;
  state.usageTimersMs = loaded.usageTimersMs;
  state.usageResetAtMs = loaded.usageResetAtMs;
  state.usageBucketsMs = loaded.usageBucketsMs;
  state.groupSnoozes = loaded.groupSnoozes;
  state.groupSnoozeTotalsMs = loaded.groupSnoozeTotalsMs;
  state.globalSettings = loaded.globalSettings;
  state.quickAddGroupId = loaded.quickAddGroupId;
  state.linkCopy = loaded.linkCopy;
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

// ── "Applies to": the platforms a group names ──────────────────────────────
// A group's lines may name several platforms and a site list; the group acts
// on their union. The cards edit ONE of them at a time: group.groupType is
// the platform in view and the flat form fields are that platform's lines
// (group-scopes.js flatFromScopes). Switching the view first folds the form
// into the group's lines, then reads the next platform's lines into the form.

function groupPlatformKeys(group) {
  const keys = CBGroupScopes.groupPlatforms(group);
  const active = activeEntryKey(group);
  if (active !== "custom" && !keys.includes(active)) keys.push(active);
  return keys;
}

function platformKeyLabel(key) {
  if (key === "site") return t("scopes.websites");
  if (key === "apps") return t("scopes.apps");
  return getGroupTypeLabel(key);
}

// The stored (canonical) group seen through one entry: its policy, every
// entry's lines, and the flat form fields of `key`.
function viewGroupOnPlatform(stored, key) {
  const entry = CBGroupScopes.normalizeEntryKey(key);
  return {
    ...stored,
    groupType: entry === "site" || entry === "apps" ? "site" : entry,
    entryView: entry,
    ...CBGroupScopes.flatFromScopes(stored, entry)
  };
}

// Fold the form into the selected group (as autosave does) and return the
// group in its canonical shape: policy + every platform's lines.
async function commitSelectedGroupLines() {
  stashCurrentDraft();
  await flushAutosave();
  const group = getSelectedGroup();
  if (!group || !isGroupEditable(group)) return null;
  const draft = getDraftForGroup(group.id);
  const current = draft ? buildUpdatedGroupFromDraft(group, draft, { strict: false }).updatedGroup : group;
  return toStoredGroup(current);
}

// Show the entry `key` in the cards; an entry the group does not name yet is
// added with the same defaults a new group of that kind would get.
async function setGroupPlatformView(key) {
  const entry = CBGroupScopes.normalizeEntryKey(key);
  const stored = await commitSelectedGroupLines();
  if (!stored || stored.groupType === "custom") {
    render();
    return;
  }
  const known = CBGroupScopes.groupPlatforms(stored).includes(entry);
  let next = viewGroupOnPlatform(stored, entry);
  if (!known && entry !== "site" && entry !== "apps") {
    const defaults = createDefaultGroup(entry);
    for (const field of CBGroupScopes.FLAT_SCOPE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(defaults, field)) next[field] = defaults[field];
    }
  }
  state.groups = state.groups.map((item) => (item.id === stored.id ? next : item));
  state.drafts[stored.id] = groupToDraft(next);
  await persistState();
  render();
}

// Drop every line of `platform`; the view moves to a platform that remains.
async function removeGroupPlatform(platform) {
  const group = getSelectedGroup();
  if (!group || !isGroupEditable(group) || groupPlatformKeys(group).length <= 1) {
    render();
    return;
  }
  // No confirmation (owner 2026-09-24): removing an entry drops its filters,
  // like removing a site chip.
  const stored = await commitSelectedGroupLines();
  if (!stored) {
    render();
    return;
  }
  const scopes = stored.scopes.filter((line) => !CBGroupScopes.lineBelongsTo(line, platform));
  const remaining = [...new Set(scopes.map((line) => CBGroupScopes.linePlatformKey(line)))];
  if (remaining.length === 0) {
    render();
    return;
  }
  const current = activeEntryKey(group);
  const nextKey = remaining.includes(current) ? current : remaining[0];
  const next = viewGroupOnPlatform({ ...stored, scopes }, nextKey);
  state.groups = state.groups.map((item) => (item.id === stored.id ? next : item));
  state.drafts[stored.id] = groupToDraft(next);
  await persistState();
  render();
}

function renderGroupScopes(group, editable) {
  if (!groupScopesSection || !groupScopesList || !groupScopesAdd) return;
  const isCustom = group.groupType === "custom";
  groupScopesSection.classList.toggle("hidden", isCustom);
  if (isCustom) return;

  const keys = groupPlatformKeys(group);
  const active = activeEntryKey(group);
  groupScopesList.innerHTML = "";
  for (const key of keys) {
    const chip = document.createElement("div");
    chip.className = `site-chip scope-chip${key === active ? " active" : ""}`;
    chip.setAttribute("role", "listitem");
    chip.tabIndex = 0;
    chip.setAttribute("aria-pressed", key === active ? "true" : "false");
    const label = document.createElement("span");
    label.className = "site-chip-name";
    label.textContent = platformKeyLabel(key);
    chip.appendChild(label);
    const open = () => {
      if (key === active) return;
      setGroupPlatformView(key).catch((error) => {
        console.error("Failed to switch the group's platform view.", error);
        setStatus(t("status.errorSaveGroup"), true);
        render();
      });
    };
    chip.addEventListener("click", open);
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    if (editable && keys.length > 1) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "site-chip-remove";
      remove.setAttribute("aria-label", t("scopes.removeAria", { name: platformKeyLabel(key) }));
      remove.textContent = "\u2212"; // minus sign
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        removeGroupPlatform(key).catch((error) => {
          console.error("Failed to remove the platform from the group.", error);
          setStatus(t("status.errorSaveGroup"), true);
          render();
        });
      });
      chip.appendChild(remove);
    }
    groupScopesList.appendChild(chip);
  }

  // Entries the group does not name yet. Apps can only be edited where an
  // app inventory exists (the desktop app), so only the desktop offers them.
  groupScopesAdd.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("scopes.add");
  placeholder.selected = true;
  groupScopesAdd.appendChild(placeholder);
  for (const key of ["site", ...(IS_NATIVE_DESKTOP ? ["apps"] : []), ...PLATFORM_GROUP_TYPES]) {
    if (keys.includes(key)) continue;
    const option = document.createElement("option");
    option.value = key;
    option.textContent = platformKeyLabel(key);
    groupScopesAdd.appendChild(option);
  }
  groupScopesAdd.value = "";
  groupScopesAdd.disabled = !editable || groupScopesAdd.options.length <= 1;
}

function askParentalPin(group) {
  return new Promise((resolve) => {
    openPinEntry({
      title: t("freeze.pin.unfreezeTitle"),
      description: t("groups.deleteAllPinPrompt", { name: group.name }),
      onSubmit: async (pin) => {
        const ok = await checkParentalPin(group, pin);
        if (ok) resolve(true);
        return ok;
      },
      onCancel: () => resolve(false)
    });
  });
}

// "Delete all" must pass the union of every lock's gates (owner 2026-09-26):
// no wait still holding, each distinct PIN once, then the confirmation. The
// plan is taken again at the last confirm, so a lock that arrived meanwhile
// (a linked device, a tool) stops the deletion instead of being skipped.
async function unlockParentalGroupsForDeleteAll(plan) {
  for (const group of plan.pinGroups) {
    if (!(await askParentalPin(group))) return false;
  }
  return true;
}

function deleteAllStillCovered(passedPinHashes, now = Date.now()) {
  const plan = CBGroupActions.deleteAllPlan(state.groups, now);
  return !plan.error && plan.pinHashes.every((hash) => passedPinHashes.includes(hash));
}

async function deleteAllGroups() {
  await flushAutosave();
  const away = state.groups.find(isEnforceOnly);
  if (away && refuseWhileMacVaultAway(away)) return;

  const plan = CBGroupActions.deleteAllPlan(state.groups, Date.now());
  if (plan.error) {
    setStatus(t("status.bulkDeleteStrictLocked"), true);
    render();
    return;
  }

  if (state.groups.length === 0) {
    return;
  }

  const confirmed = await cbDialog.confirm(
    plan.needsConfirmation ? t("groups.deleteAllConfirmFrozen") : t("groups.deleteAllConfirm"),
    { danger: true, confirmText: t("modal.confirm"), cancelText: t("modal.cancel") }
  );

  if (!confirmed) {
    return;
  }

  if (!(await unlockParentalGroupsForDeleteAll(plan))) return;

  if (plan.needsConfirmation) {
    confirmDeleteAllFrozenGroups(plan.pinHashes);
    return;
  }

  await clearAllGroups();
}

async function clearAllGroups() {
  const ids = state.groups.map((group) => group.id);
  state.groups = [];
  state.drafts = {};
  state.usageTimersMs = {};
  state.usageResetAtMs = {};
  state.usageBucketsMs = {};
  state.groupSnoozes = {};
  state.groupSnoozeTotalsMs = {};
  state.selectedGroupId = null;

  await persistState(t("status.bulkDeleted"));
  await forgetGroupLeftovers(ids);
  render();
}

// Per-group data kept outside the group maps: a deleted group leaves none.
async function forgetGroupLeftovers(ids) {
  try {
    const stored = await chrome.storage.local.get({ [CBParentalPin.ATTEMPTS_KEY]: {}, quickAddGroupId: "" });
    const attempts = { ...(stored[CBParentalPin.ATTEMPTS_KEY] || {}) };
    for (const id of ids) delete attempts[id];
    const writes = { [CBParentalPin.ATTEMPTS_KEY]: attempts };
    if (ids.includes(stored.quickAddGroupId)) writes.quickAddGroupId = "";
    await chrome.storage.local.set(writes);
  } catch (_) {}
}

async function deleteSelectedGroup() {
  await flushAutosave();
  const group = getSelectedGroup();

  if (!group) {
    return;
  }

  if (refuseWhileMacVaultAway(group)) return;
  if (!isGroupEditable(group)) {
    setStatus(t("status.frozenCannotDelete"), true);
    render();
    return;
  }

  state.groups = state.groups.filter((item) => item.id !== group.id);
  delete state.drafts[group.id];
  delete state.usageTimersMs[group.id];
  delete state.usageResetAtMs[group.id];
  delete state.usageBucketsMs[group.id];
  delete state.groupSnoozes[group.id];
  delete state.groupSnoozeTotalsMs[group.id];
  state.selectedGroupId = state.groups[0]?.id ?? null;

  await persistState(t("status.deleted", { name: group.name }));
  await forgetGroupLeftovers([group.id]);
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

    await cbDialog.prompt(
      t(copiedToClipboard ? "editor.exportGroupPromptCopied" : "editor.exportGroupPrompt"),
      exportString,
      { confirmText: t("modal.confirm"), cancelText: t("modal.cancel") }
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
      clipboardText =
        (await cbDialog.prompt(t("editor.importGroupPrompt"), "", {
          confirmText: t("modal.confirm"),
          cancelText: t("modal.cancel")
        })) ?? "";
    }

    const importedGroup = decodeGroupTransferString(clipboardText);
    const confirmed = await cbDialog.confirm(
      t("editor.importGroupConfirm", {
        current: group.name,
        imported: importedGroup.name
      }),
      { danger: true, confirmText: t("modal.confirm"), cancelText: t("modal.cancel") }
    );

    if (!confirmed) {
      return;
    }

    // An import replaces the definition, never the lock (the lock is not part
    // of an exported group), and it keeps names unique like any edit.
    const nameTaken = state.groups.some((other) =>
      other.id !== group.id && (other.name || "").trim().toLowerCase() === importedGroup.name.trim().toLowerCase());
    if (nameTaken) {
      setStatus(t("status.duplicateName"), true);
      return;
    }
    const replacementGroup = { ...importedGroup, ...CBGroupActions.lockUnit(group), id: group.id,
      lockSyncedVersion: group.lockSyncedVersion };

    state.groups = state.groups.map((item) => (item.id === group.id ? replacementGroup : item));
    state.drafts[group.id] = groupToDraft(replacementGroup);
    state.usageTimersMs[group.id] = 0;
    state.usageResetAtMs[group.id] = Date.now();
    delete state.usageBucketsMs[group.id];
    delete state.groupSnoozes[group.id];
    state.groupSnoozeTotalsMs[group.id] = 0;

    await persistState(t("status.importedGroup", { name: replacementGroup.name }));
    render();
  } catch (error) {
    console.error("Failed to import block group.", error);
    setStatus(error?.message || t("status.errorImportGroup"), true);
  }
}

function buildUpdatedGroupFromDraft(group, draft, { strict = true } = {}) {
  // Strict mode (export/transfer) throws on the first invalid field, as before.
  // Non-strict mode (autosave / exit flush) never throws: invalid fields keep
  // their last-valid value while every valid field — crucially the Tags field —
  // still gets committed. The first error is returned so the UI can surface it.
  // This is what makes tags as durable as the other fields: an unrelated
  // mid-edit field (e.g. a blank name) can no longer discard the whole update.
  let firstError = null;
  const fail = (error) => {
    if (strict) throw error;
    if (!firstError) firstError = error;
  };

  let name = draft.name.trim();

  if (!name) {
    fail(new Error(t("status.invalidName")));
    name = group.name;
  }

  // Names must be unique per endpoint (the web-app bridge links groups by name).
  const nameClash = state.groups.some(
    (other) =>
      other.id !== group.id && (other.name || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (nameClash) {
    fail(new Error(t("status.duplicateName")));
    name = group.name;
  }

  const mode = normalizeBlockingMode(draft.mode);
  const allowedMinutes = parseAllowedMinutes(draft.allowedMinutes);
  const resetIntervalHours = parseResetIntervalHours(draft.resetIntervalHours);
  const resetAtMidnight = draft.resetAtMidnight === true;
  const rollingLimit = draft.rollingLimit === true;
  const allowSnooze = Boolean(draft.allowSnooze);
  const snoozeMinutes = parseSnoozeMinutes(draft.snoozeMinutes);
  const snoozeActivationDelayMinutes = parseSnoozeDelayMinutes(draft.snoozeActivationDelayMinutes);
  const snoozeCooldownMinutes = parseSnoozeCooldownMinutes(draft.snoozeCooldownMinutes);
  const snoozeConfirmations = parseSnoozeConfirmations(draft.snoozeConfirmations);
  const pauseSeconds = parsePauseSeconds(draft.pauseSeconds);
  if (pauseSeconds === null && draft.pageAction === "pause") {
    fail(new Error(t("status.invalidPauseSeconds")));
  }
  const timeWindows = parseTimeWindowsText(draft.timeWindowsText);
  const siteResults = parseSiteTextareaValue(draft.sitesText);
  const authorResults = parsePlatformAuthorsTextarea(group.groupType, draft.sourcesText);
  const authorMode = normalizeSourceMode(draft.sourceMode, authorResults.validAuthors);
  const discordResults = parseDiscordTargetsTextarea(draft.discordTargetsText);
  const discordMode = normalizeDiscordMode(draft.discordMode, discordResults.validTargets);
  const blockingRulesText = draft.blockingRulesText?.trim() ?? "";
  const isCustomGroup = group.groupType === "custom";
  const nextMode = isCustomGroup ? "instant" : mode;

  if (nextMode === "after-minutes" && allowedMinutes === null) {
    fail(new Error(t("status.invalidAllowedMinutes")));
  }

  if (isTimedBlockingMode(nextMode) && resetIntervalHours === null) {
    fail(new Error(t("status.invalidResetHours")));
  }

  if (snoozeMinutes === null) {
    fail(new Error(t("status.invalidSnoozeMinutes")));
  }

  if (snoozeActivationDelayMinutes === null) {
    fail(new Error(t("status.invalidSnoozeActivationDelay")));
  }

  if (snoozeCooldownMinutes === null) {
    fail(
      new Error(t("status.invalidSnoozeCooldown", { max: formatHours(MAX_SNOOZE_COOLDOWN_MINUTES) }))
    );
  }

  if (snoozeConfirmations === null) {
    fail(new Error(t("status.invalidSnoozeConfirmations")));
  }

  if (timeWindows.invalidLines.length > 0) {
    fail(new Error(t("status.invalidTimeWindows", { list: timeWindows.invalidLines.join(", ") })));
  }

  // The website list belongs to the Websites entry, the app list to Apps.
  const entryKey = activeEntryKey(group);
  const usesSiteList = entryKey === "site";

  if (usesSiteList && siteResults.invalidSites.length > 0) {
    fail(new Error(t("status.invalidSites", { list: siteResults.invalidSites.join(", ") })));
  }

  const usesAuthorAxis = isPlatformAuthorGroupType(group.groupType);

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
      resetAtMidnight: isCustomGroup ? group.resetAtMidnight === true : resetAtMidnight,
      rollingLimit: isCustomGroup ? group.rollingLimit === true : rollingLimit,
      allowSnooze,
      snoozeMinutes: snoozeMinutes ?? group.snoozeMinutes,
      snoozeActivationDelayMinutes:
        snoozeActivationDelayMinutes ?? group.snoozeActivationDelayMinutes,
      snoozeCooldownMinutes: snoozeCooldownMinutes ?? group.snoozeCooldownMinutes,
      snoozeConfirmations: snoozeConfirmations ?? group.snoozeConfirmations,
      activeDays: isCustomGroup
        ? group.activeDays
        : draft.activeDays.filter((day) => DAY_NAMES.includes(day)),
      timeWindowsText: isCustomGroup
        ? group.timeWindowsText
        : timeWindows.invalidLines.length > 0
          ? group.timeWindowsText
          : timeWindows.normalizedLines.join("\n"),
      platformVideoMode: normalizeVideoMode(draft.platformVideoMode),
      sourceMode: authorMode,
      sources: usesAuthorAxis ? authorResults.validAuthors : group.sources,
      platformTagMode: isTagFilterCompatible(group.groupType)
        ? normalizeTagFilterModeChoice(draft.platformTagMode)
        : group.platformTagMode,
      platformTags: isTagFilterCompatible(group.groupType)
        ? parseTagListTextarea(draft.platformTagsText)
        : group.platformTags,
      platformTagDefaultConfidence: clampTagFilterConfidence(draft.platformTagDefaultConfidence, 4),
      platformTagBlockUntagged: Boolean(draft.platformTagBlockUntagged),
      platformTagBlockPage: draft.platformTagBlockPage !== false,
      platformTagCoverUntilTagged: draft.platformTagCoverUntilTagged === true,
      platformTagEffect: draft.platformTagEffect === "block" ? "block" : "dim",
      surfaceHides: normalizeSurfaceHides(
        Array.isArray(draft.surfaceHides) ? draft.surfaceHides : group.surfaceHides,
        group.groupType
      ),
      discordTargets:
        group.groupType === "discord" ? discordResults.validTargets : group.discordTargets,
      discordMode: group.groupType === "discord" ? discordMode : group.discordMode,
      blockingRulesText: isCustomGroup ? blockingRulesText : group.blockingRulesText,
      sites: usesSiteList ? siteResults.validSites : [],
      // Blocklist (false) vs "block all except" (true).
      allowlist: usesSiteList ? Boolean(draft.allowlist) : false,
      apps: entryKey === "apps" ? parseAppsData(draft.appsData) : [],
      appsAllowlist: entryKey === "apps" ? Boolean(draft.appsAllowlist) : false,
      blockHomePage: Boolean(draft.blockHomePage),
      // Custom groups redirect via setRedirectLink() inside the rule;
      // strip any legacy fallbackUrl on save.
      fallbackUrl: isCustomGroup
        ? ""
        : typeof draft.fallbackUrl === "string"
        ? draft.fallbackUrl.trim()
        : "",
      pageAction: !isCustomGroup && draft.pageAction === "pause" ? "pause" : "block",
      pauseSeconds: isCustomGroup ? group.pauseSeconds : pauseSeconds ?? group.pauseSeconds
    },
    modeChanged: nextMode !== group.mode,
    resetIntervalChanged:
      isTimedBlockingMode(nextMode) &&
      !isCustomGroup &&
      ((resetIntervalHours ?? group.resetIntervalHours) !== group.resetIntervalHours ||
        resetAtMidnight !== (group.resetAtMidnight === true) ||
        rollingLimit !== (group.rollingLimit === true)),
    validationError: firstError
  };
}

async function autosaveSelectedGroup() {
  const group = getSelectedGroup();
  const draft = getDraftForGroup(state.selectedGroupId);
  let validationError = null;
  let updatedGroup = null;

  // Fold the draft into state.groups. Non-strict build never throws, so every
  // valid field (including Tags) is committed even when an unrelated field is
  // mid-edit/invalid. The draft is only re-normalized when the whole group is
  // valid, so in-progress invalid text the user is still typing isn't reverted.
  if (group && draft && isGroupEditable(group)) {
    try {
      const result = buildUpdatedGroupFromDraft(group, draft, { strict: false });
      updatedGroup = result.updatedGroup;

      state.groups = state.groups.map((item) =>
        item.id === group.id ? result.updatedGroup : item
      );

      if (result.validationError) {
        validationError = result.validationError;
      } else {
        state.drafts[group.id] = groupToDraft(result.updatedGroup);

        if (
          isTimedBlockingMode(result.updatedGroup.mode) &&
          (result.modeChanged || result.resetIntervalChanged)
        ) {
          state.usageResetAtMs[group.id] = Date.now();
          state.usageTimersMs[group.id] = 0;
          delete state.usageBucketsMs[group.id];
        }
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

  if (draggedIndex === -1 || !Number.isInteger(insertIndex) || !isGroupEditable(state.groups[draggedIndex])) {
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

// Freeze (unlocked) or make the freeze stricter (frozen): the wait field's
// hours are the wait gate; a PIN is set in the guardian settings (gear).
async function applyFreeze() {
  const group = getSelectedGroup();
  if (!group || refuseWhileMacVaultAway(group)) return;
  await flushAutosave();
  const current = getSelectedGroup();
  const now = Date.now();
  if (!CBGroupActions.isLocked(current)) {
    const hours = CBGroupActions.parseWaitHours(lockWaitHoursField.value);
    if (hours === null) {
      setStatus(t("status.strictFreezeHours", { max: CBGroupActions.MAX_WAIT_HOURS }), true);
      return;
    }
    const result = CBGroupActions.lock({ ...current, lockWaitHours: hours }, now);
    await persistGroupFields(current.id, CBGroupActions.lockUnit(result.group), t("status.frozen", { name: current.name }));
    return;
  }
  const result = CBGroupActions.tighten(current, { waitHours: lockWaitHoursField.value });
  if (result.error) {
    setStatus(result.error === "not-stricter" ? t("freeze.notStricter") : t("status.strictFreezeHours", { max: CBGroupActions.MAX_WAIT_HOURS }), true);
    render();
    return;
  }
  await persistGroupFields(current.id, CBGroupActions.lockUnit(result.group), t("freeze.tightened"));
}

// Unfreeze passes every gate of the lock: its wait, its PIN (when set), then
// the confirmation — always (owner 2026-09-26).
function openUnfreezeFlow() {
  const group = getSelectedGroup();
  if (!group || refuseWhileMacVaultAway(group)) return;
  const plan = CBGroupActions.unlockPlan(group, Date.now());
  if (plan.error) {
    if (plan.waitUntilMs) setStatus(t("status.strictLocked"), true);
    render();
    return;
  }
  const startConfirmation = () => {
    state.unfreezeFlow = {
      kind: "unfreeze",
      groupId: group.id,
      lockVersion: group.lockVersion,
      label: group.name,
      confirmationsLeft: UNFREEZE_CONFIRMATIONS_REQUIRED,
      nextAllowedAtMs: Date.now() + UNFREEZE_CONFIRMATION_INTERVAL_MS
    };
    if (state.confirmIntervalId !== null) window.clearInterval(state.confirmIntervalId);
    state.confirmIntervalId = window.setInterval(() => renderUnfreezeModal(), 250);
    renderUnfreezeModal();
  };
  if (!plan.needsPin) {
    startConfirmation();
    return;
  }
  openPinEntry({
    title: t("freeze.pin.unfreezeTitle"),
    description: t("freeze.pin.unfreezePrompt"),
    onSubmit: async (pin) => {
      if (!(await checkParentalPin(group, pin))) return false;
      startConfirmation();
      return true;
    }
  });
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
function openPinEntry({ title, description, onSubmit, onCancel }) {
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
        if (typeof onCancel === "function") onCancel();
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

// Guardian settings overlay: set / verify / clear the group's password.
function openParentalSettings(group) {
  if (refuseWhileMacVaultAway(group)) return;
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
      // Clearing the PIN loosens the lock: only while unfrozen.
      if (!CBGroupActions.isLocked(currentGroup())) {
        controls.push({ id: "settings-clear", type: "button", label: t("freeze.settings.clear") });
      }
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
      // A PIN on a frozen group makes it stricter; on an unfrozen one it is
      // a gate the next freeze will carry.
      const pinFields = await CBParentalPin.newPinFields(pin);
      const result = CBGroupActions.isLocked(g)
        ? CBGroupActions.tighten(g, { pinFields })
        : CBGroupActions.setGates(g, { pinFields });
      if (result.error) {
        setStatus(t("status.frozenCannotChange"), true);
        return;
      }
      await persistGroupFields(g.id, CBGroupActions.lockUnit(result.group), t("freeze.settings.saved"));
      rebuild();
      return;
    }
    if (id === "settings-verify") {
      if (await checkParentalPin(g, pin)) setStatus(t("freeze.settings.verifyOk"), false);
      return;
    }
    if (id === "settings-clear") {
      if (!(await checkParentalPin(g, pin))) return;
      const result = CBGroupActions.setGates(currentGroup(), { pinFields: null });
      if (result.error) {
        setStatus(t("status.frozenCannotChange"), true);
        return;
      }
      await persistGroupFields(g.id, CBGroupActions.lockUnit(result.group), t("freeze.settings.cleared"));
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

function showSnoozeNotice(group, snoozeEntry, totalBeforeMs) {
  const activationDelayMs = Math.max(0, snoozeEntry.startsAtMs - Date.now());
  cbDialog.alert(
    t("snooze.noticePopup", {
      name: group.name,
      total: formatDurationMs(totalBeforeMs),
      upcoming: formatDurationMs(snoozeEntry.untilMs - snoozeEntry.startsAtMs),
      delay: formatDurationMs(activationDelayMs)
    }),
    { confirmText: t("modal.confirm") }
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
      const passed = state.unfreezeFlow.pinHashes || [];
      closeUnfreezeFlow();
      if (!deleteAllStillCovered(passed)) {
        setStatus(t("status.bulkDeleteStrictLocked"), true);
        render();
        return;
      }
      await clearAllGroups();
      return;
    }

    if (state.unfreezeFlow.kind === "snooze") {
      const group = state.groups.find((item) => item.id === state.unfreezeFlow.groupId);
      closeUnfreezeFlow();
      if (group) await applySnoozeStart(group);
      return;
    }

    const group = state.groups.find((item) => item.id === state.unfreezeFlow.groupId);

    if (!group) {
      closeUnfreezeFlow();
      return;
    }

    // The lock changed meanwhile (made stricter, or relocked elsewhere):
    // this confirmation was for the old one.
    if (group.lockVersion !== state.unfreezeFlow.lockVersion || CBGroupActions.unlockPlan(group, now).error) {
      closeUnfreezeFlow();
      render();
      return;
    }
    closeUnfreezeFlow();
    await persistGroupFields(group.id, CBGroupActions.lockUnit(CBGroupActions.unlock(group)), t("status.unfrozen", { name: group.name }));
    return;
  }

  state.unfreezeFlow.confirmationsLeft -= 1;
  state.unfreezeFlow.nextAllowedAtMs = now + UNFREEZE_CONFIRMATION_INTERVAL_MS;
  renderUnfreezeModal();
}

async function startSnooze() {
  let group = getSelectedGroup();

  if (!group || refuseWhileMacVaultAway(group)) {
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

  // The rules are group-actions.js; the snooze uses the group's SAVED
  // settings (the autosave above), the same ones the cover and linked devices use.
  const plan = CBGroupActions.snoozePlan(group, state.groupSnoozes[group.id], Date.now());
  if (plan.error) {
    showSnoozeInProgress(currentSnooze, currentSnoozePhase);
    return;
  }
  setSnoozeWarning("");
  if (plan.confirmations === 0) {
    await applySnoozeStart(group);
    return;
  }

  state.unfreezeFlow = {
    kind: "snooze",
    groupId: group.id,
    label: group.name,
    confirmationsLeft: plan.confirmations,
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

function showSnoozeInProgress(entry, phase) {
  const now = Date.now();
  if (phase === "pending") {
    setSnoozeWarning(t("snooze.warning.pending", { time: formatDurationMs(entry.startsAtMs - now) }));
  } else if (phase === "active") {
    setSnoozeWarning(t("snooze.warning.active", { time: formatDurationMs(entry.untilMs - now) }));
  } else if (phase === "cooldown") {
    setSnoozeWarning(t("snooze.warning.cooldown", { time: formatDurationMs(entry.cooldownUntilMs - now) }));
  }
}

// Starts the snooze after its confirmation. The plan is taken again here: a
// snooze started meanwhile (the cover, a linked device) is not replaced.
async function applySnoozeStart(group) {
  const now = Date.now();
  const current = state.groupSnoozes[group.id];
  if (CBGroupActions.snoozePlan(group, current, now).error) {
    showSnoozeInProgress(current, getSnoozePhase(current, now));
    render();
    return;
  }
  const totalBeforeMs = Math.max(0, Number(state.groupSnoozeTotalsMs[group.id]) || 0);
  const snoozeEntry = CBGroupActions.snoozeEntry(group, now);
  state.groupSnoozes[group.id] = snoozeEntry;
  const minutes = Number(group.snoozeMinutes) || 0;
  await persistState(
    snoozeEntry.startsAtMs > now
      ? t("status.snoozeScheduled", { name: group.name, delay: formatDurationMs(snoozeEntry.startsAtMs - now) })
      : t("status.snoozed", { name: group.name, minutes, suffix: minutes === 1 ? "" : "s" })
  );
  render();
  showSnoozeNotice(group, snoozeEntry, totalBeforeMs);
}

async function endSnooze() {
  const group = getSelectedGroup();
  if (!group || refuseWhileMacVaultAway(group)) return;
  // Ending keeps an ENDED entry (stamped now) so the end reaches linked
  // devices as the newest change (group-actions.js).
  const result = CBGroupActions.endSnoozeEntry(state.groupSnoozes[group.id], Date.now());
  if (result.error) return;
  state.groupSnoozes[group.id] = result.entry;
  state.groupSnoozeTotalsMs[group.id] = Math.max(0, Number(state.groupSnoozeTotalsMs[group.id]) || 0) + result.activeMs;
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

  if (changes.cbClusterCopy) {
    state.linkCopy = Array.isArray(changes.cbClusterCopy.newValue) ? changes.cbClusterCopy.newValue : [];
    render();
  }

  if (changes[USAGE_TIMERS_KEY]) {
    state.usageTimersMs = sanitizeUsageTimers(changes[USAGE_TIMERS_KEY].newValue, state.groups);
    shouldRenderDynamicOnly = true;
  }

  if (changes[USAGE_RESET_AT_KEY]) {
    state.usageResetAtMs = sanitizeResetTimes(changes[USAGE_RESET_AT_KEY].newValue, state.groups);
    shouldRenderDynamicOnly = true;
  }

  if (changes[USAGE_BUCKETS_KEY]) {
    state.usageBucketsMs = sanitizeUsageBuckets(changes[USAGE_BUCKETS_KEY].newValue, state.groups);
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

  if (changes[QUICK_ADD_GROUP_KEY]) {
    state.quickAddGroupId = typeof changes[QUICK_ADD_GROUP_KEY].newValue === "string" ? changes[QUICK_ADD_GROUP_KEY].newValue : "";
    renderGroupList();
  }

  if (
    changes[BLOCKED_GROUPS_KEY] &&
    Date.now() > state.suppressGroupStorageUpdatesUntil
  ) {
    state.groups = sanitizeGroups(changes[BLOCKED_GROUPS_KEY].newValue);
    // What the user is typing survives a change made elsewhere (a linked
    // device, the "+", an AI tool): their edit is the latest, so it wins.
    const typing = isUserEditing() ? state.drafts[state.selectedGroupId] : null;
    state.drafts = {};
    if (typing && state.groups.some((group) => group.id === state.selectedGroupId)) {
      state.drafts[state.selectedGroupId] = typing;
    }
    if (!state.groups.some((group) => group.id === state.selectedGroupId)) {
      state.selectedGroupId = state.groups[0]?.id ?? null;
    }
    render();
    // A group edited outside this editor (the quick-add "+", an AI tool, the
    // desktop app) is shared with linked members like an edit made here.
    announceGroups();
    syncAllClusters();
    return;
  }

  if (shouldRenderDynamicOnly) {
    renderDynamicView();
  }
}

// A rename reaches linked devices when it is finished (Enter or leaving the
// field), not letter by letter: a half-typed name would unlink the group or
// link it to another group on the way.
function announcedName(group) {
  return state.nameEditing && state.nameEditing.id === group.id ? state.nameEditing.name : group.name;
}

async function commitNameEdit() {
  if (!state.nameEditing) return;
  state.nameEditing = null;
  await flushAutosave();
  announceGroups();
  syncAllClusters();
}

groupNameField.addEventListener("focus", () => {
  const group = getSelectedGroup();
  if (group && !state.nameEditing) state.nameEditing = { id: group.id, name: group.name };
});
groupNameField.addEventListener("blur", () => { void commitNameEdit(); });
groupNameField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") void commitNameEdit();
});

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

for (const field of [resetAtMidnightField, rollingLimitField]) {
  field.addEventListener("change", () => {
    stashCurrentDraft();
    updateUsageSummary(getSelectedGroup(), getDraftForGroup(state.selectedGroupId));
    scheduleAutosave();
  });
}

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
  const reference =
    typeof globalThis.CUSTOM_RULE_AI_REFERENCE === "string" &&
    globalThis.CUSTOM_RULE_AI_REFERENCE.trim()
      ? globalThis.CUSTOM_RULE_AI_REFERENCE
      : "CUSTOM_RULE_API_REFERENCE_UNAVAILABLE";

  return [
    "TASK: Generate a Custom-rule source for Adamancia Vault.",
    "OUTPUT_CONTRACT: Return exactly one fenced javascript code block containing the complete source. Do not include prose, pseudocode, placeholders, imports, or markdown outside that one code block.",
    "QUALITY_CONTRACT: Implement the user's request with the current API reference below. Preserve useful behaviour from the current rule only when it does not conflict with the user's request. Never invent API methods.",
    "CUSTOM_RULE_API_REFERENCE_BEGIN",
    reference,
    "CUSTOM_RULE_API_REFERENCE_END",
    "USER_REQUEST_BEGIN",
    demand,
    "USER_REQUEST_END",
    "CURRENT_RULE_BEGIN",
    existingRule,
    "CURRENT_RULE_END",
    "Return the final JavaScript source now."
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
        runCustomGroupStatus.textContent = t("custom.runStatusHalted");
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

// ── Classifier tag-name suggestions ──────────────────────────────────────
// Clickable chips under a tag-list textarea, fed by the classifier's own
// taxonomy for that platform (so a filter names tags that actually exist — a
// typo'd tag silently never matches). Hidden when the classifier is unreachable.
const tagNameCache = new Map(); // platform -> { at, names }
const TAG_NAME_CACHE_MS = 60_000;
function fetchClassifierTagNames(platform) {
  const cached = tagNameCache.get(platform);
  if (cached && Date.now() - cached.at < TAG_NAME_CACHE_MS) return Promise.resolve(cached.names);
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "vault-classifier-tag-names", platform }, (response) => {
        const failed = chrome.runtime.lastError || !response || response.ok !== true;
        const names = !failed && Array.isArray(response.names) ? response.names.filter((n) => typeof n === "string" && n) : [];
        if (!failed) tagNameCache.set(platform, { at: Date.now(), names });
        resolve(names);
      });
    } catch (_) {
      resolve([]);
    }
  });
}
function usedTagNames(textarea) {
  const used = new Set();
  for (const entry of parseTagListTextarea(textarea?.value || "")) {
    for (const name of [entry.name, ...(entry.also || [])]) used.add(name.toLowerCase());
  }
  return used;
}
function renderTagSuggestions(container, textarea, names) {
  if (!container || !textarea) return;
  container.replaceChildren();
  container.classList.toggle("hidden", names.length === 0);
  if (names.length === 0) return;
  const label = document.createElement("span");
  label.className = "tag-suggestions-label";
  label.textContent = t("tagFilter.available");
  container.appendChild(label);
  const used = usedTagNames(textarea);
  for (const name of names) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = name;
    const isUsed = used.has(name.toLowerCase());
    chip.classList.toggle("used", isUsed);
    chip.disabled = isUsed;
    chip.addEventListener("click", () => {
      const current = textarea.value.replace(/\s+$/, "");
      textarea.value = current ? `${current}\n${name}` : name;
      // Fire the same event typing would, so drafts/autosave react.
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      renderTagSuggestions(container, textarea, names);
    });
    container.appendChild(chip);
  }
}
const tagSuggestionRequests = new WeakMap(); // container -> latest request token
function refreshTagSuggestions(container, textarea, platform) {
  if (!container || !textarea) return;
  const token = {};
  tagSuggestionRequests.set(container, token);
  if (!platform) { renderTagSuggestions(container, textarea, []); return; }
  fetchClassifierTagNames(platform).then((names) => {
    if (tagSuggestionRequests.get(container) !== token) return; // a newer request won
    renderTagSuggestions(container, textarea, names);
  });
}

// Keep chip "used" state live while typing.
function bindTagSuggestions(containerId, textarea, platformOf) {
  const container = document.getElementById(containerId);
  if (!container || !textarea) return;
  textarea.addEventListener("input", () => {
    const cached = tagNameCache.get(platformOf());
    if (cached) renderTagSuggestions(container, textarea, cached.names);
  });
}
bindTagSuggestions("platformTagSuggestions", platformTagsField, () => String(getSelectedGroup()?.groupType || ""));
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

setupPlatformChipInputs();

platformAuthorsField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

platformVideoModeField.addEventListener("change", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

if (groupScopesAdd) {
  groupScopesAdd.addEventListener("change", () => {
    const key = groupScopesAdd.value;
    if (!key) return;
    setGroupPlatformView(key).catch((error) => {
      console.error("Failed to add the platform to the group.", error);
      setStatus(t("status.errorSaveGroup"), true);
      render();
    });
  });
}

platformAuthorModeField.addEventListener("change", () => {
  if (platformAuthorModeField.value === "exclude") {
    setStatus(t("status.allowlistWarning"));
  }
  stashCurrentDraft();
  render();
  renderGroupList();
  scheduleAutosave();
});

// Content-tag filter fields.
if (platformTagModeField) {
  platformTagModeField.addEventListener("change", () => {
    stashCurrentDraft();
    render(); // re-toggles the tag list + untagged row for the new mode
    renderGroupList();
    scheduleAutosave();
  });
}
for (const field of [platformTagsField, platformTagDefaultConfidenceField, platformTagEffectField]) {
  if (!field) continue;
  field.addEventListener("input", () => {
    stashCurrentDraft();
    renderGroupList();
    scheduleAutosave();
  });
}
for (const field of [platformTagBlockUntaggedField, platformTagBlockPageField, platformTagCoverUntilTaggedField]) {
  if (!field) continue;
  field.addEventListener("change", () => {
    stashCurrentDraft();
    scheduleAutosave();
  });
}

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

for (const field of [platformBlockHomePageField, discordBlockHomePageField]) {
  field.addEventListener("change", () => {
    stashCurrentDraft();
    renderGroupList();
    scheduleAutosave();
  });
}

if (siteAllowlistField) {
  siteAllowlistField.addEventListener("change", () => {
    stashCurrentDraft();
    // re-render so the "Blocked websites" / "Allowed websites" label flips.
    render();
    renderGroupList();
    scheduleAutosave();
  });
}

fallbackUrlField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

if (pageActionField) {
  pageActionField.addEventListener("change", () => {
    if (pauseSecondsRow) pauseSecondsRow.classList.toggle("hidden", pageActionField.value !== "pause");
    stashCurrentDraft();
    renderGroupList();
    scheduleAutosave();
  });
}
if (pauseSecondsField) {
  pauseSecondsField.addEventListener("input", () => {
    stashCurrentDraft();
    scheduleAutosave();
  });
}

dayCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    // A group needs at least one day; "never" is what the enable switch is for.
    if (!checkbox.checked && !dayCheckboxes.some((other) => other.checked)) {
      checkbox.checked = true;
      return;
    }
    stashCurrentDraft();
    scheduleAutosave();
  });
});

// The wait gate is a group setting while unfrozen (saved on change); while
// frozen the field only feeds "Make stricter".
lockWaitHoursField.addEventListener("change", () => {
  const group = getSelectedGroup();
  if (!group || CBGroupActions.isLocked(group)) return;
  const hours = CBGroupActions.parseWaitHours(lockWaitHoursField.value);
  if (hours === null) {
    setStatus(t("status.strictFreezeHours", { max: CBGroupActions.MAX_WAIT_HOURS }), true);
    return;
  }
  if (hours === (Number(group.lockWaitHours) || 0)) return;
  const result = CBGroupActions.setGates(group, { waitHours: hours });
  persistGroupFields(group.id, CBGroupActions.lockUnit(result.group), "").catch(() => {});
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
  const settingsAutoSaveFields = [settingsDefaultSnoozeMinutesField, settingsCloseRetrySecondsField];
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

if (classifierCollectionToggle) {
  classifierCollectionToggle.addEventListener("change", () => {
    classifierBridgeStorageSet({ ...classifierBridgeSettings, collectionEnabled: classifierCollectionToggle.checked }).catch(() => {});
  });
}
if (classifierTaggingModeField) {
  classifierTaggingModeField.addEventListener("change", () => {
    classifierBridgeStorageSet({ ...classifierBridgeSettings, taggingMode: classifierTaggingModeField.value }).catch(() => {});
  });
}

if (localFolderChooseButton) {
  localFolderChooseButton.addEventListener("click", () => {
    if (IS_NATIVE_DESKTOP) {
      postToNativeShell({ kind: "local-folder-choose" });
      return;
    }
    chooseLocalFolder().catch((error) => {
      if (localFolderStatus) localFolderStatus.textContent = String(error?.message ?? error);
    });
  });
}

if (localFolderRevokeButton) {
  localFolderRevokeButton.addEventListener("click", () => {
    if (IS_NATIVE_DESKTOP) {
      postToNativeShell({ kind: "local-folder-revoke" });
      return;
    }
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

manualModal.addEventListener("click", (event) => {
  if (event.target === manualModal) {
    closeManual();
  }
});

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

  // Feed entries are tagged with the originating group's id (plus the
  // eventType), never its display name — so filter by id against the
  // selected group. The previous name-based match fell back to eventType
  // (e.g. "load-source"/"webChangedEvent"), which never equals a group
  // name, so every entry was hidden whenever a group was selected.
  const gid = entry.groupId || "";

  const row = document.createElement("div");
  row.className = "log-feed-entry " + (entry.level === "warn" ? "warn" : entry.level === "error" ? "error" : "");
  if (gid) row.setAttribute("data-group-id", gid);
  if (gid && state.selectedGroupId && gid !== state.selectedGroupId) {
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
  for (const row of logFeedList.children) {
    const gid = row.getAttribute("data-group-id") || "";
    if (!gid || !state.selectedGroupId || gid === state.selectedGroupId) {
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
  // The language picker must be usable while translation files are loading.
  populateLanguageOptions();

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
  await chrome.storage.local.set({
    [BLOCKED_GROUPS_KEY]: toStoredGroups(state.groups),
    [GLOBAL_SETTINGS_KEY]: state.globalSettings
  });
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
