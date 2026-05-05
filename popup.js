const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const LAYOUT_WIDTH_STORAGE_KEY = "custom-blocker-groups-panel-width";
const LANGUAGE_STORAGE_KEY = "custom-blocker-language";

const DEFAULT_ALLOWED_MINUTES = 15;
const DEFAULT_RESET_INTERVAL_HOURS = 24;
const DEFAULT_STRICT_FREEZE_HOURS = 24;
const DEFAULT_SNOOZE_MINUTES = 30;
const DEFAULT_GROUP_TYPE = "site";
const MAX_STRICT_FREEZE_HOURS = 72;
const MIN_SNOOZE_REASON_CHARACTERS = 100;
const MIN_SNOOZE_REASON_WORDS = 21;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const UNFREEZE_CONFIRMATIONS_REQUIRED = 20;
const UNFREEZE_CONFIRMATION_INTERVAL_MS = 5000;
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
const editorCopy = document.getElementById("editorCopy");
const groupNameField = document.getElementById("groupName");
const groupEnabledField = document.getElementById("groupEnabled");
const groupTypeSummary = document.getElementById("groupTypeSummary");
const blockModeSection = document.getElementById("blockModeSection");
const blockModeField = document.getElementById("blockMode");
const timedSettings = document.getElementById("timedSettings");
const allowedMinutesField = document.getElementById("allowedMinutes");
const resetIntervalHoursField = document.getElementById("resetIntervalHours");
const usageSummary = document.getElementById("usageSummary");
const scheduleSection = document.getElementById("scheduleSection");
const daysGrid = document.getElementById("daysGrid");
const scheduleWindowsField = document.getElementById("scheduleWindows");
const customSettingsCard = document.getElementById("customSettingsCard");
const blockingRulesField = document.getElementById("blockingRules");
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
const discordTargetTypeField = document.getElementById("discordTargetType");
const discordTargetsLabel = document.getElementById("discordTargetsLabel");
const discordTargetsField = document.getElementById("discordTargets");
const discordTargetsHelp = document.getElementById("discordTargetsHelp");
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
const snoozeReasonField = document.getElementById("snoozeReason");
const snoozeWarning = document.getElementById("snoozeWarning");
const startSnoozeButton = document.getElementById("startSnoozeButton");
const endSnoozeButton = document.getElementById("endSnoozeButton");
const siteSettingsSection = document.getElementById("siteSettingsSection");
const blockedSitesField = document.getElementById("blockedSites");
const clearSitesButton = document.getElementById("clearSitesButton");
const checkRuleSyntaxButton = document.getElementById("checkRuleSyntaxButton");
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
const dayCheckboxes = Array.from(daysGrid.querySelectorAll('input[type="checkbox"]'));

const state = {
  groups: [],
  usageTimersMs: {},
  usageResetAtMs: {},
  groupSnoozes: {},
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
  manualCache: {},
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

function countWords(value) {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
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

function applyDiscordTargetUi(targetType) {
  const isChannel = normalizeDiscordTargetType(targetType) === "channel";
  discordTargetsLabel.textContent = t(isChannel ? "discord.channels" : "discord.servers");
  discordTargetsField.setAttribute(
    "placeholder",
    t(isChannel ? "discord.channelsPlaceholder" : "discord.serversPlaceholder")
  );
  discordTargetsHelp.textContent = t(isChannel ? "discord.channelsHelp" : "discord.help");
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

function normalizeDiscordTargetType(value) {
  return value === "channel" ? "channel" : "server";
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

function normalizeDiscordTargetInput(value, targetType = "server") {
  const normalizedTargetType = normalizeDiscordTargetType(targetType);
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
    trimmed = normalizedTargetType === "channel" ? channelsMatch[2] ?? "" : channelsMatch[1];
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

function parseDiscordTargetsTextarea(value, targetType = "server") {
  const validTargets = [];
  const invalidTargets = [];

  for (const rawLine of String(value ?? "").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const normalized = normalizeDiscordTargetInput(trimmedLine, targetType);

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
  const isChannel = normalizeDiscordTargetType(groupLike.discordTargetType) === "channel";

  if (mode === "all") {
    return t(isChannel ? "meta.allDiscordChannels" : "meta.allDiscord");
  }

  if (mode === "exclude") {
    return t(isChannel ? "meta.allExceptChannels" : "meta.allExceptServers", {
      count: targets.length
    });
  }

  return t(isChannel ? "meta.channelCount" : "meta.serverCount", { count: targets.length });
}

function getLocalizedUnfreezeMessages() {
  return Array.from({ length: UNFREEZE_CONFIRMATIONS_REQUIRED }, (_, index) =>
    t(`unfreeze.message.${index + 1}`)
  );
}

// Sandboxed compiler bridge.
//
// Manifest V3 forbids `new Function` and `eval` on extension pages, so we
// can't validate a candidate custom rule directly in the popup. The
// `sandbox.html` page is declared in manifest.sandbox.pages, which gives
// it a relaxed CSP that allows the Function constructor. We send the
// source text over postMessage and wait for a reply.
const sandboxFrame = document.getElementById("ruleSandbox");
let sandboxRequestSeq = 0;
const sandboxPending = new Map();

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.source !== "custom-blocker-sandbox") return;
  const pending = sandboxPending.get(data.id);
  if (!pending) return;
  sandboxPending.delete(data.id);
  pending(data.result);
});

function compileInSandbox(source) {
  return new Promise((resolve) => {
    if (!sandboxFrame || !sandboxFrame.contentWindow) {
      resolve({ ok: false, kind: "no-sandbox" });
      return;
    }
    const id = ++sandboxRequestSeq;
    sandboxPending.set(id, resolve);
    try {
      sandboxFrame.contentWindow.postMessage({ id, type: "compile", source }, "*");
    } catch (error) {
      sandboxPending.delete(id);
      resolve({ ok: false, kind: "no-sandbox" });
      return;
    }
    window.setTimeout(() => {
      if (!sandboxPending.has(id)) return;
      sandboxPending.delete(id);
      resolve({ ok: false, kind: "timeout" });
    }, 2000);
  });
}

async function checkRuleSyntax() {
  // Make sure whatever is in the textarea right now is committed to
  // storage before we report. That way "syntax OK" implies "saved", and
  // the user doesn't have to wonder whether the rule actually took effect.
  await flushAutosave();

  const source = String(blockingRulesField?.value ?? "").trim();
  if (!source) {
    setStatus(t("status.invalidCustomRulesEmpty"), true);
    return;
  }

  const result = await compileInSandbox(source);
  if (result.ok) {
    setStatus(t("status.checkSyntaxValid"));
    return;
  }

  if (result.kind === "not-function") {
    setStatus(t("status.invalidCustomRulesNotFunction"), true);
    return;
  }

  if (result.kind === "no-sandbox" || result.kind === "timeout") {
    setStatus(t("status.checkSyntaxUnavailable"), true);
    return;
  }

  if (result.kind === "runtime") {
    setStatus(
      t("status.invalidCustomRulesRuntime", {
        message: result.message || t("status.invalidCustomRulesGeneric")
      }),
      true
    );
    return;
  }

  setStatus(
    t("status.invalidCustomRulesSyntax", {
      message: result.message || t("status.invalidCustomRulesGeneric")
    }),
    true
  );
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
    snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    activeDays: createDefaultDays(),
    timeWindowsText: "",
    platformVideoMode: "all",
    platformAuthorMode: "none",
    platformAuthors: [],
    redditMode: "all",
    redditSubreddits: [],
    discordMode: "all",
    discordTargetType: "server",
    discordTargets: [],
    blockingRulesText: t("custom.defaultRule"),
    freezeMode: "none",
    strictFreezeHours: DEFAULT_STRICT_FREEZE_HOURS,
    frozenAtMs: null,
    sites: [],
    blockHomePage: false,
    fallbackUrl: "",
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
    const discordTargetType = normalizeDiscordTargetType(group?.discordTargetType);

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
      discordTargetType,
      discordTargets: [
        ...new Set(
          rawDiscordTargets
            .map((target) => normalizeDiscordTargetInput(target, discordTargetType))
            .filter(Boolean)
        )
      ],
      discordMode: normalizeDiscordMode(group?.discordMode, rawDiscordTargets),
      blockingRulesText:
        typeof group?.blockingRulesText === "string" && group.blockingRulesText.trim()
          ? group.blockingRulesText.trim()
          : baseGroup.blockingRulesText,
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
  const now = Date.now();
  const groupIds = new Set(groups.map((group) => group.id));
  const snoozes = {};

  for (const [groupId, snooze] of Object.entries(value ?? {})) {
    if (!groupIds.has(groupId)) {
      continue;
    }

    const untilMs = Number.parseInt(snooze?.untilMs, 10);
    const reason = typeof snooze?.reason === "string" ? snooze.reason.trim() : "";

    if (Number.isFinite(untilMs) && untilMs > now && reason) {
      snoozes[groupId] = {
        untilMs,
        reason
      };
    }
  }

  return snoozes;
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
    activeDays: [...group.activeDays],
    timeWindowsText: group.timeWindowsText,
    sitesText: group.sites.join("\n"),
    platformVideoMode: normalizeVideoMode(group.platformVideoMode),
    platformAuthorMode: normalizePlatformAuthorMode(group.platformAuthorMode),
    platformAuthorsText: group.platformAuthors.join("\n"),
    redditMode: normalizeRedditMode(group.redditMode, group.redditSubreddits),
    redditSubredditsText: group.redditSubreddits.join("\n"),
    discordMode: normalizeDiscordMode(group.discordMode, group.discordTargets),
    discordTargetType: normalizeDiscordTargetType(group.discordTargetType),
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

function getActiveSnooze(groupId, now = Date.now()) {
  const snooze = state.groupSnoozes[groupId];
  return snooze && snooze.untilMs > now ? snooze : null;
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
  const allowedMinutes = parseAllowedMinutes(draft?.allowedMinutes) ?? group.allowedMinutes;
  const resetIntervalHours =
    parseResetIntervalHours(draft?.resetIntervalHours) ?? group.resetIntervalHours;
  return {
    ...group,
    allowedMinutes,
    resetIntervalHours
  };
}

function getGroupMetaText(group, draft, now = Date.now()) {
  const effectiveGroup = getEffectiveGroup(group, draft);
  const snooze = getActiveSnooze(group.id, now);
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
    const draftTargetType = normalizeDiscordTargetType(
      draft?.discordTargetType ?? group.discordTargetType
    );
    const draftTargets = parseDiscordTargetsTextarea(
      draft?.discordTargetsText ?? "",
      draftTargetType
    ).validTargets;
    pieces.push(
      describeDiscordScope({
        discordMode: draft?.discordMode ?? group.discordMode,
        discordTargetType: draftTargetType,
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

  if (snooze) {
    pieces.push(`${t("meta.snoozed")} ${formatDurationMs(snooze.untilMs - now)}`);
  } else if (effectiveGroup.mode === "instant") {
    pieces.push(t("meta.instantBlock"));
  } else if (effectiveGroup.mode === "timer") {
    const usedMs = getDisplayUsageState(effectiveGroup, now).usedMs;
    pieces.push(`${formatDurationMs(usedMs)} ${t("meta.used")}`);
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
      updateGroupEnabled(group.id, toggle.checked).catch((error) => {
        console.error("Failed to update group state.", error);
        setStatus(t("status.errorUpdateGroup"), true);
      });
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
    snoozeReasonField.disabled = true;
    startSnoozeButton.disabled = true;
    endSnoozeButton.classList.add("hidden");
    setSnoozeWarning("");
    return;
  }

  const snooze = getActiveSnooze(group.id, now);
  const freezeStatus = getFreezeStatus(group, now);
  const allowSnooze = group.allowSnooze !== false;

  allowSnoozeField.checked = allowSnooze;
  allowSnoozeField.disabled = freezeStatus.isFrozen;
  snoozeMinutesField.disabled = freezeStatus.isFrozen || !allowSnooze;
  snoozeReasonField.disabled = !allowSnooze;

  if (!snooze) {
    startSnoozeButton.disabled = !allowSnooze;
    snoozeSummary.textContent = !allowSnooze
      ? freezeStatus.isFrozen
        ? t("snooze.summary.disabledFrozen")
        : t("snooze.summary.disabled")
      : freezeStatus.isFrozen
        ? t("snooze.summary.frozen")
        : t("snooze.summary.normal");
    endSnoozeButton.classList.add("hidden");
    return;
  }

  startSnoozeButton.disabled = true;
  snoozeSummary.textContent = t("snooze.summary.active", {
    time: formatDurationMs(snooze.untilMs - now)
  });
  endSnoozeButton.classList.remove("hidden");
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
    scheduleWindowsField.value = "";
    blockedSitesField.value = "";
    blockingRulesField.value = "";
    platformAuthorsField.value = "";
    platformVideoModeField.value = "all";
    platformAuthorModeField.value = "none";
    redditModeField.value = "all";
    redditSubredditsField.value = "";
    discordModeField.value = "all";
    discordTargetTypeField.value = "server";
    discordTargetsField.value = "";
    applyDiscordTargetUi("server");
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
    scheduleWindowsField.disabled = true;
    blockedSitesField.disabled = true;
    blockingRulesField.disabled = true;
    platformAuthorsField.disabled = true;
    platformVideoModeField.disabled = true;
    platformAuthorModeField.disabled = true;
    redditModeField.disabled = true;
    redditSubredditsField.disabled = true;
    discordModeField.disabled = true;
    discordTargetTypeField.disabled = true;
    discordTargetsField.disabled = true;
    allowSnoozeField.disabled = true;
    snoozeReasonField.disabled = true;
    clearSitesButton.disabled = true;
    deleteGroupButton.disabled = true;
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
  discordTargetTypeField.value = normalizeDiscordTargetType(
    draft?.discordTargetType ?? group.discordTargetType
  );
  discordTargetsField.value = draft?.discordTargetsText ?? group.discordTargets.join("\n");
  applyDiscordTargetUi(discordTargetTypeField.value);

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
  strictFreezeSettings.classList.toggle("hidden", freezeModeField.value !== "strict");
  customSettingsCard.classList.toggle("hidden", !isCustomGroup);
  platformVideoCard.classList.toggle("hidden", !isPlatformVideoGroup);
  redditSettingsCard.classList.toggle("hidden", !isRedditGroup);
  discordSettingsCard.classList.toggle("hidden", !isDiscordGroup);
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
  discordTargetTypeField.disabled = !editable || !isDiscordGroup;
  discordTargetsField.disabled = !editable || !isDiscordGroup || discordModeField.value === "all";
  clearSitesButton.disabled =
    !editable || isPlatformVideoGroup || isRedditGroup || isDiscordGroup || isCustomGroup;
  deleteGroupButton.disabled = !editable;
  platformBlockHomePageField.disabled = !editable || !isPlatformVideoGroup;
  redditBlockHomePageField.disabled = !editable || !isRedditGroup;
  discordBlockHomePageField.disabled = !editable || !isDiscordGroup;
  fallbackUrlField.disabled = !editable;
  skipToNextOnBlockField.disabled = !editable || !isPlatformVideoGroup || !isScrollPlatform;

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
    discordTargetType: discordTargetTypeField.value,
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

async function loadStoredState() {
  const result = await chrome.storage.local.get({
    [BLOCKED_GROUPS_KEY]: [],
    [USAGE_TIMERS_KEY]: {},
    [USAGE_RESET_AT_KEY]: {},
    [GROUP_SNOOZES_KEY]: {}
  });

  const groups = sanitizeGroups(result[BLOCKED_GROUPS_KEY]);

  return {
    groups,
    usageTimersMs: sanitizeUsageTimers(result[USAGE_TIMERS_KEY], groups),
    usageResetAtMs: sanitizeResetTimes(result[USAGE_RESET_AT_KEY], groups),
    groupSnoozes: sanitizeSnoozes(result[GROUP_SNOOZES_KEY], groups)
  };
}

async function persistState(message) {
  state.suppressGroupStorageUpdatesUntil = Date.now() + 1000;

  await chrome.storage.local.set({
    [BLOCKED_GROUPS_KEY]: state.groups,
    [USAGE_TIMERS_KEY]: state.usageTimersMs,
    [USAGE_RESET_AT_KEY]: state.usageResetAtMs,
    [GROUP_SNOOZES_KEY]: state.groupSnoozes
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
  state.selectedGroupId = state.groups[0]?.id ?? null;
  state.drafts = {};
  render();
}

async function updateGroupEnabled(groupId, enabled) {
  const group = state.groups.find((item) => item.id === groupId);

  if (!group || !isGroupEditable(group)) {
    setStatus(t("status.frozenCannotChange"), true);
    render();
    return;
  }

  state.groups = state.groups.map((item) =>
    item.id === groupId ? { ...item, enabled } : item
  );

  if (state.drafts[groupId]) {
    state.drafts[groupId].enabled = enabled;
  }

  await persistState(
    t(enabled ? "status.enabled" : "status.disabled", { name: group.name })
  );
  render();
}

async function addGroup(groupType = DEFAULT_GROUP_TYPE) {
  stashCurrentDraft();
  await flushAutosave();

  const now = Date.now();
  const newGroup = createDefaultGroup(groupType);
  state.groups = [...state.groups, newGroup];
  state.usageTimersMs[newGroup.id] = 0;
  state.usageResetAtMs[newGroup.id] = now;
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
  state.selectedGroupId = state.groups[0]?.id ?? null;

  await persistState(t("status.deleted", { name: group.name }));
  render();
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
  const timeWindows = parseTimeWindowsText(draft.timeWindowsText);
  const siteResults = parseSiteTextareaValue(draft.sitesText);
  const authorResults = parsePlatformAuthorsTextarea(group.groupType, draft.platformAuthorsText);
  const authorMode = normalizePlatformAuthorMode(draft.platformAuthorMode);
  const redditResults = parseRedditSubredditsTextarea(draft.redditSubredditsText);
  const redditMode = normalizeRedditMode(draft.redditMode, redditResults.validSubreddits);
  const discordTargetType = normalizeDiscordTargetType(draft.discordTargetType);
  const discordResults = parseDiscordTargetsTextarea(draft.discordTargetsText, discordTargetType);
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
      t(
        discordTargetType === "channel"
          ? "status.invalidDiscordChannels"
          : "status.invalidDiscordServers",
        { list: discordResults.invalidTargets.join(", ") }
      )
    );
  }

  // Custom rule source is intentionally NOT validated here. The popup
  // autosaves a fraction of a second after each keystroke, so compiling
  // mid-edit would always look broken to the user. Real validation
  // happens via the Check syntax button (see checkRuleSyntax in this
  // file) which uses the sandboxed compiler page, and the content
  // script silently skips rules that don't compile at runtime.

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
      discordTargetType:
        group.groupType === "discord" ? discordTargetType : group.discordTargetType,
      blockingRulesText: isCustomGroup ? blockingRulesText : group.blockingRulesText,
      sites: group.groupType === "site" ? siteResults.validSites : [],
      blockHomePage: Boolean(draft.blockHomePage),
      fallbackUrl: typeof draft.fallbackUrl === "string" ? draft.fallbackUrl.trim() : "",
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

  if (!group || !draft || !isGroupEditable(group)) {
    return;
  }

  try {
    const { updatedGroup, modeChanged, resetIntervalChanged } = buildUpdatedGroupFromDraft(
      group,
      draft
    );

    state.groups = state.groups.map((item) =>
      item.id === group.id ? updatedGroup : item
    );
    state.drafts[group.id] = groupToDraft(updatedGroup);

    if (isTimedBlockingMode(updatedGroup.mode) && (modeChanged || resetIntervalChanged)) {
      state.usageResetAtMs[group.id] = Date.now();
      state.usageTimersMs[group.id] = 0;
    }

    await persistState();
    renderGroupList();
    updateUsageSummary(updatedGroup, state.drafts[group.id]);
  } catch (error) {
    setStatus(error.message || t("status.errorSaveGroup"), true);
    renderGroupList();
    updateUsageSummary(group, draft);
  }
}

function scheduleAutosave() {
  if (state.autosaveTimeoutId !== null) {
    window.clearTimeout(state.autosaveTimeoutId);
  }

  state.autosaveTimeoutId = window.setTimeout(() => {
    state.autosaveTimeoutId = null;
    autosaveSelectedGroup().catch((error) => {
      console.error("Failed to autosave block group.", error);
      setStatus(t("status.errorSaveGroup"), true);
    });
  }, 400);
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
  const localizedMessages = getLocalizedUnfreezeMessages();
  const messageIndex = Math.min(completedCount, localizedMessages.length - 1);
  const remainingCooldownMs = Math.max(state.unfreezeFlow.nextAllowedAtMs - now, 0);

  confirmModal.classList.remove("hidden");
  confirmTitle.textContent =
    state.unfreezeFlow.kind === "delete-all"
      ? t("modal.deleteAllTitle")
      : t("modal.unfreezeTitle");
  confirmMessage.textContent = localizedMessages[messageIndex];
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
      state.selectedGroupId = null;

      await persistState(t("status.bulkDeleted"));
      closeUnfreezeFlow();
      render();
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

  if (!allowSnooze) {
    setSnoozeWarning(
      freezeStatus.isFrozen ? t("snooze.warning.disabledFrozen") : t("snooze.warning.disabled")
    );
    return;
  }

  const snoozeMinutesValue = freezeStatus.isFrozen
    ? String(group.snoozeMinutes)
    : snoozeMinutesField.value;
  const snoozeMinutes = parseSnoozeMinutes(snoozeMinutesValue);

  if (snoozeMinutes === null) {
    setSnoozeWarning(t("snooze.warning.invalidMinutes"));
    return;
  }

  const reason = snoozeReasonField.value.trim();

  if (countWords(reason) < MIN_SNOOZE_REASON_WORDS) {
    setSnoozeWarning(t("snooze.warning.words"));
    return;
  }

  if (reason.length < MIN_SNOOZE_REASON_CHARACTERS) {
    setSnoozeWarning(t("snooze.warning.characters", { min: MIN_SNOOZE_REASON_CHARACTERS }));
    return;
  }

  setSnoozeWarning("");
  state.groupSnoozes[group.id] = {
    untilMs: Date.now() + snoozeMinutes * MS_PER_MINUTE,
    reason
  };

  snoozeReasonField.value = "";

  await persistState(
    t("status.snoozed", {
      name: group.name,
      minutes: snoozeMinutes,
      suffix: snoozeMinutes === 1 ? "" : "s"
    })
  );
  render();
}

async function endSnooze() {
  const group = getSelectedGroup();

  if (!group || !state.groupSnoozes[group.id]) {
    return;
  }

  delete state.groupSnoozes[group.id];
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

  updateGroupEnabled(state.selectedGroupId, groupEnabledField.checked).catch((error) => {
    console.error("Failed to update selected group state.", error);
    setStatus(t("status.errorUpdateGroup"), true);
  });
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

// Commit immediately when the textarea loses focus, instead of waiting for
// the 400 ms debounce. Otherwise users who type, then immediately switch
// to another tab to test their rule, can navigate before storage has been
// updated and end up running the previous version of the rule.
blockingRulesField.addEventListener("blur", () => {
  flushAutosave().catch((error) => {
    console.error("Failed to flush blocking rules on blur.", error);
  });
});

if (checkRuleSyntaxButton) {
  checkRuleSyntaxButton.addEventListener("click", () => {
    checkRuleSyntax().catch((error) => {
      console.error("Failed to check rule syntax.", error);
      setStatus(t("status.checkSyntaxUnavailable"), true);
    });
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
    setStatus(
      t(
        normalizeDiscordTargetType(discordTargetTypeField.value) === "channel"
          ? "status.discordChannelAllowlistWarning"
          : "status.discordAllowlistWarning"
      )
    );
  }
  stashCurrentDraft();
  render();
  renderGroupList();
  scheduleAutosave();
});

discordTargetTypeField.addEventListener("change", () => {
  applyDiscordTargetUi(discordTargetTypeField.value);
  stashCurrentDraft();
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

deleteAllGroupsButton.addEventListener("click", () => {
  deleteAllGroups().catch((error) => {
    console.error("Failed to delete all groups.", error);
    setStatus(t("status.errorDeleteAllGroups"), true);
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

snoozeReasonField.addEventListener("input", () => {
  if (snoozeWarning.textContent) {
    setSnoozeWarning("");
  }
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
      t(confirmationKind === "delete-all" ? "status.errorDeleteAllGroups" : "status.errorUnfreezeGroup"),
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
    if (state.isManualOpen) {
      closeManual();
    } else if (state.unfreezeFlow) {
      closeUnfreezeFlow();
    }
  }
});

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
  state.tickIntervalId = window.setInterval(() => {
    renderDynamicView();
  }, 1000);
}

initializePopupApp().catch((error) => {
  console.error("Failed to initialize popup.", error);
  setStatus(t("status.errorLoadGroups"), true);
});
