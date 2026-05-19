## Project
MACS — cooperative society management web app for member contributions, loans, EMIs, and settlements.

## Stack
Next.js 15 (App Router) · TypeScript · Prisma + Postgres · NextAuth v5 (Credentials/JWT) · TailwindCSS · Jest

### Commands
Run from `app/`:
- Dev : `npm run dev`
- Build : `npm run build`
- Single file test : `npx jest -- src/__tests__/path/to/file.test.ts`
- Full test : `npm test`
- Lint : `npm run lint`
- Type check : `npx tsc --noEmit`
- DB migrate (dev) : `npm run db:migrate:dev`
- DB migrate (prod) : `npm run db:migrate`
- DB seed : `npm run db:seed`
- DB reset : `npm run db:reset`
- Prisma generate : runs automatically via `postinstall` after `npm install` — no manual step needed

### Architecture
- `src/app/(member)/` → member routes: dashboard, ledger, loans, roster
- `src/app/admin/` → admin routes: members, contributions, loans, ledger, settings
- `src/app/api/` → REST endpoints: auth, member search, group setup
- `src/actions/` → "use server" mutations by domain (loans, contributions, members, settlements, ledger)
- `src/components/nav/` → top-nav and bottom-nav shared shells
- `src/components/ui/` → reusable presentational components
- `src/lib/auth.ts` → NextAuth config (Credentials, JWT, 30-day session)
- `src/lib/db.ts` → singleton Prisma client
- `src/lib/money.ts` → paise ↔ rupee conversion and INR formatting
- `src/lib/emi.ts` → EMI schedule generation
- `src/middleware.ts` → role-based route protection
- `prisma/schema.prisma` → Group, User, ContributionPeriod, Contribution, Loan, LoanGuarantor, Emi, Settlement, Event
- `src/__tests__/` → Jest + supertest integration tests

### Rules
- Store all money as **paise** (integer). Use `paiseToRupees` / `formatInr` from `src/lib/money.ts` — never divide by 100 inline.
- Interest rates are **basis points** (bps): 100 bps = 1%. Never store as a float percent.
- Wrap multi-step Prisma writes (loan approval, EMI payment, settlement, period creation) in `prisma.$transaction`.
- Validate every server-action input with Zod and call `auth()` before any DB read or write.
- Call `revalidatePath()` after every mutation that affects a rendered route.
- IMPORTANT : The Prisma column `Group.lateFeePassse` is a real schema typo (triple-s). Do NOT rename it — it matches the live DB. Reference it verbatim.

### Workflow
- Read the relevant page/action before editing; mirror the existing pattern instead of inventing a new one.
- Prefer editing existing files; do not introduce new abstractions for one-shot fixes.
- After schema edits: run `npm run db:migrate:dev` (generates client automatically), then update affected actions and pages.
- Run `npx tsc --noEmit` and `npm test` before declaring a task done.
- Commit style: short imperative subject (e.g. `fix loan approval pool check`), one logical change per commit.
- Ask before: destructive DB ops on shared env, changes to auth/middleware, edits inside `prisma/migrations/`.

### Out of scope
- `prisma/migrations/*` — generated; never hand-edit.
- `.env*` — never read, write, or commit secrets.
- `next.config.*`, `tailwind.config.*`, `tsconfig.json` — touch only on explicit request.
- The `lateFeePassse` column name (see Rules).
