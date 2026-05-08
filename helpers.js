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

  // ────────────────────────────────────────────────────────────────────────
  // Timer helper.
  //
  // Persisted timer state, per-id:
  //   {
  //     displayName: string,
  //     direction: "forward" | "backward",
  //     isPaused: boolean,
  //     currentMs: number       // current value of the timer
  //   }
  //
  // Identity is the user-supplied `id` string scoped to the owning custom
  // group.
  //
  // Two construction methods:
  //   create({ id, ... })            — ALWAYS resets the timer to the
  //                                     supplied init values, overwriting
  //                                     any existing state including
  //                                     currentMs. Use this when you mean
  //                                     "start fresh" (e.g. when a user
  //                                     explicitly resets a counter).
  //   getOrCreateTimer({ id, ... })  — Idempotent. Returns the existing
  //                                     timer if one is already there
  //                                     (preserving its currentMs); only
  //                                     creates with the init values if no
  //                                     timer exists. Mutable fields
  //                                     (displayName, direction) are still
  //                                     updated. Use this in rules that run
  //                                     every heartbeat.
  //
  // Both methods accept two transient predicates that are NOT persisted —
  // they only affect the current heartbeat:
  //   scope:  (url) => boolean   — when true, the timer auto-ticks by the
  //                                heartbeat's elapsedMs (the same delta
  //                                the default block group's usage timer
  //                                uses). At most one tick per heartbeat
  //                                across all rules.
  //   domain: (url) => boolean   — when true, the timer is shown in the
  //                                in-page overlay. If `domain` is omitted
  //                                the system falls back to `scope` for
  //                                display, so callers that only care
  //                                about "tick + show on the same pages"
  //                                don't need to pass it.
  // ────────────────────────────────────────────────────────────────────────

  function createTimerHelper(ctx) {
    const { groupId, timersBucket, elapsedMs, currentUrl, tickedSet, displayedSet } = ctx;

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
      try { return Boolean(predicate(currentUrl)); } catch { return false; }
    }

    function applyScopeAndDomain(id, scope, domain) {
      // Auto-tick if scope matches and we haven't already ticked this id
      // in this heartbeat. tickedSet is shared across all rules in a
      // group so multiple create / getOrCreateTimer calls don't
      // double-tick.
      if (typeof scope === "function" && !tickedSet.has(id)) {
        const timer = getTimer(id);
        if (timer && !timer.isPaused && safePredicate(scope)) {
          tickInternal(id, elapsedMs);
          tickedSet.add(id);
        }
      }
      // Decide overlay display. domain takes priority; when omitted we
      // default to scope so a "tick on shorts pages" timer also shows
      // there without needing two predicates.
      const displayPredicate = typeof domain === "function" ? domain : scope;
      if (typeof displayPredicate === "function" && safePredicate(displayPredicate)) {
        displayedSet.add(id);
      }
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

  function createLogHelper(groupId) {
    const tag = "[CustomBlocker:" + groupId + "]";
    return {
      log(...args) {
        try { console.log(tag, ...args); } catch {}
      },
      warn(...args) {
        try { console.warn(tag, ...args); } catch {}
      },
      error(...args) {
        try { console.error(tag, ...args); } catch {}
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Redirection helper. Lets custom rules inspect / override the URL the
  // content script will redirect to when the current page is blocked.
  //
  // The state is transient per heartbeat, shared across all rules in the
  // same execution pass, and seeded from the session's current fallback
  // URL (coming from the built-in groups). Because custom rules execute
  // bottom-to-top, a top rule calling set(...) naturally overrides a
  // lower rule's choice.
  // ────────────────────────────────────────────────────────────────────────

  function createRedirectionHelper(redirectState) {
    const state =
      redirectState && typeof redirectState === "object"
        ? redirectState
        : { url: "" };
    if (typeof state.url !== "string") state.url = "";
    return {
      get() {
        return state.url;
      },
      set(url) {
        if (typeof url !== "string") return false;
        state.url = url.trim();
        return true;
      }
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Platform helper. Each rule call registers DOM intents into a shared
  // `intentsState` object; the host (content script) applies them after all
  // rules have run, in storage order so that "later" groups override
  // "earlier" ones (rules execute bottom-to-top, so the top-most group wins
  // because it runs last).
  //
  // Intents per platform:
  //   shortButton    : "hide" | "show" | null
  //   homePage       : "hide" | "show" | null
  //   shortsPredicates / videosPredicates / postsPredicates :
  //     [{ predicate, blockPageOnVisit }]
  //
  // `show*` for the predicate-based variants clears all previously-recorded
  // hide predicates from earlier groups in the same heartbeat. This is what
  // lets a top group "exempt" an entire content kind that a bottom group
  // had hidden.
  // ────────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────────
  // EVENT-DRIVEN CUSTOM RULES (v1.1+)
  //
  // The new custom-rule engine runs in a long-lived offscreen sandbox.
  // Source code is executed exactly once per Run click and registers
  // event handlers via an Events registry. The helpers below are built
  // per group and per event dispatch and route side effects through an
  // `accumulator` that the host (background) reads after dispatch and
  // forwards to content scripts.
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
    return accumulator;
  }

  function createDOMHelper(accumulatorRef) {
    function record(op) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
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
        acc.intents.push({ kind: "storage", action: "get", key });
        return true;
      },
      requestAsyncSet(key, value) {
        if (typeof key !== "string" || !key) return false;
        const cloned = safeCloneJson(value);
        if (cloned === undefined) return false;
        const acc = ensureAccumulatorShape(accumulatorRef.get());
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
        acc.intents.push({ kind: "tab", action: "refresh" });
      }
    };
  }

  function createEventLogHelper(groupId, accumulatorRef) {
    function push(level, args) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      acc.logs.push({ level, groupId, args });
    }
    return {
      log(...args) {
        push("log", args);
        try { console.log("[CustomBlocker:" + groupId + "]", ...args); } catch {}
      },
      warn(...args) {
        push("warn", args);
        try { console.warn("[CustomBlocker:" + groupId + "]", ...args); } catch {}
      },
      error(...args) {
        push("error", args);
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
    return {
      get() { return ensureAccumulatorShape(accumulatorRef.get()).redirectUrl ?? ""; },
      set,
      setRedirectLink: set,
      getRedirectLink() { return ensureAccumulatorShape(accumulatorRef.get()).redirectUrl ?? ""; }
    };
  }

  // Event-mode platform helper. Adds inspection helpers and live/comment
  // hide+filter methods on top of the existing intent-based methods.
  function createEventPlatformHelper(accumulatorRef, dispatchContextRef, persistentBucket) {
    function recordIntent(platform, intent) {
      const acc = ensureAccumulatorShape(accumulatorRef.get());
      acc.intents.push({ kind: "platform", platform, intent });
    }
    function getDispatchContext() {
      return typeof dispatchContextRef === "function" ? dispatchContextRef() : (dispatchContextRef || {});
    }
    function clearPersistentSlot(platform, slot) {
      // Each (platform, slot) holds at most ONE predicate entry. Clearing
      // means dropping that entry entirely (e.g. when showVideos() is
      // called).
      if (!persistentBucket) return;
      if (!persistentBucket[platform]) return;
      persistentBucket[platform][slot] = null;
    }

    function buildPlatformApi(platform) {
      const urlOps = platformUrlOps[platform];
      function snapshot() {
        const ctx = getDispatchContext();
        return (ctx.platformSnapshot && ctx.platformSnapshot[platform]) || null;
      }

      // Single-slot semantics: hideVideos / hideShorts / hidePosts /
      // filterComments / filterLive each own ONE persistent predicate per
      // (group, platform, slot). Each call REPLACES whatever was there
      // before — there is no implicit OR-ing of multiple predicates.
      // The slot stays alive across dispatches and is cleared only by the
      // matching show*() / unload of the group. Compose multiple
      // conditions explicitly inside one predicate function if needed.
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

      return {
        // Original DOM intents
        hideShortButton() { recordIntent(platform, { kind: "shortButton", value: "hide" }); },
        showShortButton() { recordIntent(platform, { kind: "shortButton", value: "show" }); },
        hideHomePage() { recordIntent(platform, { kind: "homePage", value: "hide" }); },
        showHomePage() { recordIntent(platform, { kind: "homePage", value: "show" }); },
        hideShorts(predicate, opts) { setPredicate("shorts", predicate, opts); },
        showShorts() { recordIntent(platform, { kind: "clearPredicates", slot: "shorts" }); clearPersistentSlot(platform, "shorts"); },
        hideVideos(predicate, opts) { setPredicate("videos", predicate, opts); },
        showVideos() { recordIntent(platform, { kind: "clearPredicates", slot: "videos" }); clearPersistentSlot(platform, "videos"); },
        hidePosts(predicate, opts) { setPredicate("posts", predicate, opts); },
        showPosts() { recordIntent(platform, { kind: "clearPredicates", slot: "posts" }); clearPersistentSlot(platform, "posts"); },

        hideComments() { recordIntent(platform, { kind: "comments", value: "hide" }); },
        showComments() { recordIntent(platform, { kind: "comments", value: "show" }); clearPersistentSlot(platform, "comments"); },
        filterComments(predicate) { setPredicate("comments", predicate, null); },
        hideLive() { recordIntent(platform, { kind: "live", value: "hide" }); },
        showLive() { recordIntent(platform, { kind: "live", value: "show" }); clearPersistentSlot(platform, "live"); },
        filterLive(predicate) { setPredicate("live", predicate, null); },

        isCurrentChannelSubscribed() { return Boolean(snapshot()?.subscribed); },
        isChannelSubscribed(id) {
          const snap = snapshot();
          if (!snap || !id) return false;
          return Array.isArray(snap.subscribedChannels) && snap.subscribedChannels.includes(id);
        },
        isCurrentChannelVerified() { return Boolean(snapshot()?.verified); },
        isLiveNow() { return Boolean(snapshot()?.live); },
        isItemLive(item) { return Boolean(item && item.live === true); },
        isAlgorithmicRecommendation(item) { return Boolean(item && item.algorithmic === true); },
        isSponsored(item) { return Boolean(item && item.sponsored === true); },

        // Sub-section timers, kept identical in spirit to the legacy API
        setShortsTimer(opts = {}) {
          // In event-mode, timer state lives in the persistent
          // groupTimers bucket maintained by the sandbox; we record an
          // intent so the host can register the "scope" predicate
          // against URL-change events.
          recordIntent(platform, { kind: "subsectionTimer", slot: "shorts", opts });
          return opts && typeof opts.id === "string" ? opts.id : null;
        },
        setVideosTimer(opts = {}) {
          recordIntent(platform, { kind: "subsectionTimer", slot: "videos", opts });
          return opts && typeof opts.id === "string" ? opts.id : null;
        },
        setPostsTimer(opts = {}) {
          recordIntent(platform, { kind: "subsectionTimer", slot: "posts", opts });
          return opts && typeof opts.id === "string" ? opts.id : null;
        },

        // URL classifiers reachable through the platform helper too.
        isPlatformUrl: urlOps?.isPlatformUrl ?? (() => false),
        isShortUrl: urlOps?.isShortUrl ?? (() => false),
        isVideoUrl: urlOps?.isVideoUrl ?? (() => false),
        isPostUrl: urlOps?.isPostUrl ?? (() => false),
        isHomePage: urlOps?.isHomePage ?? (() => false),
        extractAuthor: urlOps?.extractAuthor ?? (() => null),
        extractVideoId: urlOps?.extractVideoId ?? (() => null)
      };
    }

    const helpers = {};
    for (const platform of PLATFORM_LIST) {
      helpers[platform] = function platformAccessor() {
        return buildPlatformApi(platform);
      };
    }
    return helpers;
  }

  // Top-level event-mode helpers builder.
  //
  // ctx accepts EITHER an accumulator object (legacy / one-shot) OR an
  // `accumulatorRef` and `dispatchContextRef` pair. Refs are functions
  // that return the *current* accumulator / dispatch context. This is
  // what makes a `helpers` object captured at registration time keep
  // working through every later handler dispatch: it always looks up
  // the active dispatch's accumulator instead of the dead one from
  // load-source.
  function createEventGroupHelpers(ctx) {
    const {
      groupId,
      currentUrl,
      timersBucket,
      persistenceBucket
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

    const tickedSet = new Set();
    const displayedSet = new Set();

    const domain = createEventDomainHelper();
    const timer = createTimerHelper({
      groupId,
      timersBucket: timersBucket || {},
      elapsedMs: 0,
      currentUrl: currentUrl || "",
      tickedSet,
      displayedSet
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
    createEventGroupHelpers,
    createDomainUtility,
    platformUrlOps,
    isEmptyStartPage,
    normalizeUrlForEvents
  };
})(typeof self !== "undefined" ? self : globalThis);
