/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

// astro-store.js
// Shared Firestore helpers for the pages that used to keep data in localStorage
// (Companion, Reminders and Memories). Every record belongs to the astronaut
// whose code is stored in sessionStorage by the login page (index.html).
//
// Firestore layout:
//   companion_progress/<code>   coins, owned, equipped, updated_at
//   reminders_data/<code>       journal[], notes[], tasks[], updated_at
//   memory_photos/<auto id>     crew_id, title, date, album, src, created_ms

import { db } from "./firebase-init.js";
import {
  collection, deleteDoc, doc, getDoc, getDocs, addDoc, query, serverTimestamp,
  setDoc, where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const MAX_COINS = 1000000000;

/* Largest photo kept in Firestore (characters of the data URL). A document
   can hold at most 1 MiB, so this leaves room for the other fields. */
export const MAX_PHOTO_CHARS = 800000;

const PHOTO_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

/* ---------- Login session ---------- */

export function getCrewCode() {
  try {
    return sessionStorage.getItem("crewCode") || null;
  } catch {
    return null;
  }
}

/* Returns the astronaut code, or sends the visitor back to the login page. */
export function requireCrewCode() {
  const code = getCrewCode();

  if (!code) {
    window.location.replace("index.html");
    return null;
  }

  return code;
}

/* ---------- One document per astronaut ---------- */

/* Returns the stored fields, or null when nothing has been saved yet. */
export async function loadCrewDoc(collectionName, crewCode) {
  const snap = await getDoc(doc(db, collectionName, crewCode));
  return snap.exists() ? snap.data() : null;
}

/* Replaces the astronaut's document. updated_at is set by the server. */
export async function saveCrewDoc(collectionName, crewCode, fields) {
  await setDoc(doc(db, collectionName, crewCode), {
    ...fields,
    updated_at: serverTimestamp()
  });
}

/* ---------- Memories: one document per photo ---------- */

/* Newest first. Photos whose image data does not look like a JPEG data URL
   are skipped, because the image is inserted into the page. */
export async function loadMemoryPhotos(crewCode) {
  const snap = await getDocs(
    query(collection(db, "memory_photos"), where("crew_id", "==", crewCode))
  );

  return snap.docs
    .map((entry) => ({ ...entry.data(), id: entry.id }))
    .filter((photo) =>
      typeof photo.src === "string" &&
      photo.src.length <= MAX_PHOTO_CHARS &&
      PHOTO_PATTERN.test(photo.src) &&
      typeof photo.title === "string" &&
      typeof photo.date === "string" &&
      typeof photo.album === "string"
    )
    .map((photo) => ({
      id: photo.id,
      src: photo.src,
      title: photo.title,
      date: photo.date,
      album: photo.album,
      created_ms: Number.isFinite(photo.created_ms) ? photo.created_ms : 0
    }))
    .sort((first, second) => second.created_ms - first.created_ms);
}

/* Saves one photo and returns the id of the new document. */
export async function addMemoryPhoto(crewCode, photo) {
  if (!PHOTO_PATTERN.test(photo.src) || photo.src.length > MAX_PHOTO_CHARS) {
    throw new Error("The image is invalid or too large.");
  }
  const created = await addDoc(collection(db, "memory_photos"), {
    crew_id: crewCode,
    title: photo.title,
    date: photo.date,
    album: photo.album,
    src: photo.src,
    created_ms: Date.now()
  });

  return created.id;
}

export async function deleteMemoryPhoto(photoId) {
  const crewCode = requireCrewCode();
  if (!crewCode) throw new Error("No selected crew profile.");
  const photo = await getDoc(doc(db, "memory_photos", photoId));
  if (!photo.exists() || photo.data().crew_id !== crewCode) {
    throw new Error("Photo does not belong to the selected profile.");
  }
  await deleteDoc(doc(db, "memory_photos", photoId));
}
