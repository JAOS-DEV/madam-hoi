import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

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
  throw new Error(`Missing env vars for seed: ${missingKeys.join(", ")}`);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const seedEmail = process.env.SEED_ADMIN_EMAIL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (!seedEmail || !seedPassword) {
  throw new Error(
    "Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD. Add both to .env to run seed against production-mode rules.",
  );
}

await signInWithEmailAndPassword(auth, seedEmail, seedPassword);

const mainSettings = {
  orderingOpen: true,
  announcement: "Fresh Hoi Kraeng available today",
  phoneNumber: "063-141-8856",
  dispatchPoint: {
    address: "Pattaya Klang, Pattaya City, Chon Buri, Thailand",
  },
  deliveryMessage: {
    template: "estimated_range",
    startTime: "19:00",
    endTime: "22:00",
  },
  bankTransfer: {
    enabled: true,
    bankName: "Kasikorn Bank",
    accountName: "Madam Hoi",
    accountNumber: "123-4-56789-0",
    noteTh: "กรุณาโอนเงินเมื่อได้รับสินค้า",
    noteEn: "Please transfer when your order is delivered.",
  },
  productSettings: {
    regular: {
      label: "Regular Hoi Kraeng",
      thaiLabel: "หอยแครงชุดใหญ่",
      sizeLabel: "600g-700g",
      price: 200,
      deductionGrams: 700,
      includedSauce: 1,
      active: true,
    },
    small: {
      label: "Small Hoi Kraeng",
      thaiLabel: "หอยแครงชุดเล็ก",
      sizeLabel: "400g-500g",
      price: 150,
      deductionGrams: 500,
      includedSauce: 1,
      active: true,
    },
    extraSauce: {
      label: "Extra Sauce",
      thaiLabel: "น้ำจิ้มเพิ่ม",
      price: 20,
      active: true,
    },
    opener: {
      label: "Hoi Opener",
      thaiLabel: "ที่แกะหอย",
      price: 80,
      active: true,
    },
  },
  updatedAt: serverTimestamp(),
};

const todayStock = {
  availableHoiGrams: 20000,
  openerStock: 10,
  updatedAt: serverTimestamp(),
};

const products = [
  {
    id: "regular",
    label: "Regular Hoi Kraeng",
    thaiLabel: "หอยแครงชุดใหญ่",
    price: 200,
    active: true,
    stockType: "shared_hoi",
    deductionGrams: 700,
    includedSauce: 1,
    category: "hoi",
    sortOrder: 1,
  },
  {
    id: "small",
    label: "Small Hoi Kraeng",
    thaiLabel: "หอยแครงชุดเล็ก",
    price: 150,
    active: true,
    stockType: "shared_hoi",
    deductionGrams: 500,
    includedSauce: 1,
    category: "hoi",
    sortOrder: 2,
  },
  {
    id: "extra_sauce",
    label: "Extra Sauce",
    thaiLabel: "น้ำจิ้มเพิ่ม",
    price: 20,
    active: true,
    stockType: "none",
    deductionGrams: 0,
    includedSauce: 0,
    category: "sauce",
    sortOrder: 3,
  },
  {
    id: "opener",
    label: "Hoi Opener",
    thaiLabel: "ที่แกะหอย",
    price: 80,
    active: true,
    stockType: "opener",
    deductionGrams: 0,
    includedSauce: 0,
    category: "tool",
    sortOrder: 4,
  },
];

await setDoc(doc(db, "settings", "main"), mainSettings);
await setDoc(doc(db, "stock", "today"), todayStock);
await Promise.all(
  products.map((product) => setDoc(doc(db, "products", product.id), product)),
);

console.log("Seeded settings/main, stock/today, and products successfully.");
