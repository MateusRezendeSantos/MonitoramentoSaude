/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

const form = document.querySelector("#login-form");
    const input = document.querySelector("#crew-code");
    const message = document.querySelector("#login-message");
    const button = document.querySelector("#login-button");

    let connectionPromise = null;

    function showMessage(text, state = "info") {
      message.textContent = text;
      message.dataset.state = state;
    }

    /* Load Firebase only after the user submits the form. */
    function connectDatabase() {
      if (!connectionPromise) {
        connectionPromise = Promise.all([
          import("./firebase-init.js"),
          import(
            "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
          )
        ]).then(([firebaseModule, firestoreModule]) => {
          if (!firebaseModule.db) {
            throw new Error("Firestore was not initialized.");
          }

          return {
            db: firebaseModule.db,
            doc: firestoreModule.doc,
            getDoc: firestoreModule.getDoc
          };
        }).catch((error) => {
          connectionPromise = null;
          throw error;
        });
      }

      return connectionPromise;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (button.disabled) return;

      const code = input.value.trim().toUpperCase();
      input.value = code;

      if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
        showMessage(
          "Use 3 to 20 letters, numbers, or hyphens. Example: ISS-71-01.",
          "error"
        );
        input.focus();
        return;
      }

      button.disabled = true;
      input.readOnly = true;
      button.textContent = "Checking...";

      showMessage("Looking up your crew profile...");

      try {
        const { db, doc, getDoc } = await connectDatabase();

        const snapshot = await getDoc(
          doc(db, "astronauts", code)
        );

        if (!snapshot.exists()) {
          showMessage(
            "Astronaut code not found. Check your code and try again.",
            "error"
          );
          return;
        }

        sessionStorage.setItem("crewCode", code);
        window.location.assign("dashboard.html");
      } catch (error) {
        console.error("Crew profile lookup failed:", error);

        let text =
          "Could not connect. Check your connection and try again.";

        if (error.code === "permission-denied") {
          text =
            "The database did not allow this request. Ask the team to check the Firestore access rules.";
        } else if (error.name === "SecurityError") {
          text =
            "Session storage is unavailable. Allow site storage and try again.";
        }

        showMessage(text, "error");
      } finally {
        button.disabled = false;
        input.readOnly = false;
        button.textContent = "Sign In";

        if (message.dataset.state === "error") {
          input.focus();
        }
      }
    });
