/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";
(() => {
if (!document.querySelector("#space-weather-status")) return;
// ---------- NASA DONKI space weather ----------
  // DEMO_KEY allows only 30 requests per hour and 50 per day.
  // Replace it with a free personal key from https://api.nasa.gov before demo day.
  const NASA_API_KEY = "DEMO_KEY";
  const SPACE_WEATHER_DAYS = 7;
  const SPACE_WEATHER_MAX_ITEMS = 4;
  const SPACE_WEATHER_CACHE_KEY = 'donkiNotificationsCache';
  const SPACE_WEATHER_CACHE_MS = 30 * 60 * 1000;

  const spaceWeatherLabels = {
    FLR: 'Solar flare',
    SEP: 'Solar energetic particles',
    CME: 'Coronal mass ejection',
    IPS: 'Interplanetary shock',
    MPC: 'Magnetopause crossing',
    GST: 'Geomagnetic storm',
    RBE: 'Radiation belt enhancement'
  };

  const spaceWeatherStatus = document.getElementById('space-weather-status');
  const spaceWeatherList = document.getElementById('space-weather-list');

  function setSpaceWeatherStatus(text, state) {
    spaceWeatherStatus.textContent = text;
    spaceWeatherStatus.dataset.state = state;
  }

  function readSpaceWeatherCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(SPACE_WEATHER_CACHE_KEY));
      if (
        cached &&
        Array.isArray(cached.events) &&
        Date.now() - cached.savedAt < SPACE_WEATHER_CACHE_MS
      ) {
        return cached.events;
      }
    } catch (error) {
      // Storage can be unavailable or hold invalid data; fetch again instead.
    }
    return null;
  }

  function writeSpaceWeatherCache(events) {
    try {
      sessionStorage.setItem(
        SPACE_WEATHER_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), events })
      );
    } catch (error) {
      // Caching is optional.
    }
  }

  async function fetchSpaceWeather() {
    const cached = readSpaceWeatherCache();
    if (cached) return cached;

    const end = new Date();
    const start = new Date(end.getTime() - SPACE_WEATHER_DAYS * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      type: 'all',
      api_key: NASA_API_KEY
    });

    const response = await fetch(`https://api.nasa.gov/DONKI/notifications?${params}`, { signal: AbortSignal.timeout(15000) });
    if (response.status === 429) throw new Error('rate-limit');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('Unexpected response format');

    // Keep only the fields we show; message bodies are long and unused.
    const events = payload
      .filter((item) => spaceWeatherLabels[item.messageType])
      .map((item) => ({
        type: item.messageType,
        url: typeof item.messageURL === 'string' && item.messageURL.startsWith('https://')
          ? item.messageURL
          : null,
        issued: new Date(item.messageIssueTime)
      }))
      .filter((item) => !Number.isNaN(item.issued.getTime()))
      .sort((a, b) => b.issued - a.issued)
      .map((item) => ({ ...item, issued: item.issued.toISOString() }));

    writeSpaceWeatherCache(events);
    return events;
  }

  function renderSpaceWeather(events) {
    spaceWeatherList.replaceChildren();

    if (events.length === 0) {
      setSpaceWeatherStatus(
        `No space weather notifications in the last ${SPACE_WEATHER_DAYS} days.`,
        'quiet'
      );
      return;
    }

    const hasParticleEvent = events.some((event) => event.type === 'SEP');
    if (hasParticleEvent) {
      setSpaceWeatherStatus(
        `Solar energetic particle event reported in the last ${SPACE_WEATHER_DAYS} days.`,
        'watch'
      );
    } else {
      setSpaceWeatherStatus(
        `${events.length} space weather ${events.length === 1 ? 'notification' : 'notifications'} in the last ${SPACE_WEATHER_DAYS} days. No particle events reported.`,
        'activity'
      );
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    events.slice(0, SPACE_WEATHER_MAX_ITEMS).forEach((event) => {
      const label = spaceWeatherLabels[event.type];
      const when = formatter.format(new Date(event.issued));

      const item = document.createElement('li');
      item.className = 'space-weather__item';

      const name = document.createElement('span');
      name.className = 'space-weather__type';
      name.textContent = label;

      const time = document.createElement('time');
      time.dateTime = event.issued;
      time.textContent = when;

      item.append(name, time);

      if (event.url) {
        const link = document.createElement('a');
        link.href = event.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Details';
        link.setAttribute('aria-label', `Details about ${label}, ${when} (opens NASA page)`);
        item.append(link);
      }

      spaceWeatherList.append(item);
    });
  }

  async function loadSpaceWeather() {
    try {
      renderSpaceWeather(await fetchSpaceWeather());
    } catch (error) {
      console.error("Operation failed:", error);
      setSpaceWeatherStatus(
        error.message === 'rate-limit'
          ? 'NASA request limit reached. Try again later.'
          : 'Space weather data is unavailable right now.',
        'error'
      );
    }
  }

  
loadSpaceWeather();
})();
