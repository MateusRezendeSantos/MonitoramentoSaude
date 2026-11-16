/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";
import { MAX_PHOTO_CHARS, loadMemoryPhotos, addMemoryPhoto, deleteMemoryPhoto, requireCrewCode } from "./astro-store.js";

(() => {
  /* Demonstration cards are not personal photographs. */
  const SAMPLE = [
    {
      "id": "s1",
      "emoji": "👨‍👩‍👧",
      "title": "Sunday breakfast",
      "date": "Spring 2026",
      "album": "Family",
      "a": "#ffd3a8",
      "b": "#ff9ec7"
    },
    {
      "id": "s2",
      "emoji": "🐶",
      "title": "Biscuit waiting by the door",
      "date": "Last summer",
      "album": "Pets",
      "a": "#ffe9a8",
      "b": "#ffb37a"
    },
    {
      "id": "s3",
      "emoji": "🎂",
      "title": "Mom’s birthday",
      "date": "March 2026",
      "album": "Family",
      "a": "#ffc8e0",
      "b": "#c3aaff"
    },
    {
      "id": "s4",
      "emoji": "🌻",
      "title": "Grandma’s garden",
      "date": "July 2025",
      "album": "Home",
      "a": "#d8f5a8",
      "b": "#7fe3b0"
    },
    {
      "id": "s5",
      "emoji": "🏖️",
      "title": "Beach day with cousins",
      "date": "January 2026",
      "album": "Family",
      "a": "#a8ecff",
      "b": "#8fb4ff"
    },
    {
      "id": "s6",
      "emoji": "🐱",
      "title": "Mochi on the sofa",
      "date": "Last winter",
      "album": "Pets",
      "a": "#e3d1ff",
      "b": "#ffc8e0"
    },
    {
      "id": "s7",
      "emoji": "🥳",
      "title": "Farewell dinner with friends",
      "date": "Before launch",
      "album": "Friends",
      "a": "#ffb8c6",
      "b": "#ffd98f"
    },
    {
      "id": "s8",
      "emoji": "🏡",
      "title": "Our front porch",
      "date": "Autumn 2025",
      "album": "Home",
      "a": "#b8e6ff",
      "b": "#d6c4ff"
    }
  ];

  /* Keep this key unchanged for compatibility with the dashboard. */
  const STORAGE_KEY = "memories-photos-v1";
  const byId = (id) => document.getElementById(id);
  const grid = byId("grid");
  const dialog = byId("dlg");

  const crewCode = requireCrewCode();
  if (!crewCode) return;
  let photos = [];
  let activeAlbum = "All";
  let visiblePhotos = [];
  let selectedIndex = 0;
  let toastTimer;

  function validPhoto(photo) {
    return photo &&
      typeof photo.id === "string" &&
      typeof photo.title === "string" &&
      typeof photo.date === "string" &&
      typeof photo.album === "string" &&
      typeof photo.src === "string" &&
      /^data:image\/(jpeg|png|webp);base64,/i.test(photo.src);
  }

  function showToast(message) {
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 4000);
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function allPhotos() {
    return [...photos, ...SAMPLE];
  }

  function populatePhoto(container, photo) {
    container.replaceChildren();
    container.style.background = photo.src
      ? "#ffffff"
      : `linear-gradient(135deg, ${photo.a}, ${photo.b})`;

    if (photo.src) {
      const image = document.createElement("img");
      image.src = photo.src;
      image.alt = photo.title;
      container.append(image);
    } else {
      const emoji = createElement("span", "", photo.emoji);
      emoji.setAttribute("aria-hidden", "true");
      container.append(emoji);
    }
  }

  function renderAlbums() {
    const container = byId("chips");
    const albums = ["All", ...new Set(allPhotos().map((photo) => photo.album))];
    container.replaceChildren();

    for (const album of albums) {
      const button = createElement("button", "chip", album);
      button.type = "button";
      button.dataset.album = album;
      button.setAttribute("aria-pressed", String(album === activeAlbum));
      button.addEventListener("click", () => {
        activeAlbum = album;
        render();
        const replacement = [...container.children].find(
          (item) => item.dataset.album === album
        );
        replacement?.focus({ preventScroll: true });
      });
      container.append(button);
    }
  }

  function render() {
    visiblePhotos = allPhotos().filter(
      (photo) => activeAlbum === "All" || photo.album === activeAlbum
    );
    renderAlbums();
    grid.replaceChildren();

    if (!visiblePhotos.length) {
      grid.append(createElement("p", "empty", "No photos in this album yet."));
      return;
    }

    visiblePhotos.forEach((photo, index) => {
      const card = createElement("button", "polaroid");
      card.type = "button";
      card.style.setProperty("--tilt", `${((index * 37) % 7 - 3) * 0.9}deg`);
      card.setAttribute("aria-label", `Open ${photo.title}`);

      const heart = createElement("span", "heart", "💖");
      heart.setAttribute("aria-hidden", "true");
      const preview = createElement("div", "photo");
      populatePhoto(preview, photo);

      card.append(
        heart,
        preview,
        createElement("div", "cap", photo.title),
        createElement("div", "date", photo.date)
      );
      card.addEventListener("click", () => openPhoto(index));
      grid.append(card);
    });
  }

  /* Photo viewer */
  function openPhoto(index) {
    if (!visiblePhotos.length) return;
    selectedIndex = (index + visiblePhotos.length) % visiblePhotos.length;
    const photo = visiblePhotos[selectedIndex];

    populatePhoto(byId("dPhoto"), photo);
    byId("dTitle").textContent = photo.title;
    byId("dDate").textContent = `${photo.date} · ${photo.album}`;
    byId("del").hidden = !photo.src;
    byId("prev").hidden = visiblePhotos.length < 2;
    byId("next").hidden = visiblePhotos.length < 2;

    if (!dialog.open) dialog.showModal();
  }

  byId("close").addEventListener("click", () => dialog.close());
  byId("prev").addEventListener("click", () => openPhoto(selectedIndex - 1));
  byId("next").addEventListener("click", () => openPhoto(selectedIndex + 1));

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      openPhoto(selectedIndex - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      openPhoto(selectedIndex + 1);
    }
  });

  byId("del").addEventListener("click", async () => {
    const photo = visiblePhotos[selectedIndex];
    if (!photo?.src || !confirm(`Remove the photo "${photo.title}"?`)) return;

    const button = byId("del");
    if (button.disabled) return;
    button.disabled = true;
    try {
      await deleteMemoryPhoto(photo.id);
      photos = photos.filter((item) => item.id !== photo.id);
    } catch (error) {
      console.error("Could not delete photo:", error);
      showToast("Could not delete the photo. Try again.");
      return;
    } finally {
      button.disabled = false;
    }

    dialog.close();
    if (!allPhotos().some((item) => item.album === activeAlbum)) {
      activeAlbum = "All";
    }
    render();
    byId("addBtn").focus();
    showToast("Photo removed.");
  });

  /* Resize uploads before saving them in browser storage. */
  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        try {
          const scale = Math.min(1, 900 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Image processing unavailable.");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unsupported image."));
      };
      image.src = objectUrl;
    });
  }

  byId("addBtn").addEventListener("click", () => byId("file").click());

  byId("file").addEventListener("change", async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;

    const targetAlbum = activeAlbum === "All" ? "Family" : activeAlbum;
    byId("addBtn").disabled = true;
    let savedCount = 0;
    let failedCount = 0;

    try {
      for (const file of files) {
        try {
          const src = await resizePhoto(file);
          const title = file.name
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]+/g, " ")
            .trim() || "New memory";

          const photo = {
            id: `u${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
            src,
            title,
            date: new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric"
            }),
            album: targetAlbum
          };

          if (src.length > MAX_PHOTO_CHARS) throw new Error("Image too large.");
          photo.id = await addMemoryPhoto(crewCode, photo);
          photos.unshift(photo);
          savedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
    } finally {
      byId("addBtn").disabled = false;
      render();
      showToast(
        `${savedCount} photo(s) saved.` +
        (failedCount ? ` ${failedCount} could not be saved or opened.` : "")
      );
    }
  });

  async function initializeGallery() {
    byId("addBtn").disabled = true;
    try {
      photos = await loadMemoryPhotos(crewCode);
      render();
      byId("addBtn").disabled = false;
    } catch (error) {
      console.error("Could not load photos:", error);
      showToast("Could not load your photos. Check your connection and Firestore access.");
    }
  }

  render();
  initializeGallery();
})();
