// UI wiring: typewriter, audio player (local playlist), custom volume
// slider, draggable card, music activity panel, GitHub strip.

(function () {
  "use strict";

  // ---------- helpers ----------

  function timeAgo(ts) {
    if (!ts) return "";
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.floor(hours / 24);
    if (days < 7) return days + "d ago";
    return Math.floor(days / 7) + "w ago";
  }

  const LANG_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Python: "#3572A5",
    Lua: "#000080",
    Java: "#b07219",
    "C#": "#178600",
    C: "#555555",
    "C++": "#f34b7d",
    Go: "#00ADD8",
    Rust: "#dea584",
    Shell: "#89e051",
    GLSL: "#5686a5",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
  };

  function langColor(lang) {
    return LANG_COLORS[lang] || "#8b8b8b";
  }

  function el(id) {
    return document.getElementById(id);
  }

  // ---------- typewriter (port of the original TxtType) ----------

  function TxtType(elm, toRotate, period) {
    this.toRotate = toRotate;
    this.el = elm;
    this.loopNum = 0;
    this.period = parseInt(period, 10) || 1000;
    this.txt = "";
    this.isDeleting = false;
    this.messages = this.toRotate[this.loopNum]
      .split("|")
      .map(function (m) { return m.replace(/!br!/g, "<br/>"); });
    this.messageIndex = 0;
    this.tick();
  }

  TxtType.prototype.tick = function () {
    const fullTxt = this.messages[this.messageIndex];

    if (this.isDeleting) {
      if (this.txt.endsWith("<br/>")) {
        this.txt = this.txt.substring(0, this.txt.lastIndexOf("<"));
      } else {
        this.txt = fullTxt.substring(0, this.txt.length - 1);
      }
    } else {
      if (fullTxt.substring(this.txt.length, this.txt.length + 5) === "<br/>") {
        this.txt += "<br/>";
      } else {
        this.txt = fullTxt.substring(0, this.txt.length + 1);
      }
    }

    this.el.innerHTML = '<span class="wrap">' + this.txt + "</span>";

    const that = this;
    let delta = 200 - Math.random() * 100;

    if (this.isDeleting) {
      delta /= 4;
      if (this.txt === "") {
        this.isDeleting = false;
        if (++this.messageIndex >= this.messages.length) {
          this.messageIndex = 0;
          this.loopNum++;
          if (this.loopNum >= this.toRotate.length) this.loopNum = 0;
          this.messages = this.toRotate[this.loopNum]
            .split("|")
            .map(function (m) { return m.replace(/!br!/g, "<br/>"); });
        }
        delta = 500;
      }
    }

    if (!this.isDeleting && this.txt === fullTxt) {
      delta = this.period;
      this.isDeleting = true;
    }

    setTimeout(function () { that.tick(); }, delta);
  };

  function initTypewriters() {
    const elements = document.getElementsByClassName("typewrite");
    for (let i = 0; i < elements.length; i++) {
      const raw = elements[i].getAttribute("data-type");
      const period = elements[i].getAttribute("data-period");
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      new TxtType(elements[i], parsed, period);
    }
  }

  // ---------- audio player (random local track, loops forever) ----------

  const audio = el("audio");
  const playlist = (window.SITE_CONFIG && window.SITE_CONFIG.playlist) || [];

  function playRandomTrack() {
    if (!playlist.length) return;
    const next = playlist[Math.floor(Math.random() * playlist.length)];
    if (audio.src !== new URL(next, location.href).href) {
      audio.src = next;
      audio.load();
    } else {
      audio.currentTime = 0;
    }
    audio.play().catch(function () { /* gesture gate — fine */ });
  }

  // ---------- custom volume slider ----------

  const volume = { value: 0.5, muted: false };
  const volWrap = el("volume-wrap");
  const volTrack = el("vol-track");
  const volFill = el("vol-fill");
  const volThumb = el("vol-thumb");
  const volTip = el("vol-tip");
  const volBtn = el("vol-btn");
  const volIconOn = el("vol-icon-on");
  const volIconOff = el("vol-icon-off");

  function renderVolume() {
    const pct = Math.round(volume.value * 100);
    const effective = volume.muted ? 0 : volume.value;
    audio.volume = effective;
    audio.muted = volume.muted;

    volFill.style.width = pct + "%";
    volThumb.style.left = pct + "%";
    volTip.textContent = volume.muted ? "muted" : pct + "%";
    volTip.style.left = pct + "%";

    volIconOn.style.display = volume.muted || pct === 0 ? "none" : "block";
    volIconOff.style.display = volume.muted || pct === 0 ? "block" : "none";
    volBtn.classList.toggle("muted", volume.muted || pct === 0);
  }

  function setVolumeFromPointer(event) {
    const rect = volTrack.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    volume.value = ratio;
    if (volume.muted && ratio > 0) volume.muted = false;
    renderVolume();
  }

  function initVolumeSlider() {
    volTrack.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      volWrap.classList.add("dragging");
      volTrack.setPointerCapture(e.pointerId);
      setVolumeFromPointer(e);
    });

    volTrack.addEventListener("pointermove", function (e) {
      if (volWrap.classList.contains("dragging")) setVolumeFromPointer(e);
    });

    volTrack.addEventListener("pointerup", function () {
      volWrap.classList.remove("dragging");
    });
    volTrack.addEventListener("pointercancel", function () {
      volWrap.classList.remove("dragging");
    });

    volBtn.addEventListener("click", function () {
      volume.muted = !volume.muted;
      renderVolume();
    });

    renderVolume();
  }

  // ---------- draggable card ----------

  function initDrag() {
    const card = document.querySelector(".border");
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;

    card.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a, button, .volume-wrap, input, .card-back")) return;
      if (e.pointerType === "touch") return; // mobile: no drag, touch = scroll/tap only
      if (e.button !== 0 && e.pointerType === "mouse") return;

      // first drag: switch from translate(-50%,-50%) to absolute px,
      // otherwise the transform offsets every move
      if (card.style.transform !== "none") {
        const rect = card.getBoundingClientRect();
        card.style.transform = "none";
        card.style.left = rect.left + "px";
        card.style.top = rect.top + "px";
      }

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = parseFloat(card.style.left);
      origY = parseFloat(card.style.top);
      card.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    card.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const x = Math.min(window.innerWidth - w * 0.35, Math.max(-w * 0.65, origX + dx));
      const y = Math.min(window.innerHeight - 30, Math.max(0, origY + dy));
      card.style.left = x + "px";
      card.style.top = y + "px";
    });

    card.addEventListener("pointerup", function () { dragging = false; });
    card.addEventListener("pointercancel", function () { dragging = false; });
  }

  // ---------- card flip ----------

  const cardFlip = el("card-flip");
  const flipBtn = el("flip-btn");
  const flipBackBtn = el("flip-back-btn");

  function toggleFlip(force) {
    const showBack =
      force !== undefined ? force : !cardFlip.classList.contains("flipped");
    cardFlip.classList.toggle("flipped", showBack);
    flipBtn.setAttribute("aria-expanded", String(showBack));
  }

  function initFlip() {
    flipBtn.addEventListener("click", function () { toggleFlip(); });
    flipBackBtn.addEventListener("click", function () { toggleFlip(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") toggleFlip(false);
    });
  }

  // ---------- music activity panel (card back) ----------

  const FALLBACK_ART =
    (window.SITE_CONFIG && window.SITE_CONFIG.fallbackArt) ||
    "assets/crazy-cat.gif";

  // Pixel-density matched renditions live in js/arturl.js (tested by
  // test.js) — Apple 200/400, Last.fm 300/600, base never upscaled.
  const artSrcSet = function (url) { return window.ART_URL.artSrcSet(url); };
  const baseSrc = function (url) { return window.ART_URL.baseSrc(url); };

  function setArt(imgEl, fallbackEl, src) {
    const use = src || FALLBACK_ART;
    if (use) {
      imgEl.style.display = "block";
      fallbackEl.style.display = "none";
      const srcset = artSrcSet(use);
      if (srcset) {
        imgEl.srcset = srcset;
        imgEl.src = baseSrc(use); // bigger than any slot's device-pixel need
      } else {
        imgEl.srcset = "";
        imgEl.src = use; // crazy cat gif — single file
      }
      imgEl.onerror = function () {
        if (imgEl.getAttribute("src") === use && use !== FALLBACK_ART) {
          imgEl.srcset = "";
          imgEl.src = FALLBACK_ART; // one retry with the crazy cat before giving up
          return;
        }
        imgEl.style.display = "none"; // even the cat failed → ♪ glyph
        fallbackEl.style.display = "flex";
      };
    } else {
      imgEl.style.display = "none";
      fallbackEl.style.display = "flex";
    }
  }

  // ---------- recent-track rows (card back) ----------

  function buildRecentRow(t) {
    const row = document.createElement(t.url ? "a" : "div");
    if (t.url) {
      row.href = t.url;
      row.target = "_blank";
      row.rel = "noopener noreferrer";
    }
    row.className = "recent-row";

    const art = document.createElement("img");
    art.className = "recent-art";
    art.alt = "";
    art.loading = "lazy";

    const artFallback = document.createElement("span");
    artFallback.className = "recent-art-fallback";
    artFallback.textContent = "♪";
    setArt(art, artFallback, t.image);

    const meta = document.createElement("span");
    meta.className = "recent-meta";
    meta.innerHTML =
      '<span class="recent-title"></span><span class="recent-artist"></span>';
    meta.querySelector(".recent-title").textContent = t.name;
    meta.querySelector(".recent-artist").textContent = t.artist;

    const when = document.createElement("span");
    when.className = "recent-when";
    when.textContent = t.nowplaying ? "now" : timeAgo(t.playedAt);

    row.appendChild(art);
    row.appendChild(artFallback);
    row.appendChild(meta);
    row.appendChild(when);
    return row;
  }

  // ---------- card back: music activity panel ----------

  const backArt = el("back-art");
  const backArtFallback = el("back-art-fallback");
  const backTag = el("back-np-tag");
  const backTitle = el("back-np-title");
  const backArtist = el("back-np-artist");
  const backEq = el("back-eq");
  const backArtists = el("back-artists");
  const backRecents = el("back-recents");
  const backSongs = el("back-songs");

  function renderBackNP(track) {
    const playing = Boolean(track.nowplaying);
    backTag.textContent = playing ? "NOW PLAYING" : "LAST PLAYED";
    backTag.classList.toggle("idle", !playing);
    backTitle.textContent = track.name;
    backArtist.textContent = playing
      ? track.artist
      : track.artist + " · " + timeAgo(track.playedAt);
    setArt(backArt, backArtFallback, track.image);
    backEq.style.display = playing ? "flex" : "none";
  }

  function renderBackArtists(artists) {
    backArtists.innerHTML = "";
    if (!artists || !artists.length) {
      backArtists.innerHTML =
        '<div class="artist-row"><span class="artist-name">no data yet</span></div>';
      return;
    }
    artists.slice(0, 5).forEach(function (a, i) {
      const row = document.createElement(a.url ? "a" : "div");
      if (a.url) {
        row.href = a.url;
        row.target = "_blank";
        row.rel = "noopener noreferrer";
      }
      row.className = "artist-row";
      row.innerHTML =
        '<span class="artist-rank"></span>' +
        '<img class="artist-art" alt="">' +
        '<span class="artist-art-fallback">♪</span>' +
        '<span class="artist-name"></span>';
      row.querySelector(".artist-rank").textContent = i + 1;
      setArt(
        row.querySelector(".artist-art"),
        row.querySelector(".artist-art-fallback"),
        a.image
      );
      row.querySelector(".artist-name").textContent = a.name;
      backArtists.appendChild(row);
    });
  }

  function renderBackRecents(tracks) {
    backRecents.innerHTML = "";
    tracks.slice(0, 4).forEach(function (t) {
      backRecents.appendChild(buildRecentRow(t));
    });
  }

  function renderBackSongs(songs) {
    backSongs.innerHTML = "";
    if (!songs || !songs.length) {
      backSongs.innerHTML =
        '<div class="artist-row"><span class="artist-name">no data yet</span></div>';
      return;
    }
    songs.slice(0, 5).forEach(function (t, i) {
      const row = document.createElement(t.url ? "a" : "div");
      if (t.url) {
        row.href = t.url;
        row.target = "_blank";
        row.rel = "noopener noreferrer";
      }
      row.className = "artist-row";
      row.innerHTML =
        '<span class="artist-rank"></span>' +
        '<img class="artist-art" alt="">' +
        '<span class="artist-art-fallback">♪</span>' +
        '<span class="artist-name"></span>' +
        '<span class="artist-plays"></span>';
      row.querySelector(".artist-rank").textContent = i + 1;
      setArt(
        row.querySelector(".artist-art"),
        row.querySelector(".artist-art-fallback"),
        t.image
      );
      row.querySelector(".artist-name").textContent = t.name;
      row.querySelector(".artist-plays").textContent =
        t.playcount.toLocaleString() + " plays";
      backSongs.appendChild(row);
    });
  }

  function renderMusicBack(data) {
    if (data.tracks && data.tracks.length) {
      renderBackNP(data.tracks[0]);
      renderBackRecents(data.tracks);
    }
    if (data.artists && data.artists.length) renderBackArtists(data.artists);
    if (data.songs && data.songs.length) renderBackSongs(data.songs);
  }

  // ---------- Last.fm data flow ----------

  // skip the 30s-poll rebuild when nothing changed — rebuilding identical
  // rows makes an open back panel flicker and resets its scroll
  let lastTracksSig = null;
  let lastArtistsSig = null;
  let lastSongsSig = null;

  async function refreshLastfm() {
    let tracks = await window.lastfm.fetchRecentTracks(10);
    if (tracks && tracks.length) {
      const sig = tracks
        .map(function (t) {
          return t.name + "@" + (t.playedAt || 0) + (t.nowplaying ? "!" : "");
        })
        .join("|");
      if (sig === lastTracksSig) return;
      lastTracksSig = sig;

      renderBackNP(tracks[0]);
      renderBackRecents(tracks);
      // fill in covers Last.fm is missing (iTunes), then re-render
      await window.lastfm.enrichTracks(tracks);
      renderBackNP(tracks[0]);
      renderBackRecents(tracks);
    }
  }

  async function refreshTopArtists() {
    let artists = await window.lastfm.fetchTopArtists(5, "7day");
    if (artists && artists.length) {
      const sig = artists
        .map(function (a) { return a.name + "@" + a.playcount; })
        .join("|");
      if (sig === lastArtistsSig) return;
      lastArtistsSig = sig;

      renderBackArtists(artists);
      await window.lastfm.enrichArtists(artists);
      renderBackArtists(artists);
    }
  }

  async function refreshTopSongs() {
    const songs = await window.lastfm.fetchTopTracks(5, "7day");
    if (songs && songs.length) {
      const sig = songs
        .map(function (t) { return t.name + "@" + t.playcount; })
        .join("|");
      if (sig === lastSongsSig) return;
      lastSongsSig = sig;

      renderBackSongs(songs);
      await window.lastfm.enrichTracks(songs);
      renderBackSongs(songs);
    }
  }

  function initLastfmWidgets() {
    if (!window.lastfm.isConfigured()) return;

    const cached = window.lastfm.getCached();
    if (cached) renderMusicBack(cached);

    refreshLastfm();
    setInterval(refreshLastfm, 30000);
    refreshTopArtists();
    setInterval(refreshTopArtists, 10 * 60 * 1000);
    refreshTopSongs();
    setInterval(refreshTopSongs, 10 * 60 * 1000);
  }

  // ---------- GitHub strip ----------

  function renderGitHub(summary) {
    if (!summary || !summary.profile) return;
    el("gh-login").textContent = "@" + summary.profile.login;
    el("gh-chip").href = summary.profile.url;
    el("gh-followers").textContent = summary.profile.followers.toLocaleString();
    el("gh-repo-count").textContent = summary.profile.publicRepos.toLocaleString();
    el("gh-stars").textContent = summary.totalStars.toLocaleString();

    const avatar = el("gh-avatar");
    if (summary.profile.avatar) avatar.src = summary.profile.avatar;

    const list = el("gh-repos-list");
    list.innerHTML = "";
    summary.repos.forEach(function (r) {
      const tile = document.createElement("a");
      tile.className = "gh-repo";
      tile.href = r.url;
      tile.target = "_blank";
      tile.rel = "noopener noreferrer";
      tile.innerHTML =
        '<span class="gh-repo-name"></span>' +
        '<span class="gh-repo-meta"><i class="gh-lang"></i><span class="gh-repo-info"></span></span>';
      tile.querySelector(".gh-repo-name").textContent = r.name;
      const lang = tile.querySelector(".gh-lang");
      lang.style.background = langColor(r.language);
      lang.style.display = r.language ? "inline-block" : "none";
      tile.querySelector(".gh-repo-info").textContent =
        (r.language ? r.language + " · " : "") + "★ " + r.stars;
      list.appendChild(tile);
    });
  }

  function initGitHubWidgets() {
    const gh = (window.SITE_CONFIG && window.SITE_CONFIG.github) || {};
    const strip = el("gh-strip");

    // hidden, not removed — flip github.enabled to true to bring it back
    if (gh.enabled === false || !gh.username) {
      if (strip) strip.style.display = "none";
      return;
    }

    const cached = window.githubData.getCached();
    if (cached) renderGitHub(cached);

    if (!cached || !window.githubData.cacheIsFresh(cached)) {
      window.githubData.fetchSummary(gh.repoCount).then(renderGitHub).catch(function () {
        /* offline / rate-limited — keep cached or dashes */
      });
    }
  }

  // ---------- boot ----------

  document.addEventListener("DOMContentLoaded", function () {
    initTypewriters();
    initVolumeSlider();
    initDrag();
    initFlip();
    initLastfmWidgets();
    initGitHubWidgets();

    audio.volume = 0.5;
    playRandomTrack();
    audio.addEventListener("ended", playRandomTrack);
  });
})();
