// src/lib/firebase.ts
// Configuration Firebase - remplace les valeurs par celles de ta console Firebase
// ou utilise les variables d'environnement dans .env.local

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Évite la réinitialisation en hot-reload Next.js
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// ignoreUndefinedProperties : les champs `undefined` sont ignorés à l'écriture
// au lieu de lever une erreur (ex. members[].permission pour un propriétaire,
// ou items clonés sans dueDate/note/attachments lors d'une sauvegarde de modèle).
// initializeFirestore lève si déjà initialisé (hot-reload Next) → fallback getFirestore.
// experimentalForceLongPolling : sur mobile / réseau local (LAN), certains réseaux et
// navigateurs bloquent le transport WebChannel streaming de Firestore → onSnapshot ne
// renvoie jamais son premier snapshot → app bloquée sur le spinner. L'auto-détection
// ne basculant pas de façon fiable, on FORCE le long polling (fiable, léger surcoût réseau
// acceptable à cette échelle). Fonctionne aussi bien sur desktop.
let _db;
try {
  _db = initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalForceLongPolling: true });
} catch {
  _db = getFirestore(app);
}
export const db = _db;

export const storage = getStorage(app);

// Persistance offline désactivée intentionnellement :
// enableIndexedDbPersistence est déprécié et cause des
// "INTERNAL ASSERTION FAILED" en dev Next.js (hot-reload).
// La persistance peut être réactivée en prod si nécessaire.

export default app;
