// Group scopes — the "where" half of a block group (owner model 2026-09-24).
//
// A group is a POLICY (when: mode, minutes, schedule, snooze, lock, redirect)
// plus SCOPE LINES (where). The group applies to the union of its lines, and
// every line ends in one ACTION (what happens to what it matched):
//
//   surface  | what the line names                          | legal actions
//   site     | host or host/path entries (+ "everything except") | block
//   items    | feed cards of a platform (form / sources / tags)  | hide, dim
//   pages    | the content's own page (form / sources / tags)    | block
//   home     | the platform's home feed                          | block
//   shelf    | one platform surface (Shorts shelf, comments, …)  | hide
//
// A group's lines may name several platforms (and a site list); the group
// applies to their union. The editor still works one platform at a time: the
// flat form fields are the view of ONE platform's lines (flatFromScopes with
// that platform), and saving merges that view back over the group's other
// lines (mergeFlatIntoScopes). Normal groups only block/hide/dim — exceptions
// are custom rules (allow()), never lines.
//
// Loaded by the service worker, the popup and the tests; depends on the
// platform registry (platform-profiles.js) being loaded first.
(function (global) {
  "use strict";

  const SCOPE_SURFACES = ["site", "items", "pages", "home", "shelf"];
  const SCOPE_ACTIONS = ["block", "hide", "dim"];

  function scopeLegalActions(surface) {
    if (surface === "items") return ["hide", "dim"];
    if (surface === "shelf") return ["hide"];
    return ["block"];
  }

  // Every flat field the lines replace, including the pre-2026-09-24 pairs
  // the flat sanitizer still migrates. Their presence on an input marks it as
  // a flat (form or legacy) group, or as a flat patch over a scoped group.
  const FLAT_SCOPE_FIELDS = [
    "sites", "allowlist", "blockHomePage", "platformVideoMode",
    "sourceMode", "sources", "platformAuthorMode", "platformAuthors", "redditMode", "redditSubreddits",
    "platformTagMode", "platformTags", "platformTagDefaultConfidence", "platformTagBlockUntagged",
    "platformTagEffect", "platformTagBlockPage", "platformTagCoverUntilTagged",
    "discordMode", "discordTargets", "surfaceHides"
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

  // The "platform" a line belongs to for the editor: a platform id, or "site"
  // for a site line. Every line of one platform is edited as one form view.
  function linePlatformKey(line) {
    return line && line.platform ? line.platform : "site";
  }

  function lineBelongsTo(line, platform) {
    const key = platform && platform !== "custom" ? platform : "site";
    return linePlatformKey(line) === key;
  }

  // The platforms a group applies to, in line order ("site" for a site list).
  // A platform group without lines still reports its group type.
  function groupPlatforms(group) {
    const out = [];
    for (const line of Array.isArray(group?.scopes) ? group.scopes : []) {
      const key = linePlatformKey(line);
      if (!out.includes(key)) out.push(key);
    }
    const type = global.normalizeGroupType ? global.normalizeGroupType(group?.groupType) : String(group?.groupType || "site");
    if (out.length === 0 && type !== "custom") out.push(type);
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
  const LINE_KEY_ORDER = ["id", "surface", "platform", "action", "sites", "sitesExcept", "form", "sourceMode", "sources", "discordMode", "discordTargets", "tagFilter", "shelf"];
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
    const type = global.normalizeGroupType ? global.normalizeGroupType(groupType ?? flat?.groupType) : String(groupType ?? flat?.groupType ?? "site");
    const kind = platformKind(type);
    const lines = [];
    const counters = {};
    const push = (line) => {
      counters[line.surface] = (counters[line.surface] || 0) + 1;
      lines.push(orderLine({ id: `${line.surface}-${counters[line.surface]}`, ...line }));
    };
    const sites = Array.isArray(flat?.sites) ? [...flat.sites] : [];
    const sitesExcept = Boolean(flat?.allowlist);

    if (kind === "site" || kind === "custom") {
      // A custom group's declarative list is optional; a site group always has one.
      if (kind === "site" || sites.length > 0 || sitesExcept) {
        push({ surface: "site", platform: null, sites, sitesExcept, action: "block" });
      }
      return lines;
    }

    const form = kind === "video" ? (flat?.platformVideoMode || "all") : "all";
    if (kind === "discord") {
      push({
        surface: "pages", platform: type, form: "all",
        discordMode: flat?.discordMode || "all",
        discordTargets: Array.isArray(flat?.discordTargets) ? [...flat.discordTargets] : [],
        tagFilter: null, action: "block"
      });
    } else {
      const sourceMode = flat?.sourceMode || "all";
      const sources = Array.isArray(flat?.sources) ? [...flat.sources] : [];
      // "nobody": the source axis matches nothing — no source lines at all.
      if (sourceMode !== "nobody") {
        push({ surface: "items", platform: type, form, sourceMode, sources: [...sources], tagFilter: null, action: "hide" });
        push({ surface: "pages", platform: type, form, sourceMode, sources: [...sources], tagFilter: null, action: "block" });
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
    const type = global.normalizeGroupType ? global.normalizeGroupType(platform ?? group?.groupType) : String(platform ?? group?.groupType ?? "site");
    const lines = (Array.isArray(group?.scopes) ? group.scopes : []).filter((line) => lineBelongsTo(line, type));
    const kind = platformKind(type);
    const flat = {
      sites: [], allowlist: false, blockHomePage: false, platformVideoMode: "all",
      sourceMode: "all", sources: [],
      platformTagMode: "all", platformTags: [], platformTagDefaultConfidence: 4, platformTagBlockUntagged: false,
      platformTagEffect: "dim", platformTagBlockPage: true, platformTagCoverUntilTagged: false,
      discordMode: "all", discordTargets: [], surfaceHides: []
    };
    const siteLine = lines.find((line) => line.surface === "site");
    if (siteLine) {
      flat.sites = Array.isArray(siteLine.sites) ? [...siteLine.sites] : [];
      flat.allowlist = Boolean(siteLine.sitesExcept);
    }
    if (kind === "site" || kind === "custom") return flat;

    const sourceLine = lines.find((line) => (line.surface === "items" || line.surface === "pages") && !line.tagFilter);
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
    const type = global.normalizeGroupType ? global.normalizeGroupType(platform ?? flat?.groupType) : String(platform ?? flat?.groupType ?? "site");
    const kept = type === "custom"
      ? []
      : (Array.isArray(scopes) ? scopes : []).filter((line) => !lineBelongsTo(line, type));
    return renumberLines([...kept, ...scopeLinesFromFlat(flat, type)]);
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
    linePlatformKey, lineBelongsTo, groupPlatforms
  });
  global.CBGroupScopes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
