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

const heartRate = document.querySelector("#heart-rate-value");
const oxygen = document.querySelector("#spo2-value");
const respiratoryRate = document.querySelector("#resp-rate-value");
const status = document.querySelector("#measurement-status");

let unsubscribe = null;

function clearReadings() {
  heartRate.textContent = "--";
  oxygen.textContent = "--";
  respiratoryRate.textContent = "--";
}

/* Accept numeric records without treating them as clinical assessments. */
function formatValue(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "--";
}

function recordedMilliseconds(record) {
  const timestamp = record.recorded_at;

  return timestamp && typeof timestamp.toMillis === "function"
    ? timestamp.toMillis()
    : null;
}

function renderMeasurements(snapshot) {
  /* Never display another selected profile's results. */
  if (sessionStorage.getItem("crewCode") !== crewCode) {
    stopListening();
    clearReadings();
    status.textContent = "Your selected profile changed. Reload this page.";
    return;
  }

  /*
   * Sort this astronaut's records locally.
   * This matches the existing database structure without requiring
   * a new composite index.
   */
  const records = snapshot.docs
    .map((document) => document.data())
    .filter((record) => recordedMilliseconds(record) !== null)
    .sort(
      (first, second) =>
        recordedMilliseconds(second) - recordedMilliseconds(first)
    );

  const latest = records[0];

  if (!latest) {
    clearReadings();

    status.textContent = snapshot.metadata.fromCache
      ? "No saved measurements are available in the local cache. Waiting for the database."
      : "No dated measurements found. Use Record Measurements to add your first reading.";

    return;
  }

  heartRate.textContent = formatValue(latest.bpm);
  oxygen.textContent = formatValue(latest.spo2);
  respiratoryRate.textContent = formatValue(latest.resp_rate);

  const recordedDate = latest.recorded_at.toDate();

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(recordedDate);

  const source = snapshot.metadata.fromCache
    ? "Cached record"
    : "Saved record";

  status.textContent =
    `${source} · ${crewCode} · ${formattedDate}`;
}

function stopListening() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function startListening() {
  if (!crewCode || unsubscribe) return;

  clearReadings();
  status.textContent = "Loading saved measurements...";

  const measurementsQuery = query(
    collection(db, "heart_rate_logs"),
    where("crew_id", "==", crewCode)
  );

  unsubscribe = onSnapshot(
    measurementsQuery,
    { includeMetadataChanges: true },
    renderMeasurements,
    (error) => {
      console.error("Could not load crew measurements:", error);

      clearReadings();

      status.textContent = error.code === "permission-denied"
        ? "The database did not allow access to these measurements."
        : "Could not load measurements. Check your connection and reload the page.";

      unsubscribe = null;
    }
  );
}

if (!crewCode) {
  window.location.replace("index.html");
} else {
  startListening();
}

/* Reconnect if the browser restores this page from its back cache. */
window.addEventListener("pagehide", stopListening);

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    startListening();
  }
});