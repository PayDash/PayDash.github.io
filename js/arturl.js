// Pure artwork-URL helpers — no DOM. Tested by test.js (`node test.js`).
// Both music CDNs serve arbitrary renditions, so the site rewrites one
// known-good URL into the pixel-density-matched size it needs:
//   Apple   /…/cover.jpg/<N>x<N>bb.jpg
//   Last.fm /i/u/<size>/<hash>.jpg

(function () {
  "use strict";

  // Last.fm serves this fixed image when no art exists — skip it.
  const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

  function pickImageUrl(imgs) {
    // biggest rendition first — "small" is literally 34×34 and upscaled
    // small art is exactly what made thumbnails look pixelated
    const sizes = ["mega", "extralarge", "large", "medium", "small"];
    for (const sz of sizes) {
      const entry = (imgs || []).find(function (i) { return i.size === sz; });
      const url = (entry && entry["#text"]) || "";
      if (url && url.indexOf(PLACEHOLDER_HASH) === -1) return url;
    }
    return "";
  }

  function artSrcSet(url) {
    if (!url) return null;
    if (/\/\d+x\d+bb\.jpg$/.test(url)) {
      const size = function (n) {
        return url.replace(/\/\d+x\d+bb\.jpg$/, "/" + n + "x" + n + "bb.jpg");
      };
      return size(200) + " 1x, " + size(400) + " 2x";
    }
    if (/\/i\/u\/(300x300|\d+s)\//.test(url)) {
      const size = function (n) {
        return url.replace(/\/i\/u\/[^/]+\//, "/i/u/" + n + "x" + n + "/");
      };
      return size(300) + " 1x, " + size(600) + " 2x";
    }
    if (/\/\d+x\d+-000000-80-0-0\.jpg$/.test(url)) {
      // Deezer CDN — cover_big / picture_big are stored at 500
      const size = function (n) {
        return url.replace(
          /\/\d+x\d+-000000-80-0-0\.jpg$/,
          "/" + n + "x" + n + "-000000-80-0-0.jpg"
        );
      };
      return size(250) + " 1x, " + size(500) + " 2x";
    }
    return null;
  }

  // base src: bigger than any slot's device-pixel need, never upscaled
  function baseSrc(url) {
    if (!url) return url;
    if (/\/\d+x\d+bb\.jpg$/.test(url)) {
      return url.replace(/\/\d+x\d+bb\.jpg$/, "/400x400bb.jpg");
    }
    if (/\/i\/u\/(300x300|\d+s)\//.test(url)) {
      return url.replace(/\/i\/u\/[^/]+\//, "/i/u/600x600/");
    }
    if (/\/\d+x\d+-000000-80-0-0\.jpg$/.test(url)) {
      return url.replace(
        /\/\d+x\d+-000000-80-0-0\.jpg$/,
        "/500x500-000000-80-0-0.jpg"
      );
    }
    return url;
  }

  window.ART_URL = {
    pickImageUrl: pickImageUrl,
    artSrcSet: artSrcSet,
    baseSrc: baseSrc,
  };
})();
