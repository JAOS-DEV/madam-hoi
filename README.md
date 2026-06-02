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

## Public customer ordering (feature flag)

The app is configured for **in-house admin order taking by default**. Public/customer ordering is controlled by `VITE_PUBLIC_ORDERING_ENABLED` in `.env` (Vite exposes it at build time).

| Value | Behaviour |
| --- | --- |
| **Missing, empty, or anything other than the string `true`** | Public ordering **disabled** (default) |
| **`true`** | Public ordering **enabled** |

When disabled:

- `/` and `/order` redirect to `/admin`.
- The admin header hides the “Customer view” link.
- **Firestore** only allows order **create** for signed-in admins (`isAdmin() && isValidOrderCreate()` in `firestore.rules`).
- **Admin manual orders still work** regardless of open/closed status (see below).

When you want to launch the customer page again:

1. Set `VITE_PUBLIC_ORDERING_ENABLED=true` in `.env` and rebuild/redeploy.
2. In `firestore.rules`, change the orders `allow create` line from admin-only back to public create (comment in file):

   ```text
   allow create: if isValidOrderCreate();
   ```

3. Deploy updated rules: `firebase deploy --only firestore:rules`
4. Use **Setup → Public customer ordering** (or **Today** when the flag is on) to open/close the customer storefront.

### Ordering open / closed (`settings.orderingOpen`)

This Firestore field controls whether **non-admin** orders can be submitted:

- **Customer / web orders** are blocked when `orderingOpen` is `false`.
- **Admin manual orders** (`orderSource: admin_manual`) are **always allowed**, even when closed.

The admin order form submit button is only disabled for closed ordering in non-admin mode.

## Clear all test orders (maintenance only)

Orders cannot be deleted from the app. Firestore rules block `delete` on `orders` by design.

**Fastest (no code):** [Firebase Console](https://console.firebase.google.com) → your project → **Firestore** → `orders` collection → select documents → delete. Console uses project-owner access and bypasses security rules.

**Repeatable script** (after a temporary rules change):

1. In `firestore.rules`, set orders delete to `allow delete: if isAdmin();`
2. `firebase deploy --only firestore:rules`
3. Dry run: `npm run clear-orders`
4. Delete: `npm run clear-orders -- --confirm` (uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`)
5. Revert delete to `allow delete: if false;` and deploy rules again

Test orders may have reduced stock. Update **Stock** in admin after clearing orders if counts look wrong.

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

With public ordering disabled (default): open `/admin`  
With public ordering enabled: customer page `/` or `/order`, admin `/admin`

## Build and checks

```bash
npm run typecheck
npm run build
npm run lint
```

## Firebase security notes

- `firestore.rules` includes an MVP baseline.
- Settings/stock/products are readable for the customer UI when public ordering is on.
- Admin-only writes use `isAdmin()` email allowlist.
- Order creation from clients uses a transaction; for production hardening, consider moving stock deduction to Cloud Functions.

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
