/**
 * One-off maintenance: delete ALL documents in the `orders` collection.
 *
 * Not exposed in the app. Requires admin auth (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env).
 *
 * Firestore rules currently block deletes (allow delete: if false). Before running:
 *   1. In firestore.rules, temporarily change orders delete to: allow delete: if isAdmin();
 *   2. firebase deploy --only firestore:rules
 *   3. npm run clear-orders -- --confirm
 *   4. Revert delete rule to: allow delete: if false;
 *   5. firebase deploy --only firestore:rules
 *
 * Faster alternative (no rule change): Firebase Console → Firestore → orders → delete documents.
 *
 * Usage:
 *   npm run clear-orders              # dry run (count only)
 *   npm run clear-orders -- --confirm # actually delete
 */

import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
} from "firebase/firestore";

const BATCH_SIZE = 500;

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(`Missing env vars: ${missingKeys.join(", ")}`);
}

const seedEmail = process.env.SEED_ADMIN_EMAIL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (!seedEmail || !seedPassword) {
  throw new Error("Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in .env");
}

const args = new Set(process.argv.slice(2));
const isConfirmed = args.has("--confirm");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const credentials = await signInWithEmailAndPassword(auth, seedEmail, seedPassword);
console.log(`[clear-orders] project: ${firebaseConfig.projectId}`);
console.log(`[clear-orders] signed in as: ${credentials.user.email ?? seedEmail}`);

const snapshot = await getDocs(collection(db, "orders"));
const orderIds = snapshot.docs.map((entry) => entry.id);

console.log(`[clear-orders] found ${orderIds.length} order document(s).`);

if (orderIds.length === 0) {
  console.log("[clear-orders] nothing to delete.");
  await signOut(auth).catch(() => undefined);
  process.exit(0);
}

if (!isConfirmed) {
  console.log("[clear-orders] dry run only. Pass --confirm to delete.");
  console.log("[clear-orders] example: npm run clear-orders -- --confirm");
  await signOut(auth).catch(() => undefined);
  process.exit(0);
}

let deleted = 0;
try {
  for (let offset = 0; offset < orderIds.length; offset += BATCH_SIZE) {
    const chunk = orderIds.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((orderId) => {
      batch.delete(doc(db, "orders", orderId));
    });
    await batch.commit();
    deleted += chunk.length;
    console.log(`[clear-orders] deleted ${deleted}/${orderIds.length}`);
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "permission-denied") {
    console.error("[clear-orders] PERMISSION_DENIED: Firestore rules block order deletes.");
    console.error("[clear-orders] In firestore.rules line ~171, temporarily use: allow delete: if isAdmin();");
    console.error("[clear-orders] Then: firebase deploy --only firestore:rules");
    console.error("[clear-orders] Re-run: npm run clear-orders -- --confirm");
    console.error("[clear-orders] Then revert to: allow delete: if false; and deploy rules again.");
    console.error("[clear-orders] Or use in-app Route tools → Clear all (archives, does not delete).");
    await signOut(auth).catch(() => undefined);
    process.exit(1);
  }
  throw error;
}

console.log(`[clear-orders] done. Removed ${deleted} order(s).`);
console.log(
  "[clear-orders] note: stock/packaging counts are unchanged. Reset stock on the Stock tab if test orders deducted inventory.",
);

await signOut(auth).catch(() => undefined);
