# CLAUDE.md — P-P-Sehran Healthcare Platform

## Project Overview

A full-stack healthcare ordering platform with three user roles: **Admin**, **Practitioner**, and **Patient**. Practitioners manage patients, recommend lab tests and supplements, and earn commissions. Patients can also order directly.

---

## Architecture

```
/
├── backend/    Node.js + Express 5, Prisma ORM, MariaDB/MySQL
└── frontend/   React 19 + Vite, Tailwind CSS, shadcn/ui
```

---

## Backend

### Running

```bash
cd backend
npm run dev       # nodemon index.js (hot reload)
npm start         # node index.js
```

### Stack
- **Framework**: Express 5
- **ORM**: Prisma with MariaDB/MySQL adapter
- **Auth**: JWT (`jsonwebtoken` + `bcryptjs`), middleware in `src/middleware/auth.js`
- **Images**: Cloudinary (upload via `multer`)
- **Payments**: Stripe
- **Email**: Brevo (`src/lib/mail/brevo.js`); swapped to noop in dev via `src/lib/mail/index.js`
- **API docs**: Swagger UI at `/api-docs` (`src/swagger.js`)
- **Health check**: `GET /health` — verifies DB connection and schema state

### Key directories

```
backend/src/
├── app.js                  Express server factory
├── routes.js               Mounts all /api/* routers
├── config/prisma.js        Prisma client singleton
├── middleware/auth.js      JWT auth middleware (requireAuth, requireRole)
├── middleware/errors.js    404 + global error handler
├── lib/mail/               Email helpers (order notifications, patient welcome)
├── lib/serialize.js        Response serialization helpers
├── lib/productGallery.js   Cloudinary gallery helpers
├── modules/
│   ├── auth/               POST /api/auth/login, /register
│   ├── users/              CRUD users (admin only)
│   ├── patients/           Patient management (practitioner + admin)
│   ├── products/           Product catalog (lab tests + supplements)
│   ├── vendors/            Vendor CRUD
│   ├── orders/             Order creation and management
│   ├── carts/              Cart management (all scopes)
│   ├── commissions/        Commission tracking for practitioners
│   ├── payments/           Stripe payment intents
│   ├── lab/                Lab test result management
│   └── uploads/            Cloudinary file upload endpoints
└── utils/
    ├── pagination.js       Offset pagination helper
    ├── quantity.js         Quantity validation
    └── response.js         Standard JSON response wrapper
```

### Database (Prisma schema)

Key models: `User`, `Practitioner`, `Patient`, `Product`, `Vendor`, `Cart`, `CartItem`, `Order`, `OrderItem`, `Commission`, `TestResult`, `Address`, `Contact`, `ProductImage`

Enums to know:
- `Role`: `ADMIN | PRACTITIONER | PATIENT`
- `CartScope`: `SELF | PATIENT | PATIENT_DIRECT`
- `ProductCategory`: `BLOOD_TEST | SUPPLEMENT`
- `VendorType`: `LAB | SUPPLEMENT | BOTH`
- `OrderStatus`: `PENDING | PROCESSING | COMPLETED`
- `PaymentStatus`: `PENDING | PAID`

### Prisma commands

```bash
npm run prisma:generate    # regenerate client after schema changes
npm run prisma:migrate     # create + apply a migration
npm run prisma:studio      # visual DB browser
npm run prisma:seed        # seed initial data
```

### Catalog import scripts

```bash
npm run catalog:reimport   # wipe products + reimport from Labtest.csv + Suppliments.csv
npm run import:shopify     # import from a single CSV
```

---

## Frontend

### Running

```bash
cd frontend
npm run dev      # Vite dev server
npm run build    # production build
npm run lint     # ESLint
```

### Stack
- **Framework**: React 19 + Vite
- **Routing**: React Router v7 (`src/App.jsx` defines all routes)
- **Styling**: Tailwind CSS v3 + shadcn/ui components (`src/components/ui/`)
- **HTTP**: custom API client (`src/api/client.js`) wrapping fetch with JWT token injection
- **Auth**: `src/auth/AuthProvider.jsx` — stores JWT + decoded user in context

### Key directories

```
frontend/src/
├── App.jsx                           Routes + auth guards
├── api/client.js                     All API calls, grouped by domain
├── auth/AuthProvider.jsx             Auth context (login, logout, current user)
├── context/
│   ├── PractitionerCartContext.jsx   Cart state for practitioner flow
│   └── PatientCartContext.jsx        Cart state for patient-direct flow
├── components/
│   ├── ui/                           shadcn/ui primitives
│   ├── order/                        OrderPaymentPanel, OrderStateBadge
│   ├── patient/                      PatientCartDrawer, PatientAddToCartDialog
│   └── practitioner/                 PractitionerCartDrawer, AddToCartDialog,
│                                     PractitionerCreatePatientDialog
├── pages/
│   ├── admin/                        Users, Vendors, Products, Orders, Commissions
│   ├── dashboard/                    AdminDashboard, PractitionerDashboard, PatientDashboard
│   ├── practitioner/                 Patients, Orders, catalog/CatalogBrowse
│   ├── patient/                      Orders, Recommendations, catalog/PatientCatalogBrowse
│   └── shared/                       MockCheckout, OrderDetail
└── lib/utils.js                      cn() helper (clsx + tailwind-merge)
```

### API client pattern

All API calls live in `src/api/client.js`. Functions are grouped by resource (`authApi`, `productApi`, `cartApi`, etc.) and automatically attach the JWT from localStorage.

---

## Role-based access summary

| Feature | Admin | Practitioner | Patient |
|---|---|---|---|
| Manage users/vendors | ✓ | | |
| View all orders/commissions | ✓ | | |
| Create/manage patients | | ✓ | |
| Order for a patient | | ✓ | |
| Order for self (supplements) | | ✓ | |
| Browse catalog + order direct | | | ✓ |
| View own orders/test results | | | ✓ |

---

## Docker

```bash
docker compose up --build    # starts backend + DB
```

The `docker-compose.yml` is at the repo root.

---

## Environment variables

Backend reads from `.env` (see `src/config/env.js`). Key vars:
- `DATABASE_URL` — MariaDB connection string
- `JWT_SECRET`
- `CLOUDINARY_*` — cloud name, api key, api secret
- `STRIPE_SECRET_KEY`
- `BREVO_API_KEY`
- `PORT` (default 3000)

Frontend reads `VITE_API_URL` from `.env` to set the API base URL.
