// GitHub summary widget data — public REST API, no key needed.
// Unauthenticated limit is 60 req/hr per IP, so results are cached
// in localStorage for 1 hour and rendered instantly on revisit.

(function () {
  "use strict";

  const CACHE_KEY = "vibez:gh:summary";
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  function username() {
    const gh = (window.SITE_CONFIG && window.SITE_CONFIG.github) || {};
    return gh.username || "";
  }

  function getCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts) return null;
      return parsed; // caller decides freshness (stale is better than nothing)
    } catch {
      return null;
    }
  }

  function cacheIsFresh() {
    const cached = getCached();
    return Boolean(cached && Date.now() - cached.ts < CACHE_TTL);
  }

  function writeCache(summary) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(summary));
    } catch {
      /* non-fatal */
    }
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("GitHub API " + res.status);
    return res.json();
  }

  async function fetchSummary(repoCount) {
    const user = username();
    if (!user) return null;

    const count = repoCount || 3;
    const profile = await fetchJSON(
      "https://api.github.com/users/" + encodeURIComponent(user)
    );
    const repos = await fetchJSON(
      "https://api.github.com/users/" + encodeURIComponent(user) +
        "/repos?sort=pushed&per_page=30"
    );

    const own = repos.filter(function (r) { return !r.fork; });
    const summary = {
      ts: Date.now(),
      profile: {
        login: profile.login,
        avatar: profile.avatar_url,
        url: profile.html_url,
        followers: profile.followers,
        publicRepos: profile.public_repos,
      },
      repos: own.slice(0, count).map(function (r) {
        return {
          name: r.name,
          url: r.html_url,
          description: r.description || "",
          language: r.language || "",
          stars: r.stargazers_count,
        };
      }),
      totalStars: own.reduce(function (sum, r) { return sum + r.stargazers_count; }, 0),
    };

    writeCache(summary);
    return summary;
  }

  window.githubData = {
    getCached: getCached,
    cacheIsFresh: cacheIsFresh,
    fetchSummary: fetchSummary,
  };
})();
