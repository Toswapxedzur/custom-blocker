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
  //   getOrCreateTimer  — idempotent; preserves existing currentMs.
  // Both accept transient (non-persisted) per-call predicates:
  //   scope(url)   — when true, auto-tick by heartbeat elapsedMs.
  //   domain(url)  — when true, show in overlay (defaults to scope).
  function createTimerHelper(ctx) {
    const { groupId, timersBucket } = ctx;
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

    function rememberPredicates(id, scope, domain) {
      // Only update slots that the caller actually provided so a
      // subsequent getOrCreateTimer call without explicit predicates
      // doesn't accidentally drop the scope set at create time.
      const slot = predicatesBucket[id] || {};
      if (typeof scope === "function") slot.scope = scope;
      else if (scope === null) delete slot.scope;
      if (typeof domain === "function") slot.domain = domain;
      else if (domain === null) delete slot.domain;
      predicatesBucket[id] = slot;
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
        applyScopeAndDomain(id, scope, domain);
        return id;
      },
      getOrCreateTimer({ id, displayName, direction, currentMs, scope, domain } = {}) {
        if (typeof id !== "string" || !id) return null;
        let timer = getTimer(id);
        if (!timer) {
          timer = buildFresh({ displayName, direction, currentMs });
          timersBucket[id] = timer;
        } else {
          if (direction === "forward" || direction === "backward") timer.direction = direction;
          if (typeof displayName === "string") timer.displayName = displayName;
        }
        applyScopeAndDomain(id, scope, domain);
        return id;
      },
      delete(id) {
        if (!getTimer(id)) return false;
        delete timersBucket[id];
        delete predicatesBucket[id];
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
        timer.direction = direction;
        return true;
      },
      setCurrentMs(id, ms) {
        const timer = getTimer(id);
        const value = Number(ms);
        if (!timer || !Number.isFinite(value)) return false;
        timer.currentMs = Math.max(0, Math.floor(value));
        return true;
      },
      addMs(id, deltaMs) {
        const timer = getTimer(id);
        const value = Number(deltaMs);
        if (!timer || !Number.isFinite(value)) return false;
        timer.currentMs = Math.max(0, Math.floor(timer.currentMs + value));
        return true;
      },
      setDisplayName(id, displayName) {
        const timer = getTimer(id);
        if (!timer || typeof displayName !== "string") return false;
        timer.displayName = displayName;
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
  const HELPERS_HANDLER_DEADLINE_GRACE_MS = 0;
  // Sentinel error type. Throwing it from a helper unwinds the user's
  // handler all the way out to dispatchEvent's try/catch, which records
  // a single "[handler aborted]" warning instead of letting the loop run
  // forever. Sub-classed from Error so user `try { ... } catch (e) {}`
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

  function createEventLogHelper(groupId, accumulatorRef) {
    // Returns false when the dispatch's log buffer is full so the caller
    // can also skip the corresponding console.* call. Without that gate,
    // a `for (let i = 0; i < 1e5; i++) h.log(i)` would still flood
    // DevTools and freeze Chrome even though the IPC chain is now
    // bounded. checkHandlerDeadline throws after the 1s budget so an
    // infinite while-loop calling h.log gets unwound instead of locking
    // the sandbox.
    function push(level, args) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      checkHandlerDeadline(acc);
      if (acc.logs.length >= HELPERS_MAX_LOGS_PER_DISPATCH) {
        acc.logsDropped = (acc.logsDropped || 0) + 1;
        return false;
      }
      acc.logs.push({ level, groupId, args });
      return true;
    }
    return {
      log(...args) {
        if (!push("log", args)) return;
        try { console.log("[CustomBlocker:" + groupId + "]", ...args); } catch {}
      },
      warn(...args) {
        if (!push("warn", args)) return;
        try { console.warn("[CustomBlocker:" + groupId + "]", ...args); } catch {}
      },
      error(...args) {
        if (!push("error", args)) return;
        try { console.error("[CustomBlocker:" + groupId + "]", ...args); } catch {}
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

    const domain = createEventDomainHelper();
    const timer = createTimerHelper({
      groupId,
      timersBucket: timersBucket || {},
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
    const persistence = createPersistenceHelper(persistenceBucket || {});
    const log = createEventLogHelper(groupId, accumulatorRef);
    const redirect = createEventRedirectionHelper(accumulatorRef);
    const dom = createDOMHelper(accumulatorRef);
    const navigation = createNavigationHelper(accumulatorRef, () => {
      const dc = typeof dispatchContextRef === "function" ? dispatchContextRef() : dispatchContextRef;
      return dc?.tabId ?? null;
    });
    const storage = createStorageHelper(persistenceBucket || {}, accumulatorRef);
    const tabs = createTabHelper(accumulatorRef, dispatchContextRef);
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
      getLogHelper: () => log,
      getDomainHelper: () => domain,
      getDomainUtility: () => domain,
      getTimerHelper: () => timer,
      getPersistenceHelper: () => persistence,
      getRedirectionHelper: () => redirect,
      getDOMHelper: () => dom,
      getNavigationHelper: () => navigation,
      getStorageHelper: () => storage,
      getTabHelper: () => tabs,
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
    createTabHelper,
    // Exposed so event-sandbox.js can call it from registerHandler too,
    // ensuring a registration loop (`for (let i = 0; i < 1e5; i++)
    // events.register(...)`) terminates within the time budget even
    // though it never calls a logger/DOM helper.
    checkHandlerDeadline
  };
})(typeof self !== "undefined" ? self : globalThis);
