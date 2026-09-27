// Group scopes — the "where" half of a block group (owner model 2026-09-24).
//
// A group is a POLICY (when: mode, minutes, schedule, snooze, lock, redirect)
// plus SCOPE LINES (where). The group applies to the union of its lines, and
// every line ends in one ACTION (what happens to what it matched):
//
//   surface  | what the line names                          | legal actions
//   site     | host or host/path entries (+ "everything except") | block, pause
//   apps     | desktop applications ({id, name}, + "everything except"; enforced by the desktop apps) | block
//   items    | feed cards of a platform (form / sources / tags)  | hide, dim
//   pages    | the content's own page (form / sources / tags)    | block, pause
//
// "block" covers the page in place (or sends the tab to the group's address);
// "pause" is the intention gate: the same cover with a countdown, after which
// the page is let through for that tab. Tagged pages are blacked out in
// place and only block.
//   home     | the platform's home feed                          | block
//   shelf    | one platform surface (Shorts shelf, comments, …)  | hide
//
// A group's lines may name several ENTRIES — a site list, an app list, one or
// more platforms; the group applies to their union. The editor works one entry
// at a time: the flat form fields are the view of ONE entry's lines
// (flatFromScopes with that entry key), and saving merges that view back over
// the group's other lines (mergeFlatIntoScopes). Entry keys: "site", "apps",
// or a platform id. Normal groups only block/hide/dim — exceptions
// are custom rules (allow()), never lines.
//
// Loaded by the service worker, the popup and the tests; depends on the
// platform registry (platform-profiles.js) being loaded first.
(function (global) {
  "use strict";

  const SCOPE_SURFACES = ["site", "apps", "items", "pages", "home", "shelf"];
  const SCOPE_ACTIONS = ["block", "pause", "hide", "dim"];

  function scopeLegalActions(surface) {
    if (surface === "items") return ["hide", "dim"];
    if (surface === "shelf") return ["hide"];
    if (surface === "site" || surface === "pages") return ["block", "pause"];
    return ["block"];
  }

  // Every flat field the lines replace, including the pre-2026-09-24 pairs
  // the flat sanitizer still migrates. Their presence on an input marks it as
  // a flat (form or legacy) group, or as a flat patch over a scoped group.
  const FLAT_SCOPE_FIELDS = [
    "sites", "allowlist", "apps", "appsAllowlist", "blockHomePage", "platformVideoMode",
    "sourceMode", "sources", "platformAuthorMode", "platformAuthors", "redditMode", "redditSubreddits",
    "platformTagMode", "platformTags", "platformTagDefaultConfidence", "platformTagBlockUntagged",
    "platformTagEffect", "platformTagBlockPage", "platformTagCoverUntilTagged",
    "discordMode", "discordTargets", "surfaceHides", "pageAction"
  ];

  function hasFlatScopeFields(group) {
    if (!group || typeof group !== "object") return false;
    return FLAT_SCOPE_FIELDS.some((key) => Object.prototype.hasOwnProperty.call(group, key));
  }

  function hasScopeLines(group) {
    return Boolean(group) && typeof group === "object" && Array.isArray(group.scopes);
  }

  function withoutFlatScopeFields(group) {
    const out = {};
    for (const [key, value] of Object.entries(group || {})) {
      if (!FLAT_SCOPE_FIELDS.includes(key)) out[key] = value;
    }
    return out;
  }

  function platformKind(groupType) {
    if (groupType === "apps") return "apps";
    const type = global.normalizeGroupType ? global.normalizeGroupType(groupType) : String(groupType || "");
    if (type === "site" || type === "custom") return type;
    if (type === "discord") return "discord";
    if (global.isPlatformVideoGroupType && global.isPlatformVideoGroupType(type)) return "video";
    if (type === "reddit") return "reddit";
    if (global.isPlatformFeedGroupType && global.isPlatformFeedGroupType(type)) return "feed";
    return global.isPlatformProfileGroupType && global.isPlatformProfileGroupType(type) ? "feed" : "site";
  }

  function isPlatformType(value) {
    return Boolean(global.isPlatformProfileGroupType && global.isPlatformProfileGroupType(value));
  }

  // The entry a line belongs to for the editor: "site" for the site list,
  // "apps" for the app list, else the line's platform id. Every line of one
  // entry is edited as one form view.
  function linePlatformKey(line) {
    if (!line) return "site";
    if (line.surface === "apps") return "apps";
    return line.platform ? line.platform : "site";
  }

  function normalizeEntryKey(key) {
    if (key === "apps") return "apps";
    if (!key || key === "custom" || key === "site") return "site";
    return global.normalizeGroupType ? global.normalizeGroupType(key) : String(key);
  }

  function lineBelongsTo(line, platform) {
    return linePlatformKey(line) === normalizeEntryKey(platform);
  }

  // Desktop applications: {id: bundle id, name}. Deduplicated by id.
  function normalizeAppList(value) {
    const seen = new Set();
    const out = [];
    for (const entry of Array.isArray(value) ? value : []) {
      const id = typeof entry === "string" ? entry.trim() : entry && typeof entry.id === "string" ? entry.id.trim() : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
      out.push({ id, name });
    }
    return out;
  }

  // The entries a group applies to, in line order ("site" for a site list,
  // "apps" for an app list, else the platform id).
  function groupPlatforms(group) {
    const out = [];
    for (const line of Array.isArray(group?.scopes) ? group.scopes : []) {
      const key = linePlatformKey(line);
      if (!out.includes(key)) out.push(key);
    }
    return out;
  }

  // Give every line a unique id within the group (surface + running number).
  function renumberLines(lines) {
    const counters = {};
    return lines.map((line) => {
      counters[line.surface] = (counters[line.surface] || 0) + 1;
      return orderLine({ ...line, id: `${line.surface}-${counters[line.surface]}` });
    });
  }

  // One key order for every line, whichever path built it, so a re-sanitized
  // store is byte-identical (storage change detection relies on that).
  const LINE_KEY_ORDER = ["id", "surface", "platform", "action", "sites", "sitesExcept", "apps", "appsExcept", "form", "sourceMode", "sources", "discordMode", "discordTargets", "tagFilter", "shelf"];
  function orderLine(line) {
    const out = {};
    for (const key of LINE_KEY_ORDER) if (Object.prototype.hasOwnProperty.call(line, key)) out[key] = line[key];
    return out;
  }

  function cloneTagFilter(source, coverUntilTagged) {
    return {
      mode: source.mode,
      tags: Array.isArray(source.tags) ? source.tags.map((entry) => ({ ...entry })) : [],
      defaultConfidence: source.defaultConfidence,
      blockUntagged: Boolean(source.blockUntagged),
      coverUntilTagged: Boolean(coverUntilTagged)
    };
  }

  // Flat (already normalized) group → scope lines. This is the one-time
  // migration for stored groups AND the save path for the phase-1 editor.
  function scopeLinesFromFlat(flat, groupType) {
    const kind = platformKind(groupType ?? flat?.groupType);
    const type = kind === "apps" ? "apps" : global.normalizeGroupType ? global.normalizeGroupType(groupType ?? flat?.groupType) : String(groupType ?? flat?.groupType ?? "site");
    const lines = [];
    const counters = {};
    const push = (line) => {
      counters[line.surface] = (counters[line.surface] || 0) + 1;
      lines.push(orderLine({ id: `${line.surface}-${counters[line.surface]}`, ...line }));
    };
    if (kind === "apps") {
      // Like the site list: a blocklist, or "block every application except these".
      push({ surface: "apps", platform: null, action: "block", apps: normalizeAppList(flat?.apps), appsExcept: Boolean(flat?.appsAllowlist) });
      return lines;
    }
    const sites = Array.isArray(flat?.sites) ? [...flat.sites] : [];
    const sitesExcept = Boolean(flat?.allowlist);
    // The entry's page action (block | pause) applies to its site line and its
    // untagged pages lines; custom groups only block.
    const pageAction = kind !== "custom" && flat?.pageAction === "pause" ? "pause" : "block";

    if (kind === "site" || kind === "custom") {
      // A custom group's declarative list is optional; a site group always has one.
      if (kind === "site" || sites.length > 0 || sitesExcept) {
        push({ surface: "site", platform: null, sites, sitesExcept, action: pageAction });
      }
      return lines;
    }

    const form = kind === "video" ? (flat?.platformVideoMode || "all") : "all";
    if (kind === "discord") {
      push({
        surface: "pages", platform: type, form: "all",
        discordMode: flat?.discordMode || "all",
        discordTargets: Array.isArray(flat?.discordTargets) ? [...flat.discordTargets] : [],
        tagFilter: null, action: pageAction
      });
    } else {
      const sourceMode = flat?.sourceMode || "all";
      const sources = Array.isArray(flat?.sources) ? [...flat.sources] : [];
      // "nobody": the source axis matches nothing — no source lines at all.
      if (sourceMode !== "nobody") {
        push({ surface: "items", platform: type, form, sourceMode, sources: [...sources], tagFilter: null, action: "hide" });
        push({ surface: "pages", platform: type, form, sourceMode, sources: [...sources], tagFilter: null, action: pageAction });
      }
      const tagMode = flat?.platformTagMode;
      if (tagMode === "include" || tagMode === "exclude") {
        const tagFilter = {
          mode: tagMode,
          tags: Array.isArray(flat.platformTags) ? flat.platformTags.map((entry) => ({ ...entry })) : [],
          defaultConfidence: Number.isFinite(flat.platformTagDefaultConfidence) ? flat.platformTagDefaultConfidence : 4,
          blockUntagged: Boolean(flat.platformTagBlockUntagged)
        };
        push({
          surface: "items", platform: type, form: "all", sourceMode: "all", sources: [],
          tagFilter: cloneTagFilter(tagFilter, flat.platformTagCoverUntilTagged),
          action: flat.platformTagEffect === "block" ? "hide" : "dim"
        });
        if (flat.platformTagBlockPage !== false) {
          push({
            surface: "pages", platform: type, form: "all", sourceMode: "all", sources: [],
            tagFilter: cloneTagFilter(tagFilter, false),
            action: "block"
          });
        }
      }
    }
    if (flat?.blockHomePage) push({ surface: "home", platform: type, action: "block" });
    for (const shelf of Array.isArray(flat?.surfaceHides) ? flat.surfaceHides : []) {
      push({ surface: "shelf", platform: type, shelf, action: "hide" });
    }
    return lines;
  }

  // Scope lines → the flat form fields of ONE platform (the editor's model for
  // its active platform view; `platform` defaults to the group type). Only the
  // lines of that platform are read; a site list is the "site" view.
  function flatFromScopes(group, platform) {
    const type = normalizeEntryKey(platform ?? group?.groupType);
    const lines = (Array.isArray(group?.scopes) ? group.scopes : []).filter((line) => lineBelongsTo(line, type));
    const kind = platformKind(type);
    const flat = {
      sites: [], allowlist: false, apps: [], appsAllowlist: false, blockHomePage: false, platformVideoMode: "all",
      sourceMode: "all", sources: [],
      platformTagMode: "all", platformTags: [], platformTagDefaultConfidence: 4, platformTagBlockUntagged: false,
      platformTagEffect: "dim", platformTagBlockPage: true, platformTagCoverUntilTagged: false,
      discordMode: "all", discordTargets: [], surfaceHides: [], pageAction: "block"
    };
    const siteLine = lines.find((line) => line.surface === "site");
    if (siteLine) {
      flat.sites = Array.isArray(siteLine.sites) ? [...siteLine.sites] : [];
      flat.allowlist = Boolean(siteLine.sitesExcept);
      flat.pageAction = siteLine.action === "pause" ? "pause" : "block";
    }
    const appsLine = lines.find((line) => line.surface === "apps");
    if (appsLine) {
      flat.apps = normalizeAppList(appsLine.apps);
      flat.appsAllowlist = Boolean(appsLine.appsExcept);
    }
    if (kind === "site" || kind === "custom" || kind === "apps") return flat;

    const sourceLine = lines.find((line) => (line.surface === "items" || line.surface === "pages") && !line.tagFilter);
    const pagesLine = lines.find((line) => line.surface === "pages" && !line.tagFilter);
    if (pagesLine) flat.pageAction = pagesLine.action === "pause" ? "pause" : "block";
    if (kind === "discord") {
      if (sourceLine) {
        flat.discordMode = sourceLine.discordMode || "all";
        flat.discordTargets = Array.isArray(sourceLine.discordTargets) ? [...sourceLine.discordTargets] : [];
      }
    } else if (sourceLine) {
      flat.sourceMode = sourceLine.sourceMode || "all";
      flat.sources = Array.isArray(sourceLine.sources) ? [...sourceLine.sources] : [];
      if (kind === "video") flat.platformVideoMode = sourceLine.form || "all";
    } else {
      flat.sourceMode = "nobody";
    }
    const tagItems = lines.find((line) => line.surface === "items" && line.tagFilter);
    const tagPages = lines.find((line) => line.surface === "pages" && line.tagFilter);
    const tagLine = tagItems || tagPages;
    if (tagLine) {
      flat.platformTagMode = tagLine.tagFilter.mode;
      flat.platformTags = Array.isArray(tagLine.tagFilter.tags) ? tagLine.tagFilter.tags.map((entry) => ({ ...entry })) : [];
      flat.platformTagDefaultConfidence = tagLine.tagFilter.defaultConfidence;
      flat.platformTagBlockUntagged = Boolean(tagLine.tagFilter.blockUntagged);
      flat.platformTagCoverUntilTagged = Boolean(tagItems && tagItems.tagFilter.coverUntilTagged);
      flat.platformTagEffect = tagItems && tagItems.action === "hide" ? "block" : "dim";
      flat.platformTagBlockPage = Boolean(tagPages);
    }
    flat.blockHomePage = lines.some((line) => line.surface === "home");
    flat.surfaceHides = lines.filter((line) => line.surface === "shelf" && line.shelf).map((line) => line.shelf);
    return flat;
  }

  // The editor's flat view of one platform, written back over the group's
  // lines: that platform's lines are replaced, every other platform's lines
  // are kept as they were. Custom groups only ever carry their site line.
  function mergeFlatIntoScopes(scopes, flat, platform) {
    const raw = platform ?? flat?.groupType;
    const isCustom = (global.normalizeGroupType ? global.normalizeGroupType(raw) : raw) === "custom" && raw !== "apps";
    const key = normalizeEntryKey(raw);
    const kept = isCustom
      ? []
      : (Array.isArray(scopes) ? scopes : []).filter((line) => !lineBelongsTo(line, key));
    return renumberLines([...kept, ...scopeLinesFromFlat(flat, isCustom ? "custom" : key)]);
  }

  // Validate scope lines that arrive already shaped (a stored group, a
  // new-style patch). `n` supplies the context's own normalizers for the
  // fields that differ between the worker and the popup (tags, site entries).
  function sanitizeScopeLines(rawLines, groupType, n) {
    const type = global.normalizeGroupType ? global.normalizeGroupType(groupType) : String(groupType || "site");
    const isCustom = type === "custom";
    const out = [];
    const counters = {};
    const list = Array.isArray(rawLines) ? rawLines : [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const surface = SCOPE_SURFACES.includes(raw.surface) ? raw.surface : null;
      if (!surface) continue;
      const legal = scopeLegalActions(surface);
      const action = legal.includes(raw.action) ? raw.action : legal[0];
      const line = { id: "", surface, platform: null, action };
      if (surface === "site") {
        line.sites = [...new Set((Array.isArray(raw.sites) ? raw.sites : []).map(n.normalizeSiteInput).filter(Boolean))];
        line.sitesExcept = Boolean(raw.sitesExcept);
      } else if (surface === "apps") {
        if (isCustom) continue;
        line.apps = normalizeAppList(raw.apps);
        line.appsExcept = Boolean(raw.appsExcept);
      } else {
        // A platform line names its own platform; an old line without one
        // belongs to the group's platform. Custom groups have no platform lines.
        if (isCustom) continue;
        const platform = isPlatformType(raw.platform) ? raw.platform : isPlatformType(type) ? type : null;
        if (!platform) continue;
        const kind = platformKind(platform);
        line.platform = platform;
        if (surface === "home") {
          // nothing else
        } else if (surface === "shelf") {
          const ids = global.normalizeSurfaceHides ? global.normalizeSurfaceHides([raw.shelf], platform) : [raw.shelf];
          if (ids.length === 0) continue;
          line.shelf = ids[0];
        } else {
          line.form = kind === "video" && global.normalizeVideoMode ? global.normalizeVideoMode(raw.form) : "all";
          if (kind === "discord") {
            const targets = [...new Set((Array.isArray(raw.discordTargets) ? raw.discordTargets : []).map(global.normalizeDiscordTargetInput).filter(Boolean))];
            line.discordMode = global.normalizeDiscordMode(raw.discordMode, targets);
            line.discordTargets = targets;
          } else {
            const sources = [...new Set((Array.isArray(raw.sources) ? raw.sources : []).map((value) => global.normalizeSourceInput(value, platform)).filter(Boolean))];
            line.sourceMode = global.normalizeSourceMode(raw.sourceMode, sources);
            // A "nobody" line names nothing: drop it (the absence of source lines is "nobody").
            if (line.sourceMode === "nobody") continue;
            line.sources = sources;
          }
          if (raw.tagFilter && typeof raw.tagFilter === "object") {
            const mode = n.normalizeTagFilterMode(raw.tagFilter.mode);
            // A tagged page is blacked out in place; it never pauses.
            if ((mode === "include" || mode === "exclude") && surface === "pages") line.action = "block";
            if (mode === "include" || mode === "exclude") {
              line.tagFilter = {
                mode,
                tags: n.normalizeTagList(raw.tagFilter.tags),
                defaultConfidence: n.clampTagConfidence(raw.tagFilter.defaultConfidence, 4),
                blockUntagged: Boolean(raw.tagFilter.blockUntagged),
                coverUntilTagged: surface === "items" && raw.tagFilter.coverUntilTagged === true
              };
            } else {
              line.tagFilter = null;
            }
          } else {
            line.tagFilter = null;
          }
        }
      }
      counters[surface] = (counters[surface] || 0) + 1;
      line.id = typeof raw.id === "string" && raw.id ? raw.id : `${surface}-${counters[surface]}`;
      out.push(orderLine(line));
    }
    return out;
  }

  // The group type is the platform the editor shows first: the group's own
  // type when its lines still name it, else the first platform the lines name,
  // else a site group (a platform group without lines keeps its type). A
  // custom group keeps its type (its rule is the group).
  function deriveGroupType(lines, fallbackType) {
    const fallback = global.normalizeGroupType ? global.normalizeGroupType(fallbackType) : String(fallbackType || "site");
    if (fallback === "custom") return "custom";
    const list = Array.isArray(lines) ? lines : [];
    if (list.some((line) => lineBelongsTo(line, fallback))) return fallback;
    const platformLine = list.find((line) => line.platform);
    if (platformLine) return platformLine.platform;
    return list.some((line) => line.surface === "site") ? "site" : fallback;
  }

  // ── Tag lists (a tag line's names) ───────────────────────────────────────
  // Each entry is { name, confidence?, also?, except? }:
  //   confidence — overrides the filter default for this entry;
  //   also       — further tags that must ALL be present too (AND: "A + B");
  //   except     — a carve-out ("!A"): the list matches only if no carve-out does.
  // Stored lists are normalized as entries; only text the user typed goes
  // through the text syntax (one entry per line, the inverse of tagListToText).
  function normalizeTagList(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    const cleanName = (value) => (typeof value === "string" ? value.trim().slice(0, 100) : "");
    for (const entry of raw) {
      let name = null;
      let confidence;
      let also = [];
      let except = false;
      if (typeof entry === "string") {
        name = entry;
      } else if (entry && typeof entry === "object") {
        name = entry.name;
        confidence = entry.confidence;
        if (Array.isArray(entry.also)) also = entry.also;
        except = entry.except === true;
      }
      name = cleanName(name);
      if (!name) continue;
      const alsoSeen = new Set([name.toLowerCase()]);
      const cleanAlso = [];
      for (const extra of also) {
        const extraName = cleanName(extra);
        if (!extraName || alsoSeen.has(extraName.toLowerCase())) continue;
        alsoSeen.add(extraName.toLowerCase());
        cleanAlso.push(extraName);
        if (cleanAlso.length >= 5) break;
      }
      const key = (except ? "!" : "") + [...alsoSeen].sort().join("+");
      if (seen.has(key)) continue;
      seen.add(key);
      const c = Number(confidence);
      const normalized = { name };
      if (Number.isFinite(c) && c >= 1 && c <= 5) normalized.confidence = Math.round(c);
      if (cleanAlso.length) normalized.also = cleanAlso;
      if (except) normalized.except = true;
      out.push(normalized);
      if (out.length >= 100) break;
    }
    return out;
  }

  function parseTagListText(value) {
    if (typeof value !== "string") return [];
    const entries = [];
    for (const rawLine of value.split(/\r?\n/)) {
      let line = rawLine.trim();
      if (!line) continue;
      let except = false;
      if (line.startsWith("!")) {
        except = true;
        line = line.slice(1).trim();
      }
      // "@3" anywhere at the end, or ">=3" / ">3" / ":3" after a space — so a
      // tag named "Top:5" stays a name.
      let confidence;
      const m = line.match(/(?:\s*@\s*|\s+(?:>=?|:)\s*)([1-5])$/);
      if (m) {
        confidence = Number(m[1]);
        line = line.slice(0, m.index).trim();
      }
      // AND is " + " with spaces; a dangling one ("Gaming +", a lone "+") is
      // not a tag, while "C++" is a name.
      line = line.replace(/^\+(?:\s+\+)*(?:\s+|$)|(?:^|\s+)\+(?:\s+\+)*$/g, "").trim();
      if (!line) continue;
      const names = line.split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
      if (!names.length) continue;
      const entry = { name: names[0] };
      if (confidence) entry.confidence = confidence;
      if (names.length > 1) entry.also = names.slice(1);
      if (except) entry.except = true;
      entries.push(entry);
    }
    return normalizeTagList(entries);
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

  // ── One group: its defaults and its sanitizer ────────────────────────────
  // The service worker, the editor (which then shows one entry's flat view)
  // and Mac Vault's tools (in JavaScriptCore) all use these. They need
  // platform-profiles.js and group-actions.js loaded (read at call time).
  const DEFAULT_CUSTOM_RULE = "(event, helpers) => {\n  // Register handlers here.\n}";

  // A site entry is a host ("youtube.com": that host and its subdomains) or a
  // host plus a path prefix ("youtube.com/shorts": only that path and everything
  // under it; owner 2026-09-24). Scheme, www., query and hash are dropped.
  function normalizeSiteInput(value) {
    const trimmed = String(value ?? "").trim().toLowerCase();
    if (!trimmed) return null;
    const maybeUrl = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    try {
      const parsedUrl = new URL(maybeUrl);
      let hostname = parsedUrl.hostname.trim().toLowerCase();
      if (!hostname) return null;
      if (hostname.startsWith("www.")) hostname = hostname.slice(4);
      const path = parsedUrl.pathname.replace(/\/+$/, "");
      return path && path !== "/" ? hostname + path : hostname;
    } catch {
      return null;
    }
  }

  function normalizeTagFilterMode(value) {
    return value === "include" || value === "exclude" ? value : "all";
  }

  function clampTagConfidence(value, fallback) {
    const c = Number(value);
    return Number.isFinite(c) ? Math.min(5, Math.max(1, Math.round(c))) : fallback;
  }

  const scopeNormalizers = { normalizeSiteInput, normalizeTagFilterMode, normalizeTagList, clampTagConfidence };

  // A new group of a type; `overrides` may give its name, snooze minutes and
  // custom-rule text (the editor's translated defaults).
  function createDefaultGroup(groupType = "site", overrides = {}) {
    const A = global.CBGroupActions;
    const normalizedGroupType = normalizeGroupType(groupType);
    return {
      id: A.createGroupId(),
      groupType: normalizedGroupType,
      name: overrides.name ||
        global.PLATFORM_PROFILES?.[normalizedGroupType]?.defaultName ||
        (normalizedGroupType === "custom" ? "Custom Block" : "Block Group"),
      enabled: true,
      mode: "instant",
      allowedMinutes: A.DEFAULT_ALLOWED_MINUTES,
      resetIntervalHours: A.DEFAULT_RESET_INTERVAL_HOURS,
      resetAtMidnight: false,
      rollingLimit: false,
      allowSnooze: true,
      snoozeMinutes: A.parseSnoozeMinutes(overrides.snoozeMinutes) ?? A.DEFAULT_SNOOZE_MINUTES,
      snoozeActivationDelayMinutes: A.DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
      snoozeCooldownMinutes: A.DEFAULT_SNOOZE_COOLDOWN_MINUTES,
      snoozeConfirmations: A.DEFAULT_SNOOZE_CONFIRMATIONS,
      activeDays: A.createDefaultDays(),
      timeWindowsText: "",
      platformVideoMode: "all",
      // Source axis: creators / accounts / subreddits (Discord keeps its own pair).
      sourceMode: "all",
      sources: [],
      discordMode: "all",
      discordTargets: [],
      surfaceHides: [],
      blockingRulesText: overrides.blockingRulesText || DEFAULT_CUSTOM_RULE,
      ...A.normalizeLock({}),
      sites: [],
      // false → `sites` is a block list; true → "block everything except these".
      allowlist: false,
      blockHomePage: false,
      fallbackUrl: "",
      pauseSeconds: A.DEFAULT_PAUSE_SECONDS
    };
  }

  // Stored or patched groups → the canonical shape: policy fields + `scopes`.
  // A flat (form / legacy / tool) patch describes ONE platform — the group's
  // type — and replaces only that platform's lines.
  function sanitizeGroups(groups) {
    if (!Array.isArray(groups)) return [];
    const A = global.CBGroupActions;

    return groups
      .map((input, index) => {
        const hasLines = hasScopeLines(input);
        const flatPatched = hasFlatScopeFields(input);
        const group = hasLines ? { ...flatFromScopes(input), ...input } : input;
        const useStoredLines = hasLines && !flatPatched;
        const baseGroup = createDefaultGroup(normalizeGroupType(group?.groupType));
        const hasStoredDays = Array.isArray(group?.activeDays);
        const rawDays = hasStoredDays ? group.activeDays : A.createDefaultDays();
        const activeDays = rawDays
          .map((day) => String(day).trim().toLowerCase())
          .filter((day, dayIndex, array) => A.DAY_NAMES.includes(day) && array.indexOf(day) === dayIndex);
        const rawTimeWindowsText =
          typeof group?.timeWindowsText === "string"
            ? group.timeWindowsText
            : Array.isArray(group?.timeWindows)
              ? group.timeWindows.join("\n")
              : "";
        // One source list per group. Legacy stores carried platformAuthors /
        // platformAuthorMode (creators, accounts) or redditSubreddits /
        // redditMode (Reddit); both are read once here and written back as
        // sources / sourceMode.
        const legacySources = group?.groupType === "reddit" ? group?.redditSubreddits : group?.platformAuthors;
        const legacyMode = group?.groupType === "reddit" ? group?.redditMode : group?.platformAuthorMode;
        // The legacy pair only exists in old stores and old-style patches, so when
        // it is present it wins over a default-valued modern pair merged underneath.
        const hasLegacy = Array.isArray(legacySources) || typeof legacyMode === "string";
        const rawSources = hasLegacy
          ? (Array.isArray(legacySources) ? legacySources : [])
          : Array.isArray(group?.sources) ? group.sources : [];
        const rawSourceMode = hasLegacy ? legacyMode : group?.sourceMode;
        const rawDiscordTargets = Array.isArray(group?.discordTargets) ? group.discordTargets : [];

        const normalizedGroupType = normalizeGroupType(group?.groupType);

        const normalized = {
          ...baseGroup,
          id: typeof group?.id === "string" && group.id ? group.id : baseGroup.id,
          name:
            typeof group?.name === "string" && group.name.trim()
              ? group.name.trim()
              : `${baseGroup.name} ${index + 1}`,
          // The group-level "allow" exception effect was removed (owner 2026-09-24:
          // exceptions live in custom rules). A stored exception group must not
          // silently turn into a blocking group, so it is kept but disabled.
          enabled: Boolean(group?.enabled) && group?.effect !== "allow",
          groupType: normalizedGroupType,
          mode: A.normalizeBlockingMode(group?.mode),
          allowedMinutes: A.parseAllowedMinutes(group?.allowedMinutes) ?? A.DEFAULT_ALLOWED_MINUTES,
          resetIntervalHours:
            A.parseResetIntervalHours(group?.resetIntervalHours) ?? A.DEFAULT_RESET_INTERVAL_HOURS,
          resetAtMidnight: group?.resetAtMidnight === true,
          rollingLimit: group?.rollingLimit === true,
          allowSnooze: group?.allowSnooze !== false,
          snoozeMinutes: A.parseSnoozeMinutes(group?.snoozeMinutes) ?? A.DEFAULT_SNOOZE_MINUTES,
          snoozeActivationDelayMinutes:
            A.parseSnoozeDelayMinutes(group?.snoozeActivationDelayMinutes) ??
            A.DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
          snoozeCooldownMinutes:
            A.parseSnoozeCooldownMinutes(group?.snoozeCooldownMinutes) ??
            A.DEFAULT_SNOOZE_COOLDOWN_MINUTES,
          snoozeConfirmations:
            A.parseSnoozeConfirmations(group?.snoozeConfirmations) ?? A.DEFAULT_SNOOZE_CONFIRMATIONS,
          activeDays: hasStoredDays ? activeDays : A.createDefaultDays(),
          timeWindowsText: A.parseTimeWindowsText(rawTimeWindowsText).normalizedLines.join("\n"),
          platformVideoMode: normalizeVideoMode(group?.platformVideoMode),
          sourceMode: normalizeSourceMode(rawSourceMode, rawSources),
          sources: [
            ...new Set(
              rawSources
                .map((source) => normalizeSourceInput(source, normalizedGroupType))
                .filter(Boolean)
            )
          ],
          // Content-tag filter (platform rules): block by classifier tag.
          platformTagMode: normalizeTagFilterMode(group?.platformTagMode),
          platformTags: normalizeTagList(group?.platformTags),
          platformTagDefaultConfidence: clampTagConfidence(group?.platformTagDefaultConfidence, 4),
          platformTagBlockUntagged: Boolean(group?.platformTagBlockUntagged),
          platformTagEffect: group?.platformTagEffect === "block" ? "block" : "dim",
          // A matching video's OWN page (watch/detail) blacks out its player in
          // place. On unless explicitly turned off: feed-dim + page-block is the
          // product default for content-tag blocking.
          platformTagBlockPage: group?.platformTagBlockPage !== false,
          // Optional (default off): cover taggable cards / the watch page while the
          // classifier is still tagging, instead of leaving them visible until the
          // tags arrive. Revealed when the tags settle and do not match.
          platformTagCoverUntilTagged: group?.platformTagCoverUntilTagged === true,
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
          // The lock: parallel gates (wait / PIN), see group-actions.js.
          ...A.normalizeLock(group),
          sites: Array.isArray(group?.sites)
            ? [...new Set(group.sites.map(normalizeSiteInput).filter(Boolean))]
            : [],
          // A block list (false) or "block everything except these" (true).
          allowlist: Boolean(group?.allowlist),
          blockHomePage: Boolean(group?.blockHomePage),
          // The entry's page action (block | pause), read into its lines below.
          pageAction: group?.pageAction === "pause" ? "pause" : "block",
          // One field: a web address redirects the blocked tab there, any other
          // text is shown on the cover, blank = the plain cover.
          fallbackUrl: typeof group?.fallbackUrl === "string" ? group.fallbackUrl.trim() : "",
          pauseSeconds: A.parsePauseSeconds(group?.pauseSeconds) ?? A.DEFAULT_PAUSE_SECONDS,
          // Preserve custom-rule fields verbatim so that any path which
          // eventually persists the sanitised group (e.g. getState() →
          // applyRuntimeNormalizations() when changed=true) does not silently
          // strip the user's saved source code, abort reason, or update
          // timestamp. The defaults are deliberately empty / null so non-custom
          // groups stay shape-compatible with the previous serialised form.
          activeEventSource:
            typeof group?.activeEventSource === "string" ? group.activeEventSource : "",
          lastAbortReason:
            typeof group?.lastAbortReason === "string" ? group.lastAbortReason : "",
          lastSourceUpdatedAt:
            Number.isFinite(Number(group?.lastSourceUpdatedAt)) &&
            Number(group.lastSourceUpdatedAt) > 0
              ? Number(group.lastSourceUpdatedAt)
              : null
        };
        // Stored lines are validated as they are. A flat (form / legacy / MCP)
        // patch describes ONE platform — the group's type — and replaces only
        // that platform's lines; lines of the group's other platforms stay.
        const storedLines = hasLines
          ? sanitizeScopeLines(input.scopes, normalizedGroupType, scopeNormalizers)
          : [];
        let scopes = useStoredLines
          ? storedLines
          : mergeFlatIntoScopes(storedLines, normalized, normalizedGroupType);
        // A website list patched onto a platform group edits its Websites entry
        // (owner 2026-09-24): the flat `sites`/`allowlist` describe that entry.
        if (!useStoredLines && platformKind(normalizedGroupType) !== "site" && normalizedGroupType !== "custom"
            && (Object.prototype.hasOwnProperty.call(input, "sites") || Object.prototype.hasOwnProperty.call(input, "allowlist"))) {
          scopes = mergeFlatIntoScopes(scopes, normalized, "site");
        }
        return {
          ...withoutFlatScopeFields(normalized),
          groupType: deriveGroupType(scopes, normalizedGroupType),
          scopes
        };
      });
  }

  // ── The scope line (owner 2026-09-27) ───────────────────────────────────
  // Mac Vault controls apps, a browser controls the browser; neither crosses.
  // The Apps lines are the desktop's, every other line a browser's; a program
  // edits, creates and contributes only its own.
  function lineOwner(line) {
    return line && line.surface === "apps" ? "desktop" : "browser";
  }
  function entryOwner(key) {
    return key === "apps" ? "desktop" : "browser";
  }
  function programOwner(program) {
    return program === "macapp" ? "desktop" : "browser";
  }
  // `next`'s lines for `owner`, the other owner's lines as `stored` has them.
  function withOwnLines(stored, next, owner) {
    const theirs = (Array.isArray(stored?.scopes) ? stored.scopes : []).filter((line) => lineOwner(line) !== owner);
    const mine = (Array.isArray(next?.scopes) ? next.scopes : []).filter((line) => lineOwner(line) === owner);
    return [...theirs, ...mine];
  }
  // True when `next` changes (or, for a new group, has) lines `owner` doesn't own.
  function crossesScopeLine(stored, next, owner) {
    const others = (group) => JSON.stringify((Array.isArray(group?.scopes) ? group.scopes : [])
      .filter((line) => lineOwner(line) !== owner)
      .map(({ id: _id, ...line }) => line));
    return others(stored) !== others(next);
  }

  // A new group as `owner` starts it: the desktop's default group names apps,
  // a browser's a website list.
  function newGroup(groupType, overrides, owner) {
    const group = createDefaultGroup(groupType, overrides);
    if (owner !== "desktop" || platformKind(group.groupType) !== "site") return sanitizeGroups([group])[0];
    return sanitizeGroups([{ ...withoutFlatScopeFields(group), scopes: scopeLinesFromFlat({}, "apps") }])[0];
  }

  // A new group's name: "<kind> n", the first free n after the groups of that
  // kind. `pattern(kind, n)` words it (the editor in the user's language).
  const NAME_KINDS = new Set(["youtube", "tiktok", "facebook", "instagram", "twitch", "reddit", "discord", "twitter", "custom"]);
  function nameKind(groupType) {
    return NAME_KINDS.has(groupType) ? groupType : "site";
  }
  function englishNamePattern(kind, n) {
    const root = kind === "custom" ? "Custom Rules" : kind === "site" ? "Block Group" : global.PLATFORM_PROFILES?.[kind]?.defaultName || "Block Group";
    return `${root} ${n}`;
  }
  function defaultGroupName(groups, groupType, pattern = englishNamePattern) {
    const kind = nameKind(groupType);
    const list = Array.isArray(groups) ? groups : [];
    const start = list.filter((group) => nameKind(group?.groupType) === kind).length + 1;
    return global.CBGroupActions.freeName(list, (n) => pattern(kind, n), start);
  }

  // A tool's edit, exactly as the editor could make it (owner: tools do what
  // the user can): { group } or { error }. The id, the lock and the runtime
  // marks aren't patchable; a group never turns custom or back; an invalid
  // value is refused, never defaulted; the other program's lines are refused.
  const TOOL_FIXED_FIELDS = ["id", "activeEventSource", "lastAbortReason", "lastSourceUpdatedAt", "lockSyncedVersion",
    "freezeMode", "freezeModeChoice", "strictFreezeHours", "frozenAtMs", "freezeChangedAtMs"];
  function applyToolEdit(stored, patch, owner) {
    const A = global.CBGroupActions;
    const edit = { ...(patch && typeof patch === "object" ? patch : {}) };
    for (const field of [...TOOL_FIXED_FIELDS, ...A.LOCK_FIELDS]) delete edit[field];
    const type = edit.groupType ?? stored?.groupType ?? "site";
    if ((type === "custom") !== (stored?.groupType === "custom")) return { error: "invalid-groupType" };
    const problem = A.validateGroupPatch(edit, type);
    if (problem) return { error: problem };
    // Compared with the stored group as the editor stores it (an old store's
    // flat fields read as lines).
    const [current] = sanitizeGroups([stored]);
    // Lines sent without the other program's keep those as stored.
    if (Array.isArray(edit.scopes) && !edit.scopes.some((line) => lineOwner(line) !== owner)) {
      edit.scopes = withOwnLines(current, edit, owner);
    }
    const [group] = sanitizeGroups([{ ...current, ...edit, id: stored.id }]);
    if (!group) return { error: "invalid-group" };
    if (crossesScopeLine(current, group, owner)) return { error: owner === "desktop" ? "browser-lines" : "desktop-lines" };
    return { group };
  }
  // A tool's new group, as the editor's New group makes it.
  function createToolGroup(groups, groupType, patch, owner, defaults = {}) {
    if (groupType !== "site" && groupType !== "custom" && !isPlatformType(groupType)) return { error: "unknown-group-type" };
    const name = typeof patch?.name === "string" && patch.name.trim() ? patch.name : defaultGroupName(groups, groupType);
    const base = newGroup(groupType, { name, snoozeMinutes: defaults.snoozeMinutes, blockingRulesText: defaults.blockingRulesText }, owner);
    const result = applyToolEdit(base, patch, owner);
    if (result.error) return result;
    if (crossesScopeLine(null, result.group, owner)) return { error: owner === "desktop" ? "browser-lines" : "desktop-lines" };
    if (global.CBGroupActions.nameTaken(groups, result.group.name)) return { error: "duplicate-name" };
    return result;
  }

  // The policy settings linked groups share (the whole definition is these
  // plus every entry's lines). One list for the editor and the worker.
  // The lock is not among them: it travels as its own unit with a version
  // (group-actions.js lockContribution / adoptLock).
  const SYNC_SCALAR_FIELDS = Object.freeze([
    // Everything is shared (owner 2026-09-27): the name and on/off too. A custom
    // rule's code is not (a linked custom group shares only its memory).
    "name", "enabled", "mode", "allowedMinutes", "resetIntervalHours", "resetAtMidnight", "rollingLimit",
    "allowSnooze", "snoozeMinutes", "snoozeActivationDelayMinutes", "snoozeCooldownMinutes", "snoozeConfirmations",
    "activeDays", "timeWindowsText",
    "fallbackUrl", "pauseSeconds"
  ]);

  const api = Object.freeze({
    SCOPE_SURFACES, SCOPE_ACTIONS, FLAT_SCOPE_FIELDS, SYNC_SCALAR_FIELDS,
    scopeLegalActions, hasFlatScopeFields, hasScopeLines, withoutFlatScopeFields,
    scopeLinesFromFlat, flatFromScopes, mergeFlatIntoScopes, sanitizeScopeLines, deriveGroupType, platformKind,
    linePlatformKey, lineBelongsTo, normalizeEntryKey, groupPlatforms, normalizeAppList,
    normalizeTagList, parseTagListText, tagListToText,
    DEFAULT_CUSTOM_RULE, normalizeSiteInput, normalizeTagFilterMode, clampTagConfidence, scopeNormalizers,
    createDefaultGroup, sanitizeGroups,
    lineOwner, entryOwner, programOwner, withOwnLines, crossesScopeLine, newGroup, defaultGroupName,
    applyToolEdit, createToolGroup
  });
  global.CBGroupScopes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
