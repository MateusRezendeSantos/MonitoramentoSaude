/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

import { db } from "./firebase-init.js";

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const crewCode = sessionStorage.getItem("crewCode");

const sessionList = document.querySelector("#exercise-session-list");
const equipmentList = document.querySelector("#exercise-equipment-list");
const counter = document.querySelector("#exercise-completed-count");
const dailyMinutes = document.querySelector("#exercise-value");
const setupNote = document.querySelector("#exercise-setup-note");

const openButton = document.querySelector("#log-exercise-button");
const dialog = document.querySelector("#exercise-log-dialog");
const form = document.querySelector("#exercise-log-form");
const sessionSelect = document.querySelector("#exercise-session");
const dateInput = document.querySelector("#exercise-date");
const durationInput = document.querySelector("#exercise-duration");
const effortInput = document.querySelector("#exercise-effort");
const notesInput = document.querySelector("#exercise-notes");
const saveButton = document.querySelector("#save-exercise-button");
const message = document.querySelector("#exercise-log-message");

let plan = [];
let loading = false;

function today() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T12:00:00`);

  return !Number.isNaN(date.getTime()) &&
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-") === value;
}

function element(tag, className, text) {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;

  return node;
}

function renderSessions(minutesByPlan) {
  sessionList.replaceChildren();

  const loggedCount = plan.filter(
    (session) => (minutesByPlan.get(session.id) || 0) > 0
  ).length;

  counter.textContent = `${loggedCount} of ${plan.length}`;

  if (!plan.length) {
    sessionList.append(element(
      "li",
      "exercise-session",
      "No exercise sessions configured."
    ));
  }

  for (const session of plan) {
    const minutes = minutesByPlan.get(session.id) || 0;
    const logged = minutes > 0;

    const item = element(
      "li",
      `exercise-session exercise-session--${logged ? "logged" : "pending"}`
    );

    const heading = element("div", "exercise-session__heading");

    heading.append(
      element("h3", "", session.title || "Exercise session"),
      element(
        "span",
        "exercise-session__status",
        logged ? "✓ Logged" : "○ Pending"
      )
    );

    item.append(
      heading,
      element(
        "p",
        "exercise-session__equipment",
        `Equipment: ${session.equipment || "Not specified"}`
      ),
      element(
        "p",
        "exercise-session__description",
        session.description || ""
      ),
      element(
        "p",
        "exercise-session__record",
        logged
          ? `Recorded today: ${minutes} minutes`
          : "No session recorded for today."
      )
    );

    sessionList.append(item);
  }

  const total = [...minutesByPlan.values()].reduce(
    (sum, value) => sum + value,
    0
  );

  dailyMinutes.textContent = `${total} minutes`;
}

function renderEquipment(snapshot) {
  equipmentList.replaceChildren();

  if (snapshot.empty) {
    equipmentList.append(element("li", "", "No equipment status available."));
    return;
  }

  for (const document of snapshot.docs) {
    const equipment = document.data();
    const available = equipment.status === "available";
    const unavailable = equipment.status === "unavailable";

    const item = document.createElement("li");

    item.append(
      element("strong", "", document.id),
      element(
        "span",
        `equipment-state equipment-state--${
          available ? "available" : "unavailable"
        }`,
        available ? "Available" : unavailable ? "Unavailable" : "Unknown"
      )
    );

    equipmentList.append(item);
  }
}

async function loadExercises() {
  if (!crewCode || loading) return;

  loading = true;
  openButton.disabled = true;
  saveButton.disabled = true;
  setupNote.textContent = "Loading exercise plan...";

  try {
    const [planSnapshot, logsSnapshot, equipmentSnapshot] =
      await Promise.all([
        getDocs(query(
          collection(db, "exercise_plan"),
          orderBy("order")
        )),

        getDocs(query(
          collection(db, "exercise_logs"),
          where("crew_id", "==", crewCode),
          where("day", "==", today())
        )),

        getDocs(collection(db, "equipment_status"))
      ]);

    if (sessionStorage.getItem("crewCode") !== crewCode) {
      setupNote.textContent = "Your selected profile changed. Reload the page.";
      return;
    }

    plan = planSnapshot.docs.map((document) => ({
      ...document.data(),
      id: document.id
    }));

    const minutesByPlan = new Map();

    for (const document of logsSnapshot.docs) {
      const log = document.data();

      if (
        typeof log.duration_minutes !== "number" ||
        !Number.isFinite(log.duration_minutes) ||
        log.duration_minutes < 0
      ) {
        continue;
      }

      minutesByPlan.set(
        log.plan_id,
        (minutesByPlan.get(log.plan_id) || 0) + log.duration_minutes
      );
    }

    renderSessions(minutesByPlan);
    renderEquipment(equipmentSnapshot);

    sessionSelect.replaceChildren(new Option("Select a session", ""));

    for (const session of plan) {
      sessionSelect.append(new Option(
        `${session.title || "Exercise session"} · ${
          session.equipment || "Equipment unspecified"
        }`,
        session.id
      ));
    }

    openButton.disabled = plan.length === 0;
    saveButton.disabled = plan.length === 0;

    setupNote.textContent = plan.length
      ? `Saved plan · ${crewCode} · Today`
      : "Ask the team to configure the exercise plan.";
  } catch (error) {
    console.error("Could not load exercise plan:", error);

    counter.textContent = "--";
    dailyMinutes.textContent = "--";

    setupNote.textContent =
      "Could not load the exercise plan. Check your connection and reload.";
  } finally {
    loading = false;
  }
}

openButton.addEventListener("click", () => {
  message.textContent = "";
  dateInput.max = today();
  dateInput.value = today();

  if (!dialog.open) dialog.showModal();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (saveButton.disabled) return;

  const session = plan.find(
    (item) => item.id === sessionSelect.value
  );

  const day = dateInput.value;
  const minutes = durationInput.valueAsNumber;
  const effort = Number(effortInput.value);

  if (!session) {
    message.textContent = "Select a session.";
    return;
  }

  if (!validDate(day) || day > today()) {
    message.textContent = "Choose a valid date that is not in the future.";
    return;
  }

  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    message.textContent = "Enter a duration between 1 and 600 whole minutes.";
    return;
  }

  if (!Number.isInteger(effort) || effort < 1 || effort > 5) {
    message.textContent = "Select perceived effort.";
    return;
  }

  if (sessionStorage.getItem("crewCode") !== crewCode) {
    message.textContent = "Your selected profile changed. Reload the page.";
    return;
  }

  saveButton.disabled = true;
  message.textContent = "Saving exercise...";

  try {
    await addDoc(collection(db, "exercise_logs"), {
      crew_id: crewCode,
      plan_id: session.id,
      equipment: session.equipment || "",
      duration_minutes: minutes,
      day,
      effort,
      notes: notesInput.value.trim(),
      recorded_at: serverTimestamp()
    });
  } catch (error) {
    console.error("Could not save exercise:", error);

    message.textContent =
      "Could not save the session. Check your connection and try again.";

    saveButton.disabled = false;
    return;
  }

  form.reset();
  dialog.close();

  await loadExercises();

  setupNote.textContent +=
    " · Exercise saved. Each submission adds a separate session.";
});

if (!crewCode) {
  window.location.replace("index.html");
} else {
  loadExercises();
}

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadExercises();
});