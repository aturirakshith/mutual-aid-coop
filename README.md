# MACS — Mutually Aided Cooperative Society

A web application for managing a cooperative society: member contributions, loan lifecycle, EMI tracking, guarantors, settlements, and a full audit ledger.

Money moves outside the app (UPI / cash / bank transfer). MACS is the **ledger and workflow tool** — every rupee in, every rupee out, every decision, on record.

---

## Features

### Admin
- **Dashboard** — pool balance, active loan volume, pending requests, monthly contribution snapshot
- **Members** — add members, view savings balances, reset passwords, deactivate with settlement cascade
- **Contributions** — mark / reverse monthly contributions per period, late-fee tracking
- **Loans** — review pending requests with borrower credit snapshot and guarantor exposure analysis; approve with custom terms or reject; record EMI payments
- **Ledger** — full society transaction history (contributions, loans, EMIs, settlements), filterable by type
- **Settings** — group charter (locked after setup): contribution amount, interest rate, late fee, EMI day, minimum guarantors

### Member
- **Dashboard** — savings balance, this month's contribution status, active loan card with EMI progress
- **My Loans** — full loan history, EMI schedule, pending requests
- **Loan Application** — amount, tenure slider, reason, guarantor search, live EMI estimate
- **Roster** — all members' names and this-month's paid / unpaid status
- **Payment History** — personal ledger of contributions, disbursed loans, EMI repayments

### Security
- Credentials-based auth (mobile number + bcrypt password), JWT session (30 days)
- Role-based route protection at middleware level — members cannot reach admin routes
- Zod validation on every server action; `auth()` guard before every DB write

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components) |
| Language | TypeScript 5 |
| Auth | NextAuth v5 (Credentials + JWT) |
| ORM | Prisma 5 + PostgreSQL |
| Styling | Tailwind CSS 3 |
| Validation | Zod |
| Testing | Jest + supertest (integration tests) |

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Docker)
- `npm`

### 1. Clone and install

```bash
git clone <repo-url>
cd macs-app/app
npm install
```

### 2. Environment

Create `app/.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/macs_db"
NEXTAUTH_SECRET="your-secret-here-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secret:
```bash
openssl rand -base64 32
```

### 3. Database

```bash
# Run migrations
npm run db:migrate:dev

# Seed with demo data (admin + 8 members, one active loan, contribution history)
npm run db:seed
```

**Seed credentials**

| Role | Mobile | Password |
|---|---|---|
| Admin | `9999999999` | `admin123` |
| Member | `9876543210` – `9876543217` | `member123` |

### 4. Start dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## Available Scripts

Run from `app/`:

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build (`next build`) |
| `npm start` | Start production server |
| `npm install` | Install deps — automatically runs `prisma generate` via `postinstall` |
| `npm test` | Run full integration test suite |
| `npx jest -- src/__tests__/path/to/file.test.ts` | Run a single test file |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript type check |
| `npm run db:migrate:dev` | Create + apply a new Prisma migration (dev) |
| `npm run db:migrate` | Apply pending migrations (production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop, recreate, and re-seed database |

> `prisma generate` is wired to `postinstall` — it runs automatically after every `npm install`. You never need to run it manually.

---

## Deploy on Render

### 1. Create a PostgreSQL database
**New → PostgreSQL** → copy the **Internal Database URL**.

### 2. Create a Web Service
**New → Web Service → connect `mutual-aid-coop`**

| Field | Value |
|---|---|
| **Root Directory** | `app` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node_modules/.bin/prisma migrate deploy && node_modules/.bin/next start -p $PORT` |

### 3. Set environment variables

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal Database URL from step 1 |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` locally and paste result |
| `NEXTAUTH_URL` | Your Render URL e.g. `https://macs-app.onrender.com` |

> Set `NEXTAUTH_URL` after the service is created — that's when Render assigns the URL.

### 4. How the build works

```
npm install          → installs all dependencies
  └─ postinstall     → prisma generate  (runs inside npm, .bin always in PATH)
npm run build        → next build       (no prisma needed here)

# on each deploy start:
prisma migrate deploy → applies any pending DB migrations
next start -p $PORT   → boots the app
```

Future deploys are automatic on every `git push origin main`.

---

## Project Structure

```
app/
├── prisma/
│   ├── schema.prisma          # Data model
│   ├── migrations/            # Generated migration history
│   └── seed.ts                # Demo data seeder
│
├── src/
│   ├── app/
│   │   ├── (member)/          # Member route group
│   │   │   ├── dashboard/     # Savings, contribution status, active loan
│   │   │   ├── loans/         # Loan list + new loan form
│   │   │   ├── roster/        # Group member roster
│   │   │   └── ledger/        # Personal payment history
│   │   ├── admin/             # Admin route group
│   │   │   ├── dashboard/     # Society overview
│   │   │   ├── members/       # Member management + settlement
│   │   │   ├── contributions/ # Monthly contribution recording
│   │   │   ├── loans/         # Loan queue + detail / approve
│   │   │   ├── ledger/        # Society ledger
│   │   │   └── settings/      # Group charter
│   │   ├── api/
│   │   │   ├── auth/          # NextAuth route handler
│   │   │   ├── members/search # Member search API
│   │   │   └── setup-group/   # One-time group creation
│   │   └── login/             # Login page
│   │
│   ├── actions/               # "use server" mutations
│   │   ├── contributions.ts   # Mark/reverse contributions, savings calc
│   │   ├── loans.ts           # Submit, approve, disburse, EMI payment
│   │   ├── members.ts         # Add member, reset password, deactivate
│   │   ├── settlements.ts     # Settlement cascade on member exit
│   │   └── ledger.ts          # Read-side: group ledger, member ledger
│   │
│   ├── components/
│   │   ├── nav/
│   │   │   ├── top-nav.tsx    # MACS logo + avatar dropdown (logout)
│   │   │   └── bottom-nav.tsx # Role-aware tab bar
│   │   └── ui/                # Shared presentational components
│   │
│   ├── lib/
│   │   ├── auth.ts            # NextAuth config (Credentials, JWT)
│   │   ├── db.ts              # Prisma singleton
│   │   ├── money.ts           # Paise ↔ rupee conversion, INR formatting
│   │   └── emi.ts             # EMI schedule generation, loan term calc
│   │
│   ├── middleware.ts           # JWT auth + role-based route protection
│   └── __tests__/             # Jest integration tests
```

---

## Data Model (key concepts)

- **All money stored as paise** (integer). ₹1,000 = `100000`. Use `formatInr()` / `paiseToRupees()` from `src/lib/money.ts` — never divide by 100 inline.
- **Interest rates in basis points** (bps). 100 bps = 1%. Never stored as a float percent.
- **Flat-rate loan structure**: interest deducted upfront from disbursal. Member repays the full principal in equal monthly EMIs. Example: borrow ₹50,000 at 1%/month for 12 months → interest = ₹6,000 deducted → receive ₹44,000 → repay 12 × ₹4,167.
- **Multi-step writes** (loan approval, EMI payment, settlement) wrapped in `prisma.$transaction`.
- `Group.lateFeePassse` — intentional schema typo (triple-s). Matches live DB column. Do not rename.

---

## Architecture Notes

- **Server Actions** (`src/actions/`) handle all mutations. Each validates with Zod, guards with `auth()`, wraps multi-step ops in a transaction, and calls `revalidatePath()`.
- **Middleware** (`src/middleware.ts`) enforces auth and RBAC on every request before it reaches a route. `/api/auth/*` routes are always passed through unconditionally so NextAuth signout works correctly.
- **No client-side data fetching** except the guarantor member search (`/api/members/search`). All page data is fetched server-side in RSCs.
- **Event log** (`Event` model) is the audit trail. Contributions, loan state changes, EMI payments, and settlements all append events.

---

## Testing

Integration tests live in `src/__tests__/`. They use `supertest` against the Next.js API routes with a real test database.

```bash
# Run all tests
npm test

# Run one file
npx jest -- src/__tests__/loans.test.ts
```

---

## Known Constraints (v1 scope)

- Single group per installation
- No payment gateway integration — cash/UPI/bank transfer recorded manually
- No email / SMS notifications
- Password reset requires admin action (no self-service forgot-password)
- No member-facing contribution history filter by period
