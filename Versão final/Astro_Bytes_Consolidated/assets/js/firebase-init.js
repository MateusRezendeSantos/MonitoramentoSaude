/* Developed with assistance from GPT and Claude; reviewed and adapted by the project team. */

// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyDxuvdyQ6pAjS-iLk-g-3O2tGVDLfcdHqw",
  authDomain: "monitoramento-de-saude-7338d.firebaseapp.com",
  projectId: "monitoramento-de-saude-7338d",
  storageBucket: "monitoramento-de-saude-7338d.firebasestorage.app",
  messagingSenderId: "744614599754",
  appId: "1:744614599754:web:e20a1385b5119e2ae19ab3",
  measurementId: "G-DEZVEJYZ97"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 

