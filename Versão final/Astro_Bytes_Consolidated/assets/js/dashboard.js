/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

import { db } from "./firebase-init.js";
import {
  collection, doc, query, where, orderBy, getDoc, getDocs, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  loadCrewDoc, loadMemoryPhotos, saveCrewDoc
} from "./astro-store.js";

/* Modules run in strict mode. */

(async () => {
  /* Every Firestore read and write uses the astronaut code saved at sign-in. */
  const crewCode = sessionStorage.getItem("crewCode");

  if (!crewCode) {
    window.location.replace("index.html");
    return;
  }

  const DEFAULT_WIDGETS = [
    "radiation",
    "exercise",
    "companion",
    "journal",
    "memories"
  ];

  const widgetGrid = document.querySelector("#dashboard-widgets");
  const widgets = [...widgetGrid.querySelectorAll("[data-widget]")];
  const validWidgets = new Set(widgets.map((item) => item.dataset.widget));

  const settingsDialog = document.querySelector(
    "#dashboard-settings-dialog"
  );
  const settingsForm = document.querySelector("#dashboard-settings-form");
  const customizeButton = document.querySelector(
    "#customize-dashboard-button"
  );
  const settingsMessage = document.querySelector(
    "#dashboard-settings-message"
  );
  const pageMessage = document.querySelector("#dashboard-message");
  const setupNotice = document.querySelector("#dashboard-setup-notice");

  const photoCount = document.querySelector("#featured-photo-count");
  const photoOptions = document.querySelector("#featured-photo-options");

  const journalForm = document.querySelector("#dashboard-journal-form");
  const journalDate = document.querySelector("#dashboard-journal-date");
  const journalText = document.querySelector("#dashboard-journal-text");
  const journalMessage = document.querySelector(
    "#dashboard-journal-message"
  );

  let selectedPhotoIds = [];
  let journalSnapshot = { date: "", text: "" };

  /* Shared data: Companion, Reminders and Memories now live in Firestore
     (companion_progress, reminders_data and memory_photos, one set per
     astronaut code). The dashboard keeps a copy in memory for rendering. */

  let companionCache = {};
  let remindersCache = { journal: [], notes: [], tasks: [] };
  let photosCache = [];
  let remindersLoaded = false;

  function normalizeReminders(saved) {
    const source = saved && typeof saved === "object" ? saved : {};

    return {
      journal: Array.isArray(source.journal) ? source.journal : [],
      notes: Array.isArray(source.notes) ? source.notes : [],
      tasks: Array.isArray(source.tasks) ? source.tasks : []
    };
  }

  function getReminders() {
    return remindersCache;
  }

  function getPhotos() {
    return photosCache;
  }

  /* Latest saved copy, read right before a change so edits made on the
     Reminders page in the meantime are not overwritten. */

  async function readReminders() {
    return normalizeReminders(await loadCrewDoc("reminders_data", crewCode));
  }

  async function writeReminders(data) {
    await saveCrewDoc("reminders_data", crewCode, {
      journal: data.journal,
      notes: data.notes,
      tasks: data.tasks
    });
  }

  async function loadSharedData({ photos = true } = {}) {
    const [companion, reminders, memoryPhotos] = await Promise.allSettled([
      loadCrewDoc("companion_progress", crewCode),
      loadCrewDoc("reminders_data", crewCode),
      photos ? loadMemoryPhotos(crewCode) : Promise.resolve(null)
    ]);

    let failed = 0;

    if (companion.status === "fulfilled") {
      companionCache =
        companion.value && typeof companion.value === "object"
          ? companion.value
          : {};
    } else {
      failed += 1;
      console.error("Operation failed:", companion.reason);
    }

    if (reminders.status === "fulfilled") {
      remindersCache = normalizeReminders(reminders.value);
      remindersLoaded = true;
    } else {
      failed += 1;
      console.error("Operation failed:", reminders.reason);
    }

    if (photos) {
      if (memoryPhotos.status === "fulfilled") {
        photosCache = memoryPhotos.value;
      } else {
        failed += 1;
        console.error("Operation failed:", memoryPhotos.reason);
      }
    }

    if (failed > 0) {
      pageMessage.textContent =
        "Some of your saved data could not be loaded. " +
        "Check the Firestore rules and your connection.";
    }
  }

  function defaultLayout() {
    const firstPhoto = getPhotos()[0];

    return {
      widgets: [...DEFAULT_WIDGETS],
      photoCount: 1,
      photoIds: firstPhoto ? [firstPhoto.id] : []
    };
  }

  function normalizeLayout(saved) {
    if (!saved || !Array.isArray(saved.widgets)) {
      return defaultLayout();
    }

    return {
      widgets: [...new Set(saved.widgets)].filter(
        (name) => validWidgets.has(name)
      ),
      photoCount: [1, 2, 3].includes(saved.photoCount)
        ? saved.photoCount
        : 1,
      photoIds: Array.isArray(saved.photoIds)
        ? [...new Set(saved.photoIds)].filter(
            (id) => typeof id === "string"
          ).slice(0, 3)
        : []
    };
  }

  /* dashboard_preferences/{crewCode}: widgets, photoCount, photoIds, updatedAt.
     Without a saved document, the five default widgets are shown. */

  let layout = defaultLayout();
  let layoutLoaded = false;

  async function loadLayout() {
    try {
      const snap = await getDoc(doc(db, "dashboard_preferences", crewCode));
      layoutLoaded = true;
      return snap.exists() ? normalizeLayout(snap.data()) : defaultLayout();
    } catch (error) {
      console.error("Operation failed:", error);
      pageMessage.textContent =
        "Could not load your saved layout. Showing the default widgets.";
      return defaultLayout();
    }
  }

  async function saveLayout(nextLayout) {
    await setDoc(doc(db, "dashboard_preferences", crewCode), {
      widgets: nextLayout.widgets,
      photoCount: nextLayout.photoCount,
      photoIds: nextLayout.photoIds,
      updatedAt: serverTimestamp()
    });
  }

  /* Safe DOM helpers */

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
  }

  function localDateKey(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function validDate(value) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const date = new Date(`${value}T12:00:00`);

    return (
      !Number.isNaN(date.getTime()) &&
      localDateKey(date) === value
    );
  }

  /* Widget visibility and ordering */

  function applyLayout() {
    for (const widget of widgets) {
      widget.hidden = !layout.widgets.includes(widget.dataset.widget);
    }

    for (const name of layout.widgets) {
      const widget = widgets.find((item) => item.dataset.widget === name);
      if (widget) widgetGrid.append(widget);
    }

    document.querySelector("#dashboard-empty").hidden =
      layout.widgets.length > 0;

    renderFeaturedPhotos();
  }

  /* Featured memories */

  function renderFeaturedPhotos() {
    const container = document.querySelector("#dashboard-featured-photos");
    const photos = getPhotos();

    container.replaceChildren();

    const selected = layout.photoIds
      .map((id) => photos.find((photo) => photo.id === id))
      .filter(Boolean)
      .slice(0, layout.photoCount);

    for (const photo of selected) {
      const figure = element("figure", "featured-memory");
      const image = document.createElement("img");

      image.src = photo.src;
      image.alt = photo.title || "A personal memory";
      image.loading = "lazy";

      figure.append(
        image,
        element("figcaption", "", photo.title || "A personal memory")
      );

      container.append(figure);
    }

    const empty = document.querySelector("#dashboard-memories-empty");
    empty.hidden = selected.length > 0;
    empty.textContent = photos.length
      ? "Choose your featured photos using Customize Dashboard."
      : "Add a photo in Memories, then choose it using Customize Dashboard.";
  }

  function renderPhotoOptions() {
    const photos = getPhotos();
    photoOptions.replaceChildren();

    document.querySelector("#featured-photo-options-empty").hidden =
      photos.length > 0;

    document.querySelector("#featured-photo-options-empty").textContent =
      "No uploaded photos yet. Add photos on the Memories page first.";

    const limit = Number(photoCount.value);

    for (const photo of photos) {
      const label = element("label", "featured-photo-option");
      const image = document.createElement("img");

      image.src = photo.src;
      image.alt = "";
      image.loading = "lazy";

      const description = element("span", "featured-photo-option__label");
      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.value = photo.id;
      checkbox.checked = selectedPhotoIds.includes(photo.id);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (selectedPhotoIds.length >= limit) {
            checkbox.checked = false;
            settingsMessage.textContent =
              `Choose up to ${limit} featured photos.`;
            return;
          }

          selectedPhotoIds.push(photo.id);
        } else {
          selectedPhotoIds = selectedPhotoIds.filter(
            (id) => id !== photo.id
          );
        }

        settingsMessage.textContent = "";
      });

      description.append(
        checkbox,
        element("span", "", photo.title || "A personal memory")
      );

      label.append(image, description);
      photoOptions.append(label);
    }
  }

  function populateSettings(source) {
    for (const checkbox of settingsForm.querySelectorAll(
      'input[name="widgets"]'
    )) {
      checkbox.checked = source.widgets.includes(checkbox.value);
    }

    photoCount.value = String(source.photoCount);

    const availableIds = new Set(getPhotos().map((photo) => photo.id));

    selectedPhotoIds = source.photoIds
      .filter((id) => availableIds.has(id))
      .slice(0, source.photoCount);

    settingsMessage.textContent = "";
    renderPhotoOptions();
  }

  customizeButton.addEventListener("click", () => {
    populateSettings(layout);
    settingsDialog.showModal();
  });

  photoCount.addEventListener("change", () => {
    selectedPhotoIds = selectedPhotoIds.slice(0, Number(photoCount.value));
    settingsMessage.textContent = "";
    renderPhotoOptions();
  });

  document.querySelector("#restore-dashboard-defaults").addEventListener(
    "click",
    () => {
      populateSettings(defaultLayout());
      settingsMessage.textContent =
        "Default selections restored. Select Save Layout to apply them.";
    }
  );

  document.querySelector("#cancel-dashboard-settings").addEventListener(
    "click",
    () => settingsDialog.close()
  );

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selected = [...settingsForm.querySelectorAll(
      'input[name="widgets"]:checked'
    )].map((checkbox) => checkbox.value);

    /* Preserve existing order and append newly selected widgets. */

    const ordered = [
      ...layout.widgets.filter((name) => selected.includes(name)),
      ...selected.filter((name) => !layout.widgets.includes(name))
    ];

    const nextLayout = {
      widgets: ordered,
      photoCount: Number(photoCount.value),
      photoIds: [...selectedPhotoIds]
    };

    const saveButton = document.getElementById("save-dashboard-layout");
    saveButton.disabled = true;
    settingsMessage.textContent = "Saving layout...";

    try {
      await saveLayout(nextLayout);
    } catch (error) {
      console.error("Operation failed:", error);
      settingsMessage.textContent =
        "The layout could not be saved. Your current layout is unchanged.";
      saveButton.disabled = false;
      return;
    }

    saveButton.disabled = false;
    layout = nextLayout;
    applyLayout();
    settingsDialog.close();

    pageMessage.textContent = "Dashboard layout saved.";
    customizeButton.focus();
  });

  /* Companion shares purchased and equipped accessories. */

  function renderCompanion() {
    const pet = companionCache;

    document.querySelector("#dashboard-pet-tie").hidden =
      !(pet.owned?.tie === true && pet.equipped?.tie === true);

    document.querySelector("#dashboard-pet-helmet").hidden =
      !(pet.owned?.helmet === true && pet.equipped?.helmet === true);
  }

  /* Pet reactions (Cheer Up, Pet Rise, Rest) live in dashboard-preview.js. */

  /* Journal shares the same dated entries as Reminders. */

  function journalIsDirty() {
    return (
      journalText.value !== journalSnapshot.text ||
      journalDate.value !== journalSnapshot.date
    );
  }

  function loadJournal(date) {
    const entry = getReminders().journal.find(
      (item) => item && item.date === date
    );

    journalDate.value = date;
    journalText.value = typeof entry?.text === "string" ? entry.text : "";

    journalSnapshot = {
      date,
      text: journalText.value
    };

    journalMessage.textContent = "";
  }

  journalDate.addEventListener("change", () => {
    const nextDate = journalDate.value;

    if (!validDate(nextDate)) return;

    if (
      journalText.value !== journalSnapshot.text &&
      !window.confirm("Discard unsaved journal changes and switch dates?")
    ) {
      journalDate.value = journalSnapshot.date;
      return;
    }

    loadJournal(nextDate);
  });

  journalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const date = journalDate.value;
    const text = journalText.value.slice(0, 10000);

    if (!validDate(date) || !text.trim()) {
      journalMessage.textContent =
        "Choose a valid date and write an entry.";
      return;
    }

    if (!remindersLoaded) {
      journalMessage.textContent =
        "Your reminders could not be loaded, so this entry was not saved.";
      return;
    }

    const saveButton = document.getElementById("dashboard-save-journal-button");
    saveButton.disabled = true;
    journalMessage.textContent = "Saving...";

    try {
      const latest = await readReminders();
      const existing = latest.journal.find(
        (entry) => entry && entry.date === date
      );

      if (existing) {
        existing.text = text;
      } else {
        latest.journal.push({ date, text });
      }

      await writeReminders(latest);
      remindersCache = latest;
    } catch (error) {
      console.error("Operation failed:", error);
      journalMessage.textContent =
        "Your entry could not be saved. Keep this page open and try again.";
      saveButton.disabled = false;
      return;
    }

    saveButton.disabled = false;
    journalSnapshot = { date, text: journalText.value };
    journalMessage.textContent = "Journal entry saved.";
  });

  /* Recent notes */

  function renderNotes() {
    const list = document.querySelector("#dashboard-notes-list");
    list.replaceChildren();

    const notes = getReminders().notes.filter(
      (note) => note && typeof note.title === "string"
    ).slice(0, 3);

    for (const note of notes) {
      const card = element("li", "dashboard-note");

      const text = typeof note.text === "string" ? note.text : "";
      const preview = text.length > 240 ? `${text.slice(0, 240)}…` : text;

      card.append(
        element("h3", "", note.title),
        element("p", "", preview)
      );

      list.append(card);
    }

    const empty = document.querySelector("#dashboard-notes-empty");
    empty.hidden = notes.length > 0;
    empty.textContent = "No saved notes yet. Add one in Reminders.";
  }

  /* Tasks can be completed directly from the dashboard. */

  function renderTasks(focusId = null) {
    const list = document.querySelector("#dashboard-tasks-list");
    list.replaceChildren();

    const tasks = getReminders().tasks.filter(
      (task) => task && typeof task.title === "string"
    );

    const completed = tasks.filter(
      (task) => task.completed === true
    ).length;

    document.querySelector("#dashboard-task-progress").textContent =
      `${completed} of ${tasks.length} tasks completed`;

    const empty = document.querySelector("#dashboard-tasks-empty");
    empty.hidden = tasks.length > 0;
    empty.textContent = "No saved tasks yet. Add one in Reminders.";

    for (const task of tasks) {
      const item = element("li", "dashboard-task");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.checked = task.completed === true;

      checkbox.addEventListener("change", async () => {
        const nextValue = checkbox.checked;

        if (!remindersLoaded) {
          checkbox.checked = task.completed === true;
          pageMessage.textContent =
            "Your reminders could not be loaded, so tasks cannot be changed.";
          return;
        }

        checkbox.disabled = true;

        try {
          const latest = await readReminders();
          const current = latest.tasks.find(
            (entry) => entry && entry.id === task.id
          );

          if (!current) {
            remindersCache = latest;
            renderTasks();
            return;
          }

          current.completed = nextValue;

          await writeReminders(latest);
          remindersCache = latest;

          renderTasks(task.id);
          pageMessage.textContent = current.completed
            ? "Task completed."
            : "Task marked as incomplete.";
        } catch (error) {
          console.error("Operation failed:", error);
          checkbox.checked = task.completed === true;
          checkbox.disabled = false;
          pageMessage.textContent = "The task could not be updated. Try again.";
        }
      });

      label.append(
        checkbox,
        element("span", "dashboard-task__title", task.title)
      );

      item.append(label);
      list.append(item);

      if (task.id === focusId) {
        checkbox.focus({ preventScroll: true });
      }
    }
  }

  /* Render the shared data that is already in memory. */

  function renderSharedData() {
    renderCompanion();
    renderNotes();
    renderTasks();
    renderFeaturedPhotos();

    if (!journalIsDirty()) {
      loadJournal(journalDate.value || localDateKey());
    }
  }

  /* Reload the small documents after returning from another page or tab.
     Photos are only reloaded when the page is restored from the cache. */

  async function refreshSharedData(options) {
    await loadSharedData(options);
    renderSharedData();
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshSharedData({ photos: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && layoutLoaded) {
      refreshSharedData({ photos: false });
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!journalIsDirty()) return;

    event.preventDefault();
    event.returnValue = "";
  });

  function setText(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  /* Initialize controls after the saved layout has loaded, so an early
     Save Layout can never overwrite the stored preferences. */

  setText(
    "dashboard-setup-notice",
    "Your layout, companion, journal, notes, tasks and photos are saved per " +
    "astronaut code. Without Firebase Authentication this is not a private " +
    "account: anyone who knows a code can open that profile."
  );

  await loadSharedData();
  loadJournal(localDateKey());
  renderSharedData();


  layout = await loadLayout();
  applyLayout();

  for (const id of [
    "customize-dashboard-button",
    "restore-dashboard-defaults",
    "cancel-dashboard-settings",
    "save-dashboard-layout",
    "dashboard-pet-button",
    "dashboard-journal-date",
    "dashboard-journal-text",
    "dashboard-save-journal-button"
  ]) {
    document.getElementById(id).disabled = false;
  }


})();