/* Custom Web Blocker — shared helper bundle.
 *
 * Loaded into both the content script and (via importScripts) the background
 * service worker. The helpers themselves are pure JavaScript and never touch
 * chrome.* APIs directly; the host (content script or background worker)
 * provides mutable state buckets which the helpers operate on in memory and
 * which the host is responsible for persisting.
 *
 * Public surface is exposed as `globalThis.__customBlockerHelpers`.
 */

;(function (global) {
  if (global.__customBlockerHelpers) {
    return;
  }

  const PLATFORM_LIST = ["youtube", "tiktok", "facebook", "instagram", "twitch"];
  const MAX_PERSISTENCE_KEYS_PER_GROUP = 200;
  const MAX_PERSISTENCE_VALUE_BYTES = 16 * 1024;

  // ────────────────────────────────────────────────────────────────────────
  // URL / hostname utilities. Inputs are expected to be already normalised
  // (a real URL string for `url`, and a lowercase hostname without `www.`
  // for `hostname`). The utilities try to be forgiving but never throw.
  // ────────────────────────────────────────────────────────────────────────

  function safeUrl(value) {
    if (typeof value !== "string" || !value) {
      return null;
    }
    try {
      return new URL(value);
    } catch {
      return null;
    }
  }

  function getHostname(url) {
    const parsed = safeUrl(url);
    if (!parsed) {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  }

  function getPathname(url) {
    const parsed = safeUrl(url);
    return parsed ? parsed.pathname || "/" : "/";
  }

  function hostnameMatchesSite(hostname, site) {
    if (typeof hostname !== "string" || typeof site !== "string" || !hostname || !site) {
      return false;
    }
    return hostname === site || hostname.endsWith("." + site);
  }

  function isYouTubeHost(host) {
    return Boolean(host && (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be"));
  }

  function isTikTokHost(host) {
    return Boolean(host && (host === "tiktok.com" || host.endsWith(".tiktok.com")));
  }

  function isInstagramHost(host) {
    return Boolean(host && (host === "instagram.com" || host.endsWith(".instagram.com")));
  }

  function isFacebookHost(host) {
    return Boolean(host && (host === "facebook.com" || host.endsWith(".facebook.com")));
  }

  function isTwitchHost(host) {
    return Boolean(host && (host === "twitch.tv" || host.endsWith(".twitch.tv") || host === "clips.twitch.tv"));
  }

  function isRedditHost(host) {
    return Boolean(host && (host === "reddit.com" || host.endsWith(".reddit.com")));
  }

  function isDiscordHost(host) {
    return Boolean(
      host &&
        (host === "discord.com" ||
          host.endsWith(".discord.com") ||
          host === "discordapp.com" ||
          host.endsWith(".discordapp.com"))
    );
  }

  function getPlatform(url) {
    const host = getHostname(url);
    if (isYouTubeHost(host)) return "youtube";
    if (isTikTokHost(host)) return "tiktok";
    if (isInstagramHost(host)) return "instagram";
    if (isFacebookHost(host)) return "facebook";
    if (isTwitchHost(host)) return "twitch";
    return null;
  }

  // Per-platform URL classifiers / extractors.
  const platformUrlOps = {
    youtube: {
      isPlatformUrl(url) {
        return isYouTubeHost(getHostname(url));
      },
      isShortUrl(url) {
        return isYouTubeHost(getHostname(url)) && getPathname(url).startsWith("/shorts/");
      },
      isVideoUrl(url) {
        const host = getHostname(url);
        if (!isYouTubeHost(host)) return false;
        const path = getPathname(url);
        return (
          host === "youtu.be" ||
          path.startsWith("/watch") ||
          path.startsWith("/live/") ||
          path.startsWith("/embed/")
        );
      },
      isPostUrl(url) {
        if (!isYouTubeHost(getHostname(url))) return false;
        const path = getPathname(url);
        return (
          path.startsWith("/post/") ||
          /^\/(channel|c|user)\/[^/]+\/(community|posts)/.test(path) ||
          /^\/@[^/]+\/(community|posts)/.test(path)
        );
      },
      isHomePage(url) {
        if (!isYouTubeHost(getHostname(url))) return false;
        const path = getPathname(url);
        return path === "/" || path.startsWith("/feed/");
      },
      extractAuthor(url) {
        if (!isYouTubeHost(getHostname(url))) return null;
        const path = getPathname(url).toLowerCase();
        const at = path.match(/^\/@([^/?#]+)/);
        if (at) return at[1];
        const channel = path.match(/^\/channel\/([^/?#]+)/);
        if (channel) return "channel:" + channel[1];
        const c = path.match(/^\/c\/([^/?#]+)/);
        if (c) return "c:" + c[1];
        const user = path.match(/^\/user\/([^/?#]+)/);
        if (user) return "user:" + user[1];
        return null;
      },
      extractVideoId(url) {
        const parsed = safeUrl(url);
        if (!parsed) return null;
        if (parsed.hostname === "youtu.be") {
          return parsed.pathname.slice(1) || null;
        }
        if (parsed.pathname.startsWith("/watch")) {
          return parsed.searchParams.get("v");
        }
        const m = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/);
        return m ? m[1] : null;
      }
    },
    tiktok: {
      isPlatformUrl(url) {
        return isTikTokHost(getHostname(url));
      },
      isShortUrl(url) {
        return isTikTokHost(getHostname(url)) && getPathname(url).includes("/video/");
      },
      isVideoUrl(url) {
        return isTikTokHost(getHostname(url)) && getPathname(url).includes("/video/");
      },
      isPostUrl() {
        return false;
      },
      isHomePage(url) {
        if (!isTikTokHost(getHostname(url))) return false;
        const path = getPathname(url);
        return (
          path === "/" ||
          path.startsWith("/foryou") ||
          path.startsWith("/following") ||
          path.startsWith("/explore")
        );
      },
      extractAuthor(url) {
        if (!isTikTokHost(getHostname(url))) return null;
        const m = getPathname(url).toLowerCase().match(/^\/@([^/?#]+)/);
        return m ? m[1] : null;
      },
      extractVideoId(url) {
        const parsed = safeUrl(url);
        if (!parsed) return null;
        const m = parsed.pathname.match(/\/video\/([^/?#]+)/);
        return m ? m[1] : null;
      }
    },
    instagram: {
      isPlatformUrl(url) {
        return isInstagramHost(getHostname(url));
      },
      isShortUrl(url) {
        return isInstagramHost(getHostname(url)) && getPathname(url).startsWith("/reel/");
      },
      isVideoUrl(url) {
        return isInstagramHost(getHostname(url)) && getPathname(url).startsWith("/tv/");
      },
      isPostUrl(url) {
        return isInstagramHost(getHostname(url)) && getPathname(url).startsWith("/p/");
      },
      isHomePage(url) {
        if (!isInstagramHost(getHostname(url))) return false;
        const path = getPathname(url);
        return (
          path === "/" ||
          path === "/explore" ||
          path.startsWith("/explore/") ||
          path.startsWith("/reels")
        );
      },
      extractAuthor(url) {
        if (!isInstagramHost(getHostname(url))) return null;
        const path = getPathname(url).toLowerCase().replace(/^\/+|\/+$/g, "");
        const first = path.split("/")[0] || "";
        const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about", "reels"]);
        return !reserved.has(first) && /^[a-z0-9._]+$/.test(first) ? first : null;
      },
      extractVideoId(url) {
        const parsed = safeUrl(url);
        if (!parsed) return null;
        const m = parsed.pathname.match(/\/(?:reel|p|tv)\/([^/?#]+)/);
        return m ? m[1] : null;
      }
    },
    facebook: {
      isPlatformUrl(url) {
        return isFacebookHost(getHostname(url));
      },
      isShortUrl(url) {
        if (!isFacebookHost(getHostname(url))) return false;
        const path = getPathname(url);
        return path.startsWith("/reel/") || path.startsWith("/watch/reel/");
      },
      isVideoUrl(url) {
        if (!isFacebookHost(getHostname(url))) return false;
        const path = getPathname(url);
        return path.startsWith("/watch") && !path.startsWith("/watch/reel/");
      },
      isPostUrl(url) {
        if (!isFacebookHost(getHostname(url))) return false;
        const path = getPathname(url);
        return path.includes("/posts/") || path.includes("/permalink/");
      },
      isHomePage(url) {
        if (!isFacebookHost(getHostname(url))) return false;
        const path = getPathname(url);
        return path === "/" || path === "/watch" || path.startsWith("/watch/");
      },
      extractAuthor(url) {
        if (!isFacebookHost(getHostname(url))) return null;
        const parsed = safeUrl(url);
        if (!parsed) return null;
        if (parsed.pathname.startsWith("/profile.php")) {
          const id = parsed.searchParams.get("id");
          return id ? "id:" + id : null;
        }
        const path = parsed.pathname.toLowerCase().replace(/^\/+|\/+$/g, "");
        const first = path.split("/")[0] || "";
        const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
        return !reserved.has(first) && /^[a-z0-9.]+$/.test(first) ? first : null;
      },
      extractVideoId(url) {
        const parsed = safeUrl(url);
        if (!parsed) return null;
        if (parsed.pathname.startsWith("/watch")) {
          return parsed.searchParams.get("v");
        }
        const m = parsed.pathname.match(/\/reel\/([^/?#]+)/);
        return m ? m[1] : null;
      }
    },
    twitch: {
      isPlatformUrl(url) {
        return isTwitchHost(getHostname(url));
      },
      isShortUrl(url) {
        const host = getHostname(url);
        if (!isTwitchHost(host)) return false;
        return host === "clips.twitch.tv" || getPathname(url).includes("/clip/");
      },
      isVideoUrl(url) {
        if (!isTwitchHost(getHostname(url))) return false;
        return getPathname(url).startsWith("/videos/");
      },
      isPostUrl() {
        return false;
      },
      isHomePage(url) {
        if (!isTwitchHost(getHostname(url))) return false;
        const path = getPathname(url);
        return path === "/" || path === "/directory" || path.startsWith("/directory/");
      },
      extractAuthor(url) {
        if (!isTwitchHost(getHostname(url))) return null;
        const path = getPathname(url).toLowerCase().replace(/^\/+|\/+$/g, "");
        const first = path.split("/")[0] || "";
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
        return !reserved.has(first) && /^[a-z0-9_]+$/.test(first) ? first : null;
      },
      extractVideoId(url) {
        const parsed = safeUrl(url);
        if (!parsed) return null;
        const v = parsed.pathname.match(/\/videos\/([^/?#]+)/);
        if (v) return v[1];
        const c = parsed.pathname.match(/\/clip\/([^/?#]+)/);
        return c ? c[1] : null;
      }
    }
  };

  function createDomainUtility() {
    const utility = {
      hostnameOf: getHostname,
      pathnameOf: getPathname,
      matches: hostnameMatchesSite,
      getPlatform,
      isYouTubeHost,
      isTikTokHost,
      isInstagramHost,
      isFacebookHost,
      isTwitchHost,
      isRedditHost,
      isDiscordHost
    };
    for (const platform of PLATFORM_LIST) {
      utility[platform] = function platformAccessor() {
        return platformUrlOps[platform];
      };
    }
    return utility;
  }

  // Timer helper.
  // Persisted state per id: { displayName, direction, isPaused, currentMs }.
  //   create()          — always resets currentMs.
  //   getOrCreateTimer  — idempotent; returns existing timers unchanged.
  // Creation accepts transient (non-persisted) predicates:
  //   scope(url)   — when true, auto-tick by heartbeat elapsedMs.
  //   domain(url)  — when true, show in overlay (defaults to scope).
  // Existing getOrCreateTimer() calls reuse remembered predicates.
  function createTimerHelper(ctx) {
    const { groupId, timersBucket } = ctx;
    const accumulatorRef = ctx?.accumulatorRef
      ? ctx.accumulatorRef
      : { get: () => ensureAccumulatorShape(ctx?.accumulator || {}) };
    // Accept either fixed values (legacy / tests) or thunks
    // (createEventGroupHelpers wires these to per-dispatch state so
    // every dispatch sees fresh elapsedMs / tickedSet / currentUrl).
    // Without per-dispatch refresh, elapsedMs stays at 0 forever and
    // timers never auto-tick.
    const readElapsedMs = typeof ctx.elapsedMsRef === "function"
      ? ctx.elapsedMsRef
      : () => Number(ctx.elapsedMs) || 0;
    const readCurrentUrl = typeof ctx.currentUrlRef === "function"
      ? ctx.currentUrlRef
      : () => (typeof ctx.currentUrl === "string" ? ctx.currentUrl : "");
    const readTickedSet = typeof ctx.tickedSetRef === "function"
      ? ctx.tickedSetRef
      : () => (ctx.tickedSet instanceof Set ? ctx.tickedSet : (ctx.tickedSet = new Set()));
    const readDisplayedSet = typeof ctx.displayedSetRef === "function"
      ? ctx.displayedSetRef
      : () => (ctx.displayedSet instanceof Set ? ctx.displayedSet : (ctx.displayedSet = new Set()));
    // Sandbox-lifetime predicate registry. timersBucket is JSON-
    // persisted (no functions allowed), so scope/domain predicates
    // live here keyed by timer id. Predicates last as long as the
    // sandbox iframe; on reset/reload the rule re-registers them.
    // Caller may pass an existing map via ctx.predicatesBucket so all
    // helper instances for the same group share it.
    const predicatesBucket = ctx.predicatesBucket && typeof ctx.predicatesBucket === "object"
      ? ctx.predicatesBucket
      : {};

    function getTimer(id) {
      if (typeof id !== "string" || !id) return null;
      const timer = timersBucket[id];
      return timer && typeof timer === "object" ? timer : null;
    }

    function tickInternal(id, deltaMs) {
      const timer = getTimer(id);
      if (!timer || timer.isPaused || !Number.isFinite(deltaMs)) return;
      const step = Math.max(0, Math.floor(deltaMs));
      if (timer.direction === "forward") {
        timer.currentMs = Math.max(0, Math.floor(timer.currentMs + step));
      } else {
        timer.currentMs = Math.max(0, Math.floor(timer.currentMs - step));
      }
    }

    function safePredicate(predicate) {
      if (typeof predicate !== "function") return false;
      try { return Boolean(predicate(readCurrentUrl())); } catch { return false; }
    }

    function markTimerRegistryChanged() {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      acc.timerRegistryChanged = true;
    }

    function rememberPredicates(id, scope, domain) {
      // Only update slots that the caller actually provided so a
      // subsequent getOrCreateTimer call without explicit predicates
      // doesn't accidentally drop the scope set at create time.
      const slot = predicatesBucket[id] || {};
      let changed = false;
      if (typeof scope === "function") {
        if (typeof slot.scope !== "function") changed = true;
        slot.scope = scope;
      } else if (scope === null) {
        if (typeof slot.scope === "function") changed = true;
        delete slot.scope;
      }
      if (typeof domain === "function") {
        if (typeof slot.domain !== "function") changed = true;
        slot.domain = domain;
      } else if (domain === null) {
        if (typeof slot.domain === "function") changed = true;
        delete slot.domain;
      }
      predicatesBucket[id] = slot;
      if (changed) markTimerRegistryChanged();
    }

    function applyScopeAndDomain(id, scope, domain) {
      // Persist predicates for the lifetime of the sandbox so the
      // sandbox-driven heartbeat auto-tick can find them on subsequent
      // dispatches even if the user doesn't re-pass them.
      rememberPredicates(id, scope, domain);
      // Auto-tick if scope matches and we haven't already ticked this id
      // in this dispatch. tickedSet is per-dispatch (provided by
      // event-sandbox.js) and shared across all handlers / timer
      // helpers in the group so multiple create / getOrCreateTimer
      // calls during the same dispatch don't double-tick.
      const slot = predicatesBucket[id] || {};
      const effectiveScope = typeof scope === "function" ? scope : slot.scope;
      const effectiveDomain = typeof domain === "function" ? domain : slot.domain;
      const tickedSet = readTickedSet();
      if (typeof effectiveScope === "function" && !tickedSet.has(id)) {
        const timer = getTimer(id);
        if (timer && !timer.isPaused && safePredicate(effectiveScope)) {
          tickInternal(id, readElapsedMs());
          tickedSet.add(id);
        }
      }
      // Decide overlay display. domain takes priority; when omitted we
      // default to scope so a "tick on shorts pages" timer also shows
      // there without needing two predicates.
      const displayPredicate = typeof effectiveDomain === "function" ? effectiveDomain : effectiveScope;
      if (typeof displayPredicate === "function" && safePredicate(displayPredicate)) {
        readDisplayedSet().add(id);
      }
    }

    // Sandbox-driven sweep called once per heartbeat dispatch. Walks
    // every timer the rule has created and applies scope-based auto-
    // tick + domain-based overlay display, using the predicates the
    // rule registered earlier. Without this, only timers re-touched
    // during the dispatch (i.e. via getOrCreateTimer) would auto-tick.
    function tickAllScopedTimers() {
      for (const id of Object.keys(timersBucket)) {
        const slot = predicatesBucket[id] || {};
        applyScopeAndDomain(id, slot.scope, slot.domain);
      }
    }

    // Returns a serializable snapshot of timers that should be drawn
    // in the on-page overlay for the current URL. The sandbox calls
    // this after a heartbeat dispatch so background can forward the
    // list to content.js, mirroring how default block group items
    // are surfaced.
    function getDisplayedTimerSnapshots() {
      const out = [];
      const displayed = readDisplayedSet();
      for (const id of Object.keys(timersBucket)) {
        if (!displayed.has(id)) continue;
        const timer = getTimer(id);
        if (!timer) continue;
        out.push({
          id,
          displayName: timer.displayName || id,
          direction: timer.direction,
          currentMs: timer.currentMs,
          isPaused: Boolean(timer.isPaused),
          isExpired: timer.currentMs === 0
        });
      }
      return out;
    }

    function buildFresh(init) {
      return {
        displayName: typeof init?.displayName === "string" ? init.displayName : "",
        direction: init?.direction === "forward" ? "forward" : "backward",
        isPaused: false,
        currentMs: Math.max(0, Math.floor(Number(init?.currentMs) || 0))
      };
    }

    return {
      groupId,
      create({ id, displayName, direction, currentMs, scope, domain } = {}) {
        if (typeof id !== "string" || !id) return null;
        timersBucket[id] = buildFresh({ displayName, direction, currentMs });
        markTimerRegistryChanged();
        applyScopeAndDomain(id, scope, domain);
        return id;
      },
      getOrCreateTimer({ id, displayName, direction, currentMs, scope, domain } = {}) {
        if (typeof id !== "string" || !id) return null;
        if (!getTimer(id)) {
          timersBucket[id] = buildFresh({ displayName, direction, currentMs });
          markTimerRegistryChanged();
          applyScopeAndDomain(id, scope, domain);
        } else {
          applyScopeAndDomain(id);
        }
        return id;
      },
      delete(id) {
        if (!getTimer(id)) return false;
        delete timersBucket[id];
        delete predicatesBucket[id];
        markTimerRegistryChanged();
        return true;
      },
      pause(id) {
        const timer = getTimer(id);
        if (!timer || timer.isPaused) return false;
        timer.isPaused = true;
        return true;
      },
      resume(id) {
        const timer = getTimer(id);
        if (!timer || !timer.isPaused) return false;
        timer.isPaused = false;
        return true;
      },
      setDirection(id, direction) {
        const timer = getTimer(id);
        if (!timer || (direction !== "forward" && direction !== "backward")) return false;
        if (timer.direction === direction) return true;
        timer.direction = direction;
        markTimerRegistryChanged();
        return true;
      },
      setCurrentMs(id, ms) {
        const timer = getTimer(id);
        const value = Number(ms);
        if (!timer || !Number.isFinite(value)) return false;
        const nextMs = Math.max(0, Math.floor(value));
        if (timer.currentMs === nextMs) return true;
        timer.currentMs = nextMs;
        markTimerRegistryChanged();
        return true;
      },
      addMs(id, deltaMs) {
        const timer = getTimer(id);
        const value = Number(deltaMs);
        if (!timer || !Number.isFinite(value)) return false;
        const nextMs = Math.max(0, Math.floor(timer.currentMs + value));
        if (timer.currentMs === nextMs) return true;
        timer.currentMs = nextMs;
        markTimerRegistryChanged();
        return true;
      },
      setDisplayName(id, displayName) {
        const timer = getTimer(id);
        if (!timer || typeof displayName !== "string") return false;
        if (timer.displayName === displayName) return true;
        timer.displayName = displayName;
        markTimerRegistryChanged();
        return true;
      },
      getCurrentMs(id) {
        return getTimer(id)?.currentMs ?? 0;
      },
      isExpired(id) {
        const timer = getTimer(id);
        return Boolean(timer && timer.currentMs === 0);
      },
      isPaused(id) {
        return Boolean(getTimer(id)?.isPaused);
      },
      getDirection(id) {
        return getTimer(id)?.direction ?? null;
      },
      getDisplayName(id) {
        return getTimer(id)?.displayName ?? null;
      },
      exists(id) {
        return Boolean(getTimer(id));
      },
      getState(id) {
        const timer = getTimer(id);
        if (!timer) return null;
        return {
          id,
          displayName: timer.displayName,
          direction: timer.direction,
          isPaused: timer.isPaused,
          currentMs: timer.currentMs,
          isExpired: timer.currentMs === 0
        };
      },
      list() {
        return Object.entries(timersBucket).map(([id, timer]) => ({
          id,
          displayName: timer.displayName,
          direction: timer.direction,
          isPaused: timer.isPaused,
          currentMs: timer.currentMs,
          isExpired: timer.currentMs === 0
        }));
      },
      // Sandbox-internal entry points. Prefixed __cb_ so a user rule
      // doing `helpers.getTimerHelper().reset(...)` won't ever clash.
      __cb_tickAllScopedTimers: tickAllScopedTimers,
      __cb_getDisplayedTimerSnapshots: getDisplayedTimerSnapshots
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Panel helper. Rules describe panels as safe JSON-like schemas; content.js
  // owns the fixed layout and turns snapshots into DOM.
  // ────────────────────────────────────────────────────────────────────────

  const PANEL_POSITIONS = new Set(["top-left", "top-right", "bottom-left", "bottom-right", "center"]);
  const PANEL_ALIGNS = new Set(["left", "center", "right"]);
  const PANEL_WIDTHS = new Set(["small", "medium", "large"]);
  const PANEL_LAYOUTS = new Set([
    "vertical",
    "compact",
    "comfortable",
    "spacious",
    "inline",
    "row",
    "wrap",
    "twoColumn",
    "grid",
    "split",
    "form",
    "toolbar",
    "stack"
  ]);
  const PANEL_ROLES = new Set(["region", "dialog", "alert", "status", "form", "group"]);
  const PANEL_CONTROL_TYPES = new Set([
    "text",
    "checkbox",
    "select",
    "textInput",
    "textarea",
    "button",
    "section",
    "timer",
    "numberInput",
    "range",
    "toggle",
    "radio",
    "date",
    "time",
    "color",
    "pin"
  ]);
  const PANEL_CONTROL_ACTIONS = new Set(["submit", "cancel", "close"]);

  function truncateText(value, maxLength) {
    const text = String(value ?? "");
    return text.length > maxLength ? text.slice(0, maxLength) : text;
  }

  function normalizePanelControlType(type) {
    if (type === "input") return "textInput";
    if (type === "dropdown") return "select";
    if (type === "group") return "section";
    if (type === "number") return "numberInput";
    if (type === "slider") return "range";
    if (type === "switch") return "toggle";
    return PANEL_CONTROL_TYPES.has(type) ? type : "text";
  }

  function sanitizePanelLayout(value) {
    return PANEL_LAYOUTS.has(value) ? value : "";
  }

  function sanitizePanelRole(value, fallback = "") {
    return PANEL_ROLES.has(value) ? value : fallback;
  }

  function sanitizePanelPriority(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(-1000, Math.min(1000, Math.round(n))) : 0;
  }

  function sanitizePanelId(value, fallback = "") {
    return truncateText(value || fallback, 80)
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function sanitizePanelColor(value) {
    const text = String(value ?? "").trim();
    if (!text || text.length > 64) return null;
    if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
    if (/^rgba?\([\d\s.,%+-]+\)$/i.test(text)) return text;
    if (/^hsla?\([\d\s.,%+-]+\)$/i.test(text)) return text;
    if (/^[a-z]{3,32}$/i.test(text)) return text;
    return null;
  }

  function sanitizePanelSize(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(10, Math.min(32, Math.round(value))) + "px";
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/i);
    if (!match) return "";
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return "";
    if (match[2].toLowerCase() === "px") return Math.max(10, Math.min(32, Math.round(n))) + "px";
    return Math.max(0.65, Math.min(2, n)).toFixed(2).replace(/\.?0+$/, "") + match[2].toLowerCase();
  }

  function sanitizePanelWidth(value) {
    if (PANEL_WIDTHS.has(value)) return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(180, Math.min(520, Math.round(value))) + "px";
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(\d+(?:\.\d+)?)px$/i);
    if (!match) return "";
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return "";
    return Math.max(180, Math.min(520, Math.round(n))) + "px";
  }

  function sanitizePanelControlWidth(value) {
    if (value === "full" || value === "auto") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(32, Math.min(520, Math.round(value))) + "px";
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (/^\d+(?:\.\d+)?%$/.test(text)) {
      const n = Number(text.slice(0, -1));
      return Math.max(10, Math.min(100, n)).toFixed(2).replace(/\.?0+$/, "") + "%";
    }
    const match = text.match(/^(\d+(?:\.\d+)?)px$/i);
    if (!match) return "";
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return "";
    return Math.max(32, Math.min(520, Math.round(n))) + "px";
  }

  function sanitizePanelControlHeight(value) {
    if (value === "auto") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(20, Math.min(360, Math.round(value))) + "px";
    }
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(\d+(?:\.\d+)?)px$/i);
    if (!match) return "";
    const n = Number(match[1]);
    if (!Number.isFinite(n)) return "";
    return Math.max(20, Math.min(360, Math.round(n))) + "px";
  }

  function sanitizePanelRows(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(1, Math.min(12, n)) : null;
  }

  function sanitizePanelNumber(value, min, max, fallback = 0) {
    const n = Number(value);
    const lower = Number.isFinite(Number(min)) ? Number(min) : -1_000_000;
    const upper = Number.isFinite(Number(max)) ? Number(max) : 1_000_000;
    const boundedLower = Math.min(lower, upper);
    const boundedUpper = Math.max(lower, upper);
    const base = Number.isFinite(n) ? n : fallback;
    return Math.max(boundedLower, Math.min(boundedUpper, base));
  }

  function sanitizePanelStep(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(1_000_000, n) : null;
  }

  function sanitizePanelDateValue(value) {
    const text = String(value ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function sanitizePanelTimeValue(value) {
    const text = String(value ?? "").trim();
    return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text) ? text : "";
  }

  function sanitizePanelInputColor(value) {
    const text = String(value ?? "").trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : "#000000";
  }

  function sanitizePanelTimerSnapshot(value) {
    if (!value || typeof value !== "object") return null;
    const id = sanitizePanelId(value.id);
    if (!id) return null;
    const currentMs = Math.max(0, Math.floor(Number(value.currentMs) || 0));
    return {
      id,
      displayName: truncateText(value.displayName ?? id, 240),
      direction: value.direction === "forward" ? "forward" : "backward",
      isPaused: value.isPaused === true,
      currentMs,
      isExpired: value.isExpired === true || currentMs === 0
    };
  }

  function sanitizePanelTheme(theme) {
    if (!theme || typeof theme !== "object") return {};
    const out = {};
    for (const key of ["background", "foreground", "accent", "border", "muted"]) {
      const color = sanitizePanelColor(theme[key]);
      if (color) out[key] = color;
    }
    const fontSize = sanitizePanelSize(theme.fontSize ?? theme.textSize);
    const titleSize = sanitizePanelSize(theme.titleSize);
    if (fontSize) out.fontSize = fontSize;
    if (titleSize) out.titleSize = titleSize;
    return out;
  }

  function sanitizePanelValue(type, value, control) {
    if (type === "checkbox" || type === "toggle") return value === true;
    if (type === "numberInput" || type === "range") {
      return sanitizePanelNumber(value, control?.min, control?.max, 0);
    }
    if (type === "select" || type === "radio") return truncateText(value, 256);
    if (type === "textInput" || type === "textarea") return truncateText(value, 2000);
    if (type === "date") return sanitizePanelDateValue(value);
    if (type === "time") return sanitizePanelTimeValue(value);
    if (type === "color") return sanitizePanelInputColor(value);
    if (type === "pin") {
      const len = control?.length ? Math.max(3, Math.min(12, Math.floor(Number(control.length)) || 6)) : 6;
      return String(value ?? "").replace(/\D/g, "").slice(0, len);
    }
    if (type === "section" || type === "timer") return "";
    return truncateText(value, 512);
  }

  function sanitizePanelOptions(rawOptions, selectedValue) {
    if (!Array.isArray(rawOptions)) return [];
    const out = [];
    for (const item of rawOptions.slice(0, HELPERS_MAX_PANEL_OPTIONS)) {
      if (item && typeof item === "object") {
        const value = truncateText(item.value ?? item.label, 256);
        if (!value) continue;
        out.push({
          value,
          label: truncateText(item.label ?? value, 256)
        });
      } else {
        const value = truncateText(item, 256);
        if (value) out.push({ value, label: value });
      }
    }
    if (out.length > 0 && !out.some((item) => item.value === selectedValue)) {
      return [{ value: selectedValue, label: selectedValue }, ...out].slice(0, HELPERS_MAX_PANEL_OPTIONS);
    }
    return out;
  }

  function sanitizePanelControl(control, index, depth = 0) {
    if (!control || typeof control !== "object") return null;
    const type = normalizePanelControlType(control.type);
    const id = sanitizePanelId(control.id, "control-" + (index + 1));
    if (!id) return null;
    const value = sanitizePanelValue(type, control.value, control);
    const out = {
      id,
      type,
      label: truncateText(control.label ?? "", 240),
      value,
      disabled: control.disabled === true,
      priority: sanitizePanelPriority(control.priority)
    };
    const layout = sanitizePanelLayout(control.layout);
    const align = PANEL_ALIGNS.has(control.align) ? control.align : "";
    const ariaLabel = truncateText(control.ariaLabel ?? control.a11yLabel ?? "", 240);
    if (layout) out.layout = layout;
    if (align) out.align = align;
    if (ariaLabel) out.ariaLabel = ariaLabel;
    if (control.autoFocus === true) out.autoFocus = true;
    const width = sanitizePanelControlWidth(control.width);
    const height = sanitizePanelControlHeight(control.height);
    const rows = sanitizePanelRows(control.rows);
    if (width) out.width = width;
    if (height) out.height = height;
    if (rows !== null) out.rows = rows;
    if (type === "numberInput" || type === "range") {
      const min = Number(control.min);
      const max = Number(control.max);
      const step = sanitizePanelStep(control.step);
      if (Number.isFinite(min)) out.min = Math.max(-1_000_000, Math.min(1_000_000, min));
      if (Number.isFinite(max)) out.max = Math.max(-1_000_000, Math.min(1_000_000, max));
      if (step !== null) out.step = step;
      out.value = sanitizePanelValue(type, value, out);
    }
    if (type === "text") {
      out.text = truncateText(control.text ?? control.label ?? "", 1000);
    }
    if (type === "section") {
      out.text = truncateText(control.text ?? control.description ?? "", 1000);
      out.role = sanitizePanelRole(control.role, "group");
      out.controls = [];
      const rawChildren = Array.isArray(control.controls) ? control.controls : [];
      if (depth < 3) {
        for (let i = 0; i < rawChildren.length && out.controls.length < HELPERS_MAX_PANEL_CONTROLS; i++) {
          const child = sanitizePanelControl(rawChildren[i], i, depth + 1);
          if (child) out.controls.push(child);
        }
      }
    }
    if (type === "textInput" || type === "textarea") {
      out.placeholder = truncateText(control.placeholder ?? "", 500);
    }
    if (type === "pin") {
      out.length = Math.max(3, Math.min(12, Math.floor(Number(control.length)) || 6));
      out.masked = control.masked !== false;
      out.value = sanitizePanelValue(type, value, out);
      if (control.autoSubmit === true) out.autoSubmit = true;
    }
    if (type === "select" || type === "radio") {
      out.options = sanitizePanelOptions(control.options, value);
    }
    if (type === "timer") {
      const timerId = sanitizePanelId(control.timerId ?? control.timer?.id);
      if (timerId) out.timerId = timerId;
      const timer = sanitizePanelTimerSnapshot(control.timer);
      if (timer) out.timer = timer;
      out.format = ["ms", "ss", "mm:ss", "hh:mm:ss"].includes(control.format) ? control.format : "mm:ss";
      out.showExpired = control.showExpired !== false;
      out.value = "";
    }
    if (type === "button" && !out.label) {
      out.label = truncateText(control.text ?? "Button", 120);
    }
    if (type === "button" && PANEL_CONTROL_ACTIONS.has(control.action)) {
      out.action = control.action;
    }
    return out;
  }

  function sanitizePanelConfig(config) {
    if (!config || typeof config !== "object") return null;
    const id = sanitizePanelId(config.id);
    if (!id) return null;
    const controls = [];
    const rawControls = Array.isArray(config.controls) ? config.controls : [];
    for (let i = 0; i < rawControls.length && controls.length < HELPERS_MAX_PANEL_CONTROLS; i++) {
      const control = sanitizePanelControl(rawControls[i], i);
      if (control) controls.push(control);
    }
    const position = PANEL_POSITIONS.has(config.position) ? config.position : "bottom-right";
    const align = PANEL_ALIGNS.has(config.align) ? config.align : "left";
    const width = sanitizePanelWidth(config.width);
    const textSize = sanitizePanelSize(config.textSize ?? config.fontSize);
    const layout = sanitizePanelLayout(config.layout) || "vertical";
    const ariaLabel = truncateText(config.ariaLabel ?? config.a11yLabel ?? "", 240);
    return {
      id,
      title: truncateText(config.title ?? "", 240),
      description: truncateText(config.description ?? config.body ?? "", 1000),
      position,
      align,
      layout,
      priority: sanitizePanelPriority(config.priority),
      width,
      textSize,
      ariaLabel,
      role: sanitizePanelRole(config.role, "region"),
      autoFocus: config.autoFocus === true,
      theme: sanitizePanelTheme(config.theme || config.colors || {}),
      controls,
      visible: config.visible !== false
    };
  }

  function clonePanelForSnapshot(panel) {
    return safeCloneJson(panel) || null;
  }

  function panelStateEquals(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  function createPanelHelper(ctx) {
    const { groupId, panelsBucket } = ctx;
    const timersBucket = ctx?.timersBucket && typeof ctx.timersBucket === "object" ? ctx.timersBucket : {};
    const accumulatorRef = ctx?.accumulatorRef
      ? ctx.accumulatorRef
      : { get: () => ensureAccumulatorShape(ctx?.accumulator || {}) };
    const readCurrentUrl = typeof ctx.currentUrlRef === "function"
      ? ctx.currentUrlRef
      : () => (typeof ctx.currentUrl === "string" ? ctx.currentUrl : "");
    const readDisplayedSet = typeof ctx.panelDisplayedSetRef === "function"
      ? ctx.panelDisplayedSetRef
      : () => (ctx.panelDisplayedSet instanceof Set ? ctx.panelDisplayedSet : (ctx.panelDisplayedSet = new Set()));
    const predicatesBucket = ctx.predicatesBucket && typeof ctx.predicatesBucket === "object"
      ? ctx.predicatesBucket
      : {};

    function getPanel(id) {
      if (typeof id !== "string" || !id) return null;
      const panel = panelsBucket[id];
      return panel && typeof panel === "object" ? panel : null;
    }

    function getTimerSnapshot(id) {
      const timer = timersBucket[id];
      if (!timer || typeof timer !== "object") return null;
      const currentMs = Math.max(0, Math.floor(Number(timer.currentMs) || 0));
      return {
        id,
        displayName: truncateText(timer.displayName || id, 240),
        direction: timer.direction === "forward" ? "forward" : "backward",
        isPaused: timer.isPaused === true,
        currentMs,
        isExpired: currentMs === 0
      };
    }

    function hydrateTimerControls(panel) {
      if (!panel || typeof panel !== "object") return panel;
      const visit = (controls) => {
        for (const control of controls || []) {
          if (control.type === "section") {
            visit(control.controls);
          } else if (control.type === "timer" && control.timerId) {
            const timer = getTimerSnapshot(control.timerId);
            if (timer) control.timer = timer;
          }
        }
      };
      visit(panel.controls);
      return panel;
    }

    function markPanelRegistryChanged() {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      acc.panelRegistryChanged = true;
      acc.panelGroupsChanged = Array.isArray(acc.panelGroupsChanged) ? acc.panelGroupsChanged : [];
      if (typeof groupId === "string" && groupId && !acc.panelGroupsChanged.includes(groupId)) {
        acc.panelGroupsChanged.push(groupId);
      }
    }

    function safePredicate(predicate) {
      if (typeof predicate !== "function") return false;
      try { return Boolean(predicate(readCurrentUrl())); } catch { return false; }
    }

    function rememberPredicates(id, scope, domain) {
      const slot = predicatesBucket[id] || {};
      let changed = false;
      if (typeof scope === "function") {
        if (typeof slot.scope !== "function") changed = true;
        slot.scope = scope;
      } else if (scope === null) {
        if (typeof slot.scope === "function") changed = true;
        delete slot.scope;
      }
      if (typeof domain === "function") {
        if (typeof slot.domain !== "function") changed = true;
        slot.domain = domain;
      } else if (domain === null) {
        if (typeof slot.domain === "function") changed = true;
        delete slot.domain;
      }
      predicatesBucket[id] = slot;
      if (changed) markPanelRegistryChanged();
    }

    function applyScopeAndDomain(id, scope, domain) {
      rememberPredicates(id, scope, domain);
      const panel = getPanel(id);
      const displayed = readDisplayedSet();
      displayed.delete(id);
      if (!panel || panel.visible === false) return;
      const slot = predicatesBucket[id] || {};
      const effectiveScope = typeof scope === "function" ? scope : slot.scope;
      const effectiveDomain = typeof domain === "function" ? domain : slot.domain;
      const displayPredicate = typeof effectiveDomain === "function" ? effectiveDomain : effectiveScope;
      if (typeof displayPredicate !== "function" || safePredicate(displayPredicate)) {
        displayed.add(id);
      }
    }

    function eachRawControl(controls, visit, depth = 0) {
      if (!Array.isArray(controls) || depth > 3) return;
      for (let i = 0; i < controls.length; i++) {
        const rawControl = controls[i];
        if (!rawControl || typeof rawControl !== "object") continue;
        visit(rawControl, i);
        eachRawControl(rawControl.controls, visit, depth + 1);
      }
    }

    function findControl(panel, controlId) {
      if (!panel || typeof controlId !== "string" || !controlId) return null;
      const walk = (controls) => {
        for (const control of controls || []) {
          if (control.id === controlId) return control;
          const child = walk(control.controls);
          if (child) return child;
        }
        return null;
      };
      return walk(panel.controls);
    }

    function hasInlineHandlers(rawConfig) {
      if (!rawConfig || typeof rawConfig !== "object") return false;
      if (
        typeof rawConfig.onEvent === "function" ||
        typeof rawConfig.onChange === "function" ||
        typeof rawConfig.onClick === "function" ||
        typeof rawConfig.onInput === "function" ||
        typeof rawConfig.onFocus === "function" ||
        typeof rawConfig.onBlur === "function" ||
        typeof rawConfig.onSubmit === "function" ||
        typeof rawConfig.onClose === "function" ||
        typeof rawConfig.onMount === "function" ||
        typeof rawConfig.onUnmount === "function" ||
        typeof rawConfig.onKey === "function" ||
        typeof rawConfig.onKeyDown === "function"
      ) {
        return true;
      }
      let found = false;
      eachRawControl(rawConfig.controls, (control) => {
        if (
          typeof control.onEvent === "function" ||
          typeof control.onChange === "function" ||
          typeof control.onClick === "function" ||
          typeof control.onInput === "function" ||
          typeof control.onFocus === "function" ||
          typeof control.onBlur === "function" ||
          typeof control.onSubmit === "function" ||
          typeof control.onClose === "function" ||
          typeof control.onMount === "function" ||
          typeof control.onUnmount === "function" ||
          typeof control.onKey === "function" ||
          typeof control.onKeyDown === "function"
        ) {
          found = true;
        }
      });
      return found;
    }

    function registerInlineHandlers(id, rawConfig) {
      if (typeof ctx.unregisterPanelHandlers === "function") {
        ctx.unregisterPanelHandlers(id);
      }
      if (typeof ctx.registerPanelHandler !== "function" || !rawConfig || typeof rawConfig !== "object") {
        return;
      }
      const register = (controlId, eventName, handler, options) => {
        if (typeof handler !== "function") return;
        ctx.registerPanelHandler(id, controlId, eventName, handler, options || {});
      };
      const registerAll = (controlId, raw, options) => {
        register(controlId, "*", raw.onEvent, options);
        register(controlId, "change", raw.onChange, options);
        register(controlId, "click", raw.onClick, options);
        register(controlId, "input", raw.onInput, options);
        register(controlId, "focus", raw.onFocus, options);
        register(controlId, "blur", raw.onBlur, options);
        register(controlId, "submit", raw.onSubmit, options);
        register(controlId, "close", raw.onClose, options);
        register(controlId, "mount", raw.onMount, options);
        register(controlId, "unmount", raw.onUnmount, options);
        register(controlId, "key", raw.onKey || raw.onKeyDown, options);
      };
      registerAll(null, rawConfig, rawConfig.options);
      eachRawControl(rawConfig.controls, (rawControl, i) => {
        const sanitized = sanitizePanelControl(rawControl, i);
        if (!sanitized) return;
        registerAll(sanitized.id, rawControl, rawControl.options);
      });
    }

    function create(config) {
      if (Object.keys(panelsBucket).length >= HELPERS_MAX_PANELS_PER_GROUP && !getPanel(config?.id)) {
        return null;
      }
      const panel = sanitizePanelConfig(config);
      if (!panel) return null;
      const previous = getPanel(panel.id);
      panelsBucket[panel.id] = panel;
      rememberPredicates(panel.id, config.scope, config.domain);
      registerInlineHandlers(panel.id, config);
      if (!panelStateEquals(previous, panel)) {
        markPanelRegistryChanged();
      }
      applyScopeAndDomain(panel.id, config.scope, config.domain);
      return panel.id;
    }

    function getValues(panel) {
      const out = {};
      const visit = (controls) => {
        for (const control of controls || []) {
          if (control.type === "section") {
            visit(control.controls);
            continue;
          }
          if (control.type === "button" || control.type === "text" || control.type === "timer") continue;
          out[control.id] = control.value;
        }
      };
      visit(panel?.controls);
      return out;
    }

    return {
      groupId,
      create,
      getOrCreatePanel(config = {}) {
        if (typeof config.id !== "string" || !config.id) return null;
        const id = sanitizePanelId(config.id);
        if (!id) return null;
        if (!getPanel(id)) return create({ ...config, id });
        applyScopeAndDomain(id);
        return id;
      },
      update(id, patch = {}) {
        const panel = getPanel(id);
        if (!panel || !patch || typeof patch !== "object") return false;
        const next = sanitizePanelConfig({ ...panel, ...patch, id: panel.id });
        if (!next) return false;
        const changed = !panelStateEquals(panel, next);
        if (changed) {
          panelsBucket[panel.id] = next;
        }
        if (Object.prototype.hasOwnProperty.call(patch, "scope") || Object.prototype.hasOwnProperty.call(patch, "domain")) {
          rememberPredicates(panel.id, patch.scope, patch.domain);
        }
        if (Object.prototype.hasOwnProperty.call(patch, "controls") || hasInlineHandlers(patch)) {
          registerInlineHandlers(panel.id, patch);
        }
        if (changed) {
          markPanelRegistryChanged();
        }
        applyScopeAndDomain(panel.id);
        return true;
      },
      delete(id) {
        if (!getPanel(id)) return false;
        delete panelsBucket[id];
        delete predicatesBucket[id];
        if (typeof ctx.unregisterPanelHandlers === "function") ctx.unregisterPanelHandlers(id);
        markPanelRegistryChanged();
        return true;
      },
      show(id) {
        const panel = getPanel(id);
        if (!panel || panel.visible === true) return Boolean(panel);
        panel.visible = true;
        markPanelRegistryChanged();
        applyScopeAndDomain(id);
        return true;
      },
      hide(id) {
        const panel = getPanel(id);
        if (!panel || panel.visible === false) return Boolean(panel);
        panel.visible = false;
        markPanelRegistryChanged();
        return true;
      },
      setValue(panelId, controlId, value) {
        const panel = getPanel(panelId);
        if (!panel || typeof controlId !== "string") return false;
        const control = findControl(panel, controlId);
        if (!control || control.type === "button" || control.type === "text" || control.type === "timer") return false;
        const nextValue = sanitizePanelValue(control.type, value, control);
        if (JSON.stringify(control.value) === JSON.stringify(nextValue)) return true;
        control.value = nextValue;
        markPanelRegistryChanged();
        return true;
      },
      updateControl(panelId, controlId, patch = {}) {
        const panel = getPanel(panelId);
        const control = findControl(panel, controlId);
        if (!control || !patch || typeof patch !== "object") return false;
        const next = sanitizePanelControl({ ...control, ...patch, id: control.id }, 0);
        if (!next) return false;
        if (panelStateEquals(control, next)) return true;
        for (const key of Object.keys(control)) delete control[key];
        Object.assign(control, next);
        markPanelRegistryChanged();
        return true;
      },
      disable(panelId, controlId) {
        return this.updateControl(panelId, controlId, { disabled: true });
      },
      enable(panelId, controlId) {
        return this.updateControl(panelId, controlId, { disabled: false });
      },
      setOptions(panelId, controlId, options) {
        const panel = getPanel(panelId);
        const control = findControl(panel, controlId);
        if (!control || (control.type !== "select" && control.type !== "radio")) return false;
        return this.updateControl(panelId, controlId, { options });
      },
      setText(panelId, controlId, text) {
        const panel = getPanel(panelId);
        const control = findControl(panel, controlId);
        if (!control) return false;
        if (control.type === "button") return this.updateControl(panelId, controlId, { label: text });
        if (control.type === "text" || control.type === "section") return this.updateControl(panelId, controlId, { text });
        return this.updateControl(panelId, controlId, { label: text });
      },
      setTheme(panelId, theme) {
        const panel = getPanel(panelId);
        if (!panel) return false;
        const nextTheme = sanitizePanelTheme(theme);
        if (panelStateEquals(panel.theme, nextTheme)) return true;
        panel.theme = nextTheme;
        markPanelRegistryChanged();
        return true;
      },
      setTitle(panelId, title) {
        const panel = getPanel(panelId);
        if (!panel) return false;
        const next = truncateText(title ?? "", 240);
        if (panel.title === next) return true;
        panel.title = next;
        markPanelRegistryChanged();
        return true;
      },
      setDescription(panelId, description) {
        const panel = getPanel(panelId);
        if (!panel) return false;
        const next = truncateText(description ?? "", 1000);
        if (panel.description === next) return true;
        panel.description = next;
        markPanelRegistryChanged();
        return true;
      },
      getValue(panelId, controlId) {
        const panel = getPanel(panelId);
        const control = findControl(panel, controlId);
        return control ? safeCloneJson(control.value) : undefined;
      },
      getValues(panelId) {
        return safeCloneJson(getValues(getPanel(panelId))) || {};
      },
      getState(id) {
        const panel = getPanel(id);
        return panel ? hydrateTimerControls(clonePanelForSnapshot(panel)) : null;
      },
      list() {
        return Object.keys(panelsBucket).map((id) => hydrateTimerControls(clonePanelForSnapshot(panelsBucket[id]))).filter(Boolean);
      },
      notice(config = {}) {
        return create({
          position: "bottom-right",
          layout: "compact",
          role: "status",
          ...config,
          controls: [
            ...(config.message || config.text ? [{ id: "message", type: "text", text: config.message ?? config.text }] : []),
            ...(Array.isArray(config.controls) ? config.controls : [])
          ]
        });
      },
      confirm(config = {}) {
        const confirmText = truncateText(config.confirmText ?? "Confirm", 120);
        const cancelText = truncateText(config.cancelText ?? "Cancel", 120);
        return create({
          position: "center",
          layout: "compact",
          role: "dialog",
          ...config,
          controls: [
            ...(config.message || config.text ? [{ id: "message", type: "text", text: config.message ?? config.text }] : []),
            ...(Array.isArray(config.controls) ? config.controls : []),
            {
              id: config.confirmId || "confirm",
              type: "button",
              label: confirmText,
              action: "submit",
              priority: 1
            },
            {
              id: config.cancelId || "cancel",
              type: "button",
              label: cancelText,
              action: "cancel"
            }
          ]
        });
      },
      checklist(config = {}) {
        const items = Array.isArray(config.items) ? config.items : [];
        return create({
          layout: "compact",
          ...config,
          controls: items.map((item, index) => {
            if (item && typeof item === "object") {
              return { type: "checkbox", id: item.id || ("item-" + (index + 1)), label: item.label ?? item.text ?? item.id, value: item.value === true };
            }
            return { type: "checkbox", id: "item-" + (index + 1), label: item, value: false };
          }).concat(Array.isArray(config.controls) ? config.controls : [])
        });
      },
      form(config = {}) {
        const fields = Array.isArray(config.fields) ? config.fields : [];
        return create({
          layout: config.layout || "form",
          role: "form",
          ...config,
          controls: fields.concat(Array.isArray(config.controls) ? config.controls : [])
        });
      },
      __cb_applyPanelEvent(data) {
        if (!data || typeof data !== "object") return false;
        const panelId = typeof data.panelId === "string" ? data.panelId : "";
        const panel = getPanel(panelId);
        if (!panel) return false;
        let changed = false;
        if (data.eventName === "close" && panel.visible !== false) {
          panel.visible = false;
          changed = true;
        }
        const values = data.values && typeof data.values === "object" ? data.values : null;
        if (values) {
          const applyValues = (controls) => {
            for (const control of controls || []) {
              if (control.type === "section") {
                applyValues(control.controls);
                continue;
              }
              if (control.type === "button" || control.type === "text" || control.type === "timer") continue;
              if (!Object.prototype.hasOwnProperty.call(values, control.id)) continue;
              const nextValue = sanitizePanelValue(control.type, values[control.id], control);
              if (JSON.stringify(control.value) !== JSON.stringify(nextValue)) {
                control.value = nextValue;
                changed = true;
              }
            }
          };
          applyValues(panel.controls);
        } else if (typeof data.controlId === "string") {
          const control = findControl(panel, data.controlId);
          if (control && control.type !== "button" && control.type !== "text" && control.type !== "timer") {
            const nextValue = sanitizePanelValue(control.type, data.value, control);
            if (JSON.stringify(control.value) !== JSON.stringify(nextValue)) {
              control.value = nextValue;
              changed = true;
            }
          }
        }
        if (changed) markPanelRegistryChanged();
        return changed;
      },
      __cb_refreshDisplayedPanels() {
        for (const id of Object.keys(panelsBucket)) {
          applyScopeAndDomain(id);
        }
      },
      __cb_getDisplayedPanelSnapshots() {
        const out = [];
        const displayed = readDisplayedSet();
        for (const id of Object.keys(panelsBucket)) {
          if (!displayed.has(id)) continue;
          const panel = getPanel(id);
          const snap = panel ? clonePanelForSnapshot(panel) : null;
          if (snap) {
            hydrateTimerControls(snap);
            snap.values = getValues(panel);
            out.push(snap);
          }
        }
        out.sort((a, b) => {
          const pa = Number(a.priority) || 0;
          const pb = Number(b.priority) || 0;
          if (pb !== pa) return pb - pa;
          return String(a.id || "").localeCompare(String(b.id || ""));
        });
        return out;
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Persistence helper. Per-group key/value store. JSON-serialisable values
  // only, with a soft cap on count and per-value size.
  // ────────────────────────────────────────────────────────────────────────

  function safeCloneJson(value) {
    if (value === undefined) return undefined;
    try {
      const serialised = JSON.stringify(value);
      if (typeof serialised !== "string" || serialised.length > MAX_PERSISTENCE_VALUE_BYTES) {
        return undefined;
      }
      return JSON.parse(serialised);
    } catch {
      return undefined;
    }
  }

  function createPersistenceHelper(persistenceBucket) {
    return {
      get(key, defaultValue) {
        if (typeof key !== "string" || !key) return defaultValue;
        return Object.prototype.hasOwnProperty.call(persistenceBucket, key)
          ? safeCloneJson(persistenceBucket[key])
          : defaultValue;
      },
      set(key, value) {
        if (typeof key !== "string" || !key) return false;
        const cloned = safeCloneJson(value);
        if (cloned === undefined) return false;
        if (
          !Object.prototype.hasOwnProperty.call(persistenceBucket, key) &&
          Object.keys(persistenceBucket).length >= MAX_PERSISTENCE_KEYS_PER_GROUP
        ) {
          return false;
        }
        persistenceBucket[key] = cloned;
        return true;
      },
      delete(key) {
        if (typeof key !== "string" || !key) return false;
        if (!Object.prototype.hasOwnProperty.call(persistenceBucket, key)) return false;
        delete persistenceBucket[key];
        return true;
      },
      has(key) {
        return typeof key === "string" && Object.prototype.hasOwnProperty.call(persistenceBucket, key);
      },
      keys() {
        return Object.keys(persistenceBucket);
      },
      entries() {
        return Object.entries(persistenceBucket).map(([key, value]) => [key, safeCloneJson(value)]);
      },
      clear() {
        for (const key of Object.keys(persistenceBucket)) {
          delete persistenceBucket[key];
        }
        return true;
      },
      size() {
        return Object.keys(persistenceBucket).length;
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Log helper. Writes to whichever console is available (page or worker).
  // ────────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────────
  // EVENT-DRIVEN CUSTOM RULES.
  //
  // The custom-rule engine runs in a long-lived offscreen sandbox. Source
  // code is executed exactly once per Run click and registers event
  // handlers via an Events registry. The helpers below are built per group
  // and per event dispatch and route side effects through an accumulator
  // that the host reads after dispatch and forwards to content scripts.
  // ────────────────────────────────────────────────────────────────────────

  // Hosts treated as the "default new-tab / search start" surface and
  // exposed to rules as the empty URL "". Includes Chromium new-tab
  // pages (which Chrome renders with the Google search bar) and
  // about:blank.
  function isEmptyStartPage(url) {
    if (typeof url !== "string" || !url) return true;
    const lowered = url.toLowerCase();
    if (lowered === "about:blank" || lowered.startsWith("about:blank")) return true;
    if (lowered === "about:newtab") return true;
    if (lowered.startsWith("chrome://newtab")) return true;
    if (lowered.startsWith("chrome://new-tab-page")) return true;
    if (lowered.startsWith("chrome-search://")) return true;
    if (lowered.startsWith("chrome-native://newtab")) return true;
    if (lowered.startsWith("edge://newtab")) return true;
    if (lowered.startsWith("edge://new-tab-page")) return true;
    if (lowered.startsWith("brave://newtab")) return true;
    if (lowered.startsWith("brave://new-tab-page")) return true;
    if (lowered.startsWith("opera://startpage")) return true;
    if (lowered.startsWith("vivaldi://startpage")) return true;
    return false;
  }

  function normalizeUrlForEvents(url) {
    if (isEmptyStartPage(url)) return "";
    return typeof url === "string" ? url : "";
  }

  // Domain helper additions per the event-driven plan (plus the original
  // urlOps for back-compat with the existing rule placeholder).
  function createEventDomainHelper() {
    const base = createDomainUtility();

    function toRegexList(input) {
      if (!input) return [];
      const list = Array.isArray(input) ? input : [input];
      return list
        .map((entry) => {
          if (entry instanceof RegExp) return entry;
          if (typeof entry === "string" && entry) {
            try { return new RegExp(entry); } catch { return null; }
          }
          return null;
        })
        .filter(Boolean);
    }

    return {
      ...base,
      isEmptyStartPage,
      matchesAny(url, patterns) {
        const u = typeof url === "string" ? url : "";
        for (const pattern of toRegexList(patterns)) {
          if (pattern.test(u)) return true;
        }
        return false;
      },
      pathStartsWith(url, path) {
        const p = base.pathnameOf(url);
        if (typeof path !== "string" || !path) return false;
        const target = path.startsWith("/") ? path : "/" + path;
        return p === target || p.startsWith(target.endsWith("/") ? target : target + "/");
      },
      queryHas(url, key, value) {
        const parsed = safeUrl(url);
        if (!parsed || typeof key !== "string" || !key) return false;
        if (!parsed.searchParams.has(key)) return false;
        if (value === undefined) return true;
        return parsed.searchParams.get(key) === String(value);
      },
      queryGet(url, key) {
        const parsed = safeUrl(url);
        if (!parsed || typeof key !== "string" || !key) return null;
        return parsed.searchParams.get(key);
      },
      isSearchPage(url) {
        const parsed = safeUrl(url);
        if (!parsed) return false;
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const path = parsed.pathname || "/";
        if (host === "google.com" && path === "/search" && parsed.searchParams.has("q")) return true;
        if (host === "bing.com" && path === "/search" && parsed.searchParams.has("q")) return true;
        if (host === "duckduckgo.com" && parsed.searchParams.has("q")) return true;
        if (host === "youtube.com" && path === "/results" && parsed.searchParams.has("search_query")) return true;
        if (host === "reddit.com" && path.startsWith("/search")) return true;
        if (host === "twitter.com" && path === "/search") return true;
        if (host === "x.com" && path === "/search") return true;
        return false;
      },
      isInfiniteFeedUrl(url) {
        const parsed = safeUrl(url);
        if (!parsed) return false;
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const path = parsed.pathname || "/";
        if (isYouTubeHost(host) && (path === "/" || path.startsWith("/feed/") || path.startsWith("/shorts"))) return true;
        if (isTikTokHost(host)) return true;
        if (isInstagramHost(host) && (path === "/" || path.startsWith("/reels") || path === "/explore" || path.startsWith("/explore/"))) return true;
        if (isFacebookHost(host) && (path === "/" || path.startsWith("/watch") || path.startsWith("/reel"))) return true;
        if (isRedditHost(host) && (path === "/" || path.startsWith("/r/") || path.startsWith("/best") || path.startsWith("/popular"))) return true;
        if (host === "x.com" || host === "twitter.com") return true;
        return false;
      },
      sameSection(a, b) {
        const ha = base.hostnameOf(a);
        const hb = base.hostnameOf(b);
        if (!ha || !hb || ha !== hb) return false;
        const pa = (base.pathnameOf(a) || "/").split("/").filter(Boolean)[0] || "";
        const pb = (base.pathnameOf(b) || "/").split("/").filter(Boolean)[0] || "";
        return pa === pb;
      }
    };
  }

  // Helpers receive an `accumulatorRef` — a thunk that returns the
  // *current* dispatch accumulator each time a method is called. This is
  // what makes the registration-time captured `helpers` object work
  // across many later dispatches: the user can stash `const log =
  // helpers.getLogHelper()` outside any handler and the log calls inside
  // every handler will still write into the right dispatch's logs,
  // because the lookup is dynamic, not bound at construction.
  function ensureAccumulatorShape(accumulator) {
    accumulator.intents = accumulator.intents || [];
    accumulator.logs = accumulator.logs || [];
    accumulator.domOps = accumulator.domOps || [];
    if (accumulator.timerRegistryChanged === undefined) accumulator.timerRegistryChanged = false;
    if (accumulator.panelRegistryChanged === undefined) accumulator.panelRegistryChanged = false;
    accumulator.panelGroupsChanged = Array.isArray(accumulator.panelGroupsChanged) ? accumulator.panelGroupsChanged : [];
    if (accumulator.redirectUrl === undefined) accumulator.redirectUrl = null;
    if (accumulator.logsDropped === undefined) accumulator.logsDropped = 0;
    return accumulator;
  }

  // Hard caps mirrored from event-sandbox.js. They protect helpers shared
  // by the offscreen sandbox, the content script, and the background SW
  // against a runaway handler that pushes millions of log/intent entries
  // (the kind of code that locks Chrome and survives popup re-opens).
  const HELPERS_MAX_LOGS_PER_DISPATCH = 200;
  const HELPERS_MAX_DOM_OPS_PER_DISPATCH = 256;
  const HELPERS_MAX_INTENTS_PER_DISPATCH = 256;
  const HELPERS_MAX_PANELS_PER_GROUP = 24;
  const HELPERS_MAX_PANEL_CONTROLS = 32;
  const HELPERS_MAX_PANEL_OPTIONS = 64;
  const HELPERS_HANDLER_DEADLINE_GRACE_MS = 0;
  // Sentinel error type. Throwing it from a helper unwinds the user's
  // handler all the way out to dispatchEvent's try/catch instead of
  // letting the loop run forever. Sub-classed from Error so user
  // `try { ... } catch (e) {}`
  // blocks can detect it via instanceof if they care.
  function HandlerBudgetExceededError(message) {
    const err = new Error(message || "Handler exceeded time budget");
    err.name = "HandlerBudgetExceededError";
    err.__customBlockerBudgetAbort = true;
    return err;
  }

  function checkHandlerDeadline(accumulator) {
    if (!accumulator) return;
    const deadline = accumulator._handlerDeadline;
    if (!deadline) return;
    if (accumulator._handlerOverrun) {
      throw HandlerBudgetExceededError(
        "Handler aborted: prior overrun detected"
      );
    }
    const now = (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();
    if (now > deadline + HELPERS_HANDLER_DEADLINE_GRACE_MS) {
      accumulator._handlerOverrun = true;
      throw HandlerBudgetExceededError(
        "Handler aborted: exceeded time budget"
      );
    }
  }

  function createDOMHelper(accumulatorRef) {
    function record(op) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.domOps.length >= HELPERS_MAX_DOM_OPS_PER_DISPATCH) return;
      acc.domOps.push(op);
    }
    return {
      hide(selector) { if (typeof selector === "string" && selector) record({ kind: "hide", selector }); },
      show(selector) { if (typeof selector === "string" && selector) record({ kind: "show", selector }); },
      addClass(selector, className) {
        if (typeof selector === "string" && typeof className === "string") {
          record({ kind: "addClass", selector, className });
        }
      },
      removeClass(selector, className) {
        if (typeof selector === "string" && typeof className === "string") {
          record({ kind: "removeClass", selector, className });
        }
      },
      setText(selector, text) {
        if (typeof selector === "string" && typeof text === "string") {
          record({ kind: "setText", selector, text });
        }
      },
      click(selector) {
        if (typeof selector === "string" && selector) record({ kind: "click", selector });
      },
      injectCss(css, id) {
        if (typeof css === "string" && css) record({ kind: "injectCss", css, id: typeof id === "string" ? id : null });
      },
      removeInjectedCss(id) {
        if (typeof id === "string" && id) record({ kind: "removeInjectedCss", id });
      },
      scrollTo(selector) {
        if (typeof selector === "string" && selector) record({ kind: "scrollTo", selector });
      }
    };
  }

  function createNavigationHelper(accumulatorRef, eventTabIdRef) {
    function record(op) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return;
      const tabId = typeof eventTabIdRef === "function" ? eventTabIdRef() : (eventTabIdRef ?? null);
      acc.intents.push({ kind: "navigation", op, tabId });
    }
    return {
      back() { record({ action: "back" }); },
      forward() { record({ action: "forward" }); },
      reload() { record({ action: "reload" }); },
      goTo(url) {
        if (typeof url === "string" && url) record({ action: "goTo", url });
      },
      closeTab() { record({ action: "closeTab" }); }
    };
  }

  function createStorageHelper(persistenceBucket, accumulatorRef) {
    const persistence = createPersistenceHelper(persistenceBucket);
    return {
      ...persistence,
      requestAsyncGet(key) {
        if (typeof key !== "string" || !key) return false;
        const acc = ensureAccumulatorShape(accumulatorRef.get());
        checkHandlerDeadline(acc);
        if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return false;
        acc.intents.push({ kind: "storage", action: "get", key });
        return true;
      },
      requestAsyncSet(key, value) {
        if (typeof key !== "string" || !key) return false;
        const cloned = safeCloneJson(value);
        if (cloned === undefined) return false;
        const acc = ensureAccumulatorShape(accumulatorRef.get());
        checkHandlerDeadline(acc);
        if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return false;
        acc.intents.push({ kind: "storage", action: "set", key, value: cloned });
        return true;
      }
    };
  }

  const LOCAL_FOLDER_SUPPORTED_EXTENSIONS = new Set([".txt", ".csv", ".json"]);

  function localFolderExtensionOf(path) {
    const match = String(path || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function sanitizeLocalFolderPath(path, { allowDirectory = false } = {}) {
    const text = String(path ?? "").trim().replace(/\\/g, "/").replace(/\/+/g, "/");
    if (!text || text.startsWith("/") || /^[a-z]:\//i.test(text)) return "";
    const parts = text.split("/").filter(Boolean);
    if (parts.length === 0) return "";
    for (const part of parts) {
      if (part === "." || part === ".." || part.startsWith(".")) return "";
      if (!/^[A-Za-z0-9 _.,@()\-]+$/.test(part)) return "";
    }
    const normalized = parts.join("/");
    if (allowDirectory) return normalized.replace(/\/$/, "");
    return LOCAL_FOLDER_SUPPORTED_EXTENSIONS.has(localFolderExtensionOf(normalized)) ? normalized : "";
  }

  function createLocalFolderHelper(groupId, accumulatorRef) {
    let requestCounter = 0;
    function request(action, path, extra = {}) {
      const allowDirectory = action === "list";
      const safePath = sanitizeLocalFolderPath(path || (allowDirectory ? "" : ""), { allowDirectory });
      if (!safePath && !allowDirectory) return "";
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return "";
      requestCounter += 1;
      const requestId = "lf-" + Date.now().toString(36) + "-" + requestCounter.toString(36);
      acc.intents.push({
        kind: "localFile",
        groupId,
        action,
        path: safePath,
        requestId,
        ...extra
      });
      return requestId;
    }
    return {
      isAvailable() {
        return true;
      },
      requestRead(path) {
        return request("read", path);
      },
      requestWrite(path, text) {
        if (typeof text !== "string") return "";
        return request("write", path, { text });
      },
      requestAppend(path, text) {
        if (typeof text !== "string") return "";
        return request("append", path, { text });
      },
      requestList(path = "") {
        return request("list", path || "", { directoryPath: sanitizeLocalFolderPath(path || "", { allowDirectory: true }) });
      },
      requestExists(path) {
        return request("exists", path);
      },
      requestReadJson(path) {
        if (localFolderExtensionOf(path) !== ".json") return "";
        return request("readJson", path);
      },
      requestWriteJson(path, value) {
        if (localFolderExtensionOf(path) !== ".json") return "";
        const cloned = safeCloneJson(value);
        if (cloned === undefined) return "";
        return request("writeJson", path, { value: cloned });
      }
    };
  }

  function createTabHelper(accumulatorRef, dispatchContextRef) {
    function snapshot() {
      const ctx = typeof dispatchContextRef === "function" ? dispatchContextRef() : (dispatchContextRef || {});
      return Array.isArray(ctx.tabsSnapshot) ? ctx.tabsSnapshot : [];
    }
    return {
      list() { return snapshot().slice(); },
      getActiveTab() { return snapshot().find((t) => t && t.active) || null; },
      getById(id) { return snapshot().find((t) => t && t.id === id) || null; },
      countOpen() { return snapshot().length; },
      requestRefresh() {
        const acc = ensureAccumulatorShape(accumulatorRef.get());
        checkHandlerDeadline(acc);
        if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return;
        acc.intents.push({ kind: "tab", action: "refresh" });
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Window helper — unified API for reading/managing tabs and a dynamic
  // site blocklist. On the extension side, "windows" are browser tabs.
  // ────────────────────────────────────────────────────────────────────────

  const windowBlocklist = new Map(); // pattern -> true (shared across groups, session lifetime)

  function createWindowHelper(accumulatorRef, dispatchContextRef) {
    function snapshot() {
      const ctx = typeof dispatchContextRef === "function" ? dispatchContextRef() : (dispatchContextRef || {});
      return Array.isArray(ctx.tabsSnapshot) ? ctx.tabsSnapshot : [];
    }

    function pushIntent(intent) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return;
      acc.intents.push(intent);
    }

    function normalizePattern(p) {
      let s = String(p || "").trim().toLowerCase();
      if (s.startsWith("http://")) s = s.slice(7);
      if (s.startsWith("https://")) s = s.slice(8);
      if (s.startsWith("www.")) s = s.slice(4);
      const slashIdx = s.indexOf("/");
      if (slashIdx > 0) s = s.slice(0, slashIdx);
      return s;
    }

    function hostnameMatchesPattern(hostname, pattern) {
      if (!hostname || !pattern) return false;
      const h = hostname.toLowerCase();
      if (h === pattern) return true;
      const suffix = "." + pattern;
      return h.length > pattern.length && h.endsWith(suffix);
    }

    return {
      current() {
        const active = snapshot().find((t) => t && t.active);
        if (!active) return { id: null, url: "", hostname: "", title: "", isBrowser: true };
        const host = getHostname(active.url) || "";
        return {
          id: active.id,
          url: active.url || "",
          hostname: host,
          title: active.title || "",
          isBrowser: true
        };
      },

      all() {
        return snapshot().map((t) => ({
          id: t.id,
          url: t.url || "",
          hostname: getHostname(t.url) || "",
          title: t.title || "",
          active: Boolean(t.active)
        }));
      },

      close(tabIdOrUrl) {
        if (typeof tabIdOrUrl === "number") {
          pushIntent({ kind: "window", action: "closeTab", tabId: tabIdOrUrl });
        } else if (typeof tabIdOrUrl === "string" && tabIdOrUrl) {
          pushIntent({ kind: "window", action: "closeTabByUrl", url: tabIdOrUrl });
        } else {
          pushIntent({ kind: "window", action: "closeActiveTab" });
        }
      },

      closeTab() {
        pushIntent({ kind: "window", action: "closeActiveTab" });
      },

      block(pattern) {
        const p = normalizePattern(pattern);
        if (!p) return;
        windowBlocklist.set(p, true);
        pushIntent({ kind: "window", action: "blockSite", pattern: p });
      },

      unblock(pattern) {
        const p = normalizePattern(pattern);
        windowBlocklist.delete(p);
        pushIntent({ kind: "window", action: "unblockSite", pattern: p });
      },

      isBlocked(urlOrHostname) {
        const hostname = getHostname(urlOrHostname) || normalizePattern(urlOrHostname);
        if (!hostname) return false;
        for (const [pattern] of windowBlocklist) {
          if (hostnameMatchesPattern(hostname, pattern)) return true;
        }
        return false;
      },

      getBlocked() {
        return Array.from(windowBlocklist.keys());
      }
    };
  }

  function createEventLogHelper(groupId, accumulatorRef) {
    // Returns false when the dispatch's log buffer is full so the caller
    // can also skip the corresponding console.* call. Without that gate,
    // a `for (let i = 0; i < 1e5; i++) h.log(i)` would still flood
    // DevTools and freeze Chrome even though the IPC chain is now
    // bounded. checkHandlerDeadline throws after the 1s budget so an
    // infinite while-loop calling h.log gets unwound instead of locking
    // the sandbox.
    function push(level, args, options) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.logs.length >= HELPERS_MAX_LOGS_PER_DISPATCH) {
        acc.logsDropped = (acc.logsDropped || 0) + 1;
        return false;
      }
      const entry = { level, groupId, args };
      const opts = options && typeof options === "object" ? options : {};
      if (opts.screen === true || opts.screen === false) entry.screen = opts.screen;
      if (opts.popup === true || opts.popup === false) entry.popup = opts.popup;
      acc.logs.push(entry);
      return true;
    }
    function printToConsole(level, args) {
      try {
        const prefix = "[CustomBlocker:" + groupId + "]";
        if (level === "error") console.error(prefix, ...args);
        else if (level === "warn") console.warn(prefix, ...args);
        else console.log(prefix, ...args);
      } catch {}
    }
    function record(level, args, options) {
      if (!push(level, args, options)) return;
      printToConsole(level, args);
    }
    return {
      log(...args) {
        record("log", args);
      },
      warn(...args) {
        record("warn", args);
      },
      error(...args) {
        record("error", args);
      },
      logScreen(...args) {
        record("log", args, { screen: true, popup: false });
      },
      warnScreen(...args) {
        record("warn", args, { screen: true, popup: false });
      },
      errorScreen(...args) {
        record("error", args, { screen: true, popup: false });
      },
      logPopup(...args) {
        record("log", args, { screen: false, popup: true });
      },
      warnPopup(...args) {
        record("warn", args, { screen: false, popup: true });
      },
      errorPopup(...args) {
        record("error", args, { screen: false, popup: true });
      }
    };
  }

  function createEventRedirectionHelper(accumulatorRef) {
    function set(url) {
      if (typeof url !== "string") return false;
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      acc.redirectUrl = url.trim();
      return true;
    }
    // Returns a chrome-extension:// URL that renders `message` centred on
    // message-page.html. Prefix comes from chrome.runtime.getURL() when
    // available, otherwise from the sandbox init payload.
    function createMessageUrl(message) {
      const text = String(message ?? "");
      let prefix = "";
      try {
        if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
          prefix = chrome.runtime.getURL("");
        }
      } catch (_) {}
      if (!prefix && typeof self !== "undefined" && typeof self.__customBlockerExtensionUrlPrefix === "string") {
        prefix = self.__customBlockerExtensionUrlPrefix;
      }
      return prefix + "message-page.html?msg=" + encodeURIComponent(text);
    }
    return {
      get() { return ensureAccumulatorShape(accumulatorRef.get()).redirectUrl ?? ""; },
      set,
      setRedirectLink: set,
      getRedirectLink() { return ensureAccumulatorShape(accumulatorRef.get()).redirectUrl ?? ""; },
      createMessageUrl
    };
  }

  // Per-platform method matrix. A method is exposed on a platform's API
  // iff it appears in that platform's array — calling a missing method
  // throws TypeError. Multiple platforms can write to the same internal
  // slot under different user-facing names (e.g. instagram.hideReels and
  // youtube.hideShorts both target slot "shorts").
  //
  // kind values handled by buildSpecMethod:
  //   predicate / clearPredicate     — install / clear single-slot predicate
  //   intent (+ optional clearSlot)  — record { kind, value } intent
  //   subsectionTimer                — record subsection-timer intent
  //   snapshotBool / snapshotChannelMembership / itemBool — readers
  const PLATFORM_API_SPEC = {
    youtube: [
      { name: "hideShorts", kind: "predicate", slot: "shorts" },
      { name: "showShorts", kind: "clearPredicate", slot: "shorts" },
      { name: "hideVideos", kind: "predicate", slot: "videos" },
      { name: "showVideos", kind: "clearPredicate", slot: "videos" },
      { name: "hidePosts", kind: "predicate", slot: "posts" },
      { name: "showPosts", kind: "clearPredicate", slot: "posts" },
      { name: "hideShortButton", kind: "intent", intentKind: "shortButton", value: "hide" },
      { name: "showShortButton", kind: "intent", intentKind: "shortButton", value: "show" },
      { name: "hideHomePage", kind: "intent", intentKind: "homePage", value: "hide" },
      { name: "showHomePage", kind: "intent", intentKind: "homePage", value: "show" },
      { name: "hideComments", kind: "intent", intentKind: "comments", value: "hide" },
      { name: "showComments", kind: "intent", intentKind: "comments", value: "show", clearSlot: "comments" },
      { name: "filterComments", kind: "predicate", slot: "comments" },
      { name: "hideLive", kind: "intent", intentKind: "live", value: "hide" },
      { name: "showLive", kind: "intent", intentKind: "live", value: "show", clearSlot: "live" },
      { name: "filterLive", kind: "predicate", slot: "live" },
      { name: "isCurrentChannelSubscribed", kind: "snapshotBool", field: "subscribed" },
      { name: "isChannelSubscribed", kind: "snapshotChannelMembership" },
      { name: "isCurrentChannelVerified", kind: "snapshotBool", field: "verified" },
      { name: "isLiveNow", kind: "snapshotBool", field: "live" },
      { name: "isItemLive", kind: "itemBool", field: "live" },
      { name: "isAlgorithmicRecommendation", kind: "itemBool", field: "algorithmic" },
      { name: "isSponsored", kind: "itemBool", field: "sponsored" },
      { name: "setShortsTimer", kind: "subsectionTimer", slot: "shorts" },
      { name: "setVideosTimer", kind: "subsectionTimer", slot: "videos" },
      { name: "setPostsTimer", kind: "subsectionTimer", slot: "posts" }
    ],
    tiktok: [
      // TikTok's whole experience IS short-form video, so there's no
      // separate "Shorts button" to hide and no "Posts" surface.
      { name: "hideVideos", kind: "predicate", slot: "videos" },
      { name: "showVideos", kind: "clearPredicate", slot: "videos" },
      { name: "hideHomePage", kind: "intent", intentKind: "homePage", value: "hide" },
      { name: "showHomePage", kind: "intent", intentKind: "homePage", value: "show" },
      { name: "hideComments", kind: "intent", intentKind: "comments", value: "hide" },
      { name: "showComments", kind: "intent", intentKind: "comments", value: "show", clearSlot: "comments" },
      { name: "filterComments", kind: "predicate", slot: "comments" },
      { name: "hideLive", kind: "intent", intentKind: "live", value: "hide" },
      { name: "showLive", kind: "intent", intentKind: "live", value: "show", clearSlot: "live" },
      { name: "filterLive", kind: "predicate", slot: "live" },
      { name: "isLiveNow", kind: "snapshotBool", field: "live" },
      { name: "isItemLive", kind: "itemBool", field: "live" },
      { name: "isAlgorithmicRecommendation", kind: "itemBool", field: "algorithmic" },
      { name: "isSponsored", kind: "itemBool", field: "sponsored" },
      { name: "setVideosTimer", kind: "subsectionTimer", slot: "videos" }
    ],
    instagram: [
      // Instagram calls it "Reels" not "Shorts" — same internal slot, but
      // the user-visible name follows the platform. Live streaming and
      // long-form video aren't first-class surfaces for filtering here.
      { name: "hideReels", kind: "predicate", slot: "shorts" },
      { name: "showReels", kind: "clearPredicate", slot: "shorts" },
      { name: "hidePosts", kind: "predicate", slot: "posts" },
      { name: "showPosts", kind: "clearPredicate", slot: "posts" },
      { name: "hideHomePage", kind: "intent", intentKind: "homePage", value: "hide" },
      { name: "showHomePage", kind: "intent", intentKind: "homePage", value: "show" },
      { name: "hideComments", kind: "intent", intentKind: "comments", value: "hide" },
      { name: "showComments", kind: "intent", intentKind: "comments", value: "show", clearSlot: "comments" },
      { name: "filterComments", kind: "predicate", slot: "comments" },
      { name: "isAlgorithmicRecommendation", kind: "itemBool", field: "algorithmic" },
      { name: "isSponsored", kind: "itemBool", field: "sponsored" },
      { name: "setReelsTimer", kind: "subsectionTimer", slot: "shorts" },
      { name: "setPostsTimer", kind: "subsectionTimer", slot: "posts" }
    ],
    facebook: [
      { name: "hideReels", kind: "predicate", slot: "shorts" },
      { name: "showReels", kind: "clearPredicate", slot: "shorts" },
      { name: "hideVideos", kind: "predicate", slot: "videos" },
      { name: "showVideos", kind: "clearPredicate", slot: "videos" },
      { name: "hidePosts", kind: "predicate", slot: "posts" },
      { name: "showPosts", kind: "clearPredicate", slot: "posts" },
      { name: "hideHomePage", kind: "intent", intentKind: "homePage", value: "hide" },
      { name: "showHomePage", kind: "intent", intentKind: "homePage", value: "show" },
      { name: "hideComments", kind: "intent", intentKind: "comments", value: "hide" },
      { name: "showComments", kind: "intent", intentKind: "comments", value: "show", clearSlot: "comments" },
      { name: "filterComments", kind: "predicate", slot: "comments" },
      { name: "hideLive", kind: "intent", intentKind: "live", value: "hide" },
      { name: "showLive", kind: "intent", intentKind: "live", value: "show", clearSlot: "live" },
      { name: "filterLive", kind: "predicate", slot: "live" },
      { name: "isLiveNow", kind: "snapshotBool", field: "live" },
      { name: "isItemLive", kind: "itemBool", field: "live" },
      { name: "isAlgorithmicRecommendation", kind: "itemBool", field: "algorithmic" },
      { name: "isSponsored", kind: "itemBool", field: "sponsored" },
      { name: "setReelsTimer", kind: "subsectionTimer", slot: "shorts" },
      { name: "setVideosTimer", kind: "subsectionTimer", slot: "videos" },
      { name: "setPostsTimer", kind: "subsectionTimer", slot: "posts" }
    ],
    twitch: [
      // hideComments / showComments map to STREAM CHAT (Twitch's nearest
      // analogue). filterComments is intentionally absent — no per-message
      // scraper for chat yet.
      { name: "hideComments", kind: "intent", intentKind: "comments", value: "hide" },
      { name: "showComments", kind: "intent", intentKind: "comments", value: "show", clearSlot: "comments" },
      { name: "hideClips", kind: "predicate", slot: "shorts" },
      { name: "showClips", kind: "clearPredicate", slot: "shorts" },
      { name: "hideStreams", kind: "predicate", slot: "streams" },
      { name: "showStreams", kind: "clearPredicate", slot: "streams" },
      { name: "hideVideos", kind: "predicate", slot: "videos" },
      { name: "showVideos", kind: "clearPredicate", slot: "videos" },
      { name: "hideHomePage", kind: "intent", intentKind: "homePage", value: "hide" },
      { name: "showHomePage", kind: "intent", intentKind: "homePage", value: "show" },
      { name: "hideLive", kind: "intent", intentKind: "live", value: "hide" },
      { name: "showLive", kind: "intent", intentKind: "live", value: "show", clearSlot: "live" },
      { name: "filterLive", kind: "predicate", slot: "live" },
      { name: "isCurrentChannelSubscribed", kind: "snapshotBool", field: "subscribed" },
      { name: "isChannelSubscribed", kind: "snapshotChannelMembership" },
      { name: "isLiveNow", kind: "snapshotBool", field: "live" },
      { name: "isItemLive", kind: "itemBool", field: "live" },
      { name: "isAlgorithmicRecommendation", kind: "itemBool", field: "algorithmic" },
      { name: "setClipsTimer", kind: "subsectionTimer", slot: "shorts" },
      { name: "setStreamsTimer", kind: "subsectionTimer", slot: "streams" },
      { name: "setVideosTimer", kind: "subsectionTimer", slot: "videos" }
    ]
  };

  function createEventPlatformHelper(accumulatorRef, dispatchContextRef, persistentBucket) {
    function recordIntent(platform, intent) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.intents.length >= HELPERS_MAX_INTENTS_PER_DISPATCH) return;
      acc.intents.push({ kind: "platform", platform, intent });
    }
    function getDispatchContext() {
      return typeof dispatchContextRef === "function" ? dispatchContextRef() : (dispatchContextRef || {});
    }
    function clearPersistentSlot(platform, slot) {
      if (!persistentBucket) return;
      if (!persistentBucket[platform]) return;
      persistentBucket[platform][slot] = null;
    }

    function buildPlatformApi(platform) {
      const urlOps = platformUrlOps[platform];
      const specs = PLATFORM_API_SPEC[platform] || [];

      function snapshot() {
        const ctx = getDispatchContext();
        return (ctx.platformSnapshot && ctx.platformSnapshot[platform]) || null;
      }

      // Single-slot rule: each (group, platform, slot) owns ONE predicate.
      // Each call replaces — no implicit OR-merge. Slot stays alive until
      // matching show*() or group unload.
      function setPredicate(slot, predicate, opts) {
        if (typeof predicate !== "function") return;
        const blockPageOnVisit = Boolean(opts && opts.blockPageOnVisit);
        recordIntent(platform, { slot, predicate: true, blockPageOnVisit });
        const acc = ensureAccumulatorShape(accumulatorRef.get());
        acc.platformPredicates = acc.platformPredicates || {};
        acc.platformPredicates[platform] = acc.platformPredicates[platform] || {};
        acc.platformPredicates[platform][slot] = { predicate, blockPageOnVisit };
        if (persistentBucket) {
          if (!persistentBucket[platform]) persistentBucket[platform] = {};
          persistentBucket[platform][slot] = { predicate, blockPageOnVisit };
        }
      }

      const api = {};
      for (const spec of specs) {
        api[spec.name] = buildSpecMethod(platform, spec, {
          recordIntent,
          setPredicate,
          clearPersistentSlot,
          snapshot
        });
      }

      // URL classifiers are always available, regardless of spec.
      api.isPlatformUrl = urlOps?.isPlatformUrl ?? (() => false);
      api.isShortUrl = urlOps?.isShortUrl ?? (() => false);
      api.isVideoUrl = urlOps?.isVideoUrl ?? (() => false);
      api.isPostUrl = urlOps?.isPostUrl ?? (() => false);
      api.isHomePage = urlOps?.isHomePage ?? (() => false);
      api.extractAuthor = urlOps?.extractAuthor ?? (() => null);
      api.extractVideoId = urlOps?.extractVideoId ?? (() => null);

      return api;
    }

    const helpers = {};
    for (const platform of PLATFORM_LIST) {
      helpers[platform] = function platformAccessor() {
        return buildPlatformApi(platform);
      };
    }
    helpers.listMethods = function listMethods(platform) {
      const specs = PLATFORM_API_SPEC[platform] || [];
      return specs.map((s) => s.name).concat([
        "isPlatformUrl",
        "isShortUrl",
        "isVideoUrl",
        "isPostUrl",
        "isHomePage",
        "extractAuthor",
        "extractVideoId"
      ]);
    };
    helpers.hasMethod = function hasMethod(platform, methodName) {
      return helpers.listMethods(platform).includes(methodName);
    };
    return helpers;
  }

  function buildSpecMethod(platform, spec, deps) {
    const { recordIntent, setPredicate, clearPersistentSlot, snapshot } = deps;
    switch (spec.kind) {
      case "predicate":
        return function (predicate, opts) {
          setPredicate(spec.slot, predicate, opts);
        };
      case "clearPredicate":
        return function () {
          recordIntent(platform, { kind: "clearPredicates", slot: spec.slot });
          clearPersistentSlot(platform, spec.slot);
        };
      case "intent":
        return function () {
          recordIntent(platform, { kind: spec.intentKind, value: spec.value });
          if (spec.clearSlot) clearPersistentSlot(platform, spec.clearSlot);
        };
      case "subsectionTimer":
        return function (opts = {}) {
          recordIntent(platform, { kind: "subsectionTimer", slot: spec.slot, opts });
          return opts && typeof opts.id === "string" ? opts.id : null;
        };
      case "snapshotBool":
        return function () {
          return Boolean(snapshot()?.[spec.field]);
        };
      case "snapshotChannelMembership":
        return function (id) {
          const snap = snapshot();
          if (!snap || !id) return false;
          return Array.isArray(snap.subscribedChannels) && snap.subscribedChannels.includes(id);
        };
      case "itemBool":
        return function (item) {
          return Boolean(item && item[spec.field] === true);
        };
      default:
        // Schema bug — refuse to silently no-op so the test runner
        // surfaces the typo loudly instead of returning undefined.
        return function () {
          throw new Error(
            "Internal: PLATFORM_API_SPEC[" + platform + "]." + spec.name +
            " has unknown kind " + spec.kind
          );
        };
    }
  }

  // ctx accepts an accumulator (one-shot) OR an accumulatorRef +
  // dispatchContextRef pair (refs are thunks). The thunk form lets a
  // `helpers` object captured at registration time keep working across
  // every later dispatch by re-reading the current accumulator.
  function createEventGroupHelpers(ctx) {
    const {
      groupId,
      currentUrl,
      timersBucket,
      panelsBucket,
      persistenceBucket,
      // Optional shared predicate registry (sandbox-lifetime). When the
      // event-sandbox passes one in, scope/domain predicates set during
      // a dispatch survive into subsequent heartbeats so timers can
      // auto-tick without the rule re-passing predicates each time.
      timerPredicatesBucket
    } = ctx || {};

    const accumulatorRef = ctx?.accumulatorRef
      ? ctx.accumulatorRef
      : { get: () => ensureAccumulatorShape(ctx?.accumulator || {}) };
    const dispatchContextRef = ctx?.dispatchContextRef
      ? ctx.dispatchContextRef
      : (() => ctx?.dispatchContext || {});

    // Eagerly initialise the visible accumulator so the load-source
    // call (which is the only call that uses the legacy accumulator
    // path) starts with the right shape.
    ensureAccumulatorShape(accumulatorRef.get());

    // Fallback per-helpers ticked/displayed sets used only when a
    // dispatch context isn't available (e.g. legacy callers that
    // construct helpers without the sandbox dispatch). When the
    // sandbox is driving us, dispatchContextRef returns the fresh
    // per-dispatch sets and elapsedMs.
    const fallbackTickedSet = new Set();
    const fallbackDisplayedSet = new Set();
    const fallbackPanelDisplayedSet = new Set();

    const domain = createEventDomainHelper();
    const timer = createTimerHelper({
      groupId,
      timersBucket: timersBucket || {},
      accumulatorRef,
      predicatesBucket: timerPredicatesBucket || {},
      elapsedMsRef: () => {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        const v = Number(dc?.elapsedMs);
        return Number.isFinite(v) && v >= 0 ? v : 0;
      },
      currentUrlRef: () => {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return normalizeUrlForEvents(dc?.currentUrl ?? currentUrl ?? "");
      },
      tickedSetRef: () => {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return dc?.tickedSet instanceof Set ? dc.tickedSet : fallbackTickedSet;
      },
      displayedSetRef: () => {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return dc?.displayedSet instanceof Set ? dc.displayedSet : fallbackDisplayedSet;
      }
    });
    const panel = createPanelHelper({
      groupId,
      panelsBucket: panelsBucket || {},
      timersBucket: timersBucket || {},
      accumulatorRef,
      predicatesBucket: ctx?.panelPredicatesBucket || {},
      registerPanelHandler: ctx?.registerPanelHandler,
      unregisterPanelHandlers: ctx?.unregisterPanelHandlers,
      currentUrlRef: () => {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return normalizeUrlForEvents(dc?.currentUrl ?? currentUrl ?? "");
      },
      panelDisplayedSetRef: () => {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return dc?.panelDisplayedSet instanceof Set ? dc.panelDisplayedSet : fallbackPanelDisplayedSet;
      }
    });
    const persistence = createPersistenceHelper(persistenceBucket || {});
    const log = createEventLogHelper(groupId, accumulatorRef);
    const redirect = createEventRedirectionHelper(accumulatorRef);
    const dom = createDOMHelper(accumulatorRef);
    const navigation = createNavigationHelper(accumulatorRef, () => {
      const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
      return dc?.tabId ?? null;
    });
    const storage = createStorageHelper(persistenceBucket || {}, accumulatorRef);
    const localFolder = createLocalFolderHelper(groupId, accumulatorRef);
    const tabs = createTabHelper(accumulatorRef, dispatchContextRef);
    const win = createWindowHelper(accumulatorRef, dispatchContextRef);
    const platform = createEventPlatformHelper(
      accumulatorRef,
      dispatchContextRef,
      ctx?.platformPredicatesBucket || null
    );

    return {
      get now() {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return dc?.now ?? Date.now();
      },
      get currentUrl() {
        const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
        return normalizeUrlForEvents(dc?.currentUrl ?? currentUrl ?? "");
      },
      groupId,
      // Direct shortcuts so user code can do `helpers.log("…")` without
      // having to `helpers.getLogHelper()` first. They route to the same
      // accumulator-aware log functions and therefore land in the popup's
      // Activity log feed via background.ingestSandboxLogs().
      log: (...args) => log.log(...args),
      warn: (...args) => log.warn(...args),
      error: (...args) => log.error(...args),
      logScreen: (...args) => log.logScreen(...args),
      warnScreen: (...args) => log.warnScreen(...args),
      errorScreen: (...args) => log.errorScreen(...args),
      logPopup: (...args) => log.logPopup(...args),
      warnPopup: (...args) => log.warnPopup(...args),
      errorPopup: (...args) => log.errorPopup(...args),
      getLogHelper: () => log,
      getDomainHelper: () => domain,
      getDomainUtility: () => domain,
      getTimerHelper: () => timer,
      getPanelHelper: () => panel,
      getPersistenceHelper: () => persistence,
      getRedirectionHelper: () => redirect,
      getDOMHelper: () => dom,
      getNavigationHelper: () => navigation,
      getStorageHelper: () => storage,
      getLocalFolderHelper: () => localFolder,
      getTabHelper: () => tabs,
      getWindowHelper: () => win,
      getPlatformHelper: () => platform
    };
  }

  global.__customBlockerHelpers = {
    PLATFORM_LIST,
    PLATFORM_API_SPEC,
    createEventGroupHelpers,
    createEventPlatformHelper,
    createDomainUtility,
    platformUrlOps,
    isEmptyStartPage,
    normalizeUrlForEvents,
    // Exposed for tests so we can directly exercise per-helper deadline
    // and cap behavior without spinning up a full event-sandbox stack.
    // Production callers should keep using getLogHelper/getDOMHelper/...
    // through createEventGroupHelpers — these factories are subject to
    // change.
    createEventLogHelper,
    createDOMHelper,
    createPanelHelper,
    createTabHelper,
    // Exposed so event-sandbox.js can call it from registerHandler too,
    // ensuring a registration loop (`for (let i = 0; i < 1e5; i++)
    // events.register(...)`) terminates within the time budget even
    // though it never calls a logger/DOM helper.
    checkHandlerDeadline
  };
})(typeof self !== "undefined" ? self : globalThis);
