// Last.fm client — browser port of creativeshi's src/lib/spotify.ts.
// All data comes from ws.audioscrobbler.com (Spotify scrobbles there),
// with now-playing detection and placeholder-album-art filtering.

(function () {
  "use strict";

  const LASTFM_API = "https://ws.audioscrobbler.com/2.0";

  const CACHE_KEY = "vibez:lastfm:v3"; // v3: wiped the old small-size art URLs

  function credentials() {
    const lf = (window.SITE_CONFIG && window.SITE_CONFIG.lastfm) || {};
    return { key: lf.apiKey || "", user: lf.username || "" };
  }

  function isConfigured() {
    const { key, user } = credentials();
    return Boolean(key && user);
  }

  async function apiCall(method, extra) {
    const { key, user } = credentials();
    if (!key || !user) return null;

    const url =
      LASTFM_API +
      "?method=" + encodeURIComponent(method) +
      "&user=" + encodeURIComponent(user) +
      "&api_key=" + encodeURIComponent(key) +
      "&format=json&limit=" + (extra.limit || 10) +
      (extra.period ? "&period=" + encodeURIComponent(extra.period) : "");

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function pickImageUrl(imgs) {
    return window.ART_URL.pickImageUrl(imgs);
  }

  function normalizeTrack(raw) {
    return {
      name: raw.name || "Unknown track",
      artist:
        (raw.artist && (raw.artist.name || raw.artist["#text"])) ||
        "Unknown artist",
      album: (raw.album && raw.album["#text"]) || "",
      image: pickImageUrl(raw.image),
      url: raw.url || "",
      nowplaying: Boolean(raw["@attr"] && raw["@attr"].nowplaying === "true"),
      playedAt:
        raw.date && raw.date.uts ? parseInt(raw.date.uts, 10) * 1000 : null,
    };
  }

  function normalizeArtist(raw) {
    return {
      name: raw.name || "Unknown artist",
      playcount: parseInt(raw.playcount, 10) || 0,
      image: pickImageUrl(raw.image),
      url: raw.url || "",
    };
  }

  // ---- cache: one object { ts, tracks, artists } ----

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) || null;
    } catch {
      return null;
    }
  }

  function writeCache(patch) {
    try {
      const data = readCache() || { ts: 0, tracks: [], artists: [] };
      Object.assign(data, patch, { ts: Date.now() });
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* private mode etc. — non-fatal */
    }
  }

  function getCached() {
    return readCache();
  }

  // ---- recent tracks (Now Playing bar, recents popup, card back) ----

  async function fetchRecentTracks(limit) {
    if (!isConfigured()) return null;
    const data = await apiCall("user.getRecentTracks", { limit: limit || 10 });
    if (!data || !data.recenttracks || !Array.isArray(data.recenttracks.track)) {
      return null;
    }
    const tracks = data.recenttracks.track
      .filter(function (t) { return t.name; }) // drop the phantom "now playing" dup row
      .map(normalizeTrack);
    if (tracks.length) writeCache({ tracks: tracks });
    return tracks;
  }

  // ---- top artists (card back, 7-day) ----

  async function fetchTopArtists(limit, period) {
    if (!isConfigured()) return null;
    const data = await apiCall("user.getTopArtists", {
      limit: limit || 5,
      period: period || "7day",
    });
    const list =
      (data && data.topartists && data.topartists.artist) || [];
    const artists = list.map(normalizeArtist);
    if (artists.length) writeCache({ artists: artists });
    return artists;
  }

  // ---- top songs (card back, with play counts) ----

  async function fetchTopTracks(limit, period) {
    if (!isConfigured()) return null;
    const data = await apiCall("user.getTopTracks", {
      limit: limit || 5,
      period: period || "7day",
    });
    const list = (data && data.toptracks && data.toptracks.track) || [];
    const songs = list.map(function (t) {
      return {
        name: t.name || "Unknown track",
        artist:
          (t.artist && (t.artist.name || t.artist["#text"])) ||
          "Unknown artist",
        playcount: parseInt(t.playcount, 10) || 0,
        image: pickImageUrl(t.image),
        url: t.url || "",
      };
    });
    if (songs.length) writeCache({ songs: songs });
    return songs;
  }

  window.lastfm = {
    isConfigured: isConfigured,
    getCached: getCached,
    fetchRecentTracks: fetchRecentTracks,
    fetchTopArtists: fetchTopArtists,
    fetchTopTracks: fetchTopTracks,
    fetchTrackPreview: fetchTrackPreview,
    enrichTracks: enrichTracks,
    enrichArtists: enrichArtists,
  };

  // ---- artwork ----
  // Last.fm has no covers for a lot of underground music (it serves a fixed
  // placeholder, which pickImageUrl rejects). The iTunes Search API is public,
  // CORS-enabled and usually has them. Results are cached forever in
  // localStorage — a cover for a given track/artist never changes.

  const ART_KEY = "vibez:artwork:v3"; // v3: dual-provider chain (wipes poisoned miss cache)
  const ART_MISS_TTL = 60 * 60 * 1000; // retry failed lookups after an hour
  const artCache = {}; // lazy-loaded from localStorage
  let artLoaded = false;
  const inflightArt = {}; // dedupe concurrent identical lookups

  function loadArtCache() {
    if (artLoaded) return artCache;
    artLoaded = true;
    try {
      Object.assign(artCache, JSON.parse(localStorage.getItem(ART_KEY)) || {});
    } catch {
      /* keep empty */
    }
    return artCache;
  }

  function saveArtCache() {
    try {
      localStorage.setItem(ART_KEY, JSON.stringify(artCache));
    } catch {
      /* non-fatal */
    }
  }

  async function getJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function upsize(url) {
    // request artwork close to its rendered size (~2× the largest 44px slot
    // at 2× DPI). WebKit looks mushy when downsampling a big source (300px)
    // into a tiny box — a near-size source stays crisp in Safari.
    return url ? url.replace(/\/\d+x\d+bb\.jpg$/, "/200x200bb.jpg") : "";
  }

  async function itunesTrackArt(query) {
    const data = await getJSON(
      "https://itunes.apple.com/search?media=music&entity=song&limit=1&term=" +
        encodeURIComponent(query)
    );
    const hit = data && data.results && data.results[0];
    return upsize(hit && hit.artworkUrl100);
  }

  async function itunesArtistArt(name) {
    // song search can return "feat. X" covers by the wrong artist — resolve
    // the actual artist entity first, then pull their top song's cover
    const s = await getJSON(
      "https://itunes.apple.com/search?media=music&entity=musicArtist&limit=1&term=" +
        encodeURIComponent(name)
    );
    const hit = s && s.results && s.results[0];
    if (!hit || !hit.artistId) return "";
    const l = await getJSON(
      "https://itunes.apple.com/lookup?id=" + hit.artistId + "&entity=song&limit=1"
    );
    const song =
      l && l.results && l.results.find(function (x) { return x.kind === "song"; });
    return upsize(song && song.artworkUrl100);
  }

  // ---- Deezer fallback (JSONP) ----
  // itunes.apple.com is unreachable for some iOS visitors (Private Relay /
  // content blockers). api.deezer.com sends no CORS header, but its JSONP
  // mode works everywhere, so it doubles as the mobile-safe provider.

  let jsonpSeq = 0;

  function jsonp(url) {
    return new Promise(function (resolve) {
      const cb = "__vibezjsonp" + (++jsonpSeq);
      const script = document.createElement("script");
      const timer = setTimeout(function () {
        cleanup();
        resolve(null);
      }, 6000);
      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      }
      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };
      script.onerror = function () {
        cleanup();
        resolve(null);
      };
      script.src =
        url + (url.indexOf("?") === -1 ? "?" : "&") +
        "output=jsonp&callback=" + cb;
      document.head.appendChild(script);
    });
  }

  async function deezerTrackArt(query) {
    const data = await jsonp(
      "https://api.deezer.com/search?q=" + encodeURIComponent(query) + "&limit=1"
    );
    const hit = data && data.data && data.data[0];
    const cover = hit && hit.album;
    return (cover && (cover.cover_big || cover.cover_medium)) || "";
  }

  async function deezerArtistArt(name) {
    const data = await jsonp(
      "https://api.deezer.com/search/artist?q=" + encodeURIComponent(name) + "&limit=1"
    );
    const hit = data && data.data && data.data[0];
    return (hit && (hit.picture_big || hit.picture_medium)) || "";
  }

  // ---- 30s preview streams ----
  // The Deezer track response carries a signed ~30s mp3 preview, so the
  // site can play what was actually last scrobbled instead of the local
  // mp3s. Preview URLs are time-limited (signed) — fetch fresh each page
  // load, keep in memory only.

  async function fetchTrackPreview(name, artist) {
    const data = await jsonp(
      "https://api.deezer.com/search?q=" +
        encodeURIComponent(name + " " + artist) +
        "&limit=1"
    );
    const hit = data && data.data && data.data[0];
    return (hit && hit.preview) || "";
  }

  async function lookupTrackArt(name, artist) {
    const q = name + " " + artist;
    return (
      (await itunesTrackArt(q)) ||
      (await deezerTrackArt(q)) ||
      ""
    );
  }

  async function lookupArtistArt(name) {
    return (await itunesArtistArt(name)) || (await deezerArtistArt(name)) || "";
  }

  function lookupArtwork(kind, name, artist) {
    const cache = loadArtCache();
    const key = kind + ":" + name.toLowerCase() + "|" + (artist || "").toLowerCase();
    const hit = cache[key];
    if (hit) {
      if (typeof hit === "string") return Promise.resolve(hit);
      // negative cache: a miss is remembered for an hour so tracks without
      // art anywhere don't hammer the providers on every poll
      if (typeof hit === "object" && Date.now() - hit.err < ART_MISS_TTL) {
        return Promise.resolve("");
      }
    }
    if (inflightArt[key]) return inflightArt[key];

    const promise = (kind === "artist"
      ? lookupArtistArt(name)
      : lookupTrackArt(name, artist)
    )
      .then(function (url) {
        delete inflightArt[key];
        cache[key] = url || { err: Date.now() };
        saveArtCache();
        return url;
      })
      .catch(function () {
        delete inflightArt[key];
        return "";
      });

    inflightArt[key] = promise;
    return promise;
  }

  async function enrichTracks(tracks) {
    if (!tracks) return tracks;
    for (const t of tracks) {
      if (!t.image && t.name) {
        t.image = await lookupArtwork("track", t.name, t.artist);
      }
    }
    return tracks;
  }

  async function enrichArtists(artists) {
    if (!artists) return artists;
    for (const a of artists) {
      if (!a.image && a.name) {
        a.image = await lookupArtwork("artist", a.name);
      }
    }
    return artists;
  }
})();
