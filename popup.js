// A group's policy rules (field defaults and parsers, time windows, budget
// periods, runtime-state sanitizers, global settings): one copy, in
// group-actions.js.
const {
  DAY_NAMES, DEFAULT_GROUP_TYPE, DEFAULT_SNOOZE_CONFIRMATIONS, DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
  DEFAULT_SNOOZE_COOLDOWN_MINUTES, MAX_SNOOZE_COOLDOWN_MINUTES, DEFAULT_PAUSE_SECONDS,
  MS_PER_MINUTE, normalizeBlockingMode, isTimedBlockingMode,
  parseAllowedMinutes, parseResetIntervalHours, parseSnoozeMinutes, parseSnoozeDelayMinutes,
  parseSnoozeCooldownMinutes, parsePauseSeconds, parseSnoozeConfirmations, parseTimeWindowsText,
  cbStartOfDayMs, cbPeriodStartMs, cbNextResetMs, cbPruneUsageBuckets, cbBucketsUsedMs,
  cbNextReturnMs, sanitizeUsageTimers, sanitizeSnoozeTotals, sanitizeResetTimes,
  sanitizeUsageBuckets, sanitizeSnoozes, DEFAULT_GLOBAL_SETTINGS, AUTOSAVE_DEBOUNCE_MAX_MS,
  sanitizeGlobalSettings
} = CBGroupActions;
const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
const USAGE_BUCKETS_KEY = "usageBucketsMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";
const GLOBAL_SETTINGS_KEY = "globalSettings";
// The remembered editor selection is also the quick-add destination.
const QUICK_ADD_GROUP_KEY = "quickAddGroupId";
const LAYOUT_WIDTH_STORAGE_KEY = "custom-blocker-groups-panel-width";
const LANGUAGE_STORAGE_KEY = "custom-blocker-language";
const LANGUAGE_FALLBACKS = Object.freeze({
  en: { label: "English", nativeLabel: "English" },
  zh: { label: "Chinese (Simplified)", nativeLabel: "简体中文" },
  es: { label: "Spanish", nativeLabel: "Español" },
  hi: { label: "Hindi", nativeLabel: "हिन्दी" },
  ar: { label: "Arabic", nativeLabel: "العربية" },
  bn: { label: "Bengali", nativeLabel: "বাংলা" },
  pt: { label: "Portuguese", nativeLabel: "Português" },
  ru: { label: "Russian", nativeLabel: "Русский" },
  ja: { label: "Japanese", nativeLabel: "日本語" },
  pa: { label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  de: { label: "German", nativeLabel: "Deutsch" },
  fr: { label: "French", nativeLabel: "Français" },
  ko: { label: "Korean", nativeLabel: "한국어" },
  tr: { label: "Turkish", nativeLabel: "Türkçe" },
  vi: { label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  it: { label: "Italian", nativeLabel: "Italiano" },
  th: { label: "Thai", nativeLabel: "ไทย" },
  nl: { label: "Dutch", nativeLabel: "Nederlands" },
  pl: { label: "Polish", nativeLabel: "Polski" },
  id: { label: "Indonesian", nativeLabel: "Bahasa Indonesia" }
});
const GROUP_TRANSFER_PREFIX = "custom-blocker-group:v1:";
const LOCAL_FOLDER_DB_NAME = "custom-blocker-local-folder";
const LOCAL_FOLDER_DB_VERSION = 1;
const LOCAL_FOLDER_STORE = "handles";
const LOCAL_FOLDER_ROOT_KEY = "root";
const LOCAL_FOLDER_META_KEY = "metadata";

// Debug-mode-gated console helpers. Mirror the implementation in
// background.js / content.js so every context has the same surface and
// they're all silent by default.
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
  // kind: "alert" (one button), "confirm", "prompt" (a text field), or "show"
  // (a read-only text to copy, one Close button). The surface is the shared
  // .vui-dialog (vault-ui.css), as every section's dialogs.
  function open(opts) {
    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.className = "vui-dialog-backdrop";
      const card = document.createElement("div");
      card.className = "vui-dialog";
      card.setAttribute("role", opts.kind === "alert" ? "alertdialog" : "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-label", opts.title || opts.message || opts.confirmText || "Dialog");
      const opener = document.activeElement;

      if (opts.title) {
        const title = document.createElement("h3");
        title.className = "vui-dialog-title";
        title.textContent = opts.title;
        card.appendChild(title);
      }
      const msg = document.createElement("p");
      msg.className = "vui-dialog-text";
      msg.textContent = opts.message || "";
      card.appendChild(msg);

      let input = null;
      if (opts.kind === "prompt" || opts.kind === "show") {
        input = document.createElement("input");
        input.className = "vui-dialog-field";
        input.type = "text";
        input.readOnly = opts.kind === "show";
        input.value = opts.defaultValue != null ? String(opts.defaultValue) : "";
        const inputRow = document.createElement("div");
        inputRow.className = "vui-info-field";
        if (opts.kind === "prompt") {
          inputRow.dataset.infoKey = "dialog-value";
          inputRow.dataset.infoLabel = opts.title || "Value";
          inputRow.dataset.infoCopy = opts.message || t("info.prompt");
        }
        inputRow.appendChild(input); card.appendChild(inputRow);
      }

      const actions = document.createElement("div");
      actions.className = "vui-dialog-actions";

      let cancelBtn = null;
      if (opts.kind === "confirm" || opts.kind === "prompt") {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "secondary";
        cancelBtn.textContent = opts.cancelText || "Cancel";
        actions.appendChild(cancelBtn);
      }

      const okBtn = document.createElement("button");
      okBtn.type = "button";
      if (opts.danger) okBtn.className = "danger";
      okBtn.textContent = opts.confirmText || "OK";
      actions.appendChild(okBtn);

      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      function done(result) {
        document.removeEventListener("keydown", onKey, true);
        releaseFocus(false);
        overlay.remove();
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        resolve(result);
      }
      function onOk() {
        if (opts.kind === "prompt") done(input ? input.value : "");
        else if (opts.kind === "confirm") done(true);
        else done(undefined);
      }
      function onCancel() { done(opts.kind === "prompt" ? null : opts.kind === "confirm" ? false : undefined); }
      function onKey(e) {
        if (e.key === "Enter" && e.target === input) { e.preventDefault(); onOk(); }
      }

      okBtn.addEventListener("click", onOk);
      if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) onCancel(); });
      document.addEventListener("keydown", onKey, true);

      const releaseFocus = VaultUI.focusDialog(card, { initialFocus: input || okBtn, onEscape: onCancel });
      if (input) input.select();
    });
  }

  return {
    alert: function (message, o) {
      o = o || {};
      return open({ kind: "alert", title: o.title, message: message, confirmText: o.confirmText || "OK" });
    },
    confirm: function (message, o) {
      o = o || {};
      return open({
        kind: "confirm", title: o.title, message: message, danger: !!o.danger,
        confirmText: o.confirmText || "OK", cancelText: o.cancelText || "Cancel"
      });
    },
    prompt: function (message, defaultValue, o) {
      o = o || {};
      return open({
        kind: "prompt", title: o.title, message: message, defaultValue: defaultValue,
        confirmText: o.confirmText || "OK", cancelText: o.cancelText || "Cancel"
      });
    },
    show: function (message, text, o) {
      o = o || {};
      return open({ kind: "show", title: o.title, message: message, defaultValue: text, confirmText: o.closeText || "Close" });
    }
  };
})();


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
  try { ua = navigator.userAgent || ""; } catch (_) {}
  return window.CBBridgeProtocol.browserProgramId(ua);
}

const LOCAL_PROGRAM_ID = detectProgramId();
const IS_NATIVE_DESKTOP = isNativeHost();
// The scope line (owner 2026-09-27): this editor edits only its program's
// lines — Mac Vault the Apps lines, a browser every other line.
const LOCAL_OWNER = IS_NATIVE_DESKTOP ? "desktop" : "browser";
const ownsEntry = (key) => CBGroupScopes.entryOwner(key) === LOCAL_OWNER;
// The desktop app hosts this same editor; `.desktop-only` / `.browser-only`
// markup is shown or hidden by this one class (see popup.css).
document.body.classList.toggle("is-native-desktop", IS_NATIVE_DESKTOP);

// Every unlock and "delete all" ends with this confirmation (group-actions.js).
const UNFREEZE_CONFIRMATIONS_REQUIRED = CBGroupActions.CONFIRMATIONS;
const UNFREEZE_CONFIRMATION_INTERVAL_MS = CBGroupActions.CONFIRM_INTERVAL_MS;
const MIN_GROUP_PANEL_WIDTH = 260;
const MAX_GROUP_PANEL_WIDTH = 760;

const layout = document.getElementById("layout");
const layoutResizer = document.getElementById("layoutResizer");
const groupList = document.getElementById("groupList");
const bulkActionNotice = document.getElementById("bulkActionNotice");
const languageSelect = document.getElementById("languageSelect");
const siteAccessBanner = document.getElementById("siteAccessBanner");
const siteAccessGrantButton = document.getElementById("siteAccessGrantButton");
const siteAccessDismissButton = document.getElementById("siteAccessDismissButton");
const manualButton = document.getElementById("manualButton");
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
const entryOwnerHint = document.getElementById("entryOwnerHint");
const blockedAppsData = document.getElementById("blockedAppsData");
const blockedAppsList = document.getElementById("blockedAppsList");
const appsAllowlistField = document.getElementById("appsAllowlist");
const clearAppsButton = document.getElementById("clearAppsButton");
const appPickerModal = document.getElementById("appPickerModal");
const appPickerSearch = document.getElementById("appPickerSearch");
const appPickerResults = document.getElementById("appPickerResults");
const appPickerEmpty = document.getElementById("appPickerEmpty");
const appPickerCloseButton = document.getElementById("appPickerCloseButton");
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
const snoozeKindRow = document.getElementById("snoozeKindRow");
const snoozeKindField = document.getElementById("snoozeKind");
const snoozeActivationDelayField = document.getElementById("snoozeActivationDelay");
const snoozeCooldownField = document.getElementById("snoozeCooldown");
const snoozeConfirmationsField = document.getElementById("snoozeConfirmations");
const snoozeWarning = document.getElementById("snoozeWarning");
const startSnoozeButton = document.getElementById("startSnoozeButton");
const endSnoozeButton = document.getElementById("endSnoozeButton");
const snoozeNumericFields = document.getElementById("snoozeNumericFields");
const snoozeCustomCopy = document.getElementById("snoozeCustomCopy");
const siteSettingsSection = document.getElementById("siteSettingsSection");
const whenSection = document.getElementById("whenSection");
const editorPanel = document.getElementById("editorPanel");
const editorEmpty = document.getElementById("editorEmpty");
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
const copyCodeDocsButton = document.getElementById("copyCodeDocsButton");
const runCustomGroupStatus = document.getElementById("runCustomGroupStatus");
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
const settingsQuitRetryMinutesField = document.getElementById("settingsQuitRetryMinutes");
const settingsQuickAddField = document.getElementById("settingsQuickAdd");
const localFolderChooseButton = document.getElementById("localFolderChooseButton");
const localFolderRevokeButton = document.getElementById("localFolderRevokeButton");
const localFolderStatus = document.getElementById("localFolderStatus");
let localFolderHandle = null;
const settingsResetButton = document.getElementById("settingsResetButton");
const settingsStatus = document.getElementById("settingsStatus");
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
  // Per group, only the fields the user changed (form text), so a change
  // made elsewhere to any other field shows at once.
  drafts: {},
  // blockedGroups exactly as stored: the editor writes its edited groups into
  // this list (by id), never the whole list from its own view.
  storedGroups: [],
  autosaveTimeoutId: null,
  confirmIntervalId: null,
  unfreezeFlow: null,
  isManualOpen: false,
  manualCache: {},
  manualKind: "user",
  manualSection: "",
  manualLoadRevision: 0,
  // The worker's copy of this browser's links (cbClusterCopy), for isEnforceOnly.
  linkCopy: [],
  // Every program's groups ({program: [{id, name, frozen}]}), for the Link picker.
  linkRosters: {},
  nameEditing: null,
  panelWidth: 300,
  language: "en",
  translationMessages: {},
  translationLoadPromises: {},
  // The hub connection, pushed by the browser's worker (Mac Vault's editor
  // runs inside the hub and needs none). Never persisted.
  connectionStatus: { state: "off" },
  // The links (hub-owned; never persisted here): a group is linked when a
  // link lists {program: LOCAL_PROGRAM_ID, groupId: <its id>}. Each entry:
  //   { id, groupName, members: [{ program, groupId, online, contributed }], shared }
  clusters: [],
  // Serialized last-applied cluster list, so repeated identical pushes (the Mac
  // hub re-pushes every second) don't trigger needless re-renders.
  clustersLastJSON: "",
  quickAddGroupId: ""
};

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

window.VaultLoadMessages = ensureLanguageMessages;

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

async function fetchManualMarkdown(languageCode, kind = "user") {
  const candidates = languageCode === "en" ? ["en"] : [languageCode, "en"];
  for (const candidate of candidates) {
    const cacheKey = `${kind}:${candidate}`;
    if (state.manualCache[cacheKey]) return state.manualCache[cacheKey];
    try {
      const response = await fetch(chrome.runtime.getURL(`${kind === "code" ? "code-manual" : "manual"}/${candidate}.md`));
      if (!response.ok) continue;
      const markdown = await response.text();
      state.manualCache[cacheKey] = markdown;
      return markdown;
    } catch {}
  }
  throw new Error(t("manual.error"));
}

async function loadManualContent() {
  const revision = ++state.manualLoadRevision;
  const kind = state.manualKind, section = state.manualSection, language = state.language;
  manualStatus.textContent = t("manual.loading");
  manualContent.innerHTML = "";

  try {
    const markdown = await fetchManualMarkdown(language, kind);
    if (revision !== state.manualLoadRevision || !state.isManualOpen) return;
    manualStatus.textContent = "";
    let html = renderMarkdownToHtml(markdown);
    if (state.language && state.language !== "en") {
      html = `<blockquote class="mt-banner">${escapeHtml(t("manual.mtBanner"))}</blockquote>${html}`;
    }
    manualContent.innerHTML = html;
    document.getElementById("manualDialogTitle").textContent = t(kind === "code" ? "manual.codeTitle" : "manual.title");
    const headings = Array.from(manualContent.querySelectorAll("h2, h3"));
    let heading = headings.find((node) => node.textContent === section);
    if (!heading && section) {
      // Scene links use stable English section names. Localized headings keep
      // the source guide's heading order, so translated titles can still scroll.
      const source = await fetchManualMarkdown("en", kind);
      if (revision !== state.manualLoadRevision || !state.isManualOpen) return;
      const names = [...source.matchAll(/^#{2,3}\s+(.+)$/gm)].map(match => match[1].trim());
      const index = names.indexOf(section);
      if (index >= 0) heading = headings[index];
    }
    if (heading) heading.scrollIntoView({ block: "start" });
    else manualContent.scrollTop = 0;
  } catch (error) {
    if (revision !== state.manualLoadRevision || !state.isManualOpen) return;
    manualStatus.textContent = error?.message || t("manual.error");
    manualContent.innerHTML = "";
  }
}

// Each modal owns one focus lifecycle; timer/state updates never re-open it.
const modalFocusReleases = new Map();
function focusVaultModal(modal, initialFocus, onEscape) {
  if (modalFocusReleases.has(modal)) return;
  let opener = document.activeElement;
  while (opener?.shadowRoot?.activeElement) opener = opener.shadowRoot.activeElement;
  const openerRoot = opener?.getRootNode();
  const returnFocus = () => {
    if (opener?.isConnected) return opener;
    if (opener?.id) return openerRoot?.getElementById(opener.id);
    if (opener?.dataset?.action === "openManual") return openerRoot?.querySelector('[data-action="openManual"]');
    return null;
  };
  modalFocusReleases.set(modal, VaultUI.focusDialog(modal.querySelector(".modal-card"), { initialFocus, onEscape, returnFocus }));
}
function releaseVaultModal(modal) {
  if (!modalFocusReleases.has(modal)) return;
  VaultUI.close();
  VaultInfo.close();
  modalFocusReleases.get(modal)?.();
  modalFocusReleases.delete(modal);
}

function openManual(kind = "user", section = "") {
  state.manualKind = kind === "code" ? "code" : "user";
  state.manualSection = section;
  state.isManualOpen = true;
  manualModal.classList.remove("hidden");
  focusVaultModal(manualModal, manualCloseButton, closeManual);
  loadManualContent().catch((error) => {
    manualStatus.textContent = error?.message || t("manual.error");
  });
}

window.VaultManual = { open: openManual };
manualContent.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  const href = link.getAttribute("href");
  const companion = href?.match(/^\.\.\/(code-manual|manual)\/([a-z]{2})\.md$/);
  if (companion && Object.hasOwn(getAvailableLanguages(), companion[2])) {
    event.preventDefault();
    openManual(href.startsWith("../code-") ? "code" : "user");
  }
});

function closeManual() {
  state.isManualOpen = false;
  manualModal.classList.add("hidden");
  releaseVaultModal(manualModal);
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

async function safariLocalFolderRequest(type) {
  const host = window.CBLocalHubEnvironment?.current?.nativeHost || "com.adamancia.vault.safari";
  const response = await chrome.runtime.sendNativeMessage(host, { type });
  if (!response || !response.ok) throw new Error(response?.error || "local-folder-not-available");
  window.__cbLocalFolderStatus(response);
}

async function renderLocalFolderStatus() {
  if (!localFolderStatus) return;
  // Desktop: the folder grant is native (the web view has no directory picker);
  // ask the host for the current grant and let __cbLocalFolderStatus render it.
  if (IS_NATIVE_DESKTOP) {
    postToNativeShell({ kind: "local-folder-status" });
    return;
  }
  if (LOCAL_PROGRAM_ID === "safari") {
    try { await safariLocalFolderRequest("local-folder-status"); }
    catch (error) { localFolderStatus.textContent = String(error?.message || error); }
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
  if (LOCAL_PROGRAM_ID === "safari") return safariLocalFolderRequest("local-folder-choose");
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
  if (LOCAL_PROGRAM_ID === "safari") return safariLocalFolderRequest("local-folder-revoke");
  await localFolderDbDelete(LOCAL_FOLDER_ROOT_KEY);
  await localFolderDbDelete(LOCAL_FOLDER_META_KEY);
  localFolderHandle = null;
  await renderLocalFolderStatus();
}

// The worker pushes the live connection status here.
function applyConnectionStatus(raw) {
  const incoming = raw && typeof raw === "object" ? raw : {};
  const wasOnline = bridgeIsOnline();
  const wasAway = desktopVaultAway();
  state.connectionStatus = {
    received: true,
    state: typeof incoming.state === "string" ? incoming.state : "off",
    hubProgram: window.CBBridgeProtocol.hubProgramFromStatus(incoming)
  };
  // Linked groups turn enforce-only (or editable again) with the desktop Vault.
  if (wasAway !== desktopVaultAway()) render();
  if (!wasOnline && bridgeIsOnline()) requestClusters();
}

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
// Links: the user links a group with a group of another program (Link /
// Unlink, below); the hub owns the links, this layer shows them.
// ---------------------------------------------------------------------------

function bridgeIsOnline() {
  const s = state.connectionStatus || {};
  return s.state === "connected";
}

// The link (if any) this group belongs to, by this program's pinned group id.
function groupConnectionCluster(group) {
  return window.CBBridgeProtocol.clusterForGroup(state.clusters, group, LOCAL_PROGRAM_ID);
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

function applyClusters(list, rosters) {
  const incoming = Array.isArray(list) ? list : Array.isArray(list?.clusters) ? list.clusters : [];
  const nextRosters = rosters ?? list?.rosters;
  if (nextRosters && typeof nextRosters === "object" && JSON.stringify(nextRosters) !== JSON.stringify(state.linkRosters)) {
    state.linkRosters = nextRosters;
    state.clustersLastJSON = "";
  }
  const incomingJSON = JSON.stringify(incoming);
  if (incomingJSON === state.clustersLastJSON) return;
  state.clustersLastJSON = incomingJSON;
  // Membership only: what a link shares is adopted into storage by the service
  // worker / Mac Vault, and the editor shows it from there.
  state.clusters = incoming;
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
    const key = "offline:" + cluster.id;
    if (cluster.allOnline === false) {
      warnBridgeOnce(key, t("connectionGroup.warnMemberOffline"));
    } else {
      clearBridgeWarn(key);
    }
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

// ── Link / Unlink (owner 2026-09-27: links are made by the user, never by
// names). A group links with a group of another program; the link shares the
// whole definition and the name. On unlink both keep the settings and each
// keeps its own program's lines. The service worker / Mac Vault carry it out.
const groupLinkSection = document.getElementById("groupLinkSection");
const groupLinkStatus = document.getElementById("groupLinkStatus");
const groupLinkTarget = document.getElementById("groupLinkTarget");
const groupLinkButton = document.getElementById("groupLinkButton");
const groupUnlinkButton = document.getElementById("groupUnlinkButton");

function programLabel(program) {
  const labels = { macapp: "Mac Vault", windowsapp: "Windows Vault", chrome: "Chrome", edge: "Edge", firefox: "Firefox", opera: "Opera", safari: "Safari" };
  return labels[program] || program;
}

// Groups of other programs that are in no link yet.
function linkCandidates() {
  const linked = new Set();
  for (const cluster of state.clusters || []) {
    for (const member of cluster?.members || []) if (member?.groupId) linked.add(`${member.program}␟${member.groupId}`);
  }
  const out = [];
  for (const [program, groups] of Object.entries(state.linkRosters || {})) {
    if (program === LOCAL_PROGRAM_ID || program === "classifier") continue;
    for (const entry of Array.isArray(groups) ? groups : []) {
      if (!entry?.id || entry.frozen || linked.has(`${program}␟${entry.id}`)) continue;
      out.push({ program, id: entry.id, name: entry.name || "" });
    }
  }
  return out;
}

function renderLinkSection(group, editable) {
  if (!groupLinkSection) return;
  const cluster = groupConnectionCluster(group);
  // The Mac editor runs inside the hub itself: always reachable there.
  const hubOnline = IS_NATIVE_DESKTOP || (bridgeIsOnline() && !desktopVaultAway());
  if (cluster) {
    const others = (cluster.members || []).filter((m) => m && m.program !== LOCAL_PROGRAM_ID);
    groupLinkStatus.textContent = t("link.linkedWith", {
      names: others.map((m) => t("link.candidate", { name: cluster.groupName, program: programLabel(m.program) })).join(", ")
    });
    groupLinkTarget.classList.add("hidden");
    groupLinkButton.classList.add("hidden");
    groupUnlinkButton.classList.remove("hidden");
    groupUnlinkButton.disabled = !editable || !hubOnline;
    return;
  }
  const candidates = linkCandidates();
  groupLinkStatus.textContent = t(candidates.length > 0 || !hubOnline ? "link.none" : "link.noCandidates");
  const current = groupLinkTarget.value;
  const choices = [["", t("link.pickPlaceholder")], ...candidates.map(candidate => [`${candidate.program}␟${candidate.id}`, t("link.candidate", { name: candidate.name, program: programLabel(candidate.program) })])];
  window.VaultUI.setSelectOptions(groupLinkTarget, choices, choices.some(choice => choice[0] === current) ? current : "");
  groupLinkTarget.classList.remove("hidden");
  groupLinkButton.classList.remove("hidden");
  groupUnlinkButton.classList.add("hidden");
  groupLinkTarget.disabled = !editable || !hubOnline || candidates.length === 0;
  groupLinkButton.disabled = groupLinkTarget.disabled || !groupLinkTarget.value;
}

function showLinkRefusal(reason) {
  const key = `link.refused.${String(reason || "")}`;
  const text = t(key);
  setStatus(text && text !== key ? text : t("link.refused.generic"), true);
}

// The Mac editor's native host reports a refused link here.
window.__cbLinkRefused = showLinkRefusal;

async function sendLinkRequest(message) {
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (response && response.ok === false) showLinkRefusal(response.error);
  } catch (_) {
    showLinkRefusal("desktop-unavailable");
  }
}

if (groupLinkTarget) {
  groupLinkTarget.addEventListener("change", () => {
    groupLinkButton.disabled = groupLinkTarget.disabled || !groupLinkTarget.value;
  });
  groupLinkButton.addEventListener("click", () => {
    const group = getSelectedGroup();
    const [targetProgram, targetGroupId] = String(groupLinkTarget.value || "").split("␟");
    if (!group || !targetProgram || !targetGroupId) return;
    void sendLinkRequest({ type: "group-link", groupId: group.id, targetProgram, targetGroupId });
  });
  groupUnlinkButton.addEventListener("click", () => {
    const group = getSelectedGroup();
    if (!group) return;
    void sendLinkRequest({ type: "group-unlink", groupId: group.id });
  });
}

function requestClusters() {
  try {
    chrome.runtime
      .sendMessage({ type: "clusters-status" })
      .then((res) => {
        if (res && res.clusters) applyClusters(res.clusters, res.rosters);
      })
      .catch(() => {});
  } catch (_) {}
}


function syncSettingsFormFromState() {
  const s = state.globalSettings || DEFAULT_GLOBAL_SETTINGS;
  if (settingsQuickAddField) settingsQuickAddField.checked = s.quickAddEnabled === true;
  if (settingsQuitRetryMinutesField) settingsQuitRetryMinutesField.value = String(s.quitRetryMinutes ?? 0);
  if (settingsStatus) settingsStatus.textContent = "";
}

function openSettings() {
  state.isSettingsOpen = true;
  syncSettingsFormFromState();
  settingsModal.classList.remove("hidden");
  focusVaultModal(settingsModal, settingsCloseButton, closeSettings);
  renderLocalFolderStatus().catch((error) => {
    if (localFolderStatus) localFolderStatus.textContent = String(error?.message ?? error);
  });
}

function closeSettings() {
  state.isSettingsOpen = false;
  settingsModal.classList.add("hidden");
  releaseVaultModal(settingsModal);
  if (settingsStatus) settingsStatus.textContent = "";
}

async function saveSettingsFromForm() {
  const draft = {
    // Dev values are not in the UI (debug + autosave debounce); carry the
    // stored values through a save so a developer's debug flag is not reset.
    autosaveDebounceMs: state.globalSettings?.autosaveDebounceMs,
    debugMode: state.globalSettings?.debugMode,
    quickAddEnabled: settingsQuickAddField ? settingsQuickAddField.checked : state.globalSettings?.quickAddEnabled,
    quitRetryMinutes: settingsQuitRetryMinutesField ? settingsQuitRetryMinutesField.value : state.globalSettings?.quitRetryMinutes
  };
  // A value the field can't hold is refused (the last saved value stays).
  if (CBGroupActions.validateSettingsPatch({ quitRetryMinutes: draft.quitRetryMinutes })) {
    if (settingsStatus) {
      settingsStatus.textContent = t("settings.invalidValue");
      settingsStatus.classList.add("error");
    }
    return;
  }
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
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
  window.VaultTranslate = t;
  chrome.storage?.local?.set?.({ vaultUiLanguage: state.language })?.catch?.(() => {});
  document.title = t("app.title");

  for (const element of document.querySelectorAll("[data-i18n]")) {
    if (element.dataset.armed) continue; // a delete button asking to be clicked again
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
    element.dataset.hint = t(element.dataset.i18nTitle);
  }

  for (const element of document.querySelectorAll("[data-i18n-info]")) {
    element.dataset.infoCopy = t(element.dataset.i18nInfo);
  }
  for (const element of document.querySelectorAll("[data-i18n-info-label]")) {
    element.dataset.infoLabel = t(element.dataset.i18nInfoLabel);
  }
  window.VaultInfo?.refresh(document);
  window.dispatchEvent(new CustomEvent("vault-language-changed"));
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

function siteEntryHost(entry) {
  const text = String(entry ?? "");
  const slash = text.indexOf("/");
  return slash < 0 ? text : text.slice(0, slash);
}


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

let appInventoryIndex = { source: null, size: -1, byID: new Map() };
function getAppInventory() {
  return Array.isArray(window.__cbAppInventory) ? window.__cbAppInventory : [];
}

function findInventoryApp(bundleId) {
  if (!bundleId) return null;
  const inventory = getAppInventory();
  if (appInventoryIndex.source !== inventory || appInventoryIndex.size !== inventory.length) {
    appInventoryIndex = { source: inventory, size: inventory.length, byID: new Map(inventory.filter(Boolean).map(app => [app.id, app])) };
  }
  return appInventoryIndex.byID.get(bundleId) || null;
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
  VaultUI.renderList(blockedAppsList, { scope: document, key: blockedAppsList.dataset.vuiSearch,
    items: getDraftApps(), text: app => appDisplayName(app) + " " + app.id, render: app => {
    const chip = document.createElement("div");
    chip.className = "app-chip";
    chip.setAttribute("role", "listitem");
    chip.dataset.hint = app.id;
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
    return chip;
  }, trailing: fragment => {
  if (!blockedAppsEditable) return;
  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "app-chip-add";
  addTile.setAttribute("aria-label", t("apps.addAria"));
  addTile.textContent = "+";
  addTile.addEventListener("click", () => openAppPicker());
  fragment.appendChild(addTile);
  } });
}

function openAppPicker() {
  if (!blockedAppsEditable || !appPickerModal) return;
  appPickerSearch.value = "";
  renderAppPickerResults("");
  appPickerModal.classList.remove("hidden");
  focusVaultModal(appPickerModal, appPickerSearch, closeAppPicker);
}

function closeAppPicker() {
  if (appPickerModal) {
    appPickerModal.classList.add("hidden");
    releaseVaultModal(appPickerModal);
  }
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
    });
  VaultUI.renderList(appPickerResults, { scope: document, key: "app-picker", searchable: false, items: matches, text: app => app.name + " " + app.id, pageSize: 60, render: app => {
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
    return row;
  } });
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
    if (!blockedAppsEditable || !VaultUI.confirmClick(clearAppsButton, t("confirm.clickAgain"))) return;
    commitBlockedApps([]);
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
// Scene tabs (Vault / Classifier / Activity) exist only there; the markup is
// `.desktop-only` and these hooks are no-ops in a browser.

function postToNativeShell(payload) {
  try {
    window.webkit.messageHandlers.cbBridge.postMessage(payload);
  } catch (_) {}
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

  VaultUI.renderList(blockedSitesList, { scope: document, key: blockedSitesList.dataset.vuiSearch,
    items: getDraftSites(), text: host => host, render: host => {
    const chip = document.createElement("div");
    chip.className = "site-chip";
    chip.setAttribute("role", "listitem");
    chip.dataset.hint = host;

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

    return chip;
  }, trailing: fragment => {

  // Trailing "+" tile to reveal the multi-line add panel.
  const addTile = document.createElement("button");
  addTile.type = "button";
  addTile.className = "site-chip-add";
  addTile.setAttribute("aria-label", t("sites.addAria"));
  addTile.textContent = "+";
  addTile.disabled = !editable;
  addTile.addEventListener("click", () => openSiteAddPanel());
  fragment.appendChild(addTile);
  } });
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
  list.className = "entry-chip-list vui-list-box";
  list.dataset.vuiSearch = "vault-chips:" + field.id;
  list.dataset.vuiSearchLabel = "Search saved entries";
  list.dataset.vuiSearchItems = ".entry-chip";
  list.tabIndex = 0;
  const fieldLabel = field.labels?.[0];
  if (fieldLabel) {
    if (!fieldLabel.id) fieldLabel.id = field.id + "-list-label";
    list.setAttribute("aria-labelledby", fieldLabel.id);
  }
  const addInput = document.createElement("input");
  addInput.type = "text";
  addInput.className = "entry-chip-input";
  addInput.spellcheck = false;

  field.classList.add("hidden");
  field.setAttribute("aria-hidden", "true");
  field.insertAdjacentElement("afterend", list);

  const commitAdd = () => {
    const parts = addInput.value
      .split(options?.splitCommas === false ? /\n+/ : /[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    addInput.value = "";
    if (parts.length === 0) return;
    setChipFieldEntries(field, [...getChipFieldEntries(field), ...parts]);
    renderChips();
  };

  addInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || (event.key === "," && options?.splitCommas !== false)) {
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
    VaultUI.renderList(list, { scope: document, key: list.dataset.vuiSearch, items: getChipFieldEntries(field), text: entry => entry, render: entry => {
      const valid = normalize(entry) !== null;
      const chip = document.createElement("span");
      chip.className = "entry-chip" + (valid ? "" : " entry-chip-invalid");
      chip.dataset.hint = valid ? entry : t("chip.invalid");

      const label = document.createElement("span");
      label.className = "entry-chip-label";
      label.textContent = entry;
      if (editable && options?.editableEntries) {
        label.tabIndex = 0;
        label.contentEditable = "true";
        label.setAttribute("role", "textbox");
        label.setAttribute("aria-label", t("tagFilter.tags"));
        const commit = () => {
          const value = label.textContent.trim();
          setChipFieldEntries(field, getChipFieldEntries(field).map(item => item === entry ? value : item));
          renderChips();
        };
        label.addEventListener("blur", commit);
        label.addEventListener("keydown", event => {
          if (event.key === "Enter") { event.preventDefault(); label.blur(); }
          if (event.key === "Escape") { event.preventDefault(); label.textContent = entry; label.blur(); }
        });
      }
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
      return chip;
    }, trailing: fragment => {

    addInput.disabled = !editable;
    addInput.placeholder = t("chip.addPlaceholder");
    fragment.appendChild(addInput);
    } });
  }

  field.__cbChip = { render: renderChips };
  renderChips();
}

function refreshChipField(field) {
  if (field && field.__cbChip) field.__cbChip.render();
}

function setupPlatformChipInputs() {
  setupChipField(platformTagsField, {
    normalize: value => CBGroupScopes.parseTagListText(value).length === 1 ? value : null,
    splitCommas: false, editableEntries: true
  });
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
  const modes = ["all", "include", "exclude", ...(isTagFilterCompatible(type) ? ["tags-include", "tags-exclude"] : [])];

  const previous = platformAuthorModeField.value;
  platformAuthorModeField.innerHTML = "";
  for (const mode of modes) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode.startsWith("tags-") ? t(`tagFilter.mode${mode === "tags-include" ? "Include" : "Exclude"}`) : t(`platform.authorMode.${mode}`, { noun });
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

  platformAuthorModeLabel.textContent = t("scopes.applyTo");
  rebuildAuthorModeOptions(type);
  platformAuthorModeHelp.textContent = !platformCapabilities(type).feed && type !== "discord"
    ? t("platform.pagesOnlyHelp") : isReddit
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
          title: t("surfaceHide.contentTitle"),
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
    text.dataset.infoKey = "surface-hide:" + entry.id;
    text.dataset.infoCopy = t(surfaceHideEntryScope(entry) === "entry" ? "info.hideEntry" : "info.hidePlatform", { control: t(entry.labelKey) });

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
const CUSTOM_RULE_API_NAMES = new Set(["on", "v", "ev", "state", "log", "emit", "panel", "file", "item", "cover", "go", "close", "css", "dom", "query", "apps", "quit", "block"]);

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
  if (event.button !== 0 || VaultUI.searchQuery(groupList).trim()) {
    return; // Clear search before reordering the full group list.
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
      reorderGroups(draggedGroupId, state.groups.findIndex(group => group.id === dragContext.cards[insertIndex].dataset.groupId)).catch((error) => {
        console.error("Failed to reorder block groups.", error);
        setStatus(t("status.errorReorderGroups"), true);
        clearDragState(true);
      });
    });
  };

  window.addEventListener("mousemove", handleMove);
  window.addEventListener("mouseup", handleUp);
}

// One group's defaults, sanitizer and normalizers: one copy, in group-scopes.js
// (the service worker and Mac Vault use it too). The editor adds only its view:
// the flat form fields of the entry in view.
const { normalizeSiteInput, normalizeTagFilterMode, clampTagConfidence } = CBGroupScopes;

// The entry the cards show first: a custom group has none. In the desktop app
// a group opens on its apps, or on its first entry when it has none yet (the
// add menu offers Apps; no empty Apps chip on a group that has no apps);
// otherwise the stored type.
function defaultEntryView(stored) {
  if (stored.groupType === "custom") return "custom";
  const entries = CBGroupScopes.groupPlatforms(stored);
  if (!IS_NATIVE_DESKTOP) return entries.find(key => CBGroupScopes.entryPlatform(key) === stored.groupType) || entries[0] || stored.groupType;
  return entries.includes("apps") || entries.length === 0 ? "apps" : entries[0];
}

// A stored (canonical) group as the editor shows it.
function groupView(stored, entry = defaultEntryView(stored)) {
  if (entry === "custom") return { ...stored, ...CBGroupScopes.flatFromScopes(stored, "custom"), entryView: "custom" };
  return viewGroupOnPlatform(stored, entry);
}

function sanitizeGroups(groups) {
  return CBGroupScopes.sanitizeGroups(groups).map((stored) => groupView(stored));
}

// A new group, with the editor's defaults: a unique name in the user's
// language, 30-minute snooze duration, and the custom-rule template.
function createDefaultGroup(groupType = DEFAULT_GROUP_TYPE) {
  const type = normalizeGroupType(groupType);
  const stored = CBGroupScopes.newGroup(type, {
    name: CBGroupScopes.defaultGroupName(state.groups, type, (kind, number) => t(`groupName.${kind}Pattern`, { number })),
    blockingRulesText: t("custom.defaultRule")
  }, LOCAL_OWNER);
  return groupView(stored);
}

// The canonical stored shape: the policy and the group's lines as they are.
// The flat form fields are only the view of one entry (folded into the lines
// when the user edits them, foldEntryIntoLines).
function toStoredGroup(group) {
  const { entryView, storedGroupType, ...rest } = CBGroupScopes.withoutFlatScopeFields(group);
  return {
    ...rest,
    // The stored type stays put while another entry is in view.
    groupType: CBGroupScopes.deriveGroupType(group.scopes, storedGroupType ?? group.groupType),
    scopes: group.scopes
  };
}

// The entry in view's form fields become that entry's lines; the group's other
// lines keep theirs. Only an edit of those fields does this.
function foldEntryIntoLines(group) {
  return { ...group, scopes: CBGroupScopes.mergeFlatIntoScopes(group.scopes, group, activeEntryKey(group)) };
}

// The group with the draft applied, never throwing: invalid fields keep their
// last valid value (the first error is returned). The lines change only when
// the entry's form fields did.
function applyDraft(group, draft) {
  const result = buildUpdatedGroupFromDraft(group, draft);
  const updated = result.updatedGroup;
  const linesChanged = CBGroupScopes.FLAT_SCOPE_FIELDS.some((field) => JSON.stringify(updated[field]) !== JSON.stringify(group[field]));
  const next = linesChanged ? foldEntryIntoLines(updated) : { ...updated, scopes: group.scopes };
  // A name is saved when its edit is finished (Enter or leaving the field): a
  // half-typed name would be shared with linked devices and checked for duplicates.
  if (state.nameEditing && state.nameEditing.id === group.id) next.name = group.name;
  return { group: next, validationError: result.validationError };
}

// The entry whose lines the cards edit: "site", "apps", a platform id, or
// "custom" (custom groups have no entries).
function activeEntryKey(group) {
  if (!group || group.groupType === "custom") return "custom";
  return CBGroupScopes.normalizeEntryKey(group.entryView || group.groupType);
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
    snoozeKind: group.snoozeKind === "budget" ? "budget" : "time",
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
  // What the user sees, as a save would store it (a half-typed field keeps its
  // last valid value, as in a save).
  const draft = state.drafts[group.id] ? getDraftForGroup(group.id) : null;
  return draft ? applyDraft(group, draft).group : group;
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
    snoozeKind: group.snoozeKind === "budget" ? "budget" : "time",
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
    platformTagMode: normalizeTagFilterMode(group.platformTagMode),
    platformTagsText: CBGroupScopes.tagListToText(group.platformTags),
    platformTagDefaultConfidence: clampTagConfidence(group.platformTagDefaultConfidence, 4),
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
          lastAbortReason: null
        }
      : item
  );
  if (state.drafts[groupId]) {
    delete state.drafts[groupId].blockingRulesText;
    delete state.drafts[groupId].enabled;
  }
}

let indexedGroups = null, indexedGroupCount = -1, groupsByID = new Map();
function groupByID(groupId) {
  if (indexedGroups !== state.groups || indexedGroupCount !== state.groups.length) {
    indexedGroups = state.groups; indexedGroupCount = state.groups.length;
    groupsByID = new Map(state.groups.map(group => [group.id, group]));
  }
  return groupsByID.get(groupId);
}
function getDraftForGroup(groupId) {
  const group = groupByID(groupId);
  return group ? { ...groupToDraft(group), ...(state.drafts[groupId] || {}) } : null;
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

// The desktop Vault holds a linked group's real state. While it is
// away this browser only ENFORCES a linked group (from its copy of the links,
// kept by the worker): nothing about the group can change — settings, entries,
// freeze, snooze, delete — until the desktop Vault is back.
function desktopVaultAway() {
  if (IS_NATIVE_DESKTOP) return false;
  const s = state.connectionStatus || {};
  // Unknown until the worker's first status push: not "away" yet.
  if (!s.received) return false;
  return !(s.state === "connected" && (s.hubProgram === "macapp" || s.hubProgram === "windowsapp"));
}

// True (and says why) when the group is enforce-only right now.
// The one refusal for a change the group can't take right now, with its
// reason: the desktop Vault is away (enforce-only) or the group is frozen.
function refuseUnlessEditable(group) {
  if (!group) return true;
  if (refuseWhileDesktopVaultAway(group)) return true;
  if (isGroupEditable(group)) return false;
  setStatus(t("status.frozenCannotChange"), true);
  render();
  return true;
}

function refuseWhileDesktopVaultAway(group) {
  if (!isEnforceOnly(group)) return false;
  setStatus(t("link.enforceOnly"), true);
  render();
  return true;
}

function isEnforceOnly(group) {
  if (!group || !desktopVaultAway()) return false;
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

// --- Overlay panel ---------------------------------------------------------
// An in-popup overlay built from panel-control snapshots (the PIN entry, the
// guardian settings); its interaction events go to `onEvent`.
// Returns { update(nextSnapshot), close() }.
let __cbOverlayPanelSeq = 0;

function openOverlayPanel(snapshot, onEvent) {
  const panelId = snapshot.id || "cb-overlay-" + ++__cbOverlayPanelSeq;
  return __cbOpenInPopupOverlay(panelId, { ...snapshot, id: panelId }, onEvent);
}

function __cbEnsureOverlayStyles() {
  if (document.getElementById("cb-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "cb-overlay-styles";
  style.textContent = [
    // The surface is the shared .vui-dialog (vault-ui.css); only the layout
    // of the controls is the overlay's own.
    ".cb-overlay-card{width:min(360px,100%);max-height:calc(100vh - 40px);overflow:auto;display:flex;flex-direction:column;gap:14px;}",
    ".cb-overlay-card>*{flex-shrink:0;}",
    ".cb-overlay-card .vui-dialog-title,.cb-overlay-card .vui-dialog-actions{margin:0;}",
    ".cb-overlay-label{font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;}",
    ".cb-overlay-row{display:flex;flex-direction:column;}",
    ".cb-overlay-pin{display:flex;gap:10px;align-items:center;justify-content:center;cursor:text;}",
    ".cb-overlay-pin-box{width:40px;height:50px;border-radius:10px;background:#f1f5f9;border:none;display:flex;align-items:center;justify-content:center;font:600 22px ui-monospace,Menlo,monospace;color:#0f172a;transition:border-color .12s,background .12s,box-shadow .12s;}",
    ".cb-overlay-pin-box.filled{background:#e2e8f0;}",
    ".cb-overlay-pin-box.active{box-shadow:0 0 0 3px rgba(30,58,138,0.16);}",
    ".cb-overlay-pin-input{position:absolute;opacity:0;width:1px;height:1px;border:0;padding:0;}",
    ".cb-overlay-input{box-sizing:border-box;width:100%;border:none;background:#f1f5f9;border-radius:10px;padding:8px 10px;font-size:13px;}",
    ".cb-overlay-input:focus{outline:none;box-shadow:0 0 0 3px rgba(30,58,138,0.16);}",
  ].join("");
  document.head.appendChild(style);
}

function __cbOpenInPopupOverlay(panelId, snap, onEvent) {
  __cbEnsureOverlayStyles();
  let backdrop = document.getElementById(panelId + "-backdrop");
  if (backdrop) backdrop.remove();
  backdrop = document.createElement("div");
  backdrop.id = panelId + "-backdrop";
  backdrop.className = "vui-dialog-backdrop";
  const card = document.createElement("div");
  card.className = "vui-dialog cb-overlay-card";
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
      p.className = "vui-dialog-text";
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
      // Submit is the navy pill; the rest are secondary (vault-ui.css buttons).
      if (control.action !== "submit") btn.className = "secondary";
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
      h.className = "vui-dialog-title";
      h.textContent = snapshot.title;
      card.appendChild(h);
    }
    const buttonRow = document.createElement("div");
    buttonRow.className = "vui-dialog-actions";
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

// A few names, then "+N" for the rest.
function summarizeNames(names) {
  const list = names.filter(Boolean);
  if (list.length <= 2) return list.join(", ");
  return `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
}

// The card's line (owner 2026-09-30): what the group covers, then when.
function getGroupMetaText(group, draft, now = Date.now()) {
  const effectiveGroup = getEffectiveGroup(group, draft);
  const snooze = getCurrentSnooze(group.id, now);
  const snoozePhase = getSnoozePhase(snooze, now);
  const freezeStatus = getFreezeStatus(group, now);
  const pieces = [];

  if (group.groupType === "custom") {
    pieces.push(t("meta.customRules"));
  } else {
    // What it covers, from the stored lines; the entry in view shows its unsaved edit.
    const lines = Array.isArray(group.scopes) ? group.scopes : [];
    const active = activeEntryKey(group);
    const covers = [];
    for (const key of CBGroupScopes.groupPlatforms(group)) {
      if (CBGroupScopes.entryPlatform(key) === "site") {
        const sites = draft && active === key
          ? parseSiteTextareaValue(draft.sitesText).validSites
          : lines.find((line) => line.surface === "site" && CBGroupScopes.lineBelongsTo(line, key))?.sites || [];
        if (sites.length) covers.push(summarizeNames(sites));
      } else if (key === "apps") {
        const apps = draft && active === "apps"
          ? parseAppsData(draft.appsData)
          : lines.find((line) => line.surface === "apps")?.apps || [];
        if (apps.length) covers.push(summarizeNames(apps.map((app) => app.name || app.id)));
      } else {
        covers.push(platformKeyLabel(key));
      }
    }
    if (covers.length) pieces.push(covers.join(", "));
  }

  if (snoozePhase === "pending") {
    pieces.push(`${t("meta.snoozePending")} ${formatDurationMs(snooze.startsAtMs - now)}`);
  } else if (snoozePhase === "active" && snooze.kind === "budget") {
    // A budget snooze keeps the group in effect: its extra time is in "left".
    const remainingMs = Math.max(
      effectiveGroup.allowedMinutes * MS_PER_MINUTE + CBGroupActions.snoozeExtraMs(snooze, now) -
        getDisplayUsageState(effectiveGroup, now).usedMs,
      0
    );
    pieces.push(`${formatDurationMs(remainingMs)} ${t("meta.left")}`, t("meta.snoozeBudget"));
  } else if (snoozePhase === "active") {
    pieces.push(`${t("meta.snoozed")} ${formatDurationMs(snooze.untilMs - now)}`);
  } else if (snoozePhase === "cooldown") {
    pieces.push(`${t("meta.snoozeCooldown")} ${formatDurationMs(snooze.cooldownUntilMs - now)}`);
  } else if (group.groupType === "custom") {
    // A custom rule decides when it acts: no "when" on its card.
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

  return pieces.join(" • ");
}

// A lock whose wait still holds keeps "delete all" closed (group-actions.js).
function hasStrictLockedGroups(now = Date.now()) {
  return Boolean(CBGroupActions.deleteAllPlan(state.groups, now).error);
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

let renderedGroups = null;
function renderGroupList(now = Date.now()) {
  groupList.classList.remove("is-reordering");
  renderedGroups = state.groups;

  VaultUI.renderList(groupList, { scope: document, key: groupList.dataset.vuiSearch,
    items: state.groups, text: group => (getDraftForGroup(group.id)?.name || group.name) + " " + getGroupMetaText(group, getDraftForGroup(group.id), now), render: group => {
    const draft = getDraftForGroup(group.id);
    const card = document.createElement("div");
    card.className = `group-card${group.id === state.selectedGroupId ? " active" : ""}${group.enabled ? "" : " is-off"}`;
    card.dataset.groupId = group.id;

    if (group.id === state.draggedGroupId) {
      card.classList.add("dragging");
    }

    if (groupConnectionCluster(group)) {
      card.classList.add("bridge-connected");
    }
    const quickAddOn = state.globalSettings?.quickAddEnabled === true && group.groupType !== "custom";

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
    toggle.disabled = !isGroupEditable(group, now);
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
      badge.dataset.hint = t("groups.quickAddBadge");
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

    return card;
  } });
}

// The badge and the card select the same remembered destination.
function setQuickAddGroup(groupId) {
  return selectGroup(groupId);
}

function rememberGroupSelection(groupId = state.selectedGroupId) {
  const id = groupId || "";
  if (state.quickAddGroupId === id) return Promise.resolve();
  state.quickAddGroupId = id;
  return chrome.storage.local.set({ [QUICK_ADD_GROUP_KEY]: id }).catch((error) => {
    console.error("Failed to remember the selected group.", error);
    setStatus(t("status.errorSaveGroup"), true);
  });
}

let groupSelectionRevision = 0;

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
  const remainingMs = Math.max(
    displayGroup.allowedMinutes * MS_PER_MINUTE + CBGroupActions.snoozeExtraMs(state.groupSnoozes[group.id], now) - usageState.usedMs,
    0
  );
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
    lockWaitHoursField.value = String(freezeStatus.waitHours || 0);
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
    snoozeKindField.disabled = true;
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
  // Prefer the draft so optimistic UI doesn't snap back during autosave.
  const draft = getDraftForGroup(group.id);
  const allowSnooze = draft?.allowSnooze ?? (group.allowSnooze !== false);
  const isCustomGroup = group.groupType === "custom";

  // Snooze settings change only when the group can (not frozen, Mac Vault
  // not away); snoozing itself stays available on a frozen group.
  const settingsLocked = !isGroupEditable(group, now);
  allowSnoozeField.checked = allowSnooze;
  allowSnoozeField.disabled = settingsLocked;
  snoozeKindField.disabled = settingsLocked || !allowSnooze;
  snoozeMinutesField.disabled = settingsLocked || !allowSnooze;
  // The snooze kind is a setting of time-limit groups only (owner 2026-09-29).
  const timeLimitMode = normalizeBlockingMode(draft?.mode ?? group.mode) === "after-minutes";
  const budgetMode = timeLimitMode && (draft?.snoozeKind ?? group.snoozeKind) === "budget";
  const durationLabel = document.querySelector('label[for="snoozeMinutes"]');
  if (durationLabel) durationLabel.textContent = t(budgetMode ? "snooze.extraMinutes" : "snooze.minutes");
  snoozeKindRow.classList.toggle("hidden", isCustomGroup || !timeLimitMode);
  snoozeActivationDelayField.disabled = settingsLocked || !allowSnooze;
  snoozeCooldownField.disabled = settingsLocked || !allowSnooze;
  snoozeConfirmationsField.disabled = settingsLocked || !allowSnooze;

  // Custom groups own snooze semantics via the rule's "snooze" event, so
  // the numeric knobs are hidden and a copy line replaces them.
  if (snoozeNumericFields) {
    snoozeNumericFields.classList.toggle("hidden", isCustomGroup);
  }
  if (snoozeCustomCopy) {
    snoozeCustomCopy.classList.toggle("hidden", !isCustomGroup);
  }

  if (!snooze) {
    // No snooze: the block says nothing (owner 2026-09-30); a line shows only
    // while a snooze is scheduled, running or cooling down.
    startSnoozeButton.disabled = !allowSnooze || isEnforceOnly(group);
    snoozeSummary.textContent = "";
    endSnoozeButton.classList.add("hidden");
    return;
  }

  startSnoozeButton.disabled = true;
  const budgetSnooze = snooze.kind === "budget";
  if (snoozePhase === "pending") {
    snoozeSummary.textContent = budgetSnooze
      ? t("snooze.summary.pendingBudget", {
        delay: formatDurationMs(snooze.startsAtMs - now),
        time: formatDurationMs(snooze.extraMs)
      })
      : t("snooze.summary.pending", {
        delay: formatDurationMs(snooze.startsAtMs - now),
        time: formatDurationMs(snooze.untilMs - snooze.startsAtMs)
      });
    endSnoozeButton.classList.remove("hidden");
    endSnoozeButton.disabled = isEnforceOnly(group);
  } else if (snoozePhase === "active") {
    snoozeSummary.textContent = budgetSnooze
      ? t("snooze.summary.activeBudget", {
        time: formatDurationMs(snooze.extraMs),
        until: formatDurationMs(snooze.untilMs - now)
      })
      : t("snooze.summary.active", {
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
}

function renderEditor(now = Date.now()) {
  const noGroups = state.groups.length === 0;
  editorPanel.classList.toggle("is-empty", noGroups);
  editorEmpty.classList.toggle("hidden", !noGroups);
  renderEditorFields(now);
  syncMoreRows();
}

// "More" holds the rarely used settings, away from the part they belong to: a
// row marked data-follows="<id>" shows only while that part shows.
function syncMoreRows() {
  for (const row of document.querySelectorAll("[data-follows]")) {
    const part = document.getElementById(row.dataset.follows);
    row.classList.toggle("follow-hidden", !part || Boolean(part.closest(".hidden, [hidden]")));
  }
}

function renderEditorFields(now) {
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
    snoozeKindField.value = "time";
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
    scheduleWindowsField.disabled = true;
    blockedSitesField.disabled = true;
    blockingRulesField.disabled = true;
    platformAuthorsField.disabled = true;
    platformVideoModeField.disabled = true;
    platformAuthorModeField.disabled = true;
    discordModeField.disabled = true;
    discordTargetsField.disabled = true;
    allowSnoozeField.disabled = true;
    clearSitesButton.disabled = true;
    deleteGroupButton.disabled = true;
    exportGroupButton.disabled = true;
    importGroupButton.disabled = true;
    applyFreezeButton.disabled = true;
    platformBlockHomePageField.disabled = true;
    discordBlockHomePageField.disabled = true;
    fallbackUrlField.disabled = true;
    updateFreezeUI(null, now);
    updateSnoozeUI(null, now);
    setSnoozeWarning("");
    updateBlockingRulesEditor();
    renderBlockedSites();
    return;
  }

  const draft = getDraftForGroup(group.id);
  const editable = isGroupEditable(group, now);
  const selectedMode = normalizeBlockingMode(draft?.mode ?? group.mode);
  const isTimedMode = isTimedBlockingMode(selectedMode);
  const isPlatformVideoGroup = isPlatformVideoGroupType(group.groupType);
  const usesAuthorAxis = isPlatformAuthorGroupType(group.groupType);
  const isDiscordGroup = group.groupType === "discord";
  const isCustomGroup = group.groupType === "custom";
  const isPlatformProfileGroup = isPlatformProfileGroupType(group.groupType);
  const entryKey = activeEntryKey(group);
  const isSiteView = CBGroupScopes.entryPlatform(entryKey) === "site";
  const isAppsView = CBGroupScopes.entryPlatform(entryKey) === "apps";
  // The entry in view is edited only by the program that owns it (scope line).
  const entryEditable = editable && ownsEntry(entryKey);

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
  snoozeKindField.value = draft?.snoozeKind ?? (group.snoozeKind === "budget" ? "budget" : "time");
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
  const tagMode = normalizeTagFilterMode(draft?.platformTagMode ?? group.platformTagMode);
  platformTagModeField.value = tagMode;
  if (tagCompatible && tagMode !== "all") platformAuthorModeField.value = `tags-${tagMode}`;
  platformTagsField.value = draft?.platformTagsText ?? CBGroupScopes.tagListToText(group.platformTags);
  platformTagDefaultConfidenceField.value = String(
    clampTagConfidence(draft?.platformTagDefaultConfidence ?? group.platformTagDefaultConfidence, 4)
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
  if (platformTagFields) platformTagFields.classList.toggle("hidden", !tagCompatible || tagMode === "all");
  if (platformTagListBlock) platformTagListBlock.classList.toggle("hidden", tagMode === "all");
  refreshTagSuggestions(
    document.getElementById("platformTagSuggestions"), platformTagsField,
    tagCompatible && tagMode !== "all" ? group.groupType : ""
  );
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
    if (pageActionField) pageActionField.disabled = !entryEditable;
    if (pauseSecondsField) pauseSecondsField.disabled = !entryEditable;
    if (pauseSecondsRow) pauseSecondsRow.classList.toggle("hidden", (pageActionField ? pageActionField.value : "block") !== "pause");
  }
  platformVideoCard.classList.toggle("hidden", !usesAuthorAxis);
  discordSettingsCard.classList.toggle("hidden", !isDiscordGroup);
  renderSurfaceHides(group, draft, entryEditable);
  if (fallbackUrlSection) {
    fallbackUrlSection.classList.toggle("hidden", isCustomGroup);
  }
  scheduleSection.classList.toggle("hidden", isCustomGroup);
  // A custom rule decides for itself when it acts: no "When" (owner 2026-09-30).
  whenSection.classList.toggle("hidden", isCustomGroup);
  // The cards show the entry in view: the website list, the app list, or the
  // platform card. Custom rules define their own behavior and have no entries.
  siteSettingsSection.classList.toggle("hidden", !isSiteView);
  if (appsSettingsSection) appsSettingsSection.classList.toggle("hidden", !isAppsView);
  blockedAppsEditable = entryEditable && isAppsView;
  if (appsAllowlistField) appsAllowlistField.disabled = !blockedAppsEditable;
  if (appsHelp) appsHelp.textContent = t(IS_NATIVE_DESKTOP ? "apps.help" : "apps.readOnlyHint");
  if (entryOwnerHint) entryOwnerHint.classList.toggle("hidden", isCustomGroup || ownsEntry(entryKey) || isAppsView);
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
  // (The snooze fields are set by updateSnoozeUI.)
  scheduleWindowsField.disabled = !editable || isCustomGroup;
  blockedSitesField.disabled = !entryEditable || !isSiteView;
  if (siteAllowlistField) {
    siteAllowlistField.disabled = !entryEditable || !isSiteView;
  }
  blockingRulesField.disabled = !editable || !isCustomGroup;
  const currentAuthorMode = normalizeSourceMode(platformAuthorModeField.value);
  const authorModeUsesList = !platformAuthorModeField.value.startsWith("tags-") && sourceModeUsesList(currentAuthorMode); // include/exclude
  // Show the author list only for include/exclude.
  platformAuthorsBlock.classList.toggle("hidden", !usesAuthorAxis || !authorModeUsesList);
  platformAuthorsField.disabled = !entryEditable || !usesAuthorAxis || !authorModeUsesList;
  platformVideoModeField.disabled = !entryEditable || !isPlatformVideoGroup;
  platformAuthorModeField.disabled = !entryEditable || !usesAuthorAxis;
  discordModeField.disabled = !entryEditable || !isDiscordGroup;
  discordTargetsField.disabled = !entryEditable || !isDiscordGroup || discordModeField.value === "all";
  // A locked group's tag line is shown, not changed.
  for (const field of [platformTagModeField, platformTagsField, platformTagDefaultConfidenceField, platformTagEffectField,
    platformTagBlockUntaggedField, platformTagBlockPageField, platformTagCoverUntilTaggedField]) {
    if (field) field.disabled = !entryEditable;
  }
  clearSitesButton.disabled =
    !entryEditable || !isSiteView;
  renderBlockedSites();
  refreshChipField(platformAuthorsField);
  refreshChipField(discordTargetsField);
  refreshChipField(platformTagsField);
  deleteGroupButton.disabled = !editable;
  renderLinkSection(group, editable);
  exportGroupButton.disabled = false;
  importGroupButton.disabled = !editable;
  platformBlockHomePageField.disabled = !entryEditable || !usesAuthorAxis;
  discordBlockHomePageField.disabled = !entryEditable || !isDiscordGroup;
  fallbackUrlField.disabled = !editable;
  if (runCustomGroupButton) {
    runCustomGroupButton.disabled = !editable || !isCustomGroup;
  }
  if (copyCodeDocsButton) {
    copyCodeDocsButton.disabled = !isCustomGroup;
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

  if (renderedGroups !== state.groups) { renderGroupList(now); return; }

  for (const card of cards) {
    const group = groupByID(card.dataset.groupId);
    if (!group) { renderGroupList(now); return; }
    const draft = getDraftForGroup(group.id);

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
      const locked = !isGroupEditable(group, now);
      if (toggle.disabled !== locked) toggle.disabled = locked;
    }
  }
}

function stashCurrentDraft() {
  const group = getSelectedGroup();

  if (!state.selectedGroupId || !group) {
    return;
  }

  const usesAuthorAxis = isPlatformAuthorGroupType(group.groupType);
  const isDiscordGroup = group.groupType === "discord";

  const full = {
    name: groupNameField.value,
    enabled: groupEnabledField.checked,
    mode: blockModeField.value,
    allowedMinutes: allowedMinutesField.value,
    resetIntervalHours: resetIntervalHoursField.value,
    resetAtMidnight: resetAtMidnightField.checked,
    rollingLimit: rollingLimitField.checked,
    allowSnooze: allowSnoozeField.checked,
    snoozeKind: snoozeKindField.value === "budget" ? "budget" : "time",
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
    sourceMode: platformAuthorModeField.value.startsWith("tags-") ? "nobody" : platformAuthorModeField.value,
    sourcesText: platformAuthorsField.value,
    platformTagMode: platformAuthorModeField.value.startsWith("tags-") ? platformAuthorModeField.value.slice(5) : "all",
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
  const changes = draftChanges(full, groupToDraft(group));
  if (changes) state.drafts[state.selectedGroupId] = changes;
  else delete state.drafts[state.selectedGroupId];
}

// The fields of `full` that differ from `base` (null when none).
function draftChanges(full, base) {
  const changes = {};
  for (const [key, value] of Object.entries(full)) {
    if (JSON.stringify(value) !== JSON.stringify(base[key])) changes[key] = value;
  }
  return Object.keys(changes).length > 0 ? changes : null;
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
  // Closing the popup before the store was read must not write anything back.
  if (!state.groupsLoaded) return;
  const group = getSelectedGroup();
  if (!group || !state.drafts[group.id] || !isGroupEditable(group)) return;
  try {
    const next = applyDraft(group, getDraftForGroup(group.id)).group;
    state.groups = state.groups.map((item) => (item.id === group.id ? next : item));
    // Unawaited: the write is sent before the popup tears down.
    persistGroups([group.id]).catch(() => {});
  } catch (_) {}
}

async function selectGroup(groupId) {
  if (!state.groups.some((group) => group.id === groupId)) return;
  const revision = ++groupSelectionRevision;
  // Send the choice immediately, even if the editor closes during autosave.
  const remembered = rememberGroupSelection(groupId);
  if (groupId !== state.selectedGroupId) {
    closeUnfreezeFlow();
    stashCurrentDraft();
    try {
      await flushAutosave();
    } catch (error) {
      console.error("Failed to flush autosave before selection change.", error);
    }
    if (revision !== groupSelectionRevision || !state.groups.some((group) => group.id === groupId)) return;
    state.selectedGroupId = groupId;
    setSnoozeWarning("");
    render();
  }
  await remembered;
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

  const storedGroups = Array.isArray(result[BLOCKED_GROUPS_KEY]) ? result[BLOCKED_GROUPS_KEY] : [];
  const groups = sanitizeGroups(storedGroups);
  const settings = sanitizeGlobalSettings(result[GLOBAL_SETTINGS_KEY]);
  cbDebugMode = settings.debugMode === true;

  return {
    quickAddGroupId: typeof result[QUICK_ADD_GROUP_KEY] === "string" ? result[QUICK_ADD_GROUP_KEY] : "",
    storedGroups,
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

// What the editor writes (owner 2026-09-26): only what the user changed — the
// groups it edited, by id, into the stored list as it is now (a change made
// elsewhere meanwhile — a linked device, the "+", an AI tool — is kept).
// Usage, snooze counting and links belong to the service worker / Mac Vault,
// which share every stored change.
async function persistGroups(ids, { reorder = false, message = "" } = {}) {
  let list = state.storedGroups.filter((group) => group && group.id);
  for (const id of ids) {
    const at = list.findIndex((group) => group.id === id);
    const index = state.groups.findIndex((group) => group.id === id);
    if (index < 0) {
      if (at >= 0) list.splice(at, 1);
      continue;
    }
    const next = toStoredGroup(state.groups[index]);
    // The other program's lines are never written from here: they stay as stored.
    if (at >= 0) next.scopes = CBGroupScopes.withOwnLines(list[at], next, LOCAL_OWNER);
    if (at >= 0) list[at] = next;
    else list.splice(Math.min(index, list.length), 0, next);
  }
  if (reorder) {
    const order = new Map(state.groups.map((group, index) => [group.id, index]));
    list = list
      .map((group, index) => ({ group, key: order.has(group.id) ? order.get(group.id) : state.groups.length + index }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.group);
  }
  state.storedGroups = list;
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: list });
  if (message) setStatus(message);
}

// A snooze entry the user started or ended here; the service worker / Mac
// Vault count its time and share it with linked devices.
async function persistSnooze(groupId, entry, message = "") {
  if (refuseWhileDesktopVaultAway(state.groups.find((item) => item.id === groupId))) return;
  const stored = (await chrome.storage.local.get({ [GROUP_SNOOZES_KEY]: {} }))[GROUP_SNOOZES_KEY];
  await chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: { ...(stored && typeof stored === "object" ? stored : {}), [groupId]: entry } });
  if (message) setStatus(message);
}

async function loadGroups() {
  const loaded = await loadStoredState();
  state.storedGroups = loaded.storedGroups;
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
  state.selectedGroupId = state.groups.find((group) => group.id === loaded.quickAddGroupId)?.id ?? state.groups[0]?.id ?? null;
  state.drafts = {};
  await rememberGroupSelection();
  render();
}

function updateGroupEnabled(groupId, enabled) {
  const group = state.groups.find((item) => item.id === groupId);
  if (refuseUnlessEditable(group)) return;

  state.groups = state.groups.map((item) =>
    item.id === groupId ? { ...item, enabled } : item
  );

  if (state.drafts[groupId]) {
    delete state.drafts[groupId].enabled;
  }

  if (groupId === state.selectedGroupId) {
    groupEnabledField.checked = enabled;
  }

  renderGroupList();
  persistGroups([groupId], { message: t(enabled ? "status.enabled" : "status.disabled", { name: group.name }) }).catch(() => {
    setStatus(t("status.errorSaveGroup"), true);
  });
}

async function addGroup(groupType = DEFAULT_GROUP_TYPE) {
  stashCurrentDraft();
  await flushAutosave();

  const newGroup = createDefaultGroup(groupType);
  state.groups = [...state.groups, newGroup];
  ++groupSelectionRevision;
  state.selectedGroupId = newGroup.id;

  await persistGroups([newGroup.id], { message: t("status.created", { name: newGroup.name }) });
  await rememberGroupSelection();
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
  key = CBGroupScopes.entryPlatform(key);
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
    groupType: ["site", "apps"].includes(CBGroupScopes.entryPlatform(entry)) ? "site" : CBGroupScopes.entryPlatform(entry),
    storedGroupType: stored.groupType,
    entryView: entry,
    ...CBGroupScopes.flatFromScopes(stored, entry)
  };
}

// Save the form (as autosave does) and return the selected group in its
// canonical shape: policy + every platform's lines.
async function commitSelectedGroupLines() {
  stashCurrentDraft();
  await flushAutosave();
  const group = getSelectedGroup();
  if (!group || !isGroupEditable(group)) return null;
  return toStoredGroup(group);
}

// Show the entry `key` in the cards; an entry the group does not name yet is
// added with the same defaults a new group of that kind would get.
async function setGroupPlatformView(key) {
  const entry = CBGroupScopes.normalizeEntryKey(key);
  const group = getSelectedGroup();
  // A locked group's entries can be viewed (not changed or added).
  const editable = Boolean(group) && isGroupEditable(group);
  const stored = editable ? await commitSelectedGroupLines() : group && toStoredGroup(group);
  if (!stored || stored.groupType === "custom") {
    render();
    return;
  }
  const known = CBGroupScopes.groupPlatforms(stored).includes(entry);
  if (!known && !editable) {
    render();
    return;
  }
  let next = viewGroupOnPlatform(stored, entry);
  if (!known) {
    const defaults = createDefaultGroup(CBGroupScopes.entryPlatform(entry));
    for (const field of CBGroupScopes.FLAT_SCOPE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(defaults, field)) next[field] = defaults[field];
    }
    // A new entry gets its lines.
    next = foldEntryIntoLines(next);
  }
  state.groups = state.groups.map((item) => (item.id === stored.id ? next : item));
  delete state.drafts[stored.id];
  if (!known) await persistGroups([stored.id]);
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
  const remaining = CBGroupScopes.groupPlatforms({ scopes });
  if (remaining.length === 0) {
    render();
    return;
  }
  const current = activeEntryKey(group);
  const nextKey = remaining.includes(current) ? current : remaining[0];
  const next = viewGroupOnPlatform({ ...stored, scopes }, nextKey);
  state.groups = state.groups.map((item) => (item.id === stored.id ? next : item));
  delete state.drafts[stored.id];
  await persistGroups([stored.id]);
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
    chip.className = `vui-tab scope-chip${key === active ? " is-active" : ""}`;
    chip.setAttribute("role", "listitem");
    chip.tabIndex = 0;
    chip.setAttribute("aria-pressed", key === active ? "true" : "false");
    const label = document.createElement("span");
    const siblings = keys.filter(item => CBGroupScopes.entryPlatform(item) === CBGroupScopes.entryPlatform(key));
    label.textContent = platformKeyLabel(key) + (siblings.length > 1 ? ` ${siblings.indexOf(key) + 1}` : "");
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
    if (editable && keys.length > 1 && ownsEntry(key)) {
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

  // Entries the group does not name yet, of this program's own: apps in the
  // desktop app, websites and platforms in a browser.
  groupScopesAdd.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = t("scopes.add");
  placeholder.selected = true;
  groupScopesAdd.appendChild(placeholder);
  for (const key of ["site", "apps", ...PLATFORM_GROUP_TYPES]) {
    if ((key === "apps" && keys.includes(key)) || !ownsEntry(key)) continue;
    const option = document.createElement("option");
    option.value = key;
    option.textContent = platformKeyLabel(key);
    groupScopesAdd.appendChild(option);
  }
  groupScopesAdd.value = "";
  // Nothing left to add (Mac Vault names only its apps): no dead dropdown.
  groupScopesAdd.hidden = groupScopesAdd.options.length <= 1;
  groupScopesAdd.disabled = !editable;
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
  if (away && refuseWhileDesktopVaultAway(away)) return;

  const plan = CBGroupActions.deleteAllPlan(state.groups, Date.now());
  if (plan.error) {
    setStatus(t("status.bulkDeleteStrictLocked"), true);
    render();
    return;
  }

  if (state.groups.length === 0) {
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
  // The last step's own check: a linked group turned enforce-only meanwhile.
  const away = state.groups.find(isEnforceOnly);
  if (away && refuseWhileDesktopVaultAway(away)) return;
  const ids = state.groups.map((group) => group.id);
  state.groups = [];
  state.drafts = {};
  ++groupSelectionRevision;
  state.selectedGroupId = null;

  // The service worker / Mac Vault drop the groups' usage and snoozes.
  await persistGroups(ids, { message: t("status.bulkDeleted") });
  await rememberGroupSelection();
  render();
}

async function deleteSelectedGroup() {
  await flushAutosave();
  const group = getSelectedGroup();

  if (!group) {
    return;
  }

  if (refuseWhileDesktopVaultAway(group)) return;
  if (!isGroupEditable(group)) {
    setStatus(t("status.frozenCannotDelete"), true);
    render();
    return;
  }

  state.groups = state.groups.filter((item) => item.id !== group.id);
  delete state.drafts[group.id];
  ++groupSelectionRevision;
  state.selectedGroupId = state.groups[0]?.id ?? null;

  await persistGroups([group.id], { message: t("status.deleted", { name: group.name }) });
  await rememberGroupSelection();
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

    await cbDialog.show(
      t(copiedToClipboard ? "editor.exportGroupPromptCopied" : "editor.exportGroupPrompt"),
      exportString,
      { title: t("editor.exportGroupButton"), closeText: t("manual.close") }
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

  if (refuseUnlessEditable(group)) {
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
          title: t("editor.importGroupButton"),
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
      { title: t("editor.importGroupButton"), danger: true, confirmText: t("modal.confirm"), cancelText: t("modal.cancel") }
    );

    if (!confirmed) {
      return;
    }

    // An import replaces the definition, never the lock (the lock is not part
    // of an exported group), and it keeps names unique like any edit.
    if (CBGroupActions.nameTaken(state.groups, importedGroup.name, group.id)) {
      setStatus(t("status.duplicateName"), true);
      return;
    }
    const replacementGroup = { ...importedGroup, ...CBGroupActions.lockUnit(group), id: group.id,
      lockSyncedVersion: group.lockSyncedVersion };

    state.groups = state.groups.map((item) => (item.id === group.id ? replacementGroup : item));
    delete state.drafts[group.id];

    await persistGroups([group.id], { message: t("status.importedGroup", { name: replacementGroup.name }) });
    // An imported group starts fresh (owner 2026-09-27): no time used, no
    // snooze. The runtime's owner (the worker, Mac Vault) resets it.
    await chrome.runtime.sendMessage({ type: "reset-group-runtime", groupId: group.id });
    render();
  } catch (error) {
    console.error("Failed to import block group.", error);
    setStatus(error?.message || t("status.errorImportGroup"), true);
  }
}

function buildUpdatedGroupFromDraft(group, draft) {
  // Never throws: invalid fields keep their last-valid value while every valid
  // field still gets committed, so an unrelated mid-edit field (e.g. a blank
  // name) can't discard the whole update. The first error is returned so the
  // UI can surface it.
  let firstError = null;
  const fail = (error) => {
    if (!firstError) firstError = error;
  };

  let name = draft.name.trim();

  if (!name) {
    fail(new Error(t("status.invalidName")));
    name = group.name;
  }

  // Names are unique per device (duplicates elsewhere are renamed silently).
  if (CBGroupActions.nameTaken(state.groups, name, group.id)) {
    fail(new Error(t("status.duplicateName")));
    name = group.name;
  }

  const mode = normalizeBlockingMode(draft.mode);
  const allowedMinutes = parseAllowedMinutes(draft.allowedMinutes);
  const resetIntervalHours = parseResetIntervalHours(draft.resetIntervalHours);
  const resetAtMidnight = draft.resetAtMidnight === true;
  const rollingLimit = draft.rollingLimit === true;
  const allowSnooze = Boolean(draft.allowSnooze);
  const snoozeKind = draft.snoozeKind === "budget" ? "budget" : "time";
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
  const usesSiteList = CBGroupScopes.entryPlatform(entryKey) === "site";

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
      snoozeKind: isCustomGroup ? (group.snoozeKind === "budget" ? "budget" : "time") : snoozeKind,
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
        ? normalizeTagFilterMode(draft.platformTagMode)
        : group.platformTagMode,
      platformTags: isTagFilterCompatible(group.groupType)
        ? CBGroupScopes.parseTagListText(draft.platformTagsText)
        : group.platformTags,
      platformTagDefaultConfidence: clampTagConfidence(draft.platformTagDefaultConfidence, 4),
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
      // An entry not in view keeps its own values (a custom group's site list).
      sites: usesSiteList ? siteResults.validSites : group.sites,
      // Blocklist (false) vs "block all except" (true).
      allowlist: usesSiteList ? Boolean(draft.allowlist) : group.allowlist,
      apps: entryKey === "apps" ? parseAppsData(draft.appsData) : group.apps,
      appsAllowlist: entryKey === "apps" ? Boolean(draft.appsAllowlist) : group.appsAllowlist,
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
    validationError: firstError
  };
}

async function autosaveSelectedGroup() {
  const group = getSelectedGroup();
  if (!group || !state.drafts[group.id] || !isGroupEditable(group)) return;
  const draft = getDraftForGroup(group.id);
  let validationError = null;
  let next = group;
  try {
    const result = applyDraft(group, draft);
    next = result.group;
    validationError = result.validationError;
  } catch (error) {
    validationError = error;
  }
  state.groups = state.groups.map((item) => (item.id === group.id ? next : item));
  // What is saved leaves the draft; a field still invalid (or a name still
  // being typed) stays in it.
  const remaining = draftChanges(draft, groupToDraft(next));
  if (remaining) state.drafts[group.id] = remaining;
  else delete state.drafts[group.id];

  try {
    await persistGroups([group.id]);
  } catch (error) {
    console.error("Failed to persist groups during autosave.", error);
    setStatus(t("status.errorSaveGroup"), true);
    return;
  }

  if (validationError) {
    setStatus(validationError.message || t("status.errorSaveGroup"), true);
  }
  renderGroupList();
  updateUsageSummary(next, getDraftForGroup(group.id));
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

  if (!group || CBGroupScopes.entryPlatform(activeEntryKey(group)) !== "site" || refuseUnlessEditable(group)) return;

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

  await persistGroups([], { reorder: true });
  render();
}

// Freeze (unlocked) or make the freeze stricter (frozen): the wait field's
// hours are the wait gate; a PIN is set in the guardian settings (gear).
async function applyFreeze() {
  const group = getSelectedGroup();
  if (!group || refuseWhileDesktopVaultAway(group)) return;
  await flushAutosave();
  const current = getSelectedGroup();
  const now = Date.now();
  if (!CBGroupActions.isLocked(current)) {
    const hours = CBGroupActions.parseWaitHours(lockWaitHoursField.value);
    if (hours === null) {
      setStatus(t("status.strictFreezeHours", { max: CBGroupActions.MAX_WAIT_HOURS }), true);
      return;
    }
    const result = CBGroupActions.lockWithGates(current, { waitHours: hours }, now);
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
  if (!group || refuseWhileDesktopVaultAway(group)) return;
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
  // A long flow (a 10 × 5 s confirmation, an open PIN panel) checks again at
  // the end: Mac Vault may have gone away meanwhile.
  if (refuseWhileDesktopVaultAway(state.groups.find((item) => item.id === groupId))) return;
  state.groups = state.groups.map((item) =>
    item.id === groupId ? { ...item, ...fields } : item
  );
  await persistGroups([groupId], { message: statusMsg });
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
    }
  );
  return handle;
}

// Guardian settings overlay: set / verify / clear the group's password.
function openParentalSettings(group) {
  if (refuseWhileDesktopVaultAway(group)) return;
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

  handle = openOverlayPanel(snapshotFor(Boolean(currentGroup().parentalPasswordHash)), onEvent);
}

function closeUnfreezeFlow() {
  state.unfreezeFlow = null;
  confirmModal.classList.add("hidden");
  releaseVaultModal(confirmModal);

  if (state.confirmIntervalId !== null) {
    window.clearInterval(state.confirmIntervalId);
    state.confirmIntervalId = null;
  }
}

function showSnoozeNotice(group, snoozeEntry, totalBeforeMs) {
  const activationDelayMs = Math.max(0, snoozeEntry.startsAtMs - Date.now());
  cbDialog.alert(
    t(snoozeEntry.kind === "budget" ? "snooze.noticePopupBudget" : "snooze.noticePopup", {
      name: group.name,
      total: formatDurationMs(totalBeforeMs),
      upcoming: formatDurationMs(snoozeEntry.kind === "budget" ? snoozeEntry.extraMs : snoozeEntry.untilMs - snoozeEntry.startsAtMs),
      delay: formatDurationMs(activationDelayMs)
    }),
    { title: t("snooze.title"), confirmText: t("modal.confirm") }
  );
}

function renderUnfreezeModal(now = Date.now()) {
  if (!state.unfreezeFlow) {
    confirmModal.classList.add("hidden");
  releaseVaultModal(confirmModal);
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
  focusVaultModal(confirmModal, confirmCancelButton, closeUnfreezeFlow);
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
  confirmProgress.textContent = t("modal.confirmProgress", {
    label: state.unfreezeFlow.label,
    count: state.unfreezeFlow.confirmationsLeft
  });
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

  if (!group || refuseWhileDesktopVaultAway(group)) {
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

  // Custom groups: Start Snooze sends the rule its "snooze" event; the rule
  // decides what happens (the group itself doesn't snooze).
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
    setSnoozeWarning(t(entry.kind === "budget" ? "snooze.warning.activeBudget" : "snooze.warning.active",
      { time: formatDurationMs(entry.untilMs - now) }));
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
  const snoozeEntry = CBGroupActions.snoozeEntry(group, now, state.usageResetAtMs[group.id]);
  state.groupSnoozes[group.id] = snoozeEntry;
  const minutes = Number(group.snoozeMinutes) || 0;
  await persistSnooze(
    group.id,
    snoozeEntry,
    snoozeEntry.startsAtMs > now
      ? t("status.snoozeScheduled", { name: group.name, delay: formatDurationMs(snoozeEntry.startsAtMs - now) })
      : t(snoozeEntry.kind === "budget" ? "status.snoozedBudget" : "status.snoozed",
        { name: group.name, minutes, suffix: minutes === 1 ? "" : "s" })
  );
  render();
  showSnoozeNotice(group, snoozeEntry, totalBeforeMs);
}

async function endSnooze() {
  const group = getSelectedGroup();
  if (!group || refuseWhileDesktopVaultAway(group)) return;
  // Ending keeps an ENDED entry (stamped now) so the end reaches linked
  // devices as the newest change (group-actions.js).
  const result = CBGroupActions.endSnoozeEntry(state.groupSnoozes[group.id], Date.now());
  if (result.error) return;
  state.groupSnoozes[group.id] = result.entry;
  await persistSnooze(group.id, result.entry, t("status.endedSnooze", { name: group.name }));
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
    applyPanelWidth(document.documentElement.dir === "rtl" ? layoutRect.right - moveEvent.clientX : moveEvent.clientX - layoutRect.left);
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

  const selectionChange = changes[QUICK_ADD_GROUP_KEY];
  const incomingSelection = typeof selectionChange?.newValue === "string" ? selectionChange.newValue : "";
  const selectionChangedElsewhere = selectionChange && incomingSelection !== state.quickAddGroupId;
  if (selectionChange) state.quickAddGroupId = incomingSelection;

  if (changes[BLOCKED_GROUPS_KEY]) {
    // Any writer's change (this editor, a linked device, the "+", an AI tool)
    // shows at once; the user's unsaved field edits (the drafts) stay on top.
    state.storedGroups = Array.isArray(changes[BLOCKED_GROUPS_KEY].newValue) ? changes[BLOCKED_GROUPS_KEY].newValue : [];
    // Each group stays on the entry the user was viewing.
    const views = new Map(state.groups.map((group) => [group.id, activeEntryKey(group)]));
    state.groups = CBGroupScopes.sanitizeGroups(state.storedGroups).map((stored) => groupView(stored, views.get(stored.id)));
    for (const id of Object.keys(state.drafts)) {
      if (!state.groups.some((group) => group.id === id)) delete state.drafts[id];
    }
    if (!state.groups.some((group) => group.id === state.selectedGroupId)) {
      ++groupSelectionRevision;
      state.selectedGroupId = state.groups.find((group) => group.id === state.quickAddGroupId)?.id ?? state.groups[0]?.id ?? null;
    }
    if (selectionChangedElsewhere && state.groups.some((group) => group.id === incomingSelection)) {
      void selectGroup(incomingSelection);
    } else if (!state.groups.some((group) => group.id === state.quickAddGroupId)) {
      void rememberGroupSelection();
    }
    render();
    return;
  }

  if (selectionChangedElsewhere) {
    if (state.groups.some((group) => group.id === incomingSelection)) void selectGroup(incomingSelection);
    else void rememberGroupSelection();
  }

  if (shouldRenderDynamicOnly) {
    renderDynamicView();
  }
}

async function commitNameEdit() {
  if (!state.nameEditing) return;
  state.nameEditing = null;
  if (state.autosaveTimeoutId !== null) {
    window.clearTimeout(state.autosaveTimeoutId);
    state.autosaveTimeoutId = null;
  }
  await autosaveSelectedGroup();
}

// A name is being edited from the first keystroke (focus or not) until Enter or
// leaving the field.
function beginNameEdit() {
  const group = getSelectedGroup();
  if (group && !state.nameEditing) state.nameEditing = { id: group.id };
}
groupNameField.addEventListener("focus", beginNameEdit);
groupNameField.addEventListener("blur", () => { void commitNameEdit(); });
groupNameField.addEventListener("keydown", (event) => {
  if (event.key === "Enter") void commitNameEdit();
});

groupNameField.addEventListener("input", () => {
  beginNameEdit();
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

snoozeKindField.addEventListener("change", () => {
  stashCurrentDraft();
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

// Wall-clock watchdog for the Run flow. If a previous custom rule
// already locked the sandbox iframe with an infinite loop, the worker's
// sandbox request hangs until offscreen.js's hard timeout fires (~5s) and
// tears the iframe down. We give the whole round trip a generous 8s budget so the
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
    throw new Error(t("custom.copyFailed"));
  }
}

async function runSelectedCustomGroup() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom" || refuseUnlessEditable(group)) return;
  await flushAutosave();
  const source = String(blockingRulesField?.value ?? "").trim();
  if (runCustomGroupStatus) {
    runCustomGroupStatus.textContent = t("custom.runStatusRunning");
    runCustomGroupStatus.className = "run-status";
  }
  try {
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
          runCustomGroupStatus.textContent = t("custom.runStatusOk", { count: String(lr.handlers ?? 0) });
          runCustomGroupStatus.className = "run-status success";
        }
        setStatus(t("status.customGroupRan", { name: group.name, count: String(lr.handlers ?? 0) }));
      } else {
        // The rule didn't load (the one running before keeps running).
        // A hard timeout from offscreen surfaces as error="sandbox-timeout".
        let displayError = lr.error || t("custom.runStatusError");
        if (lr.error === "sandbox-timeout") {
          displayError = t("custom.runStatusSandboxTimeout");
        } else if (lr.quarantine && lr.quarantine.reason) {
          displayError = t("custom.runStatusQuarantined", { reason: lr.quarantine.reason });
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
  for (const entry of CBGroupScopes.parseTagListText(textarea?.value || "")) {
    for (const name of [entry.name, ...(entry.also || [])]) used.add(name.toLowerCase());
  }
  return used;
}
let activeTagChooser = null;
const tagSuggestionState = new WeakMap();
function closeTagChooser(restoreFocus = false) {
  const chooser = activeTagChooser;
  if (!chooser) return;
  activeTagChooser = null;
  chooser.menu.remove();
  chooser.button.setAttribute("aria-expanded", "false");
  if (restoreFocus && chooser.button.isConnected) chooser.button.focus({ preventScroll: true });
}
function placeTagChooser() {
  const chooser = activeTagChooser;
  if (!chooser) return;
  if (!chooser.button.isConnected || !chooser.button.getClientRects().length) return closeTagChooser();
  const box = chooser.button.getBoundingClientRect(), menu = chooser.menu;
  const width = Math.min(Math.max(240, box.width), innerWidth - 16);
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
  menu.style.maxHeight = `${Math.min(320, innerHeight - 16)}px`;
  const below = innerHeight - box.bottom - 12, above = box.top - 12;
  const up = below < menu.offsetHeight && above > below;
  menu.style.maxHeight = `${Math.max(0, Math.min(320, up ? above : below))}px`;
  menu.style.top = `${Math.max(8, Math.min(up ? box.top - menu.offsetHeight - 4 : box.bottom + 4, innerHeight - menu.offsetHeight - 8))}px`;
}
function updateTagChooser() {
  const chooser = activeTagChooser;
  if (!chooser) return;
  if (chooser.groupID !== getSelectedGroup()?.id || chooser.entryID !== activeEntryKey(getSelectedGroup())) return closeTagChooser();
  const { textarea, names } = tagSuggestionState.get(chooser.container);
  const query = chooser.search.value.trim().toLowerCase(), used = usedTagNames(textarea);
  const scroll = chooser.list.scrollTop;
  VaultUI.renderList(chooser.list, { scope: chooser.menu, key: "available-tags", searchable: false, label: t("tagFilter.available"),
    items: names.filter(name => name.toLowerCase().includes(query)), text: name => name, render: name => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "vui-menu-item" + (used.has(name.toLowerCase()) ? " is-selected" : "");
    item.textContent = name;
    item.disabled = textarea.disabled || used.has(name.toLowerCase());
    item.addEventListener("click", () => {
      if (textarea.disabled || chooser.groupID !== getSelectedGroup()?.id || chooser.entryID !== activeEntryKey(getSelectedGroup())) return closeTagChooser();
      const current = textarea.value.replace(/\s+$/, "");
      textarea.value = current ? `${current}\n${name}` : name;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      refreshChipField(textarea);
      updateTagChooser();
      chooser.search.focus({ preventScroll: true });
    });
    return item;
  } });
  chooser.list.scrollTop = scroll;
  placeTagChooser();
}
function openTagChooser(container, button) {
  if (activeTagChooser?.container === container) return closeTagChooser(true);
  closeTagChooser();
  window.VaultUI.close();
  const menu = document.createElement("div");
  menu.className = "vui-menu tag-chooser";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = t("tagFilter.tags");
  search.setAttribute("aria-label", t("tagFilter.available"));
  const list = document.createElement("div");
  list.className = "vui-list-box tag-chooser-list";
  list.setAttribute("aria-label", t("tagFilter.available"));
  const searchRow = document.createElement("div");
  searchRow.className = "vui-info-field";
  searchRow.dataset.infoKey = "tag-search"; searchRow.dataset.infoLabel = t("contentTag.search");
  searchRow.dataset.infoCopy = t("info.tagSearch");
  searchRow.appendChild(search); menu.append(searchRow, list);
  document.body.appendChild(menu);
  VaultUI.showMenuLayer(menu);
  activeTagChooser = { container, button, menu, search, list, groupID: getSelectedGroup()?.id, entryID: activeEntryKey(getSelectedGroup()) };
  button.setAttribute("aria-expanded", "true");
  search.addEventListener("input", updateTagChooser);
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeTagChooser(true); }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && !event.isComposing) {
      const items = [...list.querySelectorAll("button:not(:disabled)")];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      const next = index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1)
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      event.preventDefault();
      items[next].focus({ preventScroll: true });
      items[next].scrollIntoView({ block: "nearest" });
    }
  });
  menu.addEventListener("focusout", () => requestAnimationFrame(() => {
    if (activeTagChooser?.menu === menu && !menu.contains(document.activeElement) && document.activeElement !== button) closeTagChooser();
  }));
  updateTagChooser();
  search.focus({ preventScroll: true });
}
function renderTagSuggestions(container, textarea, names) {
  if (!container || !textarea) return;
  tagSuggestionState.set(container, { textarea, names });
  container.classList.toggle("hidden", names.length === 0);
  if (!names.length) {
    if (activeTagChooser?.container === container) closeTagChooser();
    container.replaceChildren();
    return;
  }
  let button = container.querySelector("button");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "secondary tag-suggestion-trigger";
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => openTagChooser(container, button));
    container.replaceChildren(button);
  }
  button.textContent = t("tagFilter.available");
  if (activeTagChooser?.container === container) updateTagChooser();
}
document.addEventListener("pointerdown", event => {
  const chooser = activeTagChooser;
  if (chooser && !chooser.menu.contains(event.target) && !chooser.button.contains(event.target)) closeTagChooser();
}, true);
document.addEventListener("scroll", event => {
  if (activeTagChooser && !activeTagChooser.menu.contains(event.target)) placeTagChooser();
}, true);
window.addEventListener("resize", placeTagChooser);
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
async function copyCodeDocs() {
  try {
    const docs = fetchManualMarkdown("en", "code");
    // WebKit requires the write request inside the click gesture. The item
    // may resolve later, after the bundled guide finishes loading.
    if (navigator.clipboard?.write && typeof ClipboardItem === "function") {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": docs.then(text => new Blob([text], { type: "text/plain" }))
      })]);
    } else {
      await copyTextToClipboard(await docs);
    }
    setStatus(t("custom.docsCopied"));
  } catch (error) {
    setStatus(error?.message || t("custom.copyFailed"), true);
  }
}

copyCodeDocsButton?.addEventListener("click", copyCodeDocs);

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
    const entry = key === "apps" ? key : CBGroupScopes.newEntryKey(key);
    setGroupPlatformView(entry).catch((error) => {
      console.error("Failed to add the platform to the group.", error);
      setStatus(t("status.errorSaveGroup"), true);
      render();
    });
  });
}

platformAuthorModeField.addEventListener("change", () => {
  platformTagModeField.value = platformAuthorModeField.value.startsWith("tags-") ? platformAuthorModeField.value.slice(5) : "all";
  if (platformAuthorModeField.value === "exclude") {
    setStatus(t("status.allowlistWarning"));
  }
  stashCurrentDraft();
  render();
  scheduleAutosave();
});

// Content-tag filter fields.
if (platformTagModeField) {
  platformTagModeField.addEventListener("change", () => {
    stashCurrentDraft();
    render(); // re-toggles the tag list + untagged row for the new mode
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

document.getElementById("emptyAddGroupButton").addEventListener("click", () => addGroupButton.click());

for (const [button, groupType] of [[addGroupButton, DEFAULT_GROUP_TYPE], [document.getElementById("addCustomGroupButton"), "custom"]]) {
  button.addEventListener("click", () => {
    addGroup(groupType).catch((error) => {
      console.error("Failed to add block group.", error);
      setStatus(t("status.errorCreateGroup"), true);
    });
  });
}

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
  const settingsAutoSaveFields = [settingsQuitRetryMinutesField, settingsQuickAddField];
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
  if (!VaultUI.confirmClick(deleteAllGroupsButton, t("confirm.clickAgain"))) return;
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
  if (!VaultUI.confirmClick(deleteGroupButton, t("confirm.clickAgain"))) return;
  deleteSelectedGroup().catch((error) => {
    console.error("Failed to delete block group.", error);
    setStatus(t("status.errorDeleteGroup"), true);
  });
});

clearSitesButton.addEventListener("click", () => {
  if (VaultUI.confirmClick(clearSitesButton, t("confirm.clickAgain"))) clearSelectedSites();
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
    applyPanelWidth(state.panelWidth + (document.documentElement.dir === "rtl" ? 20 : -20));
  } else if (event.key === "ArrowRight") {
    applyPanelWidth(state.panelWidth + (document.documentElement.dir === "rtl" ? -20 : 20));
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
// Activity log feed — displays the rules' v.log() output inside the
// popup itself. Pulls a buffer from background on open and subscribes to
// live "log-feed-entry" broadcasts.
// ────────────────────────────────────────────────────────────────────────

const LOG_FEED_MAX_RENDER = 200;
const logFeedList = document.getElementById("logFeedList");
const logFeedCount = document.getElementById("logFeedCount");
const logFeedClear = document.getElementById("logFeedClear");
const logFeedDownload = document.getElementById("logFeedDownload");
if (logFeedList) logFeedList.addEventListener("vui-search-filtered", updateLogFeedVisibleCount);
const logFeedSeenIds = new Set();
let logFeedGroupId = null;
let logFeedRequestId = 0;

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
  if (!entry || !logFeedList || entry.source !== "v.log" || !entry.groupId
      || entry.groupId !== state.selectedGroupId || entry.groupId !== logFeedGroupId) return;
  if (entry.id != null && logFeedSeenIds.has(entry.id)) return;
  if (entry.id != null) logFeedSeenIds.add(entry.id);

  const row = document.createElement("div");
  row.className = "log-feed-entry";
  row.setAttribute("data-group-id", entry.groupId);
  const meta = document.createElement("span");
  meta.className = "log-feed-meta";
  const parts = [];
  parts.push(formatLogFeedTime(entry.ts));
  if (entry.eventType) parts.push(entry.eventType);
  if (entry.level && entry.level !== "log") parts.push(entry.level.toUpperCase());
  meta.textContent = parts.filter(Boolean).join(" · ");
  row.appendChild(meta);
  const body = document.createElement("span");
  body.className = "log-feed-message";
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
    if (child.style.display !== "none" && !child.classList.contains("vui-search-hidden")) count++;
  }
  logFeedCount.textContent = String(count);
}

function resetLogFeedView() {
  if (logFeedList) logFeedList.replaceChildren();
  logFeedSeenIds.clear();
  if (logFeedCount) logFeedCount.textContent = "0";
}

function filterLogFeedByGroup() {
  const groupId = state.selectedGroupId || null;
  if (groupId === logFeedGroupId) return;
  logFeedGroupId = groupId;
  resetLogFeedView();
  loadLogFeedSnapshot();
}

async function loadLogFeedSnapshot() {
  const groupId = logFeedGroupId;
  const requestId = ++logFeedRequestId;
  if (!logFeedList || !groupId) return;
  try {
    const response = await chrome.runtime.sendMessage({ type: "get-log-feed", groupId });
    if (requestId !== logFeedRequestId || groupId !== logFeedGroupId || !response?.ok) return;
    for (const entry of response.entries || []) renderLogFeedEntry(entry);
  } catch (_) {}
}

function clearLogFeed() {
  const groupId = logFeedGroupId;
  if (!groupId) return;
  ++logFeedRequestId; // An older snapshot must not undo Clear.
  resetLogFeedView();
  try { chrome.runtime.sendMessage({ type: "clear-log-feed", groupId }).catch(() => {}); } catch (_) {}
}

if (logFeedClear) {
  logFeedClear.addEventListener("click", clearLogFeed);
}

if (logFeedDownload) {
  logFeedDownload.addEventListener("click", () => {
    const entries = [];
    if (logFeedList) {
      logFeedList.querySelectorAll(".log-feed-entry").forEach((el) => {
        if (el.getAttribute("data-group-id") !== logFeedGroupId) return;
        const meta = el.querySelector(".log-feed-meta");
        const msg = el.querySelector(".log-feed-message");
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
      applyClusters(message.clusters, message.rosters);
      return;
    }
    if (message.type === "link-refused") {
      showLinkRefusal(message.reason);
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
  await loadLogFeedSnapshot();
  // Banner runs after translations are applied so the labels read in
  // the user's language, and runs after loadGroups so the popup is in a
  // visible-and-laid-out state before the banner pops in.
  initializeSiteAccessBanner().catch((error) => {
    cbDebugError("site access banner init failed", error);
  });
  window.setInterval(() => {
    renderDynamicView();
  }, 1000);

  // The link state the editor shows: transport status and current links.
  requestConnectionStatus();
  requestClusters();
}

initializePopupApp().catch((error) => {
  console.error("Failed to initialize popup.", error);
  setStatus(t("status.errorLoadGroups"), true);
});

window.VaultInfo?.watch(document, { enabled: () => true });
