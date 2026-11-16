/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

// Daily care (mood + meals), saved in Firestore.
// Collection: daily_care/{crewCode}_{YYYY-MM-DD} (one document per crew and day)
//   mood, note, mood_updated_at, meals (map of booleans), meals_updated_at
import { db } from './firebase-init.js';
import {
  collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit,
  documentId, serverTimestamp, where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const COLLECTION = 'daily_care';
const crewCode = sessionStorage.getItem("crewCode");
if (!crewCode) {
  window.location.replace("index.html");
  throw new Error("Astronaut login required.");
}
function dayId(date) { return `${crewCode}_${date}`; }
const NOTE_MAX_LENGTH = 1000;
const HISTORY_LIMIT = 30;

const moodForm = document.querySelector('#mood-form');
const mealForm = document.querySelector('#meal-form');

const moodNames = {
  great: 'Great',
  good: 'Good',
  okay: 'Okay',
  low: 'Low',
  stressed: 'Stressed'
};

let activeDate = today();

function today() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function errorText(error) {
  return error && error.code ? error.code : 'unknown error';
}

async function readDay(date) {
  const snap = await getDoc(doc(db, COLLECTION, dayId(date)));
  return snap.exists() ? snap.data() : {};
}

async function renderMoodHistory() {
  const list = document.querySelector('#mood-history-list');
  if (!list) return;

  let entries = [];

  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('crew_id', '==', crewCode))
    );
    entries = snap.docs
      .map((entry) => entry.data())
      .filter((entry) => (
        /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
        Object.hasOwn(moodNames, entry.mood)
      ))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, HISTORY_LIMIT);
  } catch (error) {
    console.error("Operation failed:", error);
    const item = document.createElement('li');
    item.textContent = `Could not load the mood history (${errorText(error)}).`;
    list.replaceChildren(item);
    return;
  }

  list.replaceChildren();

  if (!entries.length) {
    const item = document.createElement('li');
    item.textContent = 'No mood check-ins yet.';
    list.append(item);
    return;
  }

  for (const entry of entries) {
    const item = document.createElement('li');

    const formatted = new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const note = typeof entry.note === 'string' ? entry.note : '';

    item.textContent =
      `${formatted} — ${moodNames[entry.mood]}` +
      (note ? `\n${note}` : '');

    list.append(item);
  }
}

async function loadToday() {
  activeDate = today();

  let entry = {};
  try {
    entry = await readDay(activeDate);
  } catch (error) {
    console.error("Operation failed:", error);
    const message = document.querySelector('#mood-message');
    if (message) message.textContent = `Could not load today's check-in (${errorText(error)}).`;
  }

  if (moodForm) {
    moodForm.reset();

    for (const input of moodForm.querySelectorAll('[name="mood"]')) {
      input.checked = input.value === entry.mood;
    }

    document.querySelector('#mood-note').value =
      typeof entry.note === 'string' ? entry.note : '';

    renderMoodHistory();
  }

  if (mealForm) {
    for (const input of mealForm.querySelectorAll('[name="meal"]')) {
      input.checked = entry.meals?.[input.value] === true;
    }
  }
}

async function checkDate(messageElement) {
  if (activeDate === today()) return true;

  await loadToday();

  messageElement.textContent =
    "A new day has started. Review today's check-in and save again.";

  return false;
}

async function saveDay(form, message, fields, successText) {
  const button = form.querySelector('[type="submit"]');
  if (button?.disabled) return false;
  if (sessionStorage.getItem('crewCode') !== crewCode) {
    message.textContent = 'Your selected profile changed. Reload this page.';
    return false;
  }
  if (button) button.disabled = true;
  message.textContent = 'Saving…';

  try {
    // merge: true keeps the other half of the day (mood vs meals) untouched.
    await setDoc(doc(db, COLLECTION, dayId(activeDate)), { ...fields, crew_id: crewCode, date: activeDate }, { merge: true });
    message.textContent = successText;
    return true;
  } catch (error) {
    console.error("Operation failed:", error);
    message.textContent = `Could not save (${errorText(error)}). Check your connection and try again.`;
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

if (moodForm) {
  moodForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = document.querySelector('#mood-message');
    if (!(await checkDate(message))) return;

    const mood = new FormData(moodForm).get('mood');
    if (!Object.hasOwn(moodNames, mood)) {
      message.textContent = 'Choose a mood first.';
      return;
    }

    const note = document.querySelector('#mood-note').value.trim();
    if (note.length > NOTE_MAX_LENGTH) {
      message.textContent = `The note can have up to ${NOTE_MAX_LENGTH} characters.`;
      return;
    }

    const saved = await saveDay(
      moodForm,
      message,
      { mood, note, mood_updated_at: serverTimestamp() },
      "Today's mood saved."
    );

    if (saved) renderMoodHistory();
  });
}

if (mealForm) {
  mealForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const message = document.querySelector('#meal-message');
    if (!(await checkDate(message))) return;

    const meals = {};

    for (const input of mealForm.querySelectorAll('[name="meal"]')) {
      meals[input.value] = input.checked;
    }

    await saveDay(
      mealForm,
      message,
      { meals, meals_updated_at: serverTimestamp() },
      "Today's meal check-in saved."
    );
  });
}

loadToday();
