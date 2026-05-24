Cursor Prompt — Madam Hoi Ordering Site MVP

Build a production-ready MVP web app for a Thai seafood delivery business called Madam Hoi.

The app should be a simple mobile-first ordering site using:

React
TypeScript
Vite
Firebase
Firestore
Firebase Auth
Firebase Hosting-ready structure
Tailwind CSS
React Hook Form
Zod

Important: keep this app Firebase Spark/free-plan friendly for now.

Do not use:

Cloud Functions
Stripe
Online payments
Automated email sending
Customer accounts
SMS/LINE API automation
Any paid backend service

The site should work as a lightweight customer ordering page plus an admin dashboard.

Business Context

Madam Hoi sells cooked and cooled Hoi Kraeng / blood cockles in Pattaya.

Main products:

Regular Hoi Kraeng
Size: 600g–700g
Price: 200 THB
Stock deduction: 700g
Small Hoi Kraeng
Size: 400g–500g
Price: 150 THB
Stock deduction: 500g
Extra Sauce
Price: 20 THB
Does not deduct hoi stock
Hoi Opener
Price: 80 THB
Has its own stock count

Every Hoi Kraeng pack includes 1 sauce automatically.

Example:

2 regular + 1 small = 3 included sauces
If customer adds 2 extra sauces, total sauces = 5
Main Requirements

Build two main areas:

Customer ordering site
Admin dashboard

The customer site should require no login.

The admin dashboard should require Firebase Auth email/password login.

Customer Site Requirements
Main customer page

Create a mobile-first ordering page.

The default language should be Thai, with an English toggle.

Use a simple i18n structure with translation files, for example:

src/i18n/th.ts
src/i18n/en.ts

Do not scatter Thai text randomly throughout components.

The Thai copy must be natural and professional.

Use these Thai labels where relevant:

{
  brandTagline: "ส่งสดใหม่ทุกวัน",
  deliveryEstimatePrefix: "เวลาจัดส่งโดยประมาณวันนี้",
  orderFinalWarning: "กรุณาตรวจสอบรายการให้ถูกต้องก่อนยืนยันคำสั่งซื้อ เมื่อยืนยันแล้ว คำสั่งซื้อถือเป็นรายการสุดท้าย",
  paymentOnDelivery: "ชำระเงินเมื่อได้รับสินค้า",
  cashOnDelivery: "เงินสดปลายทาง",
  bankTransferOnDelivery: "โอนเงินเมื่อได้รับสินค้า",
  name: "ชื่อ",
  phone: "เบอร์โทรศัพท์",
  deliveryLocation: "สถานที่จัดส่ง / ชื่อบาร์",
  notes: "หมายเหตุเพิ่มเติม",
  confirmOrder: "ยืนยันคำสั่งซื้อ",
  soldOut: "สินค้าหมด",
  orderingClosed: "ปิดรับออเดอร์ชั่วคราว",
  orderReceived: "ได้รับคำสั่งซื้อแล้ว",
  regularHoi: "หอยแครงชุดใหญ่",
  smallHoi: "หอยแครงชุดเล็ก",
  extraSauce: "น้ำจิ้มเพิ่ม",
  hoiOpener: "ที่แกะหอย",
  quantity: "จำนวน",
  total: "รวมทั้งหมด",
  paymentMethod: "วิธีชำระเงิน",
  required: "จำเป็นต้องกรอก",
  invalidPhone: "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง"
}

English can be simple and clear.

Customer page content

The page should show:

Madam Hoi branding
Tagline: “Delivered Fresh Daily” / Thai: “ส่งสดใหม่ทุกวัน”
Admin-controlled announcement
Admin-controlled daily delivery message
Available stock for today
Product quantity steppers
Customer details form
Payment method selector
Order summary
Final order warning
Confirm order button

Mobile UX matters most:

Big buttons
Quantity stepper buttons
Minimal typing
Fast loading
No checkout complexity
No customer login
Stock System

This is very important.

Stock should be tracked internally in grams, but admin should enter today’s hoi stock in kg.

Example:

Admin enters:

20.5

This means 20.5kg.

Internally store:

availableHoiGrams: 20500
Shared stock logic

Regular and Small products share the same hoi stock.

Regular deducts 700g.

Small deducts 500g.

Do not treat regular stock and small stock as separate fixed stock pools.

The frontend must dynamically recalculate available stock based on the customer’s current selections.

Example:

Starting stock:

availableHoiGrams = 20000

Customer selects 10 regular:

10 * 700 = 7000g
remaining = 13000g

Then the customer can still add:

Math.floor(13000 / 700) = 18 regular
Math.floor(13000 / 500) = 26 small

If customer selects 28 regular:

28 * 700 = 19600g
remaining = 400g

Then they cannot add more regular or small.

Frontend behaviour

Use live calculations to:

Disable + buttons when adding another item would exceed available grams
Show a clear warning if not enough stock
Show remaining stock after current selection
Show approximate availability, but avoid misleading independent stock numbers

Customer-facing wording can be:

Thai:

สต็อกวันนี้: 20 กก.
ระบบจะอัปเดตสต็อกตามจำนวนที่คุณเลือก

English:

Today’s stock: 20kg
Stock updates based on your selected order.

Also show:

Based on your current order, you can still add:
Regular: X
Small: Y

Translated properly.

Firestore Transaction Requirement

The app must prevent overselling.

Even if frontend stock checks pass, submission must use a Firestore transaction.

On order submit:

Read settings/main
Read stock/today
Calculate required hoi grams:
regularQty * regularDeductionGrams
smallQty * smallDeductionGrams
Check enough availableHoiGrams
Check enough opener stock
Create order document
Deduct hoi grams from stock
Deduct opener stock
Return confirmation

If stock has changed and is no longer enough, show:

Thai:

ขออภัย สต็อกมีการเปลี่ยนแปลง กรุณาปรับรายการและลองอีกครั้ง

English:

Sorry, stock has changed. Please update your order and try again.

Do not let the client directly edit stock outside of the transaction/order flow.

Delivery Message System

Admin should be able to set a daily delivery message using templates.

Do not let customers choose delivery time in v1.

Admin should choose from standard templates:

Template 1
Estimated delivery today: {startTime}–{endTime}

Thai:

เวลาจัดส่งโดยประมาณวันนี้: {startTime}–{endTime}
Template 2
Delivery starts after {startTime}. We will contact you by LINE/phone.

Thai:

เริ่มจัดส่งหลัง {startTime} เราจะติดต่อคุณทาง LINE หรือโทรศัพท์
Template 3
Estimated delivery time is set daily and may vary depending on route and demand.

Thai:

เวลาจัดส่งโดยประมาณจะกำหนดในแต่ละวัน และอาจเปลี่ยนแปลงตามเส้นทางและจำนวนออเดอร์
Template 4

Custom message.

Admin should be able to edit:

Template type
Start time
End time
Custom message

The selected delivery message should display on the customer order page and confirmation page.

Payment System

No online payment.

No upfront payment.

Customer must select:

Cash on delivery
Bank transfer on delivery

Thai:

Cash on delivery: เงินสดปลายทาง
Bank transfer on delivery: โอนเงินเมื่อได้รับสินค้า

Customer-facing wording:

Thai:

ชำระเงินเมื่อได้รับสินค้า

English:

Payment is made on delivery.

For bank transfer, show bank details after order confirmation only.

Use dummy bank details initially, editable by admin:

bankTransfer: {
  enabled: true,
  bankName: "Kasikorn Bank",
  accountName: "Madam Hoi",
  accountNumber: "123-4-56789-0",
  note: "Please transfer when your order is delivered."
}

Thai bank transfer note:

กรุณาโอนเงินเมื่อได้รับสินค้า

Later v1.5 may add PromptPay QR image upload/display, but do not implement that now.

Customer Form

Required fields:

Name
Phone number
Delivery location / bar name
Payment method

Optional fields:

Email
Notes

Delivery location label should be:

Thai:

สถานที่จัดส่ง / ชื่อบาร์

English:

Delivery location / bar name

Notes placeholder:

Thai:

เช่น ห้อง โต๊ะ จุดสังเกต ชื่อพนักงาน หรือคำแนะนำเพิ่มเติม

English:

Room, table, landmark, staff name, or special instructions

Validation:

Name required
Phone required
Phone should accept Thai-style phone numbers, spaces, and hyphens
Delivery location required
At least one paid item required
Email optional but validate if provided

Use Zod + React Hook Form.

Order Summary

Before confirmation, show a summary.

Example:

Regular x 2 = 400 THB
Small x 1 = 150 THB
Extra sauce x 2 = 40 THB
Hoi opener x 1 = 80 THB

Included sauce: 3
Extra sauce: 2
Total sauce: 5

Total: 670 THB
Payment: Bank transfer on delivery

Thai labels should be clean and natural.

Also show warning:

Thai:

กรุณาตรวจสอบรายการให้ถูกต้องก่อนยืนยันคำสั่งซื้อ เมื่อยืนยันแล้ว คำสั่งซื้อถือเป็นรายการสุดท้าย

English:

Please check your order before confirming. Once confirmed, orders are final.
Confirmation Page

After successful order, show:

Thank you message
Order reference
Order total
Payment method
Delivery message
Customer name
Delivery location
Items ordered
Included sauces / extra sauces / total sauces
Bank details if bank transfer selected
Instruction to contact Madam Hoi to edit/cancel

Generate a short readable order reference like:

MH-4837

It does not need to be globally sequential, but should be easy to quote.

Cancellation/editing should not be self-service in v1.

Confirmation wording:

Thai:

ได้รับคำสั่งซื้อแล้ว
หมายเลขออเดอร์: MH-4837
หากต้องการแก้ไขหรือยกเลิก กรุณาติดต่อ Madam Hoi ทาง LINE หรือโทรศัพท์ และแจ้งหมายเลขออเดอร์นี้

English:

Your order has been received.
Order reference: MH-4837
Need to change or cancel? Contact Madam Hoi on LINE/phone and quote this order reference.
Admin Dashboard Requirements

Admin route:

/admin

Use Firebase Auth email/password.

Only authenticated admins can access.

Use an admin allowlist approach. For MVP, define allowed admin emails or UIDs in env/config and enforce in the UI. Also prepare Firestore security rules so only authenticated admins can update settings, stock, and orders.

Admin dashboard sections:

1. Ordering status

Admin can:

Open ordering
Close ordering

When closed, customer page should show:

Thai:

ปิดรับออเดอร์ชั่วคราว

English:

Ordering is temporarily closed.

Customer should not be able to submit orders when closed.

2. Today’s stock

Admin enters hoi stock in kg only.

Example field:

Available hoi stock today (kg)

Admin can enter decimals like:

20
20.5
20.1

Convert to grams internally:

Math.round(kg * 1000)

Also admin can set:

Hoi opener stock count

Sauce stock does not need tracking in v1.

3. Delivery message

Admin can choose from:

Estimated delivery today: start–end
Delivery starts after start
Estimated delivery time varies
Custom message

Admin can edit start/end times.

4. Product settings

Admin can edit:

Regular price
Regular size label
Regular deduction grams
Small price
Small size label
Small deduction grams
Extra sauce price
Hoi opener price
Product active/inactive toggles

Defaults:

regular: {
  label: "Regular Hoi Kraeng",
  thaiLabel: "หอยแครงชุดใหญ่",
  sizeLabel: "600g–700g",
  price: 200,
  deductionGrams: 700,
  includedSauce: 1,
  active: true
}

small: {
  label: "Small Hoi Kraeng",
  thaiLabel: "หอยแครงชุดเล็ก",
  sizeLabel: "400g–500g",
  price: 150,
  deductionGrams: 500,
  includedSauce: 1,
  active: true
}

extraSauce: {
  label: "Extra Sauce",
  thaiLabel: "น้ำจิ้มเพิ่ม",
  price: 20,
  active: true
}

opener: {
  label: "Hoi Opener",
  thaiLabel: "ที่แกะหอย",
  price: 80,
  active: true
}
5. Bank details

Admin can edit:

Bank name
Account name
Account number
Bank transfer note
6. Orders dashboard

Admin can view orders.

Show:

Order reference
Created time
Customer name
Phone
Delivery location
Notes
Items
Total
Payment method
Status

Statuses:

"new" | "confirmed" | "preparing" | "out_for_delivery" | "completed" | "cancelled"

Admin can update status.

Admin can cancel an order and choose whether to restore stock.

If restoring stock:

Add calculated.hoiGramsDeducted back to stock/today.availableHoiGrams
Add opener quantity back to stock/today.openerStock

Use a Firestore transaction for cancel + restore.

7. Daily summary

Show today’s totals:

Orders today
Revenue today
Regular sold
Small sold
Extra sauce sold
Openers sold
Hoi grams used
Hoi kg remaining
Orders by status

This can be calculated client-side from today’s orders for v1.

Firestore Data Model

Use these collections/documents.

settings/main
{
  orderingOpen: boolean,
  announcement: string,
  phoneNumber: string,
  lineUrl?: string,

  deliveryMessage: {
    template: "estimated_range" | "starts_after" | "varies" | "custom",
    startTime?: string,
    endTime?: string,
    customMessageTh?: string,
    customMessageEn?: string
  },

  bankTransfer: {
    enabled: boolean,
    bankName: string,
    accountName: string,
    accountNumber: string,
    noteTh: string,
    noteEn: string
  },

  productSettings: {
    regular: {
      label: string,
      thaiLabel: string,
      sizeLabel: string,
      price: number,
      deductionGrams: number,
      includedSauce: number,
      active: boolean
    },
    small: {
      label: string,
      thaiLabel: string,
      sizeLabel: string,
      price: number,
      deductionGrams: number,
      includedSauce: number,
      active: boolean
    },
    extraSauce: {
      label: string,
      thaiLabel: string,
      price: number,
      active: boolean
    },
    opener: {
      label: string,
      thaiLabel: string,
      price: number,
      active: boolean
    }
  },

  updatedAt: Timestamp
}
stock/today
{
  availableHoiGrams: number,
  openerStock: number,
  updatedAt: Timestamp
}
orders/{orderId}
{
  orderRef: string,

  customer: {
    name: string,
    phone: string,
    email?: string,
    deliveryLocation: string,
    notes?: string
  },

  quantities: {
    regular: number,
    small: number,
    extraSauce: number,
    opener: number
  },

  calculated: {
    hoiGramsDeducted: number,
    includedSauce: number,
    extraSauce: number,
    totalSauce: number,
    subtotal: number,
    total: number
  },

  paymentMethod: "cash" | "bank_transfer",

  status: "new" | "confirmed" | "preparing" | "out_for_delivery" | "completed" | "cancelled",

  deliveryMessageSnapshot: {
    th: string,
    en: string
  },

  pricingSnapshot: {
    regularPrice: number,
    smallPrice: number,
    extraSaucePrice: number,
    openerPrice: number
  },

  createdAt: Timestamp,
  updatedAt: Timestamp,
  cancelledAt?: Timestamp,
  stockRestored?: boolean
}

Use snapshots so old orders keep the prices and delivery message that applied when ordered.

Firebase Setup

Create:

src/lib/firebase.ts

Read Firebase config from Vite env variables:

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

Add an .env.example.

Do not hardcode secrets.

If env vars are missing, show a clear developer error.

Security Rules

Add Firestore security rules file.

MVP rules should follow this intention:

Anyone can read settings/main
Anyone can read stock/today
Anyone can create orders only if valid
Customers cannot update/delete orders
Only admins can update settings
Only admins can update stock directly
Only admins can update order statuses/cancel orders

Because Firestore rules cannot fully verify complex stock deduction logic across documents in the same way a trusted server can, keep the stock-changing order submission as a client transaction and make the rules as strict as reasonably possible for MVP.

Include a clear comment in the code:

For production hardening, move order creation/stock deduction to a trusted backend or Cloud Function if the project moves beyond Firebase Spark/free-plan MVP constraints.

But do not use Cloud Functions in v1.

Project Structure

Use a clean structure like:

src/
  app/
    App.tsx
    routes.tsx
  components/
    layout/
    ui/
    order/
    admin/
  features/
    ordering/
      OrderPage.tsx
      OrderForm.tsx
      OrderSummary.tsx
      QuantityStepper.tsx
      ConfirmationPage.tsx
      orderSchema.ts
      orderService.ts
      stockUtils.ts
    admin/
      AdminLogin.tsx
      AdminDashboard.tsx
      StockPanel.tsx
      SettingsPanel.tsx
      ProductSettingsPanel.tsx
      BankDetailsPanel.tsx
      OrdersPanel.tsx
      DailySummary.tsx
      adminService.ts
  i18n/
    en.ts
    th.ts
    index.ts
  lib/
    firebase.ts
    env.ts
  types/
    firestore.ts
  utils/
    money.ts
    dates.ts
UI Design Direction

Brand feel:

Thai seafood delivery
Warm
Friendly
Bold
Mobile-first
Red/gold/green accents
Clean white background
Large readable text

Do not overdesign.

The site should feel like a practical Thai ordering page, not a corporate SaaS product.

Use Tailwind.

Add simple components:

Card
Button
Input
Select
Badge
Alert
QuantityStepper
Seed Data

Add a script or clear developer helper to seed initial Firestore data.

Initial settings:

orderingOpen: true
announcement: "Fresh Hoi Kraeng available today"
phoneNumber: "063-141-8856"

deliveryMessage: {
  template: "estimated_range",
  startTime: "19:00",
  endTime: "22:00"
}

bankTransfer: {
  enabled: true,
  bankName: "Kasikorn Bank",
  accountName: "Madam Hoi",
  accountNumber: "123-4-56789-0",
  noteTh: "กรุณาโอนเงินเมื่อได้รับสินค้า",
  noteEn: "Please transfer when your order is delivered."
}

Initial stock:

availableHoiGrams: 20000
openerStock: 10
Testing / Smoke Checks

Add scripts:

{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit",
  "lint": "eslint ."
}

The project must pass:

npm run typecheck
npm run build

If ESLint is configured, it must pass lint too.

Add helpful comments explaining how to:

Create Firebase project
Enable Firestore
Enable Firebase Auth email/password
Add env vars
Seed initial data
Deploy to Firebase Hosting
Behaviour Acceptance Criteria

The build is not done until these behaviours work:

Customer
Customer can view Thai order page by default
Customer can toggle English
Customer sees ordering closed message if ordering is closed
Customer sees today’s kg stock
Customer can add regular/small with steppers
Regular/small both consume shared gram stock
Plus buttons disable when not enough shared stock remains
Customer can add extra sauce and opener
Customer cannot order more openers than available
Customer must enter name, phone, delivery location
Customer must select payment method
Customer sees correct total
Customer sees included sauce and total sauce count
Customer sees final-order warning
Order creates successfully through Firestore transaction
Stock deducts after successful order
Confirmation page shows order reference
Bank details show only when bank transfer selected
Admin
Admin can login
Admin can open/close ordering
Admin can set stock in kg
App stores stock in grams
Admin can set opener stock
Admin can choose delivery message template and times
Admin can update product prices/deduction grams
Admin can update bank details
Admin can view orders
Admin can update order status
Admin can cancel order
Admin can cancel and restore stock via transaction
Admin can see daily summary
Important Implementation Notes
Keep code strongly typed.
Avoid any.
Use clear TypeScript interfaces for Firestore docs.
Use Firestore serverTimestamp() for createdAt/updatedAt.
Use Firestore runTransaction() for order creation and stock deduction.
Use Firestore onSnapshot() for live customer stock/settings updates.
Keep all money in THB as integers.
Keep all stock internally as grams.
Keep kg only as an admin input/display convenience.
Do not implement email confirmation in v1.
Do not implement customer self-cancellation in v1.
Confirmation page should tell the customer to contact Madam Hoi by LINE/phone with order reference for edits/cancellations.
Do not implement PromptPay QR in v1, but leave the data model/design easy to extend later.
Final Deliverable

Generate the complete working project.

After implementation, provide:

Summary of files created
Firebase setup steps
How to seed initial data
How to run locally
How to build
Any security caveats
Suggested v1.5 improvements:
PromptPay QR image
Customer order lookup by order reference + phone
Email confirmation
LINE notification/admin alert
Cloud Function trusted checkout if moving to paid Firebase Blaze plan
Basic analytics/export

Make sure the project is clean, understandable, and ready for me to continue developing in React + TypeScript.