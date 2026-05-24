interface AppEnv {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;
  adminEmails: string[];
}

const requiredEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export function getEnv(): AppEnv {
  const missing = requiredEnv.filter((key) => !import.meta.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase env vars: ${missing.join(", ")}. Check .env.example.`,
    );
  }

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);

  return {
    firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    firebaseMessagingSenderId: import.meta.env
      .VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    firebaseAppId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    adminEmails,
  };
}
