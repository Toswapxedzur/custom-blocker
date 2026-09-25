// Group scopes — the "where" half of a block group (owner model 2026-09-24).
//
// A group is a POLICY (when: mode, minutes, schedule, snooze, lock, redirect)
// plus SCOPE LINES (where). The group applies to the union of its lines, and
// every line ends in one ACTION (what happens to what it matched):
//
//   surface  | what the line names                          | legal actions
//   site     | host or host/path entries (+ "everything except") | block, pause
//   apps     | desktop applications ({id, name}; enforced by the desktop apps) | block
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
    "sites", "allowlist", "apps", "blockHomePage", "platformVideoMode",
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
  const LINE_KEY_ORDER = ["id", "surface", "platform", "action", "sites", "sitesExcept", "apps", "form", "sourceMode", "sources", "discordMode", "discordTargets", "tagFilter", "shelf"];
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
      push({ surface: "apps", platform: null, action: "block", apps: normalizeAppList(flat?.apps) });
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
      sites: [], allowlist: false, apps: [], blockHomePage: false, platformVideoMode: "all",
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
    if (appsLine) flat.apps = normalizeAppList(appsLine.apps);
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

  const api = Object.freeze({
    SCOPE_SURFACES, SCOPE_ACTIONS, FLAT_SCOPE_FIELDS,
    scopeLegalActions, hasFlatScopeFields, hasScopeLines, withoutFlatScopeFields,
    scopeLinesFromFlat, flatFromScopes, mergeFlatIntoScopes, sanitizeScopeLines, deriveGroupType, platformKind,
    linePlatformKey, lineBelongsTo, normalizeEntryKey, groupPlatforms, normalizeAppList
  });
  global.CBGroupScopes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
