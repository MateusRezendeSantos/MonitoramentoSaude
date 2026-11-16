/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

(() => {
  const API_KEY = "DEMO_KEY";
  const CACHE_KEY = "astroBytes.apod.cache.v1";

  const image = document.querySelector("#apod-image");
  const title = document.querySelector("#apod-title");
  const date = document.querySelector("#apod-date");
  const status = document.querySelector("#apod-status");
  const readButton = document.querySelector("#apod-read-button");
  const retryButton = document.querySelector("#apod-retry-button");
  const dialog = document.querySelector("#apod-dialog");

  if (!image || !dialog) return;

  let currentEntry = null;
  let loading = false;

  function safeUrl(value) {
    try {
      const url = new URL(value);

      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function loadCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));

      return cached &&
        Number.isFinite(cached.savedAt) &&
        cached.entry &&
        typeof cached.entry.title === "string"
        ? cached
        : null;
    } catch {
      return null;
    }
  }

  function saveCache(entry) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          entry
        })
      );
    } catch {
      /* The astronomy card still works without persistent caching. */
    }
  }

  function render(entry, fromCache = false) {
    currentEntry = entry;

    title.textContent = entry.title;
    date.textContent = entry.date || "";

    image.hidden = true;
    image.removeAttribute("src");

    let mediaUrl = null;

    if (entry.media_type === "image") {
      /*
       * Current responses provide the image in hdurl.
       * Older responses may provide it in url instead.
       */

      mediaUrl = safeUrl(entry.hdurl);

      if (!mediaUrl && !entry.permalink) {
        mediaUrl = safeUrl(entry.url);
      }
    } else {
      mediaUrl = safeUrl(entry.thumbnail_url);
    }

    if (mediaUrl) {
      image.alt = entry.title;
      image.hidden = false;
      image.src = mediaUrl;
    }

    const messages = [];

    if (fromCache) {
      messages.push("Saved discovery. A live update is unavailable.");
    }

    if (entry.media_type !== "image") {
      messages.push(
        "This discovery contains a video or other media. Open the original to view it."
      );
    } else if (!mediaUrl) {
      messages.push("Open the original to view this image.");
    }

    status.textContent = messages.join(" ");

    document.querySelector("#apod-dialog-title").textContent =
      entry.title;

    document.querySelector("#apod-explanation").textContent =
      entry.explanation || "No description is available.";

    document.querySelector("#apod-credit").textContent =
      entry.copyright
        ? `Credit: ${entry.copyright}`
        : "Source: NASA APOD. See the original page for image credits.";

    const source = document.querySelector("#apod-source");

    const archiveUrl = /^\d{4}-\d{2}-\d{2}$/.test(entry.date || "")
      ? `https://apod.nasa.gov/apod/ap${entry.date.slice(2).replaceAll("-", "")}.html`
      : "https://apod.nasa.gov/";

    source.href =
      safeUrl(entry.permalink) ||
      (entry.media_type !== "image" ? safeUrl(entry.url) : null) ||
      archiveUrl;

    readButton.disabled = false;
  }

  image.addEventListener("error", () => {
    image.hidden = true;

    status.textContent =
      "The preview could not load. Select Read More to open the original.";
  });

  async function loadDiscovery() {
    if (loading) return;

    loading = true;
    retryButton.hidden = true;
    status.textContent = "Loading NASA's latest discovery...";

    const cached = loadCache();

    /* Reuse recent metadata to reduce requests during the demo. */

    const cacheAge = cached ? Date.now() - cached.savedAt : Infinity;

    if (cached && cacheAge >= 0 && cacheAge < 30 * 60 * 1000) {
      render(cached.entry);
      loading = false;
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const endpoint = new URL(
        "https://api.nasa.gov/planetary/apod"
      );

      endpoint.searchParams.set("api_key", API_KEY);
      endpoint.searchParams.set("thumbs", "true");

      const response = await fetch(endpoint, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`NASA request failed: ${response.status}`);
      }

      const entry = await response.json();

      if (
        !entry ||
        typeof entry.title !== "string" ||
        typeof entry.media_type !== "string"
      ) {
        throw new Error("Unexpected NASA response.");
      }

      render(entry);
      saveCache(entry);
    } catch {
      if (cached) {
        render(cached.entry, true);
      } else {
        title.textContent = "A discovery is waiting";
        status.textContent =
          "NASA content is unavailable. Check your connection or try again later.";
      }

      retryButton.hidden = false;
    } finally {
      window.clearTimeout(timeout);
      loading = false;
    }
  }

  readButton.addEventListener("click", () => {
    if (currentEntry && !dialog.open) {
      dialog.showModal();
    }
  });

  retryButton.addEventListener("click", loadDiscovery);

  loadDiscovery();
})();