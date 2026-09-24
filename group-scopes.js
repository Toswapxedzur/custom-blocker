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
// Phase 1 keeps every group on one platform and edits it through the same
// forms as before: the flat form fields and the scope lines are two views of
// the same thing, converted here in both directions. Normal groups only
// block/hide/dim — exceptions are custom rules (allow()), never lines.
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

  // Scope lines → the flat form fields (the phase-1 editor's model, and the
  // shape the feed-filter / matcher code consumed before lines existed).
  function flatFromScopes(group) {
    const lines = Array.isArray(group?.scopes) ? group.scopes : [];
    const type = global.normalizeGroupType ? global.normalizeGroupType(group?.groupType) : String(group?.groupType || "site");
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

  // Validate scope lines that arrive already shaped (a stored group, a
  // new-style patch). `n` supplies the context's own normalizers for the
  // fields that differ between the worker and the popup (tags, site entries).
  function sanitizeScopeLines(rawLines, groupType, n) {
    const type = global.normalizeGroupType ? global.normalizeGroupType(groupType) : String(groupType || "site");
    const kind = platformKind(type);
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
        if (kind !== "site" && kind !== "custom") continue;
        line.sites = [...new Set((Array.isArray(raw.sites) ? raw.sites : []).map(n.normalizeSiteInput).filter(Boolean))];
        line.sitesExcept = Boolean(raw.sitesExcept);
      } else {
        if (kind === "site" || kind === "custom") continue;
        line.platform = type;
        if (surface === "home") {
          // nothing else
        } else if (surface === "shelf") {
          const ids = global.normalizeSurfaceHides ? global.normalizeSurfaceHides([raw.shelf], type) : [raw.shelf];
          if (ids.length === 0) continue;
          line.shelf = ids[0];
        } else {
          line.form = kind === "video" && global.normalizeVideoMode ? global.normalizeVideoMode(raw.form) : "all";
          if (kind === "discord") {
            const targets = [...new Set((Array.isArray(raw.discordTargets) ? raw.discordTargets : []).map(global.normalizeDiscordTargetInput).filter(Boolean))];
            line.discordMode = global.normalizeDiscordMode(raw.discordMode, targets);
            line.discordTargets = targets;
          } else {
            const sources = [...new Set((Array.isArray(raw.sources) ? raw.sources : []).map((value) => global.normalizeSourceInput(value, type)).filter(Boolean))];
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

  // The group type is derived from the lines: the platform they name, else a
  // site group. A custom group keeps its type (its rule is the group).
  function deriveGroupType(lines, fallbackType) {
    const fallback = global.normalizeGroupType ? global.normalizeGroupType(fallbackType) : String(fallbackType || "site");
    if (fallback === "custom") return "custom";
    const platformLine = (Array.isArray(lines) ? lines : []).find((line) => line.platform);
    if (platformLine) return platformLine.platform;
    return fallback;
  }

  const api = Object.freeze({
    SCOPE_SURFACES, SCOPE_ACTIONS, FLAT_SCOPE_FIELDS,
    scopeLegalActions, hasFlatScopeFields, hasScopeLines, withoutFlatScopeFields,
    scopeLinesFromFlat, flatFromScopes, sanitizeScopeLines, deriveGroupType, platformKind
  });
  global.CBGroupScopes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
