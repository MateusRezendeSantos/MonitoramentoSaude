/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

"use strict";

(async () => {
  const crewCode = sessionStorage.getItem("crewCode");

  if (!crewCode) {
    window.location.replace("index.html");
    return;
  }

  /* Replace the demonstration identity while the profile loads. */

  const nameElements = document.querySelectorAll("[data-crew-name]");
  const roleElements = document.querySelectorAll("[data-crew-role]");
  const codeElements = document.querySelectorAll("[data-crew-code]");

  nameElements.forEach((element) => {
    element.textContent = "Loading profile...";
  });

  roleElements.forEach((element) => {
    element.textContent = "";
  });

  codeElements.forEach((element) => {
    element.textContent = crewCode;
  });

  /* Clear the selected profile when leaving the session. */

  document.querySelectorAll("[data-session-exit]").forEach((link) => {
    link.addEventListener("click", () => {
      sessionStorage.removeItem("crewCode");
    });
  });

  try {
    const [{ db }, { doc, getDoc }] = await Promise.all([
      import("./firebase-init.js"),
      import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
      )
    ]);

    const snapshot = await getDoc(
      doc(db, "astronauts", crewCode)
    );

    if (!snapshot.exists()) {
      sessionStorage.removeItem("crewCode");
      window.location.replace("index.html");
      return;
    }

    const crew = snapshot.data();

    const name = crew.name || crew.full_name || crew.nome;
    const role = crew.role || crew.position || crew.cargo;

    nameElements.forEach((element) => {
      element.textContent =
        typeof name === "string" && name.trim()
          ? name
          : crewCode;
    });

    roleElements.forEach((element) => {
      element.textContent =
        typeof role === "string" && role.trim()
          ? role
          : "Crew Member";
    });
  } catch (error) {
    console.error("Could not load crew profile:", error);

    nameElements.forEach((element) => {
      element.textContent = crewCode;
    });

    roleElements.forEach((element) => {
      element.textContent = "Profile unavailable";
    });
  }
})();