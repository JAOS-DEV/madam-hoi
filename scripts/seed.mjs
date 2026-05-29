import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Timestamp, deleteDoc, doc, getFirestore, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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
const args = new Set(process.argv.slice(2));

const seedEmail = process.env.SEED_ADMIN_EMAIL;
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

if (!seedEmail || !seedPassword) {
  throw new Error(
    "Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD. Add both to .env to run seed against production-mode rules.",
  );
}

await signInWithEmailAndPassword(auth, seedEmail, seedPassword);

const ORDER_COUNT = 20;
const CANCELLED_ORDER_INDEXES = [3, 8, 15];
const COMPLETED_ORDER_INDEXES = [5, 10, 20];
const shouldSeedOrders = !args.has("--no-orders");

function seedOrderDocId(index) {
  return `seed-routing-${String(index).padStart(3, "0")}`;
}

function toOrderRef(index) {
  return `MH-T${String(index).padStart(3, "0")}`;
}

async function clearSeedOrdersAndCustomers() {
  const deletions = [];
  for (let index = 1; index <= ORDER_COUNT; index += 1) {
    deletions.push(deleteDoc(doc(db, "orders", seedOrderDocId(index))));
    deletions.push(deleteDoc(doc(db, "customers", `seed-customer-${index}`)));
  }
  await Promise.all(deletions);
}

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

const pattayaStops = [
  { name: "The Panora Pattaya", lat: 12.8712, lng: 100.9025 },
  { name: "Terminal 21 Pattaya", lat: 12.9569, lng: 100.8902 },
  { name: "Central Festival Pattaya Beach", lat: 12.9347, lng: 100.8835 },
  { name: "Walking Street Pattaya", lat: 12.9274, lng: 100.8734 },
  { name: "Bali Hai Pier Pattaya", lat: 12.9181, lng: 100.8713 },
  { name: "Jomtien Beach Night Market", lat: 12.8897, lng: 100.8838 },
  { name: "Pattaya Floating Market", lat: 12.8762, lng: 100.9122 },
  { name: "Sanctuary of Truth", lat: 12.9732, lng: 100.8894 },
  { name: "Naklua Fish Market", lat: 12.9649, lng: 100.8872 },
  { name: "Thepprasit Night Market", lat: 12.9072, lng: 100.8908 },
  { name: "Big C South Pattaya", lat: 12.9154, lng: 100.8846 },
  { name: "Pattaya Park Night Plaza", lat: 12.9037, lng: 100.8691 },
  { name: "Pratumnak Hill Viewpoint", lat: 12.9142, lng: 100.8608 },
  { name: "Underwater World Pattaya", lat: 12.9035, lng: 100.9011 },
  { name: "Art in Paradise Pattaya", lat: 12.9478, lng: 100.8891 },
  { name: "Mini Siam Pattaya", lat: 12.9617, lng: 100.9165 },
  { name: "The Avenue Pattaya", lat: 12.9316, lng: 100.8807 },
  { name: "Pattaya City Hospital", lat: 12.9301, lng: 100.8899 },
  { name: "Harbor Pattaya", lat: 12.944, lng: 100.8977 },
  { name: "Royal Garden Plaza", lat: 12.9301, lng: 100.8778 },
];

function buildOrderFromStop(stop, index) {
  const orderIndex = index + 1;
  const regularQty = index % 3 === 0 ? 2 : 1;
  const smallQty = index % 2;
  const sauceQty = index % 4;
  const openerQty = index % 5 === 0 ? 1 : 0;
  const quantities = {
    regular: regularQty,
    small: smallQty,
    extra_sauce: sauceQty,
    opener: openerQty,
  };
  const itemSnapshot = products
    .map((product) => ({
      product,
      quantity: quantities[product.id] ?? 0,
    }))
    .filter((entry) => entry.quantity > 0)
    .map((entry) => ({
      productId: entry.product.id,
      label: entry.product.label,
      thaiLabel: entry.product.thaiLabel,
      price: entry.product.price,
      quantity: entry.quantity,
      lineTotal: entry.quantity * entry.product.price,
      stockType: entry.product.stockType,
      category: entry.product.category,
    }));
  const total = itemSnapshot.reduce((sum, item) => sum + item.lineTotal, 0);
  const includedSauce = itemSnapshot.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + item.quantity * (product?.includedSauce ?? 0);
  }, 0);
  const extraSauce = quantities.extra_sauce ?? 0;
  const hoiGramsDeducted =
    (quantities.regular ?? 0) * 700 + (quantities.small ?? 0) * 500;
  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - (index % 7));
  createdDate.setHours(13 + (index % 6), 10, 0, 0);

  return {
    orderRef: toOrderRef(orderIndex),
    customer: {
      name: `Test Customer ${orderIndex}`,
      phone: `08${String(10000000 + index).slice(0, 8)}`,
      deliveryLocation: stop.name,
      notes: "Seed dummy order for routing test",
      location: { lat: stop.lat, lng: stop.lng },
    },
    customerId: `seed-customer-${orderIndex}`,
    orderSource: "admin_manual",
    quantities,
    calculated: {
      hoiGramsDeducted,
      includedSauce,
      extraSauce,
      totalSauce: includedSauce + extraSauce,
      subtotal: total,
      total,
    },
    paymentMethod: index % 2 === 0 ? "cash" : "bank_transfer",
    status: "new",
    deliveryMessageSnapshot: {
      th: "เวลาจัดส่งโดยประมาณวันนี้: 19:00-22:00",
      en: "Estimated delivery today: 19:00-22:00",
    },
    itemSnapshot,
    pricingSnapshot: Object.fromEntries(products.map((item) => [item.id, item.price])),
    createdAt: Timestamp.fromDate(createdDate),
    updatedAt: Timestamp.fromDate(createdDate),
  };
}

async function seedCoreDocs() {
  await setDoc(doc(db, "settings", "main"), mainSettings);
  await setDoc(doc(db, "stock", "today"), todayStock);
  await Promise.all(
    products.map((product) => setDoc(doc(db, "products", product.id), product)),
  );
}

async function seedOrdersAndCustomers() {
  await clearSeedOrdersAndCustomers();

  await Promise.all(
    pattayaStops.map((stop, index) =>
      setDoc(doc(db, "orders", seedOrderDocId(index + 1)), buildOrderFromStop(stop, index)),
    ),
  );

  await Promise.all(
    pattayaStops.map((stop, index) =>
      setDoc(
        doc(db, "customers", `seed-customer-${index + 1}`),
        {
          name: `Test Customer ${index + 1}`,
          phone: `08${String(10000000 + index).slice(0, 8)}`,
          defaultDeliveryLocation: stop.name,
          notes: "Seed dummy customer profile",
          lastOrderAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ),
  );

  await Promise.all(
    CANCELLED_ORDER_INDEXES.map((index) =>
      updateDoc(doc(db, "orders", seedOrderDocId(index)), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
      }),
    ),
  );

  await Promise.all(
    COMPLETED_ORDER_INDEXES.map((index) =>
      updateDoc(doc(db, "orders", seedOrderDocId(index)), {
        status: "completed",
        updatedAt: serverTimestamp(),
      }),
    ),
  );
}

await seedCoreDocs();
if (shouldSeedOrders) {
  await seedOrdersAndCustomers();
}

if (shouldSeedOrders) {
  const newCount = ORDER_COUNT - CANCELLED_ORDER_INDEXES.length - COMPLETED_ORDER_INDEXES.length;
  console.log(
    `Seed completed: settings/main, stock/today, products (${products.length}), orders (${ORDER_COUNT} total: ${newCount} new, ${CANCELLED_ORDER_INDEXES.length} cancelled, ${COMPLETED_ORDER_INDEXES.length} completed), customers (${ORDER_COUNT}).`,
  );
} else {
  console.log(`Seed completed: settings/main, stock/today, products (${products.length}). Orders skipped (--no-orders).`);
}
