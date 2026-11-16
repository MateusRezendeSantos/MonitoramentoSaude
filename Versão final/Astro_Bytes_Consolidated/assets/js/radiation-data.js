/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

import { db } from "./firebase-init.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const crewCode = sessionStorage.getItem("crewCode");

const totalElement = document.querySelector("#radiation-total");
const dailyElement = document.querySelector("#radiation-daily");
const statusElement = document.querySelector("#radiation-updated");

let loading = false;

function clearValues(message) {
  totalElement.textContent = "--";
  dailyElement.textContent = "--";
  statusElement.textContent = message;
}

function validDose(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0;
}

function formatDose(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3
  }).format(value);
}

async function loadRadiation() {
  if (loading) return;

  if (!crewCode) {
    window.location.replace("index.html");
    return;
  }

  loading = true;
  clearValues("Loading saved radiation readings...");

  try {
    const [summary, readings] = await Promise.all([
      getDoc(doc(db, "radiation_summary", crewCode)),

      getDocs(query(
        collection(db, "radiation_logs"),
        where("crew_id", "==", crewCode)
      ))
    ]);

    if (sessionStorage.getItem("crewCode") !== crewCode) {
      clearValues("Your selected profile changed. Reload this page.");
      return;
    }

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const logs = readings.docs
      .map((document) => document.data())
      .filter((entry) => (
        validDose(entry.dose_msv) &&
        typeof entry.recorded_at?.toMillis === "function"
      ))
      .map((entry) => ({
        dose: entry.dose_msv,
        time: entry.recorded_at.toMillis()
      }))
      .filter((entry) => entry.time <= now)
      .sort((first, second) => second.time - first.time);

    const total = summary.exists()
      ? summary.data().total_msv
      : null;

    totalElement.textContent = validDose(total)
      ? formatDose(total)
      : "--";

    if (!logs.length) {
      dailyElement.textContent = "--";

      statusElement.textContent =
        "No dated radiation readings found for this crew member.";

      return;
    }

    const last24Hours = logs
      .filter((entry) => entry.time >= dayAgo)
      .reduce((sum, entry) => sum + entry.dose, 0);

    dailyElement.textContent = formatDose(last24Hours);

    const recordedDate = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(logs[0].time));

    const cached = summary.metadata.fromCache ||
      readings.metadata.fromCache;

    statusElement.textContent =
      `${cached ? "Cached readings" : "Saved readings"} · ${crewCode}` +
      ` · Last reading: ${recordedDate}` +
      (!validDose(total) ? " · Mission total unavailable." : "");
  } catch (error) {
    console.error("Could not load radiation readings:", error);

    clearValues(
      error.code === "permission-denied"
        ? "The database did not allow access to radiation readings."
        : "Could not load radiation readings. Check your connection and reload."
    );
  } finally {
    loading = false;
  }
}

loadRadiation();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadRadiation();
});