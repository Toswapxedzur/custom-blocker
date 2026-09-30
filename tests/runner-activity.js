// Unit tests for the pure helpers in vault-activity.js (the web-visit dwell
// math, domain extraction, and buffer bounding). The chrome/hub-driven parts of
// cbActivity are exercised by the live E2E on the mini1 rig.
"use strict";

const path = require("path");
const {
  cbActivityDomainOf, cbActivityMakeVisit, cbActivityBoundBuffer,
  cbActivityIconAccepted, cbActivityIconsToSend, CB_ACTIVITY_MAX_ICON_BYTES,
} = require(path.join(__dirname, "..", "vault-activity.js"));

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) { pass += 1; console.log(`PASS ${label}`); }
  else { fail += 1; console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function eq(label, a, b) { check(label, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`); }

// contentFor (vault-activity-content.js): which one piece of content an address shows.
globalThis.VaultClassifierExtensionContract = {
  youtubeVideoIDFromURL: (href) => { const m = String(href).match(/[?&]v=([A-Za-z0-9_-]{11})/); return m ? m[1] : null; },
};
require(path.join(__dirname, "..", "vault-activity-content.js"));
const contentFor = globalThis.VaultActivityContent.contentFor;
const piece = (platform, href, title) => { const c = contentFor(platform, href, title); return c && [c.key, c.label, c.video]; };
eq("youtube watch", piece("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Song - YouTube"), ["youtube:dQw4w9WgXcQ", "Song", true]);
eq("youtube feed is no one piece", piece("youtube", "https://www.youtube.com/", "YouTube"), null);
eq("bilibili video", piece("bilibili", "https://www.bilibili.com/video/BV1xx411c7mD/", "标题_哔哩哔哩_bilibili"), ["bilibili:BV1xx411c7mD", "标题", true]);
eq("twitch live channel", piece("twitch", "https://www.twitch.tv/Shroud", "shroud - Twitch"), ["twitch:shroud", "shroud", true]);
eq("twitch past video", piece("twitch", "https://www.twitch.tv/videos/123456", "Stream - Twitch"), ["twitch:video:123456", "Stream", true]);
eq("twitch directory is no one piece", piece("twitch", "https://www.twitch.tv/directory", "Twitch"), null);
eq("reddit post", piece("reddit", "https://www.reddit.com/r/Brawlstars/comments/1abcde/new_brawler/", "New brawler : r/Brawlstars"), ["reddit:1abcde", "New brawler", false]);
eq("reddit subreddit feed is no one piece", piece("reddit", "https://www.reddit.com/r/Brawlstars/", "r/Brawlstars"), null);
eq("x post", piece("twitter", "https://x.com/ClashReport/status/1840000000000000000", "Clash Report on X: \"news\" / X"), ["twitter:1840000000000000000", "Clash Report on X: \"news\"", false]);
eq("instagram reel", piece("instagram", "https://www.instagram.com/reel/C9abcdef/", "Reel • Instagram"), ["instagram:C9abcdef", "Reel", false]);
eq("facebook watch", piece("facebook", "https://www.facebook.com/watch/?v=10150000000", "Video | Facebook"), ["facebook:10150000000", "Video", false]);
eq("facebook post", piece("facebook", "https://www.facebook.com/somepage/posts/pfbid02abcDEF", "Post | Facebook"), ["facebook:pfbid02abcDEF", "Post", false]);
eq("discord channel", piece("discord", "https://discord.com/channels/111/222", "Discord | #general | Server"), ["discord:111/222", "#general | Server", false]);
eq("discord direct messages are not recorded", piece("discord", "https://discord.com/channels/@me/333", "Discord"), null);

// domainOf
eq("domain strips www", cbActivityDomainOf("https://www.youtube.com/watch?v=x"), "youtube.com");
eq("domain keeps subdomain", cbActivityDomainOf("https://m.bilibili.com/x"), "m.bilibili.com");
eq("domain rejects non-http", cbActivityDomainOf("chrome://extensions"), null);
eq("domain rejects garbage", cbActivityDomainOf("not a url"), null);
eq("domain rejects empty", cbActivityDomainOf(""), null);

// makeVisit
const visit = cbActivityMakeVisit(
  { domain: "youtube.com", startMs: 1000, tabId: 5 },
  1000 + 30000,
  { minMs: 2000, makeId: () => "fixed" }
);
eq("visit id", visit.id, "fixed");
eq("visit category", visit.category, "web-visit");
eq("visit seconds", visit.seconds, 30);
eq("visit startedAtMs", visit.startedAtMs, 1000);
eq("visit key/label", [visit.key, visit.label], ["youtube.com", "youtube.com"]);

check("visit below min dwell is dropped",
  cbActivityMakeVisit({ domain: "x.com", startMs: 0 }, 1000, { minMs: 2000 }) === null);
check("visit with no domain is dropped",
  cbActivityMakeVisit({ startMs: 0 }, 999999, { minMs: 2000 }) === null);
check("visit from null session is null", cbActivityMakeVisit(null, 1) === null);

// boundBuffer
eq("buffer under cap unchanged", cbActivityBoundBuffer([1, 2, 3], 5), [1, 2, 3]);
eq("buffer over cap drops oldest", cbActivityBoundBuffer([1, 2, 3, 4, 5], 3), [3, 4, 5]);
eq("buffer non-array coerced", cbActivityBoundBuffer(undefined, 3), []);

// favicons: the extension keeps exactly what Mac Vault keeps (its cap is the
// whole data URI, ActivityStore.maxWebIconBytes = 24000).
const png = (bytes) => "data:image/png;base64," + "A".repeat(bytes - "data:image/png;base64,".length);
eq("icon cap matches Mac Vault", CB_ACTIVITY_MAX_ICON_BYTES, 24000);
check("icon at the cap is kept", cbActivityIconAccepted(png(24000)));
check("icon over the cap is refused", !cbActivityIconAccepted(png(24001)));
check("a non-image is refused", !cbActivityIconAccepted("data:text/html;base64,AAAA"));
check("a URL is refused", !cbActivityIconAccepted("https://example.com/favicon.ico"));
const pending = { "a.com": png(100), "b.com": "data:text/html,x", "c.com": png(100), "d.com": png(100) };
eq("send picks accepted icons, oldest first, up to the limit", Object.keys(cbActivityIconsToSend(pending, 2)), ["a.com", "c.com"]);
eq("send with nothing pending", cbActivityIconsToSend(undefined, 20), {});

console.log(`ACTIVITY TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
if (fail === 0) console.log("__CB_TEST_RESULT__: OK");
process.exit(fail === 0 ? 0 : 1);
