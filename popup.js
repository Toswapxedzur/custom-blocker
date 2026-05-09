const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";
const GLOBAL_SETTINGS_KEY = "globalSettings";
const LAYOUT_WIDTH_STORAGE_KEY = "custom-blocker-groups-panel-width";
const LANGUAGE_STORAGE_KEY = "custom-blocker-language";
const GROUP_TRANSFER_PREFIX = "custom-blocker-group:v1:";

// Extension-wide preferences. Keep these defaults in sync with the
// placeholder text in popup.html's Settings modal.
const DEFAULT_GLOBAL_SETTINGS = {
  tickRateMs: 1000,
  autosaveDebounceMs: 400,
  showDebugOverlay: true,
  defaultSnoozeMinutes: 30,
  defaultFallbackUrl: "about:blank"
};
const TICK_RATE_MIN_MS = 250;
const TICK_RATE_MAX_MS = 60_000;
const AUTOSAVE_DEBOUNCE_MAX_MS = 5_000;

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
const UNFREEZE_CONFIRMATIONS_REQUIRED = 20;
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
const blockingRulesField = document.getElementById("blockingRules");
const openRuleTemplatesButton = document.getElementById("openRuleTemplatesButton");
const platformVideoCard = document.getElementById("platformVideoCard");
const platformVideoTitle = document.getElementById("platformVideoTitle");
const platformVideoCopy = document.getElementById("platformVideoCopy");
const platformVideoModeLabel = document.getElementById("platformVideoModeLabel");
const platformVideoModeField = document.getElementById("platformVideoMode");
const platformVideoModeAllOption = platformVideoModeField.querySelector('option[value="all"]');
const platformVideoModeShortOption = platformVideoModeField.querySelector('option[value="short"]');
const platformVideoModeLongOption = platformVideoModeField.querySelector('option[value="long"]');
const platformVideoModePostOption = platformVideoModeField.querySelector('option[value="post"]');
const platformAuthorModeLabel = document.getElementById("platformAuthorModeLabel");
const platformAuthorModeField = document.getElementById("platformAuthorMode");
const platformAuthorModeNoneOption = platformAuthorModeField.querySelector('option[value="none"]');
const platformAuthorModeIncludeOption = platformAuthorModeField.querySelector('option[value="include"]');
const platformAuthorModeExcludeOption = platformAuthorModeField.querySelector('option[value="exclude"]');
const platformAuthorsLabel = document.getElementById("platformAuthorsLabel");
const platformAuthorsField = document.getElementById("platformAuthors");
const platformVideoHelp = document.getElementById("platformVideoHelp");
const platformBlockHomePageField = document.getElementById("platformBlockHomePage");
const skipToNextOnBlockRow = document.getElementById("skipToNextOnBlockRow");
const skipToNextOnBlockField = document.getElementById("skipToNextOnBlock");
const redditSettingsCard = document.getElementById("redditSettingsCard");
const redditModeField = document.getElementById("redditMode");
const redditSubredditsField = document.getElementById("redditSubreddits");
const redditBlockHomePageField = document.getElementById("redditBlockHomePage");
const discordSettingsCard = document.getElementById("discordSettingsCard");
const discordModeField = document.getElementById("discordMode");
const discordTargetsField = document.getElementById("discordTargets");
const discordBlockHomePageField = document.getElementById("discordBlockHomePage");
const fallbackUrlSection = document.getElementById("fallbackUrlSection");
const fallbackUrlField = document.getElementById("fallbackUrl");
const freezeSummary = document.getElementById("freezeSummary");
const freezeSetup = document.getElementById("freezeSetup");
const freezeModeField = document.getElementById("freezeMode");
const strictFreezeSettings = document.getElementById("strictFreezeSettings");
const strictFreezeHoursField = document.getElementById("strictFreezeHours");
const applyFreezeButton = document.getElementById("applyFreezeButton");
const unfreezeButton = document.getElementById("unfreezeButton");
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
const clearSitesButton = document.getElementById("clearSitesButton");
const runCustomGroupButton = document.getElementById("runCustomGroupButton");
const checkSyntaxButton = document.getElementById("checkSyntaxButton");
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
const settingsShowDebugOverlayField = document.getElementById("settingsShowDebugOverlay");
const settingsDefaultSnoozeMinutesField = document.getElementById("settingsDefaultSnoozeMinutes");
const settingsDefaultFallbackUrlField = document.getElementById("settingsDefaultFallbackUrl");
const settingsResetButton = document.getElementById("settingsResetButton");
const settingsSaveButton = document.getElementById("settingsSaveButton");
const settingsStatus = document.getElementById("settingsStatus");
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
  dropTargetGroupId: null,
  dropInsertAfter: false,
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
  language: "en",
  translationMessages: {},
  translationLoadPromises: {}
};

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

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}

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
    manualContent.innerHTML = renderMarkdownToHtml(markdown);
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

function syncSettingsFormFromState() {
  const s = state.globalSettings || DEFAULT_GLOBAL_SETTINGS;
  if (settingsTickRateField) settingsTickRateField.value = String(s.tickRateMs);
  if (settingsAutosaveDebounceField) settingsAutosaveDebounceField.value = String(s.autosaveDebounceMs);
  if (settingsShowDebugOverlayField) settingsShowDebugOverlayField.checked = Boolean(s.showDebugOverlay);
  if (settingsDefaultSnoozeMinutesField) settingsDefaultSnoozeMinutesField.value = String(s.defaultSnoozeMinutes);
  if (settingsDefaultFallbackUrlField) settingsDefaultFallbackUrlField.value = s.defaultFallbackUrl ?? "";
  if (settingsStatus) settingsStatus.textContent = "";
}

function openSettings() {
  state.isSettingsOpen = true;
  syncSettingsFormFromState();
  settingsModal.classList.remove("hidden");
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
    showDebugOverlay: settingsShowDebugOverlayField?.checked ?? true,
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

function normalizeYouTubeCreatorInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      trimmed = parsed.pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/@")) {
    return trimmed.slice(2).split("/")[0] || null;
  }

  if (trimmed.startsWith("@")) {
    return trimmed.slice(1) || null;
  }

  const pathLike = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const channelMatch = pathLike.match(/^channel\/([^/?#]+)/);
  const customMatch = pathLike.match(/^c\/([^/?#]+)/);
  const userMatch = pathLike.match(/^user\/([^/?#]+)/);

  if (channelMatch) {
    return `channel:${channelMatch[1]}`;
  }

  if (customMatch) {
    return `c:${customMatch[1]}`;
  }

  if (userMatch) {
    return `user:${userMatch[1]}`;
  }

  if (/^(channel|c|user):[a-z0-9._-]+$/i.test(pathLike)) {
    return pathLike;
  }

  return /^[a-z0-9._-]+$/i.test(pathLike) ? pathLike : null;
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
  const showDebugOverlay = src.showDebugOverlay !== false;
  return { tickRateMs, autosaveDebounceMs, showDebugOverlay, defaultSnoozeMinutes, defaultFallbackUrl };
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

function normalizeGroupType(value) {
  return value === "youtube" ||
    value === "tiktok" ||
    value === "facebook" ||
    value === "instagram" ||
    value === "twitch" ||
    value === "reddit" ||
    value === "discord" ||
    value === "custom"
    ? value
    : "site";
}

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

function applyPlatformVideoUi(groupType) {
  const platform = getPlatformDisplayName(groupType);
  const shortLabel = getPlatformTypeLabel(groupType, "short");
  const longLabel = getPlatformTypeLabel(groupType, "long");
  const postLabel = getPlatformTypeLabel(groupType, "post");
  const isYouTube = groupType === "youtube";

  platformVideoTitle.textContent = t("platform.filtersTitle", { platform });
  platformVideoCopy.textContent = t("platform.copy", {
    platform,
    shortLabel,
    longLabel,
    postLabel
  });
  platformVideoModeLabel.textContent = t("platform.videoMode");
  platformVideoModeAllOption.textContent = t("platform.videoModeAll", { platform });
  platformVideoModeShortOption.textContent = t("platform.videoModeShort", { content: shortLabel });
  platformVideoModeLongOption.textContent = t("platform.videoModeLong", { content: longLabel });
  platformVideoModePostOption.textContent = t("platform.videoModePost", { content: postLabel });
  platformAuthorModeLabel.textContent = t("platform.authorMode");
  platformAuthorModeNoneOption.textContent = t("platform.authorModeNone");
  platformAuthorModeIncludeOption.textContent = t("platform.authorModeInclude");
  platformAuthorModeExcludeOption.textContent = t("platform.authorModeExclude");
  platformAuthorsLabel.textContent = t("platform.authors");
  platformAuthorsField.setAttribute("placeholder", getPlatformAuthorsPlaceholder(groupType));
  platformVideoHelp.textContent = isYouTube
    ? t("platform.help.youtube", { platform })
    : t("platform.help.generic", { platform, shortLabel, longLabel, postLabel });
}

function normalizePlatformAuthorMode(value) {
  return value === "include" || value === "exclude" ? value : "none";
}

function normalizeRedditMode(value, fallbackList) {
  if (value === "all" || value === "include" || value === "exclude") {
    return value;
  }

  const list = Array.isArray(fallbackList) ? fallbackList : [];
  return list.length > 0 ? "include" : "all";
}

function normalizeDiscordMode(value, fallbackList) {
  if (value === "all" || value === "include" || value === "exclude") {
    return value;
  }

  const list = Array.isArray(fallbackList) ? fallbackList : [];
  return list.length > 0 ? "include" : "all";
}

function isPlatformVideoGroupType(groupType) {
  const normalized = normalizeGroupType(groupType);
  return normalized === "youtube" ||
    normalized === "tiktok" ||
    normalized === "facebook" ||
    normalized === "instagram" ||
    normalized === "twitch";
}

function normalizePlatformAuthorInput(value, groupType) {
  const normalizedGroupType = normalizeGroupType(groupType);

  if (normalizedGroupType === "youtube") {
    return normalizeYouTubeCreatorInput(value);
  }

  let trimmed = String(value ?? "").trim().toLowerCase();
  const extractFromPath = (pathLike) => {
    const path = String(pathLike || "").replace(/^\/+|\/+$/g, "");
    const first = path.split("/")[0] || "";

    if (normalizedGroupType === "tiktok") {
      return first.startsWith("@")
        ? first.slice(1) || null
        : /^[a-z0-9._-]+$/i.test(first)
          ? first
          : null;
    }

    if (normalizedGroupType === "instagram") {
      const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
      return !reserved.has(first) && /^[a-z0-9._]+$/i.test(first) ? first : null;
    }

    if (normalizedGroupType === "facebook") {
      if (path.startsWith("profile.php")) {
        return null;
      }
      const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
      return !reserved.has(first) && /^[a-z0-9.]+$/i.test(first) ? first : null;
    }

    if (normalizedGroupType === "twitch") {
      const reserved = new Set([
        "directory",
        "videos",
        "settings",
        "downloads",
        "subscriptions",
        "search",
        "jobs",
        "drops",
        "inventory"
      ]);
      return !reserved.has(first) && /^[a-z0-9_]+$/i.test(first) ? first : null;
    }

    return null;
  };

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/^\/+|\/+$/g, "");

      if (normalizedGroupType === "facebook") {
        if (path.startsWith("profile.php")) {
          const id = parsed.searchParams.get("id");
          return id ? `id:${id}` : null;
        }
      }
      const extracted = extractFromPath(path);
      if (extracted) {
        return extracted;
      }
      trimmed = path;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    return extractFromPath(trimmed);
  }

  trimmed = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");

  if (normalizedGroupType === "facebook" && trimmed.startsWith("id:")) {
    return trimmed;
  }

  return /^[a-z0-9._-]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeVideoMode(value) {
  return value === "short" || value === "long" || value === "post" ? value : "all";
}

function normalizeRedditSubredditInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }

  trimmed = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");

  if (trimmed.startsWith("r/")) {
    trimmed = trimmed.slice(2);
  }

  return /^[a-z0-9_]+$/i.test(trimmed) ? trimmed : null;
}

// Accepts a bare snowflake or a /channels/<server>[/<channel>] URL.
// Returns a single numeric ID (channel preferred over server when both
// are present). Match logic later compares this against the page's
// server-id and channel-id, so callers don't need to know which it is.
function normalizeDiscordTargetInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }

  trimmed = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  const channelsMatch = trimmed.match(/^channels\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (channelsMatch) {
    trimmed = channelsMatch[2] || channelsMatch[1] || "";
  }

  if (trimmed === "@me") {
    return null;
  }

  return /^[0-9]{6,24}$/.test(trimmed) ? trimmed : null;
}

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

function quoteJs(value) {
  return JSON.stringify(String(value ?? ""));
}

function minutesToMsLiteral(value) {
  return Math.round(Number(value) * MS_PER_MINUTE);
}

const CUSTOM_RULE_TEMPLATES = [
  {
    id: "weekday-window-block",
    title: "Weekday Block Window",
    description: "Block one site only during a weekday time window. Uses openWebEvent + switchWebEvent to evaluate every visit.",
    tags: ["schedule", "site"],
    params: [
      { id: "domainContains", label: "URL contains", type: "text", defaultValue: "youtube.com" },
      { id: "startHour", label: "Start hour", type: "number", min: 0, max: 23, step: 1, defaultValue: 9 },
      { id: "endHour", label: "End hour", type: "number", min: 1, max: 24, step: 1, defaultValue: 18 },
      {
        id: "daysCsv",
        label: "Days (comma separated)",
        type: "text",
        span: 2,
        defaultValue: "Monday,Tuesday,Wednesday,Thursday,Friday"
      }
    ],
    buildCode(values) {
      const days = String(values.daysCsv || "")
        .split(",")
        .map((day) => day.trim())
        .filter(Boolean)
        .map(quoteJs)
        .join(", ");
      return `(event, helpers) => {
  const target = ${quoteJs(values.domainContains)};
  const blockedDays = [${days}];

  function decide(ev) {
    if (!ev.url.includes(target)) return;
    if (!blockedDays.includes(ev.time.dayName)) return;
    if (ev.time.hour < ${Number(values.startHour)} || ev.time.hour >= ${Number(values.endHour)}) return;
    ev.preventDefault();
    ev.setResult(-1);
  }

  event.registerOpenWebEvent("weekday-block", decide);
  event.registerSwitchWebEvent("weekday-block", decide);
}`;
    }
  },
  {
    id: "site-time-budget",
    title: "Website Time Budget",
    description: "Tick a shared countdown while you are on the site (tickEvent), then block it via openWebEvent.",
    tags: ["timer", "site"],
    params: [
      { id: "domainContains", label: "URL contains", type: "text", defaultValue: "reddit.com" },
      { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 20 },
      { id: "timerId", label: "Timer ID", type: "text", defaultValue: "budget-site" },
      { id: "displayName", label: "Display name", type: "text", defaultValue: "Site Budget" }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const TIMER_ID = ${quoteJs(values.timerId)};

  // Ensure the budget timer exists once at registration time.
  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)}
  });

  event.registerTickEvent("tick-budget", (ev, h) => {
    if (!ev.url.includes(TARGET)) return;
    h.getTimerHelper().addMs(TIMER_ID, -1000);
  });

  function blockIfExpired(ev, h) {
    if (!ev.url.includes(TARGET)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("block-when-expired", blockIfExpired);
  event.registerSwitchWebEvent("block-when-expired", blockIfExpired);
}`;
    }
  },
  {
    id: "youtube-shorts-cap",
    title: "YouTube Shorts Daily Cap",
    description: "Tick a Shorts-only timer; block when it hits zero. Also fires timerEnded so you can react.",
    tags: ["timer", "youtube", "shorts"],
    params: [
      { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 30 },
      { id: "timerId", label: "Timer ID", type: "text", defaultValue: "yt-shorts" },
      { id: "displayName", label: "Display name", type: "text", defaultValue: "YT Shorts" }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const yt = helpers.getDomainHelper().youtube();

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)}
  });

  event.registerTickEvent("yt-shorts-tick", (ev, h) => {
    if (!yt.isShortUrl(ev.url)) return;
    h.getTimerHelper().addMs(TIMER_ID, -1000);
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("yt-shorts-block", maybeBlock);
  event.registerSwitchWebEvent("yt-shorts-block", maybeBlock);

  event.registerTimerEndedEvent("yt-shorts-ended", (ev, h) => {
    h.getLogHelper().log("YouTube Shorts time used up:", ev.data);
  });
}`;
    }
  },
  {
    id: "tiktok-short-cap",
    title: "TikTok Feed Cap",
    description: "Tick a TikTok-only timer; block any TikTok page once it expires.",
    tags: ["timer", "tiktok", "shorts"],
    params: [
      { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 20 },
      { id: "timerId", label: "Timer ID", type: "text", defaultValue: "tiktok-feed" },
      { id: "displayName", label: "Display name", type: "text", defaultValue: "TikTok" }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const tiktok = helpers.getDomainHelper().tiktok();

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)}
  });

  event.registerTickEvent("tt-tick", (ev, h) => {
    if (!tiktok.isShortUrl(ev.url)) return;
    h.getTimerHelper().addMs(TIMER_ID, -1000);
  });

  function maybeBlock(ev, h) {
    if (!tiktok.isPlatformUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("tt-block", maybeBlock);
  event.registerSwitchWebEvent("tt-block", maybeBlock);
}`;
    }
  },
  {
    id: "instagram-reels-cap",
    title: "Instagram Reels Cap",
    description: "Track Reels with a per-second tick; block any Instagram page once expired.",
    tags: ["timer", "instagram", "shorts"],
    params: [
      { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 15 },
      { id: "timerId", label: "Timer ID", type: "text", defaultValue: "ig-reels" },
      { id: "displayName", label: "Display name", type: "text", defaultValue: "IG Reels" }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const ig = helpers.getDomainHelper().instagram();

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)}
  });

  event.registerTickEvent("ig-tick", (ev, h) => {
    if (!ig.isShortUrl(ev.url)) return;
    h.getTimerHelper().addMs(TIMER_ID, -1000);
  });

  function maybeBlock(ev, h) {
    if (!ig.isPlatformUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("ig-block", maybeBlock);
  event.registerSwitchWebEvent("ig-block", maybeBlock);
}`;
    }
  },
  {
    id: "hide-youtube-shorts-author-length",
    title: "Hide Shorts By Author Length",
    description: "On every YouTube open, hide Shorts whose author handle is longer than a threshold.",
    tags: ["feed", "youtube", "shorts"],
    params: [
      { id: "maxAuthorLength", label: "Max author length", type: "number", min: 1, step: 1, defaultValue: 16 },
      { id: "blockPageOnVisit", label: "Block direct visits", type: "checkbox", defaultValue: true }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  function configure(ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShortButton();
    yt.hideShorts(
      (item) => item.author && item.author.length > ${Number(values.maxAuthorLength)},
      { blockPageOnVisit: ${Boolean(values.blockPageOnVisit)} }
    );
  }

  event.registerOpenWebEvent("hide-shorts", configure);
  event.registerSwitchWebEvent("hide-shorts", configure);
}`;
    }
  },
  {
    id: "hide-youtube-videos-keyword",
    title: "Hide Videos By Keyword",
    description: "Hide YouTube long-form videos whose titles contain a keyword.",
    tags: ["feed", "youtube"],
    params: [
      { id: "keyword", label: "Keyword", type: "text", defaultValue: "drama" },
      { id: "blockPageOnVisit", label: "Block direct visits", type: "checkbox", defaultValue: false }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const KEYWORD = ${quoteJs(String(values.keyword || "").toLowerCase())};

  function configure(ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideVideos(
      (item) => {
        const text =
          typeof item?.name === "string"
            ? item.name
            : typeof item?.title === "string"
              ? item.title
              : "";
        return text.toLowerCase().includes(KEYWORD);
      },
      { blockPageOnVisit: ${Boolean(values.blockPageOnVisit)} }
    );
  }
  event.registerOpenWebEvent("hide-keyword", configure);
  event.registerSwitchWebEvent("hide-keyword", configure);
}`;
    }
  },
  {
    id: "reddit-subreddit-work-block",
    title: "Block One Subreddit At Work",
    description: "Block a subreddit only during a chosen daily work window. Reacts to navigation events.",
    tags: ["schedule", "reddit"],
    params: [
      { id: "subreddit", label: "Subreddit", type: "text", defaultValue: "all" },
      { id: "startHour", label: "Start hour", type: "number", min: 0, max: 23, step: 1, defaultValue: 9 },
      { id: "endHour", label: "End hour", type: "number", min: 1, max: 24, step: 1, defaultValue: 17 }
    ],
    buildCode(values) {
      let normalizedSubreddit = String(values.subreddit || "").trim().toLowerCase();
      if (normalizedSubreddit.startsWith("r/")) {
        normalizedSubreddit = normalizedSubreddit.slice(2);
      }
      return `(event, helpers) => {
  const TARGET = ${quoteJs(normalizedSubreddit)};

  function decide(ev) {
    if (!ev.url.toLowerCase().includes("/r/" + TARGET + "/")) return;
    if (["Saturday", "Sunday"].includes(ev.time.dayName)) return;
    if (ev.time.hour < ${Number(values.startHour)} || ev.time.hour >= ${Number(values.endHour)}) return;
    ev.preventDefault();
    ev.setResult(-1);
  }

  event.registerOpenWebEvent("subreddit-work-block", decide);
  event.registerSwitchWebEvent("subreddit-work-block", decide);
}`;
    }
  },
  {
    id: "weekend-only-access",
    title: "Weekend-Only Access",
    description: "Allow a site only on weekends and block it on weekdays.",
    tags: ["schedule", "site"],
    params: [
      { id: "domainContains", label: "URL contains", type: "text", defaultValue: "twitch.tv" }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};

  function decide(ev) {
    if (!ev.url.includes(TARGET)) return;
    const weekend = ["Saturday", "Sunday"].includes(ev.time.dayName);
    if (weekend) {
      ev.setResult(1);
    } else {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("weekend-only", decide);
  event.registerSwitchWebEvent("weekend-only", decide);
}`;
    }
  },
  {
    id: "one-free-visit",
    title: "One Free Visit Then Block",
    description: "Allow the first N matching visits, then block every later one until you clear persistence.",
    tags: ["site", "persistence"],
    params: [
      { id: "domainContains", label: "URL contains", type: "text", defaultValue: "news.ycombinator.com" },
      { id: "allowedVisits", label: "Allowed visits", type: "number", min: 1, step: 1, defaultValue: 1 }
    ],
    buildCode(values) {
      return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const ALLOWED = ${Number(values.allowedVisits)};

  function decide(ev, h) {
    if (!ev.url.includes(TARGET)) return;
    const store = h.getPersistenceHelper();
    const visitKey = "visit-count:" + TARGET;
    const pageKey = "last-url:" + TARGET;
    const currentCount = Number(store.get(visitKey, 0) || 0);

    if (store.get(pageKey) !== ev.url) {
      store.set(pageKey, ev.url);
      store.set(visitKey, currentCount + 1);
    }

    if (Number(store.get(visitKey, 0) || 0) > ALLOWED) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("free-visit-block", decide);
  event.registerSwitchWebEvent("free-visit-block", decide);
}`;
    }
  }
];

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

function getTemplateFilterOptions() {
  const seen = new Set();
  const options = [];

  for (const template of CUSTOM_RULE_TEMPLATES) {
    for (const tag of getTemplateTags(template)) {
      if (seen.has(tag)) {
        continue;
      }
      seen.add(tag);
      const translationKey = `custom.templateTag.${tag}`;
      const translated = t(translationKey);
      options.push({
        value: tag,
        label:
          translated !== translationKey
            ? translated
            : tag.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
      });
    }
  }

  return options;
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
  code.textContent = preview;
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

function clearDragState(shouldRender = true) {
  state.draggedGroupId = null;
  state.dropTargetGroupId = null;
  state.dropInsertAfter = false;

  if (shouldRender) {
    renderGroupList();
  }
}

function updateDragTarget(clientY) {
  const cards = Array.from(groupList.querySelectorAll(".group-card[data-group-id]")).filter(
    (card) => card.dataset.groupId !== state.draggedGroupId
  );

  if (cards.length === 0) {
    state.dropTargetGroupId = null;
    state.dropInsertAfter = false;
    renderGroupList();
    return;
  }

  let bestCard = cards[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(clientY - centerY);

    if (distance < bestDistance) {
      bestCard = card;
      bestDistance = distance;
    }
  }

  const bestRect = bestCard.getBoundingClientRect();
  const bestCenterY = bestRect.top + bestRect.height / 2;
  state.dropTargetGroupId = bestCard.dataset.groupId;
  state.dropInsertAfter = clientY > bestCenterY;
  renderGroupList();
}

function startGroupReorder(event, groupId) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  flushAutosave().catch((error) => {
    console.error("Failed to flush autosave before reordering.", error);
  });

  state.draggedGroupId = groupId;
  state.dropTargetGroupId = null;
  state.dropInsertAfter = false;
  document.body.style.userSelect = "none";
  renderGroupList();

  const handleMove = (moveEvent) => {
    updateDragTarget(moveEvent.clientY);
  };

  const handleUp = () => {
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);

    const draggedGroupId = state.draggedGroupId;
    const targetGroupId = state.dropTargetGroupId;
    const insertAfter = state.dropInsertAfter;

    if (!draggedGroupId || !targetGroupId || draggedGroupId === targetGroupId) {
      clearDragState(true);
      return;
    }

    reorderGroups(draggedGroupId, targetGroupId, insertAfter).catch((error) => {
      console.error("Failed to reorder block groups.", error);
      setStatus(t("status.errorReorderGroups"), true);
      clearDragState(true);
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
    platformAuthorMode: "none",
    platformAuthors: [],
    redditMode: "all",
    redditSubreddits: [],
    discordMode: "all",
    discordTargets: [],
    blockingRulesText: t("custom.defaultRule"),
    activeEventSource: "",
    freezeMode: "none",
    strictFreezeHours: DEFAULT_STRICT_FREEZE_HOURS,
    frozenAtMs: null,
    sites: [],
    blockHomePage: false,
    fallbackUrl: state.globalSettings?.defaultFallbackUrl ?? "",
    skipToNextOnBlock: false
  };
}

function sanitizeGroups(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups.map((group) => {
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
        group?.freezeMode === "strict" || group?.freezeMode === "frozen"
          ? group.freezeMode
          : "none",
      strictFreezeHours:
        parseStrictFreezeHours(group?.strictFreezeHours) ?? DEFAULT_STRICT_FREEZE_HOURS,
      frozenAtMs:
        Number.isFinite(Number(group?.frozenAtMs)) && Number(group.frozenAtMs) > 0
          ? Number(group.frozenAtMs)
          : null,
      sites: Array.isArray(group?.sites)
        ? [...new Set(group.sites.map(normalizeSiteInput).filter(Boolean))]
        : [],
      blockHomePage: Boolean(group?.blockHomePage),
      fallbackUrl: typeof group?.fallbackUrl === "string" ? group.fallbackUrl.trim() : "",
      skipToNextOnBlock: Boolean(group?.skipToNextOnBlock)
    };
  });
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
    const refreezeMode =
      snooze?.refreezeMode === "strict" || snooze?.refreezeMode === "frozen"
        ? snooze.refreezeMode
        : "frozen";

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
    redditMode: group.redditMode,
    redditSubreddits: [...group.redditSubreddits],
    discordMode: group.discordMode,
    discordTargets: [...group.discordTargets],
    blockingRulesText: group.blockingRulesText,
    freezeMode: group.freezeMode,
    strictFreezeHours: group.strictFreezeHours,
    frozenAtMs: group.freezeMode === "none" ? null : group.frozenAtMs,
    sites: [...group.sites],
    blockHomePage: Boolean(group.blockHomePage),
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
    redditMode: normalizeRedditMode(group.redditMode, group.redditSubreddits),
    redditSubredditsText: group.redditSubreddits.join("\n"),
    discordMode: normalizeDiscordMode(group.discordMode, group.discordTargets),
    discordTargetsText: group.discordTargets.join("\n"),
    blockingRulesText: group.blockingRulesText,
    blockHomePage: Boolean(group.blockHomePage),
    fallbackUrl: group.fallbackUrl ?? "",
    skipToNextOnBlock: Boolean(group.skipToNextOnBlock)
  };
}

function getSelectedGroup() {
  return state.groups.find((group) => group.id === state.selectedGroupId) ?? null;
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
  const baseTotal = Math.max(0, Number(state.groupSnoozeTotalsMs[groupId]) || 0);
  const snooze = state.groupSnoozes[groupId];
  if (getSnoozePhase(snooze, now) !== "active") {
    return baseTotal;
  }
  return baseTotal + Math.max(0, now - snooze.startsAtMs);
}

function getFreezeStatus(group, now = Date.now()) {
  const isFrozen = group.freezeMode !== "none";
  const isStrict = group.freezeMode === "strict";
  const unlockedAtMs =
    isStrict && group.frozenAtMs
      ? group.frozenAtMs + group.strictFreezeHours * MS_PER_HOUR
      : null;
  const lockedRemainingMs =
    unlockedAtMs && unlockedAtMs > now ? unlockedAtMs - now : 0;

  return {
    isFrozen,
    isStrict,
    unlockedAtMs,
    lockedRemainingMs,
    canUnfreeze: isFrozen && (!isStrict || lockedRemainingMs <= 0)
  };
}

function isGroupEditable(group, now = Date.now()) {
  return !getFreezeStatus(group, now).isFrozen;
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
    const usageState = getDisplayUsageState(effectiveGroup, now);
    const remainingMs = Math.max(effectiveGroup.resetIntervalHours * MS_PER_HOUR - usageState.usedMs, 0);
    pieces.push(`${formatDurationMs(remainingMs)} ${t("meta.left")}`);
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

    if (group.id === state.dropTargetGroupId) {
      card.classList.add(state.dropInsertAfter ? "drop-target-after" : "drop-target-before");
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

    dragHandle.addEventListener("mousedown", (event) => {
      startGroupReorder(event, group.id);
    });

    topline.append(dragHandle, name);
    textWrap.append(topline, meta);
    header.append(textWrap, toggle);
    card.appendChild(header);

    card.addEventListener("click", () => {
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
    const remainingMs = Math.max(displayGroup.resetIntervalHours * MS_PER_HOUR - usageState.usedMs, 0);
    usageSummary.textContent = t("timed.summaryTimer", {
      time: formatDurationMs(remainingMs),
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
    applyFreezeButton.disabled = true;
    unfreezeButton.classList.add("hidden");
    unfreezeButton.disabled = true;
    return;
  }

  const freezeStatus = getFreezeStatus(group, now);
  const strictDraftHours = parseStrictFreezeHours(strictFreezeHoursField.value);

  if (!freezeStatus.isFrozen) {
    freezeSummary.textContent = t("freeze.summary.notFrozen");
    freezeSetup.classList.remove("hidden");
    strictFreezeSettings.classList.toggle("hidden", freezeModeField.value !== "strict");
    applyFreezeButton.disabled =
      freezeModeField.value === "strict" && strictDraftHours === null;
    unfreezeButton.classList.add("hidden");
    unfreezeButton.disabled = true;
    return;
  }

  freezeSetup.classList.add("hidden");
  unfreezeButton.classList.remove("hidden");
  unfreezeButton.disabled = !freezeStatus.canUnfreeze;

  if (freezeStatus.isStrict && freezeStatus.lockedRemainingMs > 0) {
    freezeSummary.textContent = t("freeze.summary.strictLocked", {
      time: formatDurationMs(freezeStatus.lockedRemainingMs)
    });
    return;
  }

  freezeSummary.textContent = freezeStatus.isStrict
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
    skipToNextOnBlockField.checked = false;
    skipToNextOnBlockRow.classList.add("hidden");
    blockModeSection.classList.remove("hidden");
    timedSettings.classList.add("hidden");
    customSettingsCard.classList.add("hidden");
    platformVideoCard.classList.add("hidden");
    redditSettingsCard.classList.add("hidden");
    discordSettingsCard.classList.add("hidden");
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
    updateFreezeUI(null, now);
    updateSnoozeUI(null, now);
    setSnoozeWarning("");
    return;
  }

  const draft = getDraftForGroup(group.id);
  const editable = isGroupEditable(group, now);
  const freezeStatus = getFreezeStatus(group, now);
  const selectedMode = normalizeBlockingMode(draft?.mode ?? group.mode);
  const isTimedMode = isTimedBlockingMode(selectedMode);
  const isPlatformVideoGroup = isPlatformVideoGroupType(group.groupType);
  const isRedditGroup = group.groupType === "reddit";
  const isDiscordGroup = group.groupType === "discord";
  const isCustomGroup = group.groupType === "custom";

  if (isPlatformVideoGroup) {
    applyPlatformVideoUi(group.groupType);
  }

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
  platformVideoModeField.value = draft?.platformVideoMode ?? group.platformVideoMode;
  platformAuthorModeField.value = draft?.platformAuthorMode ?? group.platformAuthorMode;
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

  const isScrollPlatform = ["youtube", "tiktok", "instagram"].includes(group.groupType);
  skipToNextOnBlockRow.classList.toggle("hidden", !isPlatformVideoGroup || !isScrollPlatform);
  skipToNextOnBlockField.checked = Boolean(draft?.skipToNextOnBlock ?? group.skipToNextOnBlock);

  freezeModeField.value = freezeStatus.isStrict ? "strict" : "frozen";  strictFreezeHoursField.value = String(group.strictFreezeHours);

  blockModeSection.classList.toggle("hidden", isCustomGroup);
  timedSettings.classList.toggle("hidden", !isTimedMode || isCustomGroup);
  allowedMinutesRow.classList.toggle("hidden", selectedMode === "timer");
  strictFreezeSettings.classList.toggle("hidden", freezeModeField.value !== "strict");
  customSettingsCard.classList.toggle("hidden", !isCustomGroup);
  platformVideoCard.classList.toggle("hidden", !isPlatformVideoGroup);
  redditSettingsCard.classList.toggle("hidden", !isRedditGroup);
  discordSettingsCard.classList.toggle("hidden", !isDiscordGroup);
  if (fallbackUrlSection) {
    fallbackUrlSection.classList.toggle("hidden", isCustomGroup);
  }
  scheduleSection.classList.toggle("hidden", isCustomGroup);
  siteSettingsSection.classList.toggle(
    "hidden",
    isPlatformVideoGroup || isRedditGroup || isDiscordGroup || isCustomGroup
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
  blockedSitesField.disabled = !editable || isPlatformVideoGroup || isRedditGroup || isCustomGroup;
  blockingRulesField.disabled = !editable || !isCustomGroup;
  platformAuthorsField.disabled =
    !editable || !isPlatformVideoGroup || platformAuthorModeField.value === "none";
  platformVideoModeField.disabled = !editable || !isPlatformVideoGroup;
  platformAuthorModeField.disabled = !editable || !isPlatformVideoGroup;
  redditModeField.disabled = !editable || !isRedditGroup;
  redditSubredditsField.disabled =
    !editable || !isRedditGroup || redditModeField.value === "all";
  discordModeField.disabled = !editable || !isDiscordGroup;
  discordTargetsField.disabled = !editable || !isDiscordGroup || discordModeField.value === "all";
  clearSitesButton.disabled =
    !editable || isPlatformVideoGroup || isRedditGroup || isDiscordGroup || isCustomGroup;
  deleteGroupButton.disabled = !editable;
  exportGroupButton.disabled = false;
  importGroupButton.disabled = !editable;
  platformBlockHomePageField.disabled = !editable || !isPlatformVideoGroup;
  redditBlockHomePageField.disabled = !editable || !isRedditGroup;
  discordBlockHomePageField.disabled = !editable || !isDiscordGroup;
  fallbackUrlField.disabled = !editable;
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
}

function render(now = Date.now()) {
  applyStaticTranslations();
  renderGroupList(now);
  updateBulkActionsUI(now);
  renderEditor(now);
  renderUnfreezeModal(now);
  renderTemplateModal();
}

function renderDynamicView() {
  const now = Date.now();

  if (!state.draggedGroupId) {
    renderGroupList(now);
  }

  updateBulkActionsUI(now);
  const group = getSelectedGroup();
  const draft = getDraftForGroup(state.selectedGroupId);
  updateUsageSummary(group, draft, now);
  updateFreezeUI(group, now);
  updateSnoozeUI(group, now);
  renderUnfreezeModal(now);
}

function stashCurrentDraft() {
  const group = getSelectedGroup();

  if (!state.selectedGroupId || !group) {
    return;
  }

  const isPlatformVideoGroup = isPlatformVideoGroupType(group.groupType);
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
    redditMode: redditModeField.value,
    redditSubredditsText: redditSubredditsField.value,
    discordMode: discordModeField.value,
    discordTargetsText: discordTargetsField.value,
    blockHomePage: isPlatformVideoGroup
      ? platformBlockHomePageField.checked
      : isRedditGroup
        ? redditBlockHomePageField.checked
        : isDiscordGroup
          ? discordBlockHomePageField.checked
          : false,
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

  return {
    groups,
    usageTimersMs: sanitizeUsageTimers(result[USAGE_TIMERS_KEY], groups),
    usageResetAtMs: sanitizeResetTimes(result[USAGE_RESET_AT_KEY], groups),
    groupSnoozes: sanitizeSnoozes(result[GROUP_SNOOZES_KEY], groups),
    groupSnoozeTotalsMs: sanitizeSnoozeTotals(result[GROUP_SNOOZE_TOTALS_KEY], groups),
    globalSettings: sanitizeGlobalSettings(result[GLOBAL_SETTINGS_KEY])
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

  if (isPlatformVideoGroupType(group.groupType) && authorResults.invalidAuthors.length > 0) {
    throw new Error(t("status.invalidCreators", { list: authorResults.invalidAuthors.join(", ") }));
  }

  if (group.groupType === "reddit" && redditResults.invalidSubreddits.length > 0) {
    throw new Error(
      t("status.invalidSubreddits", { list: redditResults.invalidSubreddits.join(", ") })
    );
  }

  if (group.groupType === "discord" && discordResults.invalidTargets.length > 0) {
    throw new Error(
      t("status.invalidDiscordTargets", { list: discordResults.invalidTargets.join(", ") })
    );
  }

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
      platformAuthors:
        isPlatformVideoGroupType(group.groupType) ? authorResults.validAuthors : group.platformAuthors,
      redditSubreddits:
        group.groupType === "reddit" ? redditResults.validSubreddits : group.redditSubreddits,
      redditMode: group.groupType === "reddit" ? redditMode : group.redditMode,
      discordTargets:
        group.groupType === "discord" ? discordResults.validTargets : group.discordTargets,
      discordMode: group.groupType === "discord" ? discordMode : group.discordMode,
      blockingRulesText: isCustomGroup ? blockingRulesText : group.blockingRulesText,
      sites: group.groupType === "site" ? siteResults.validSites : [],
      blockHomePage: Boolean(draft.blockHomePage),
      // Custom groups redirect via setRedirectLink() inside the rule;
      // strip any legacy fallbackUrl on save.
      fallbackUrl: isCustomGroup
        ? ""
        : typeof draft.fallbackUrl === "string"
        ? draft.fallbackUrl.trim()
        : "",
      skipToNextOnBlock: Boolean(draft.skipToNextOnBlock)
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
}

async function reorderGroups(draggedGroupId, targetGroupId, insertAfter) {
  await flushAutosave();

  const draggedIndex = state.groups.findIndex((group) => group.id === draggedGroupId);
  const targetIndex = state.groups.findIndex((group) => group.id === targetGroupId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    state.draggedGroupId = null;
    state.dropTargetGroupId = null;
    renderGroupList();
    return;
  }

  const reordered = [...state.groups];
  const [draggedGroup] = reordered.splice(draggedIndex, 1);
  let insertIndex = targetIndex;

  if (draggedIndex < targetIndex) {
    insertIndex -= 1;
  }

  if (insertAfter) {
    insertIndex += 1;
  }

  reordered.splice(insertIndex, 0, draggedGroup);
  state.groups = reordered;
  state.draggedGroupId = null;
  state.dropTargetGroupId = null;

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
    refreezeMode: group.freezeMode === "strict" ? "strict" : "frozen"
  };
}

function maybeRefreezeGroupAfterSnooze(groupId, snooze, now = Date.now()) {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group || group.freezeMode !== "none") {
    return;
  }
  const nextGroup = {
    ...group,
    freezeMode: snooze?.refreezeMode === "strict" ? "strict" : "frozen",
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
      console.log("[CustomBlocker:trace] popup → fire-snooze-press", group.id);
      const response = await chrome.runtime.sendMessage({
        type: "fire-snooze-press",
        groupId: group.id
      });
      console.log("[CustomBlocker:trace] popup ← fire-snooze-press response", response);
      if (!response || !response.ok) {
        const err =
          (response && response.error) || t("snooze.warning.snoozePressFailed");
        setSnoozeWarning(err);
      }
    } catch (error) {
      console.warn("[CustomBlocker:trace] popup fire-snooze-press error", error);
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

blockedSitesField.addEventListener("input", () => {
  stashCurrentDraft();
  renderGroupList();
  scheduleAutosave();
});

blockingRulesField.addEventListener("input", () => {
  stashCurrentDraft();
  scheduleAutosave();
});

// Commit on blur so a user who types then immediately runs the rule
// doesn't lose the most recent keystrokes to the autosave debounce.
blockingRulesField.addEventListener("blur", () => {
  flushAutosave().catch((error) => {
    console.error("Failed to flush blocking rules on blur.", error);
  });
});

async function runSelectedCustomGroup() {
  const group = getSelectedGroup();
  if (!group || group.groupType !== "custom") return;
  await flushAutosave();
  const source = String(blockingRulesField?.value ?? "").trim();
  if (runCustomGroupStatus) {
    runCustomGroupStatus.textContent = t("custom.runStatusRunning");
    runCustomGroupStatus.className = "run-status";
  }
  try {
    const response = await chrome.runtime.sendMessage({
      type: "run-custom-group",
      groupId: group.id,
      source
    });
    if (response && response.ok && response.loadResult) {
      const lr = response.loadResult;
      if (lr.ok) {
        if (runCustomGroupStatus) {
          runCustomGroupStatus.textContent = t("custom.runStatusOk", { count: String(lr.handlers ?? 0) });
          runCustomGroupStatus.className = "run-status success";
        }
        setStatus(t("status.customGroupRan", { name: group.name, count: String(lr.handlers ?? 0) }));
      } else {
        if (runCustomGroupStatus) {
          runCustomGroupStatus.textContent = lr.error || t("custom.runStatusError");
          runCustomGroupStatus.className = "run-status error";
        }
        setStatus(lr.error || t("status.errorRunCustomGroup"), true);
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
    // Sandbox compiles under a synthetic groupId and discards results;
    // the real group's loaded handlers are not touched.
    const response = await chrome.runtime.sendMessage({
      type: "check-custom-group-syntax",
      source
    });
    if (response && response.ok && response.result && response.result.ok) {
      const handlers = response.result.handlers ?? 0;
      const text = t("custom.checkSyntaxOk", { count: String(handlers) });
      if (runCustomGroupStatus) {
        runCustomGroupStatus.textContent = text;
        runCustomGroupStatus.className = "run-status success";
      }
      setStatus(text);
      return;
    }
    const err =
      (response && response.result && response.result.error) ||
      (response && response.error) ||
      t("custom.checkSyntaxFailed");
    if (runCustomGroupStatus) {
      runCustomGroupStatus.textContent = err;
      runCustomGroupStatus.className = "run-status error";
    }
    setStatus(err, true);
  } catch (error) {
    const text = String(error && error.message ? error.message : error);
    if (runCustomGroupStatus) {
      runCustomGroupStatus.textContent = text;
      runCustomGroupStatus.className = "run-status error";
    }
    setStatus(text, true);
  }
}

if (checkSyntaxButton) {
  checkSyntaxButton.addEventListener("click", () => {
    checkSelectedCustomGroupSyntax();
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
  strictFreezeSettings.classList.toggle("hidden", freezeModeField.value !== "strict");
  updateFreezeUI(getSelectedGroup());
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

if (settingsSaveButton) {
  settingsSaveButton.addEventListener("click", () => {
    saveSettingsFromForm().catch((error) => {
      console.error("Failed to save global settings.", error);
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

  const row = document.createElement("div");
  row.className = "log-feed-entry " + (entry.level === "warn" ? "warn" : entry.level === "error" ? "error" : "");
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
  if (logFeedCount) {
    logFeedCount.textContent = String(logFeedList.children.length);
  }
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

if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "log-feed-entry") return;
    renderLogFeedEntry(message.entry);
  });
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
  state.tickIntervalId = window.setInterval(() => {
    renderDynamicView();
  }, 1000);
}

initializePopupApp().catch((error) => {
  console.error("Failed to initialize popup.", error);
  setStatus(t("status.errorLoadGroups"), true);
});
