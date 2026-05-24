# Madam Hoi Ordering MVP

Mobile-first ordering website and admin dashboard for Madam Hoi using React + TypeScript + Vite + Firebase.

## Tech stack

- React + TypeScript + Vite
- Firebase Auth + Firestore
- Tailwind CSS
- React Hook Form + Zod

## Setup

1. Create Firebase project.
2. Enable Firestore database.
3. Enable Firebase Authentication with Email/Password provider.
4. Copy `.env.example` to `.env` and fill all values.
5. Add admin emails to `VITE_ADMIN_EMAILS` (comma-separated).
6. Install dependencies:

```bash
npm install
```

## Seed initial data

Seed creates:
- `settings/main`
- `stock/today`

Run:

```bash
npm run seed
```

## Run locally

```bash
npm run dev
```

Customer page: `/`  
Admin login/dashboard: `/admin`

## Build and checks

```bash
npm run typecheck
npm run build
npm run lint
```

## Firebase security notes

- `firestore.rules` includes an MVP baseline.
- Public users can read settings/stock and create orders.
- Admin-only writes are restricted by `isAdmin()` UID allowlist.
- **Important:** order creation and stock deduction currently run from client transaction.
- For production hardening, move this logic to a trusted backend/Cloud Function.

## Deploy (Firebase Hosting)

1. Install Firebase CLI (`npm i -g firebase-tools`)
2. `firebase login`
3. `firebase init hosting`
4. Set build output directory to `dist`
5. Build and deploy:

```bash
npm run build
firebase deploy
```
