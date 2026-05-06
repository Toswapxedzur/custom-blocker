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

  function createEmptyIntentsState() {
    const state = {};
    for (const platform of PLATFORM_LIST) {
      state[platform] = {
        shortButton: null,
        homePage: null,
        shortsPredicates: [],
        videosPredicates: [],
        postsPredicates: []
      };
    }
    return state;
  }

  function createPlatformHelper(ctx) {
    const { intentsState, getTimerHelper } = ctx;

    function buildPlatformApi(platform) {
      const ps = intentsState[platform];
      const urlOps = platformUrlOps[platform];

      function pushPredicate(list, predicate, opts) {
        if (typeof predicate !== "function") return;
        list.push({
          predicate,
          blockPageOnVisit: Boolean(opts && opts.blockPageOnVisit)
        });
      }

      return {
        hideShortButton() { ps.shortButton = "hide"; },
        showShortButton() { ps.shortButton = "show"; },
        hideHomePage() { ps.homePage = "hide"; },
        showHomePage() { ps.homePage = "show"; },
        hideShorts(predicate, opts) { pushPredicate(ps.shortsPredicates, predicate, opts); },
        showShorts() { ps.shortsPredicates = []; },
        hideVideos(predicate, opts) { pushPredicate(ps.videosPredicates, predicate, opts); },
        showVideos() { ps.videosPredicates = []; },
        hidePosts(predicate, opts) { pushPredicate(ps.postsPredicates, predicate, opts); },
        showPosts() { ps.postsPredicates = []; },
        setShortsTimer(opts = {}) {
          // Use getOrCreateTimer so calling this every heartbeat doesn't
          // wipe currentMs. The user can still pass an explicit
          // currentMs to seed a brand-new timer.
          return getTimerHelper().getOrCreateTimer({ ...opts, scope: (u) => urlOps.isShortUrl(u) });
        },
        setVideosTimer(opts = {}) {
          return getTimerHelper().getOrCreateTimer({ ...opts, scope: (u) => urlOps.isVideoUrl(u) });
        },
        setPostsTimer(opts = {}) {
          return getTimerHelper().getOrCreateTimer({ ...opts, scope: (u) => urlOps.isPostUrl(u) });
        }
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

  // ────────────────────────────────────────────────────────────────────────
  // Top-level helper bundle. A new bundle is created for every rule
  // invocation; the buckets it mutates are shared with the host so that
  // changes are visible to the persistence layer.
  // ────────────────────────────────────────────────────────────────────────

  function createCustomRuleHelpers(ctx) {
    const {
      groupId,
      timersBucket,
      persistenceBucket,
      intentsState,
      currentUrl,
      now,
      elapsedMs,
      redirectState
    } = ctx;
    const tickedSet = ctx.tickedSet instanceof Set ? ctx.tickedSet : new Set();
    const displayedSet = ctx.displayedSet instanceof Set ? ctx.displayedSet : new Set();

    const domainUtility = createDomainUtility();
    const timerHelper = createTimerHelper({
      groupId,
      timersBucket,
      elapsedMs,
      currentUrl,
      tickedSet,
      displayedSet
    });
    const persistenceHelper = createPersistenceHelper(persistenceBucket);
    const logHelper = createLogHelper(groupId);
    const redirectionHelper = createRedirectionHelper(redirectState);
    const platformHelper = createPlatformHelper({
      intentsState,
      getTimerHelper: () => timerHelper
    });

    return {
      now,
      elapsedMs,
      currentUrl,
      groupId,
      tickedSet,
      displayedSet,
      getTimerHelper: () => timerHelper,
      getPersistenceHelper: () => persistenceHelper,
      getLogHelper: () => logHelper,
      getRedirectionHelper: () => redirectionHelper,
      getPlatformHelper: () => platformHelper,
      getDomainUtility: () => domainUtility
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Compile a custom rule source string into a function. The expected
  // signature is:
  //
  //   (month, dayOfMonth, dayName, hour, minute, url, helpers) => integer
  //
  // Returns null on syntax/type errors. Runtime errors are caught by the
  // caller.
  // ────────────────────────────────────────────────────────────────────────

  function compileCustomBlockingRule(source) {
    const trimmed = String(source ?? "").trim();
    if (!trimmed) {
      return null;
    }
    try {
      const fn = new Function("return (" + trimmed + ");")();
      return typeof fn === "function" ? fn : null;
    } catch {
      return null;
    }
  }

  function sanitizeTimersBucket(bucket) {
    const clean = {};
    if (!bucket || typeof bucket !== "object") return clean;
    for (const [id, raw] of Object.entries(bucket)) {
      if (typeof id !== "string" || !id || !raw || typeof raw !== "object") continue;
      clean[id] = {
        displayName: typeof raw.displayName === "string" ? raw.displayName.slice(0, 80) : "",
        direction: raw.direction === "forward" ? "forward" : "backward",
        isPaused: Boolean(raw.isPaused),
        currentMs: Math.max(0, Math.floor(Number(raw.currentMs) || 0))
      };
    }
    return clean;
  }

  function sanitizePersistenceBucket(bucket) {
    const clean = {};
    if (!bucket || typeof bucket !== "object") return clean;
    let count = 0;
    for (const [key, raw] of Object.entries(bucket)) {
      if (typeof key !== "string" || !key || count >= MAX_PERSISTENCE_KEYS_PER_GROUP) continue;
      const cloned = safeCloneJson(raw);
      if (cloned !== undefined) {
        clean[key] = cloned;
        count += 1;
      }
    }
    return clean;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Strip predicate functions from an intents state so it can survive
  // structured-clone (postMessage). Predicates themselves cannot leave the
  // sandbox where they were created — their closures depend on the sandbox
  // V8 context. We replace each predicate entry with just its
  // `blockPageOnVisit` flag so the host (content script) can still see how
  // many predicates were registered and whether any of them participate in
  // page-block-on-visit decisions.
  // ────────────────────────────────────────────────────────────────────────

  function toSerializableIntents(intentsState) {
    const out = {};
    const stripList = (list) => (Array.isArray(list) ? list : []).map((entry) => ({
      blockPageOnVisit: Boolean(entry && entry.blockPageOnVisit)
    }));
    for (const platform of PLATFORM_LIST) {
      const ps = (intentsState && intentsState[platform]) || {};
      out[platform] = {
        shortButton: ps.shortButton ?? null,
        homePage: ps.homePage ?? null,
        shortsPredicates: stripList(ps.shortsPredicates),
        videosPredicates: stripList(ps.videosPredicates),
        postsPredicates: stripList(ps.postsPredicates)
      };
    }
    return out;
  }

  global.__customBlockerHelpers = {
    PLATFORM_LIST,
    createCustomRuleHelpers,
    compileCustomBlockingRule,
    createEmptyIntentsState,
    createDomainUtility,
    platformUrlOps,
    sanitizeTimersBucket,
    sanitizePersistenceBucket,
    toSerializableIntents
  };
})(typeof self !== "undefined" ? self : globalThis);
