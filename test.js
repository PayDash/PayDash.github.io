// Sanity tests for the pure artwork-URL helpers (js/arturl.js).
// Run: node test.js
// These guard against ordering/URL regressions like the 34×34 thumbnail bug.

global.window = {};
require("./js/arturl.js");
const A = global.window.ART_URL;
const assert = require("assert");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}

const APPLE =
  "https://is1-ssl.mzstatic.com/image/thumb/Music/x/y/cover.jpg/200x200bb.jpg";
const LASTFM =
  "https://lastfm-img.freetls.fastly.net/i/u/300x300/364225fe.jpg";
const LASTFM_LARGE =
  "https://lastfm-img.freetls.fastly.net/i/u/174s/364225fe.jpg";
const PLACEHOLDER =
  "https://lastfm-img.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";

// ---- pickImageUrl: biggest rendition wins ----
test("pickImageUrl prefers extralarge over small", () => {
  assert.strictEqual(
    A.pickImageUrl([
      { size: "small", "#text": "https://x/34s/a.jpg" },
      { size: "extralarge", "#text": "https://x/300x300/a.jpg" },
    ]),
    "https://x/300x300/a.jpg"
  );
});

test("pickImageUrl rejects the Last.fm placeholder image", () => {
  assert.strictEqual(A.pickImageUrl([{ size: "extralarge", "#text": PLACEHOLDER }]), "");
});

test("pickImageUrl returns '' for empty input", () => {
  assert.strictEqual(A.pickImageUrl([]), "");
  assert.strictEqual(A.pickImageUrl(undefined), "");
});

test("pickImageUrl falls back to smaller sizes when big ones are placeholders", () => {
  assert.strictEqual(
    A.pickImageUrl([
      { size: "extralarge", "#text": PLACEHOLDER },
      { size: "medium", "#text": "https://x/64s/a.jpg" },
    ]),
    "https://x/64s/a.jpg"
  );
});

// ---- artSrcSet: density-matched candidates per CDN ----
test("artSrcSet builds 200/400 for Apple URLs", () => {
  assert.strictEqual(
    A.artSrcSet(APPLE),
    APPLE.replace("200x200bb", "200x200bb") + " 1x, " +
      APPLE.replace("200x200bb", "400x400bb") + " 2x"
  );
});

test("artSrcSet builds 300/600 for Last.fm URLs (even /174s/)", () => {
  assert.strictEqual(
    A.artSrcSet(LASTFM),
    LASTFM.replace("300x300", "300x300") + " 1x, " +
      LASTFM.replace("300x300", "600x600") + " 2x"
  );
  assert.ok(A.artSrcSet(LASTFM_LARGE).includes("/i/u/300x300/"));
  assert.ok(A.artSrcSet(LASTFM_LARGE).includes("/i/u/600x600/"));
});

test("artSrcSet returns null for unknown URLs (crazy-cat gif)", () => {
  assert.strictEqual(A.artSrcSet("assets/crazy-cat.gif"), null);
  assert.strictEqual(A.artSrcSet(""), null);
});

// ---- Deezer CDN branch ----
const DEEZER =
  "https://cdn-images.dzcdn.net/images/cover/582a0cc292c2e45fe73c8305945d54f4/500x500-000000-80-0-0.jpg";

test("artSrcSet builds 250/500 for Deezer URLs", () => {
  assert.strictEqual(
    A.artSrcSet(DEEZER),
    DEEZER.replace("500x500", "250x250") + " 1x, " + DEEZER + " 2x"
  );
});

test("baseSrc normalizes Deezer URLs to 500x500", () => {
  const xl = DEEZER.replace("500x500", "1000x1000");
  assert.strictEqual(A.baseSrc(DEEZER), DEEZER);
  assert.strictEqual(A.baseSrc(xl), DEEZER);
});

// ---- baseSrc: base src is never upscaled ----
test("baseSrc rewrites Apple URLs to 400x400", () => {
  assert.strictEqual(A.baseSrc(APPLE), APPLE.replace("200x200bb", "400x400bb"));
});

test("baseSrc rewrites Last.fm URLs to 600x600", () => {
  assert.strictEqual(A.baseSrc(LASTFM), LASTFM.replace("300x300", "600x600"));
  assert.strictEqual(A.baseSrc(LASTFM_LARGE), LASTFM_LARGE.replace("174s", "600x600"));
});

test("baseSrc passes unknown URLs through untouched", () => {
  assert.strictEqual(A.baseSrc("assets/crazy-cat.gif"), "assets/crazy-cat.gif");
});

console.log("\n✓ " + passed + " tests passed");
