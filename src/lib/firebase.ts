import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getEnv } from "./env";

const env = getEnv();

const firebaseApp = initializeApp({
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
});

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const adminEmails = env.adminEmails;
