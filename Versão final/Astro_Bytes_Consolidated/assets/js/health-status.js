/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

import { db } from "./firebase-init.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const crewCode = sessionStorage.getItem("crewCode");

const summary = document.querySelector("#health-summary");
const summaryIcon = document.querySelector("#health-summary-icon");
const summaryTitle = document.querySelector("#health-summary-title");
const summaryText = document.querySelector("#health-summary-text");
const grid = document.querySelector("#health-indicator-grid");
const reasons = document.querySelector("#health-status-reasons");
const updated = document.querySelector("#health-status-updated");

const icons = {
  normal: "✓",
  warning: "!",
  critical: "✕",
  missing: "—"
};

const labels = {
  normal: "Within range",
  warning: "Needs review",
  critical: "Out of range",
  missing: "No data"
};

let loading = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function latestRecord(snapshot) {
  return snapshot.docs
    .map((document) => document.data())
    .filter((record) => (
      typeof record.recorded_at?.toMillis === "function"
    ))
    .sort(
      (first, second) =>
        second.recorded_at.toMillis() - first.recorded_at.toMillis()
    )[0] || null;
}

function validBand(min, max) {
  return (
    (min === undefined || min === null || numeric(min)) &&
    (max === undefined || max === null || numeric(max)) &&
    (numeric(min) || numeric(max)) &&
    !(numeric(min) && numeric(max) && min > max)
  );
}

function inBand(value, min, max) {
  return (
    (!numeric(min) || value >= min) &&
    (!numeric(max) || value <= max)
  );
}

function describeBand(min, max) {
  if (numeric(min) && numeric(max)) return `${min}–${max}`;
  if (numeric(min)) return `${min} or higher`;
  if (numeric(max)) return `${max} or lower`;
  return "not configured";
}

function classify(name, value, range, record) {
  const result = {
    name,
    state: "missing",
    label: "No data",
    reason: `${name}: no valid saved reading.`
  };

  if (!numeric(value)) return result;

  if (
    !range ||
    !validBand(range.green_min, range.green_max)
  ) {
    result.label = "No valid range";
    result.reason =
      `${name}: reading ${value}; demonstration range is missing or invalid.`;

    return result;
  }

  const yellowConfigured =
    validBand(range.yellow_min, range.yellow_max);

  if (inBand(value, range.green_min, range.green_max)) {
    result.state = "normal";
  } else if (
    yellowConfigured &&
    inBand(value, range.yellow_min, range.yellow_max)
  ) {
    result.state = "warning";
  } else {
    result.state = "critical";
  }

  result.label = labels[result.state];

  const date = record.recorded_at.toDate().toLocaleString("en-US");

  result.reason =
    `${name}: ${value}${range.unit ? ` ${range.unit}` : ""}` +
    ` · Recorded ${date}` +
    ` · Green: ${describeBand(range.green_min, range.green_max)}` +
    ` · Yellow: ${describeBand(range.yellow_min, range.yellow_max)}`;

  return result;
}

function setSummary(state, title, text) {
  summary.className = `health-summary health-summary--${state}`;
  summaryIcon.textContent = icons[state];
  summaryTitle.textContent = title;
  summaryText.textContent = text;
}

function render(indicators) {
  grid.replaceChildren();
  reasons.replaceChildren();

  for (const indicator of indicators) {
    const tile = element(
      "li",
      `indicator-tile indicator-tile--${indicator.state}`
    );

    tile.append(
      element("span", "indicator-tile__name", indicator.name),
      element(
        "strong",
        "indicator-tile__status",
        `${icons[indicator.state]} ${indicator.label}`
      )
    );

    grid.append(tile);
    reasons.append(element("li", "", indicator.reason));
  }

  const missing = indicators.filter(
    (indicator) => indicator.state === "missing"
  ).length;

  if (indicators.some((indicator) => indicator.state === "critical")) {
    setSummary(
      "critical",
      "Out of Range",
      "Review the highlighted saved readings and the applicable mission procedure."
    );
  } else if (indicators.some((indicator) => indicator.state === "warning")) {
    setSummary(
      "warning",
      "Review Needed",
      "One or more saved indicators require review."
    );
  } else if (missing > 0) {
    setSummary(
      "missing",
      "Assessment Incomplete",
      "Some readings or reference ranges are missing."
    );
  } else {
    setSummary(
      "normal",
      "Saved Readings Within Range",
      "The assessed records fall within the configured demonstration ranges."
    );
  }
}

async function loadStatus() {
  if (loading || !crewCode) return;
  loading = true;

  try {
    const [rangesSnapshot, measurementsSnapshot, checkInsSnapshot] =
      await Promise.all([
        getDocs(collection(db, "health_ranges")),

        getDocs(query(
          collection(db, "heart_rate_logs"),
          where("crew_id", "==", crewCode)
        )),

        getDocs(query(
          collection(db, "daily_check_ins"),
          where("crew_id", "==", crewCode)
        ))
      ]);

    if (sessionStorage.getItem("crewCode") !== crewCode) {
      grid.replaceChildren();
      reasons.replaceChildren();

      setSummary(
        "missing",
        "Profile Changed",
        "Reload this page to use the selected profile."
      );
      return;
    }

    const ranges = Object.fromEntries(
      rangesSnapshot.docs.map((document) => [
        document.id,
        document.data()
      ])
    );

    const measurements = latestRecord(measurementsSnapshot);
    const checkIn = latestRecord(checkInsSnapshot);

    const indicators = [
      classify(
        "Heart rate",
        measurements?.bpm,
        ranges.heart_rate,
        measurements
      ),
      classify(
        "Oxygen saturation",
        measurements?.spo2,
        ranges.spo2,
        measurements
      ),
      classify(
        "Respiratory rate",
        measurements?.resp_rate,
        ranges.resp_rate,
        measurements
      ),
      classify(
        "Fatigue",
        checkIn?.fatigue_level,
        ranges.fatigue,
        checkIn
      ),
      classify(
        "Sleep",
        checkIn?.sleep_duration_minutes,
        ranges.sleep_minutes,
        checkIn
      )
    ];

    /* Preserve the team's demonstration rule for poor sleep quality. */
    const sleep = indicators[4];

    if (sleep.state === "normal" && checkIn?.sleep_quality === "Poor") {
      sleep.state = "warning";
      sleep.label = labels.warning;
      sleep.reason += " · Reported sleep quality: Poor.";
    }

    render(indicators);

    const cached = [
      rangesSnapshot,
      measurementsSnapshot,
      checkInsSnapshot
    ].some((snapshot) => snapshot.metadata.fromCache);

    updated.textContent =
      `${cached ? "Cached records" : "Saved records"} · ${crewCode}` +
      " · See details for measurement dates.";
  } catch (error) {
    console.error("Could not calculate health status:", error);

    grid.replaceChildren();
    reasons.replaceChildren();
    updated.textContent = "";

    setSummary(
      "missing",
      "Status Unavailable",
      "Could not load records or reference ranges. Reload to try again."
    );
  } finally {
    loading = false;
  }
}

if (!crewCode) {
  window.location.replace("index.html");
} else {
  loadStatus();
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadStatus();
});