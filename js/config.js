// vibez.is-a.dev — site config
// ─────────────────────────────────────────────────────────────
// Last.fm powers the Now Playing bar + Recently Scrobbled popup.
//   1. Spotify scrobbles to Last.fm (Settings → Applications → Connect)
//   2. Free API key: https://www.last.fm/api/account/create
// Paste both below and the widgets go live. Empty = kaomoji fallback.
//
// Both values are public on a static site — that's fine for Last.fm
// (read-only, free tier). Rotate the key any time from your Last.fm
// account if it ever gets abused.

window.SITE_CONFIG = {
  lastfm: {
    username: "byevibez",
    apiKey: "f694646dde9a19b351e1f5d95b293534",
  },

  github: {
    enabled: false, // hidden for now — flip to true when the profile has something to show
    username: "PayDash",
    repoCount: 3,   // tiles shown in the GitHub strip
  },

  // shown when neither Last.fm nor iTunes has cover art for a track/artist
  fallbackArt: "assets/crazy-cat.gif",

  playlist: [
    "assets/loseme.mp3",
    "assets/moonlight.mp3",
    "assets/wait.mp3",
    "assets/lie.mp3",
    "assets/love.mp3",
    "assets/something.mp3",
  ],
};
