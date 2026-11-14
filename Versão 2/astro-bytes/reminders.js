"use strict";

(() => {
  /* Configuration */

  const STORAGE_KEY = "astroBytes.reminders.demo.v1";

  const journalForm = document.querySelector("#journal-form");
  const journalDate = document.querySelector("#journal-date");
  const journalText = document.querySelector("#journal-text");
  const journalMessage = document.querySelector("#journal-message");
  const journalDialog = document.querySelector("#journal-dialog");
  const journalEntryList = document.querySelector("#journal-entry-list");
  const journalReaderContent = document.querySelector("#journal-reader-content");
  const journalReaderEmpty = document.querySelector("#journal-reader-empty");

  const notesList = document.querySelector("#notes-list");
  const notesEmpty = document.querySelector("#notes-empty");
  const noteDialog = document.querySelector("#note-dialog");
  const noteForm = document.querySelector("#note-form");
  const noteId = document.querySelector("#note-id");
  const noteTitle = document.querySelector("#note-title");
  const noteText = document.querySelector("#note-text");
  const noteMessage = document.querySelector("#note-message");

  const tasksList = document.querySelector("#tasks-list");
  const tasksEmpty = document.querySelector("#tasks-empty");
  const taskDialog = document.querySelector("#task-dialog");
  const taskForm = document.querySelector("#task-form");
  const taskTitle = document.querySelector("#task-title");
  const taskDate = document.querySelector("#task-date");
  const taskMessage = document.querySelector("#task-message");

  const pageMessage = document.querySelector("#reminders-message");
  const storageNotice = document.querySelector("#reminders-storage-notice");

  let storageAvailable = true;
  let selectedEntryDate = null;
  let editorSnapshot = { date: "", text: "" };

  /* Dates use the browser's local calendar. */

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function isValidDate(value) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && localDateKey(date) === value;
  }

  function formatDate(value) {
    if (!isValidDate(value)) return value;

    return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatTimestamp(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /* Storage */

  function emptyData() {
    return {
      journal: [],
      notes: [],
      tasks: []
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();

      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") {
        throw new Error("Invalid saved data.");
      }

      const result = emptyData();

      /* Keep only valid records and remove duplicate identifiers. */

      const journalByDate = new Map();

      if (Array.isArray(saved.journal)) {
        for (const entry of saved.journal) {
          if (
            entry &&
            isValidDate(entry.date) &&
            typeof entry.text === "string"
          ) {
            journalByDate.set(entry.date, {
              date: entry.date,
              text: entry.text.slice(0, 10000)
            });
          }
        }
      }

      result.journal = [...journalByDate.values()];

      const noteIds = new Set();

      if (Array.isArray(saved.notes)) {
        for (const note of saved.notes) {
          if (
            note &&
            typeof note.id === "string" &&
            !noteIds.has(note.id) &&
            typeof note.title === "string" &&
            typeof note.text === "string"
          ) {
            noteIds.add(note.id);

            result.notes.push({
              id: note.id,
              title: note.title.slice(0, 80),
              text: note.text.slice(0, 2000),
              updatedAt:
                typeof note.updatedAt === "string" ? note.updatedAt : ""
            });
          }
        }
      }

      const taskIds = new Set();

      if (Array.isArray(saved.tasks)) {
        for (const task of saved.tasks) {
          if (
            task &&
            typeof task.id === "string" &&
            !taskIds.has(task.id) &&
            typeof task.title === "string"
          ) {
            taskIds.add(task.id);

            result.tasks.push({
              id: task.id,
              title: task.title.slice(0, 160),
              dueDate: isValidDate(task.dueDate) ? task.dueDate : "",
              completed: task.completed === true
            });
          }
        }
      }

      return result;
    } catch {
      storageAvailable = false;
      return emptyData();
    }
  }

  const data = loadData();

  function updateStorageNotice() {
    storageNotice.textContent = storageAvailable
      ? "Saved in this browser for the demo, shared across demo profiles. This is not a secure private journal. Clearing site data removes saved entries."
      : "Browser storage is unavailable. Changes are kept only for this session and may be lost when the page closes.";
  }

  function persistData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }

    updateStorageNotice();
    return storageAvailable;
  }

  function saveMessage(message, persisted) {
    return persisted
      ? message
      : `${message} Kept for this session only; browser storage is unavailable.`;
  }

  /* DOM helpers keep user-written content as plain text. */

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  function makeButton(text, className, onClick) {
    const button = makeElement("button", className, text);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  /* Journal editor */

  function hasUnsavedJournalChanges() {
    return (
      journalDate.value !== editorSnapshot.date ||
      journalText.value !== editorSnapshot.text
    );
  }

  function loadJournalDate(date) {
    const entry = data.journal.find((item) => item.date === date);

    journalDate.value = date;
    journalText.value = entry?.text || "";

    editorSnapshot = {
      date,
      text: journalText.value
    };

    journalMessage.textContent = "";
  }

  journalDate.addEventListener("change", () => {
    const nextDate = journalDate.value;

    if (!isValidDate(nextDate)) return;

    /* Check text changes before replacing the editor's contents. */

    if (
      journalText.value !== editorSnapshot.text &&
      !window.confirm("Discard unsaved journal changes and switch dates?")
    ) {
      journalDate.value = editorSnapshot.date;
      return;
    }

    loadJournalDate(nextDate);
  });

  journalForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const date = journalDate.value;
    const text = journalText.value;

    if (!isValidDate(date)) {
      journalMessage.textContent = "Choose a valid entry date.";
      journalDate.focus();
      return;
    }

    if (!text.trim()) {
      journalMessage.textContent = "Write something before saving.";
      journalText.focus();
      return;
    }

    const existingEntry = data.journal.find(
      (entry) => entry.date === date
    );

    if (existingEntry) {
      existingEntry.text = text;
    } else {
      data.journal.push({ date, text });
    }

    editorSnapshot = { date, text };

    const persisted = persistData();

    journalMessage.textContent = saveMessage(
      existingEntry ? "Journal entry updated." : "Journal entry saved.",
      persisted
    );
  });

  /* Journal reader */

  function selectJournalEntry(date) {
    const entry = data.journal.find((item) => item.date === date);
    if (!entry) return;

    selectedEntryDate = date;

    document.querySelector("#journal-entry-title").textContent =
      `Entry for ${formatDate(date)}`;

    const dateElement = document.querySelector("#journal-entry-date");
    dateElement.dateTime = date;
    dateElement.textContent = formatDate(date);
    dateElement.hidden = false;

    document.querySelector("#journal-entry-text").textContent = entry.text;

    for (const button of journalEntryList.querySelectorAll("button")) {
      if (button.dataset.date === date) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  function renderJournalReader() {
    journalEntryList.replaceChildren();

    const entries = [...data.journal].sort(
      (first, second) => second.date.localeCompare(first.date)
    );

    journalReaderEmpty.hidden = entries.length > 0;
    journalReaderContent.hidden = entries.length === 0;

    if (!entries.length) return;

    for (const entry of entries) {
      const item = document.createElement("li");

      const button = makeButton(
        formatDate(entry.date),
        "journal-entry-button",
        () => selectJournalEntry(entry.date)
      );

      button.dataset.date = entry.date;
      item.append(button);
      journalEntryList.append(item);
    }

    const selectedExists = entries.some(
      (entry) => entry.date === selectedEntryDate
    );

    selectJournalEntry(
      selectedExists ? selectedEntryDate : entries[0].date
    );
  }

  document.querySelector("#read-journal-button").addEventListener(
    "click",
    () => {
      renderJournalReader();

      if (!journalDialog.open) {
        journalDialog.showModal();
      }
    }
  );

  /* Quick notes */

  function openNoteEditor(note = null) {
    noteForm.reset();
    noteId.value = note?.id || "";
    noteTitle.value = note?.title || "";
    noteText.value = note?.text || "";
    noteMessage.textContent = "";

    document.querySelector("#note-dialog-title").textContent =
      note ? "Edit Note" : "Add Note";

    noteDialog.showModal();
    noteTitle.focus();
  }

  function renderNotes(focusIndex = null) {
    notesList.replaceChildren();
    notesEmpty.hidden = data.notes.length > 0;

    data.notes.forEach((note, index) => {
      const card = makeElement("li", "note-card");

      const title = makeElement("h3", "note-card__title", note.title);
      const text = makeElement("p", "note-card__text", note.text);
      const date = makeElement(
        "span",
        "note-card__date",
        `Updated ${formatTimestamp(note.updatedAt) || "this session"}`
      );

      const actions = makeElement("div", "note-card__actions");

      const editButton = makeButton("Edit", "", () => {
        openNoteEditor(note);
      });

      editButton.setAttribute("aria-label", `Edit note: ${note.title}`);

      const deleteButton = makeButton("Delete", "", () => {
        if (!window.confirm(`Delete the note "${note.title}"?`)) return;

        data.notes = data.notes.filter((item) => item.id !== note.id);
        const persisted = persistData();

        renderNotes(index);

        pageMessage.textContent = saveMessage("Note deleted.", persisted);
      });

      deleteButton.setAttribute(
        "aria-label",
        `Delete note: ${note.title}`
      );

      actions.append(editButton, deleteButton);
      card.append(title, text, date, actions);
      notesList.append(card);
    });

    if (focusIndex !== null) {
      const cards = notesList.children;
      const nextCard = cards[Math.min(focusIndex, cards.length - 1)];

      const target = nextCard?.querySelector("button")
        || document.querySelector("#add-note-button");

      target.focus({ preventScroll: true });
    }
  }

  document.querySelector("#add-note-button").addEventListener(
    "click",
    () => openNoteEditor()
  );

  noteForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = noteTitle.value.trim();
    const text = noteText.value.trim();

    if (!title || !text) {
      noteMessage.textContent = "Enter a title and note.";
      (!title ? noteTitle : noteText).focus();
      return;
    }

    const existingNote = data.notes.find(
      (note) => note.id === noteId.value
    );

    if (existingNote) {
      existingNote.title = title;
      existingNote.text = text;
      existingNote.updatedAt = new Date().toISOString();
    } else {
      data.notes.unshift({
        id: createId(),
        title,
        text,
        updatedAt: new Date().toISOString()
      });
    }

    const persisted = persistData();

    renderNotes();
    noteDialog.close();

    document.querySelector("#add-note-button").focus({
      preventScroll: true
    });

    pageMessage.textContent = saveMessage(
      existingNote ? "Note updated." : "Note added.",
      persisted
    );
  });

  /* Tasks */

  function renderTasks(focusIndex = null, focusDelete = false) {
    tasksList.replaceChildren();
    tasksEmpty.hidden = data.tasks.length > 0;

    const completed = data.tasks.filter((task) => task.completed).length;

    document.querySelector("#task-progress").textContent =
      `${completed} of ${data.tasks.length} tasks completed`;

    data.tasks.forEach((task, index) => {
      const item = makeElement(
        "li",
        task.completed
          ? "task-item task-item--completed"
          : "task-item"
      );

      const label = makeElement("label", "task-item__label");

      const checkbox = makeElement("input", "task-item__checkbox");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;

      const content = makeElement("span", "task-item__content");
      const title = makeElement(
        "span",
        "task-item__title",
        task.title
      );

      content.append(title);

      if (task.dueDate) {
        const date = makeElement(
          "time",
          "task-item__date",
          `Due ${formatDate(task.dueDate)}`
        );

        date.dateTime = task.dueDate;
        content.append(date);
      }

      checkbox.addEventListener("change", () => {
        task.completed = checkbox.checked;

        const persisted = persistData();

        renderTasks(index);

        pageMessage.textContent = saveMessage(
          task.completed ? "Task completed." : "Task marked as incomplete.",
          persisted
        );
      });

      label.append(checkbox, content);

      const deleteButton = makeButton(
        "Delete",
        "task-item__delete",
        () => {
          if (!window.confirm(`Delete the task "${task.title}"?`)) return;

          data.tasks = data.tasks.filter((entry) => entry.id !== task.id);
          const persisted = persistData();

          renderTasks(index, true);

          pageMessage.textContent = saveMessage(
            "Task deleted.",
            persisted
          );
        }
      );

      deleteButton.setAttribute(
        "aria-label",
        `Delete task: ${task.title}`
      );

      item.append(label, deleteButton);
      tasksList.append(item);
    });

    if (focusIndex !== null) {
      const items = tasksList.children;
      const nextItem = items[Math.min(focusIndex, items.length - 1)];

      const target = nextItem?.querySelector(
        focusDelete ? "button" : "input"
      ) || document.querySelector("#add-task-button");

      target.focus({ preventScroll: true });
    }
  }

  document.querySelector("#add-task-button").addEventListener(
    "click",
    () => {
      taskForm.reset();
      taskMessage.textContent = "";
      taskDialog.showModal();
      taskTitle.focus();
    }
  );

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = taskTitle.value.trim();
    const dueDate = taskDate.value;

    if (!title) {
      taskMessage.textContent = "Enter a task.";
      taskTitle.focus();
      return;
    }

    if (dueDate && !isValidDate(dueDate)) {
      taskMessage.textContent = "Choose a valid due date.";
      taskDate.focus();
      return;
    }

    data.tasks.push({
      id: createId(),
      title,
      dueDate,
      completed: false
    });

    const persisted = persistData();

    renderTasks();
    taskDialog.close();

    pageMessage.textContent = saveMessage("Task added.", persisted);
  });

  /* Warn before leaving with an unsaved journal entry. */

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedJournalChanges()) return;

    event.preventDefault();
    event.returnValue = "";
  });

  /* Initialize controls and saved records. */

  const controls = [
    "#journal-date",
    "#journal-text",
    "#save-journal-button",
    "#read-journal-button",
    "#add-note-button",
    "#add-task-button",
    "#save-note-button",
    "#save-task-button"
  ];

  for (const selector of controls) {
    document.querySelector(selector).disabled = false;
  }

  loadJournalDate(localDateKey());
  renderNotes();
  renderTasks();
  updateStorageNotice();
})();