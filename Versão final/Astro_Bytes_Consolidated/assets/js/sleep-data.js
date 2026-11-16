/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

import { db } from "./firebase-init.js";

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const crewCode = sessionStorage.getItem("crewCode");

const durationElement = document.querySelector("#sleep-duration-value");
const dateElement = document.querySelector("#sleep-record-date");
const fatigueElement = document.querySelector("#fatigue-value");
const qualityElement = document.querySelector("#sleep-quality-value");
const statusElement = document.querySelector("#check-in-status");

const line = document.querySelector("#sleep-data-line");
const points = document.querySelector("#sleep-data-points");
const dates = document.querySelector("#sleep-date-labels");
const yLabels = document.querySelector("#sleep-y-labels");
const description = document.querySelector("#sleep-chart-description");

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const fatigueLabels = {
  1: "Very mild",
  2: "Mild",
  3: "Moderate",
  4: "High",
  5: "Severe"
};

let unsubscribe = null;

function timestampMilliseconds(record) {
  return typeof record.recorded_at?.toMillis === "function"
    ? record.recorded_at.toMillis()
    : null;
}

function validSleep(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1440;
}

function formatDuration(minutes) {
  const rounded = Math.round(minutes);
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

function svgElement(tag, attributes, text) {
  const node = document.createElementNS(SVG_NAMESPACE, tag);

  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }

  if (text !== undefined) node.textContent = text;

  return node;
}

function renderChart(records) {
  points.replaceChildren();
  dates.replaceChildren();
  line.setAttribute("points", "");

  /* Newest four valid sleep records, displayed oldest first. */
  const entries = records
    .filter((record) => validSleep(record.sleep_duration_minutes))
    .slice(0, 4)
    .reverse();

  const highestHours = entries.reduce(
    (maximum, entry) =>
      Math.max(maximum, entry.sleep_duration_minutes / 60),
    12
  );

  const chartMaximum = Math.ceil(highestHours / 3) * 3;

  yLabels.querySelectorAll("text").forEach((label, index) => {
    label.textContent = `${chartMaximum * (1 - index / 3)} h`;
  });

  const coordinates = [];
  const accessibleValues = [];

  entries.forEach((entry, index) => {
    const x = entries.length === 1
      ? 190
      : 45 + index * 285 / (entries.length - 1);

    const hours = entry.sleep_duration_minutes / 60;
    const y = 145 - hours / chartMaximum * 120;

    coordinates.push(`${x},${y}`);

    const recordedDate = entry.recorded_at.toDate();

    const shortDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    }).format(recordedDate);

    const circle = svgElement("circle", {
      cx: x,
      cy: y,
      r: 4
    });

    circle.append(
      svgElement(
        "title",
        {},
        `${shortDate}: ${formatDuration(entry.sleep_duration_minutes)}`
      )
    );

    points.append(circle);

    dates.append(svgElement("text", {
      x,
      y: 170,
      "text-anchor": "middle"
    }, shortDate));

    accessibleValues.push(
      `${shortDate}: ${formatDuration(entry.sleep_duration_minutes)}`
    );
  });

  line.setAttribute("points", coordinates.join(" "));

  description.textContent = entries.length
    ? accessibleValues.join(". ")
    : "No saved sleep records.";
}

function clearValues(message) {
  durationElement.textContent = "--";
  dateElement.textContent = "No reading";
  fatigueElement.textContent = "--";
  qualityElement.textContent = "--";
  statusElement.textContent = message;
  renderChart([]);
}

function renderCheckIns(snapshot) {
  if (sessionStorage.getItem("crewCode") !== crewCode) {
    stopListening();
    clearValues("Your selected profile changed. Reload this page.");
    return;
  }

  const records = snapshot.docs
    .map((document) => document.data())
    .filter((record) => timestampMilliseconds(record) !== null)
    .sort(
      (first, second) =>
        timestampMilliseconds(second) - timestampMilliseconds(first)
    );

  if (!records.length) {
    clearValues(
      snapshot.metadata.fromCache
        ? "Waiting for saved check-ins from the database."
        : "No check-ins recorded. Add one in Record Measurements."
    );
    return;
  }

  const latest = records[0];

  durationElement.textContent = validSleep(latest.sleep_duration_minutes)
    ? formatDuration(latest.sleep_duration_minutes)
    : "--";

  const recordedDate = latest.recorded_at.toDate();

  dateElement.textContent = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(recordedDate);

  const fatigue = latest.fatigue_level;

  fatigueElement.textContent =
    Number.isInteger(fatigue) && fatigue >= 1 && fatigue <= 5
      ? `${fatigue} / 5 — ${fatigueLabels[fatigue]}`
      : "--";

  qualityElement.textContent =
    typeof latest.sleep_quality === "string" &&
    latest.sleep_quality.trim()
      ? latest.sleep_quality
      : "--";

  const updated = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(recordedDate);

  statusElement.textContent =
    `${snapshot.metadata.fromCache ? "Cached check-in" : "Saved check-in"}` +
    ` · ${crewCode} · ${updated}`;

  renderChart(records);
}

function stopListening() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function startListening() {
  if (!crewCode || unsubscribe) return;

  clearValues("Loading saved check-in...");

  const checkInsQuery = query(
    collection(db, "daily_check_ins"),
    where("crew_id", "==", crewCode)
  );

  unsubscribe = onSnapshot(
    checkInsQuery,
    { includeMetadataChanges: true },
    renderCheckIns,
    (error) => {
      console.error("Could not load daily check-ins:", error);

      clearValues(
        error.code === "permission-denied"
          ? "The database did not allow access to these check-ins."
          : "Could not load check-ins. Check your connection and reload."
      );

      unsubscribe = null;
    }
  );
}

if (!crewCode) {
  window.location.replace("index.html");
} else {
  startListening();
}

window.addEventListener("pagehide", stopListening);

window.addEventListener("pageshow", (event) => {
  if (event.persisted) startListening();
});