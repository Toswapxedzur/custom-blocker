// Custom Web Blocker — feed / shorts hiding templates.
//
// Two flavours of feed-trimming exist:
//
// 1. URL gate: openWebEvent + switchWebEvent that calls
//    preventDefault() when the URL itself is a Shorts/Reels page,
//    so navigation never resolves.
//
// 2. DOM filter: webChangedEvent that uses
//    helpers.getPlatformHelper().<site>().hideShorts(predicate, opts)
//    or .hideFeed(predicate, opts) to remove items from the live
//    feed. predicate receives a {title} object and decides whether
//    to keep the entry. The platform helper installs a single
//    MutationObserver per page; the registry de-duplicates calls.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "youtube-shorts-block-page",
      title: "Block YouTube Shorts URLs Outright",
      description: "Hard-block any /shorts/ URL on YouTube. Visiting one bounces you off the page; the rest of YouTube is untouched.",
      tags: ["feed", "shorts", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();
  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("yt-shorts-page-block", maybeBlock);
  event.registerSwitchWebEvent("yt-shorts-page-block", maybeBlock);
}`;
      }
    },
    {
      id: "youtube-shorts-hide-feed",
      title: "Hide YouTube Shorts From Home Feed",
      description: "Remove Shorts cards from the YouTube home page and search results. Long-form videos are untouched.",
      tags: ["feed", "shorts", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-yt-shorts", (ev, h) => {
    h.getPlatformHelper().youtube().hideShorts(() => true);
  });
}`;
      }
    },
    {
      id: "youtube-hide-shorts-by-keyword",
      title: "Hide YouTube Shorts By Keyword",
      description: "Hide Shorts whose title contains any of the comma-separated keywords. Useful for a soft filter on emotionally loaded topics.",
      tags: ["feed", "shorts", "youtube"],
      params: [
        { id: "keywordsCsv", label: "Keywords (comma separated)", type: "text", span: 2, defaultValue: "drama,react,prank" }
      ],
      buildCode(values) {
        const items = String(values.keywordsCsv || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => quoteJs(s.toLowerCase()))
          .join(", ");
        return `(event, helpers) => {
  const KEYWORDS = [${items}];
  event.registerWebChangedEvent("hide-yt-shorts-keyword", (ev, h) => {
    h.getPlatformHelper().youtube().hideShorts((video) => {
      const title = String(video?.title || "").toLowerCase();
      return KEYWORDS.some((k) => title.includes(k));
    });
  });
}`;
      }
    },
    {
      id: "youtube-hide-home-feed",
      title: "Hide YouTube Home Feed",
      description: "Strip the recommendations grid from the YouTube home page. You can still search and visit channels — only the feed is gone.",
      tags: ["feed", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-yt-home-feed", (ev, h) => {
    if (!h.getDomainHelper().isYouTubeHost(h.getDomainHelper().hostnameOf(ev.url))) return;
    h.getDOMHelper().hide("ytd-rich-grid-renderer");
    h.getDOMHelper().hide("ytd-browse[page-subtype='home']");
  });
}`;
      }
    },
    {
      id: "youtube-hide-comments",
      title: "Hide YouTube Comments",
      description: "Hide the comment section under videos so you can watch without the doomscrolling tail.",
      tags: ["feed", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-yt-comments", (ev, h) => {
    if (!h.getDomainHelper().isYouTubeHost(h.getDomainHelper().hostnameOf(ev.url))) return;
    h.getDOMHelper().hide("ytd-comments");
    h.getDOMHelper().hide("#comments");
  });
}`;
      }
    },
    {
      id: "youtube-hide-trending",
      title: "Hide YouTube Trending Tab",
      description: "Hide the Trending sidebar link and the Trending page itself.",
      tags: ["feed", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-yt-trending", (ev, h) => {
    if (!h.getDomainHelper().isYouTubeHost(h.getDomainHelper().hostnameOf(ev.url))) return;
    h.getDOMHelper().hide("a[href='/feed/trending']");
  });
}`;
      }
    },
    {
      id: "tiktok-block-fyp",
      title: "Block TikTok For You Page",
      description: "Hard-block /foryou and the TikTok home page. Profiles and direct video links are still reachable.",
      tags: ["feed", "shorts", "tiktok"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!url.includes("tiktok.com")) return;
    if (!/\\/foryou|^https?:\\/\\/(www\\.)?tiktok\\.com\\/?$/.test(url)) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("tt-fyp-block", maybeBlock);
  event.registerSwitchWebEvent("tt-fyp-block", maybeBlock);
}`;
      }
    },
    {
      id: "tiktok-hide-shorts",
      title: "Hide TikTok Short Videos",
      description: "Remove every short-video card from the TikTok feed using the platform helper. Profile pages still render normally.",
      tags: ["feed", "shorts", "tiktok"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-tt-shorts", (ev, h) => {
    h.getPlatformHelper().tiktok().hideShorts(() => true);
  });
}`;
      }
    },
    {
      id: "instagram-block-reels",
      title: "Block Instagram Reels URLs",
      description: "Hard-block /reels/ pages on Instagram. Profiles and DMs are unaffected.",
      tags: ["feed", "shorts", "instagram"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  const ig = helpers.getDomainHelper().instagram();
  function maybeBlock(ev) {
    if (!ig.isShortUrl(ev.url)) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("ig-reels-block", maybeBlock);
  event.registerSwitchWebEvent("ig-reels-block", maybeBlock);
}`;
      }
    },
    {
      id: "instagram-hide-reels-feed",
      title: "Hide Instagram Reels From Feed",
      description: "Remove Reels carousels from the Instagram timeline so you only see static posts.",
      tags: ["feed", "shorts", "instagram"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-ig-reels", (ev, h) => {
    h.getPlatformHelper().instagram().hideShorts(() => true);
  });
}`;
      }
    },
    {
      id: "facebook-hide-feed",
      title: "Hide Facebook News Feed",
      description: "Strip the Facebook home news feed. You can still use Messenger, groups, and direct profile links.",
      tags: ["feed", "facebook"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-fb-feed", (ev, h) => {
    if (!h.getDomainHelper().isFacebookHost(h.getDomainHelper().hostnameOf(ev.url))) return;
    h.getDOMHelper().hide("[role='feed']");
  });
}`;
      }
    },
    {
      id: "facebook-hide-reels",
      title: "Hide Facebook Reels",
      description: "Hide Reels content in the Facebook feed.",
      tags: ["feed", "shorts", "facebook"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-fb-reels", (ev, h) => {
    h.getPlatformHelper().facebook().hideShorts(() => true);
  });
}`;
      }
    },
    {
      id: "reddit-hide-home",
      title: "Hide Reddit Home Feed",
      description: "Hide the front-page feed on reddit.com. Subreddits and direct post links keep working.",
      tags: ["feed", "reddit"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-reddit-home", (ev, h) => {
    const url = String(ev.url || "");
    if (!url.includes("reddit.com")) return;
    if (!/reddit\\.com\\/?(\\?|#|$)/.test(url)) return;
    h.getDOMHelper().hide("shreddit-feed");
    h.getDOMHelper().hide("[data-testid='posts-list']");
  });
}`;
      }
    },
    {
      id: "twitter-hide-home",
      title: "Hide Twitter / X Timeline",
      description: "Hide the Twitter/X home timeline. Profile, search, and DMs continue to work.",
      tags: ["feed", "twitter"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-twitter-home", (ev, h) => {
    const url = String(ev.url || "");
    if (!/twitter\\.com|x\\.com/.test(url)) return;
    if (!/(twitter|x)\\.com\\/home/.test(url)) return;
    h.getDOMHelper().hide("[aria-label='Timeline: Your Home Timeline']");
    h.getDOMHelper().hide("[data-testid='primaryColumn']");
  });
}`;
      }
    },
    {
      id: "twitter-hide-trending",
      title: "Hide Twitter / X Trending Sidebar",
      description: "Just hide the right-rail trending widget so you stop reading bait headlines while composing tweets.",
      tags: ["feed", "twitter"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-twitter-trending", (ev, h) => {
    const url = String(ev.url || "");
    if (!/twitter\\.com|x\\.com/.test(url)) return;
    h.getDOMHelper().hide("[aria-label='Timeline: Trending now']");
  });
}`;
      }
    },
    {
      id: "linkedin-hide-feed",
      title: "Hide LinkedIn Feed",
      description: "Hide the LinkedIn news feed but leave messaging, profile, and search functional.",
      tags: ["feed", "site"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-linkedin-feed", (ev, h) => {
    if (!String(ev.url || "").includes("linkedin.com")) return;
    h.getDOMHelper().hide("main[aria-label='Main Feed']");
    h.getDOMHelper().hide("div.scaffold-finite-scroll");
  });
}`;
      }
    }
  ]);
})();
