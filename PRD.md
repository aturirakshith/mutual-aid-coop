# Mutually Aided Cooperative Society (MACS) — Product Requirements Document

**Version:** 0.1 (draft) · **Date:** 2026-05-16 · **Status:** For review

---

## 1. Overview

A web application that lets a single trusted group operate as a **mutually-aided cooperative**: every member contributes a fixed amount monthly (default **₹1,000**) into a shared pool, and members can request loans from that pool. An **admin** runs the group — they enter contributions, review loan requests, approve disbursals, and track repayments. Loans carry a fixed interest rate; interest is **deducted from the loan amount at disbursal**, and the loan is repaid in **fixed equal EMIs**.

This is a v1 / MVP. Payment integration is out of scope — money moves outside the app (UPI, cash, bank transfer); the app is the **ledger and workflow tool**.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Group** | The single cooperative society. v1 supports exactly one group per installation. |
| **Pool** | Cumulative cash held by the group = (contributions received) − (loan principals disbursed, net of interest) + (EMI repayments received). |
| **Contribution** | The monthly ₹1,000 (configurable per group) every member owes. |
| **Loan** | A sum a member requests from the pool. Subject to admin approval. |
| **Disbursal amount** | Cash actually handed to borrower = Principal − Interest (see §5.3). |
| **EMI** | Equal Monthly Instalment. Principal ÷ tenure-in-months. |
| **Late fee** | Amount added to a member's dues when they miss a monthly contribution. |
| **Eligibility** | Whether a member is currently permitted to receive a new loan. Blocked by missed contributions. |

---

## 3. User roles

### 3.1 Admin (one per group)
- Creates/edits the group's settings (contribution amount, late fee, default interest rate)
- Adds/removes members; resets member passwords
- Records monthly contributions (marks paid/unpaid per member, per month)
- Reviews loan requests; approves with terms (principal, interest %, tenure) or rejects
- Records EMI repayments
- Views full ledger and pool balance

### 3.2 Member
- Logs in with username (= mobile number) + password set by admin
- Views own dashboard: contributions paid/owed, active loans, EMI schedule, pool balance
- Submits a loan request (amount, reason, proposed tenure)
- Views own transaction history

Members do **not** see other members' personal balances or loan details in v1 (privacy default). They do see the group's **aggregate** pool balance.

> **Open Q1:** Should members see a roster (names + paid/unpaid status this month) for transparency? Common in real cooperatives but mildly privacy-reducing. Default assumption: **yes, names + monthly paid/unpaid status visible to all members** (but not loan details).

---

## 4. User flows (v1)

### 4.1 Onboarding
1. Admin creates the group (one-time): sets group name, monthly contribution amount, default interest rate, late fee amount.
2. Admin adds members one by one: full name, mobile number (= username), initial password.
3. Admin shares username + temp password with member out-of-band.
4. Member logs in; can change own password from profile page (admin can also reset it).

### 4.2 Monthly contribution cycle
1. On the 1st of each month, the app creates a "contribution due" row for every active member.
2. Admin records payments as they come in: marks row "Paid" (with date + optional note).
3. Rows not marked paid by month-end remain "Unpaid" and carry forward. A **late fee** is added to the member's dues automatically.
4. Members with one or more unpaid contributions are marked **loan-ineligible**.

### 4.3 Loan request → disbursal
1. Member submits a request: amount, proposed tenure (months), reason.
2. Request appears in admin's queue with member's history (past contributions, past loans repaid on-time, current outstanding loans).
3. Admin reviews and either:
   - **Approves** with final principal, interest rate, tenure → status: Approved
   - **Rejects** with optional reason
4. On approval, admin marks the loan **Disbursed** when the cash is actually handed over (records date). The pool balance updates; EMI schedule is generated.
5. Member dashboard shows the active loan, EMI schedule, and outstanding balance.

### 4.4 EMI repayment
1. EMI schedule lists due dates and amounts.
2. As member pays, admin marks each EMI "Paid" with date.
3. Outstanding balance updates; pool balance increases.
4. When final EMI is recorded, loan status → Closed.

---

## 5. Core mechanics — the money model

### 5.1 Pool balance formula
```
pool_balance = Σ contributions_received
             + Σ EMI_repayments_received
             − Σ loan_disbursal_amounts
             + Σ late_fees_received
```
Note: interest is **already netted out of disbursal_amount**, so it accrues to the pool as EMI payments come in.

### 5.2 Contribution accounting
- Each member, each month → one contribution row, status ∈ {Paid, Unpaid}.
- Late fee applied automatically when month rolls over with status still Unpaid.
- Member's total dues = sum of unpaid contributions + accumulated late fees.

### 5.3 Loan math (flat-rate, interest deducted upfront)

Given:
- `P` = principal (the "loan amount" admin approves)
- `r` = monthly interest rate (e.g. 1%)
- `n` = tenure in months

Then:
- `interest = P × r × n` (flat-rate total interest)
- `disbursal_amount = P − interest` (what borrower receives in cash)
- `EMI = P / n` (member repays principal in equal instalments)
- `total_paid_by_borrower = P` (over n months)
- `effective_cost_to_borrower = interest` (paid upfront via reduced disbursal)

**Worked example:** Loan ₹10,000 at 1%/month flat for 6 months
- Interest = 10,000 × 0.01 × 6 = **₹600**
- Disbursal = 10,000 − 600 = **₹9,400** (cash to member)
- EMI = 10,000 / 6 = **₹1,666.67/month** for 6 months
- Pool: −9,400 today, +1,666.67 × 6 over six months = +₹600 net gain

### 5.4 Loan cap & approval policy
- App enforces only: requested amount ≤ current pool balance (soft warning if not).
- Admin makes the final call based on visible signals: member's contribution history, past loans, current outstanding loans, requested amount vs. pool.
- App must surface these signals on the approval screen (see §6.4).

### 5.5 Multiple concurrent loans
- A member may have more than one active loan at a time (admin's call).
- A member can be loan-ineligible (due to missed contributions) — checked at request and approval time.

---

## 6. Functional requirements

### 6.1 Authentication & access control
- **FR-1.1** Login via username (= 10-digit mobile number) + password.
- **FR-1.2** Two roles: `admin`, `member`. Role-based access enforced server-side.
- **FR-1.3** Member can change own password (must enter old password).
- **FR-1.4** Admin can reset any member's password (sets a new value; member must change on next login).
- **FR-1.5** Sessions expire after 30 days of inactivity.

### 6.2 Group & member management (admin)
- **FR-2.1** Admin sets group name, monthly contribution amount, default interest rate (%/month), late fee amount, default loan tenure.
- **FR-2.2** Admin adds a member: name, mobile (unique), initial password.
- **FR-2.3** Admin deactivates a member (cannot delete — preserves ledger integrity). Deactivated members do not appear in new monthly cycles but their history is intact.
- **FR-2.4** Admin views a member list with each member's: total contributed, total dues, active loans, outstanding loan balance.

### 6.3 Contribution tracking
- **FR-3.1** App auto-generates contribution rows on the 1st of each month for all active members.
- **FR-3.2** Admin marks a row Paid (with date, optional note).
- **FR-3.3** App auto-applies late fee to unpaid rows when the month rolls over.
- **FR-3.4** Members with unpaid contributions are flagged loan-ineligible.
- **FR-3.5** Admin can manually waive a late fee (with audit note).

### 6.4 Loan workflow
- **FR-4.1** Member submits a loan request: amount, tenure (months), reason (free text).
- **FR-4.2** Loan-ineligible members are blocked from submitting (with explanation).
- **FR-4.3** Admin sees pending requests in a queue. Each request shows: member name, requested amount, requested tenure, reason, **member context block** (contributions paid, past loans count, past on-time repayment rate, current outstanding balance).
- **FR-4.4** Admin can approve (with final amount, interest %, tenure — may differ from request), reject (with reason), or hold.
- **FR-4.5** On approval, app shows the calculation (interest, disbursal, EMI) before final confirm.
- **FR-4.6** Admin marks loan **Disbursed** when cash changes hands. EMI schedule generated.
- **FR-4.7** Admin records each EMI repayment.
- **FR-4.8** Loan auto-closes when last EMI is marked Paid.

### 6.5 Member dashboard
- **FR-5.1** Shows current month's contribution status and total dues.
- **FR-5.2** Shows active loan(s): principal, EMI, next due date, outstanding balance, schedule.
- **FR-5.3** Shows total pool balance (aggregate only).
- **FR-5.4** Shows roster with monthly paid/unpaid status of all members (subject to Open Q1).
- **FR-5.5** "Request loan" button (disabled with reason if ineligible).
- **FR-5.6** Personal transaction history (contributions, loans, EMIs).

### 6.6 Admin dashboard
- **FR-6.1** Pool balance + month-over-month trend.
- **FR-6.2** This-month contribution status snapshot (paid / unpaid counts).
- **FR-6.3** Active loans summary (count, total outstanding).
- **FR-6.4** Pending loan requests count.
- **FR-6.5** Quick links to each workflow.

---

## 7. Non-functional requirements

- **NFR-1** Web app — responsive (works on mobile browsers; admin likely on desktop).
- **NFR-2** Currency: INR (₹), display with thousands separators (Indian numbering, e.g. ₹1,00,000).
- **NFR-3** Time zone: Asia/Kolkata. All dates stored UTC, displayed in IST.
- **NFR-4** Soft-delete semantics — financial records are never hard-deleted. Deactivate, don't delete.
- **NFR-5** All financial mutations (contribution paid, loan approved, EMI marked paid) recorded with `actor_user_id` + `timestamp` for forensic trail (even if a formal audit-log UI is v2).
- **NFR-6** Money handled as integer paise (e.g. ₹100 → 10000) to avoid float errors.

---

## 8. Tech stack

- **Frontend + backend:** Next.js 15+ (App Router), TypeScript, Tailwind CSS
- **Database:** PostgreSQL (Neon / Supabase / Railway managed)
- **ORM:** Prisma
- **Auth:** Auth.js (next-auth) with custom credentials provider (username = mobile)
- **Deployment:** Vercel (frontend) + managed Postgres
- **No payment integration in v1** (Razorpay/UPI deferred to v2)

---

## 9. High-level data model

Tables (simplified):

- **groups** (`id`, `name`, `monthly_contribution_paise`, `default_interest_rate_bps`, `late_fee_paise`, `default_tenure_months`, `created_at`)
- **users** (`id`, `group_id`, `mobile`, `name`, `password_hash`, `role`, `must_change_password`, `active`, `created_at`)
- **contribution_periods** (`id`, `group_id`, `year`, `month`) — one row per calendar month
- **contributions** (`id`, `period_id`, `user_id`, `status`, `amount_paise`, `paid_at`, `note`, `late_fee_paise`, `recorded_by`)
- **loans** (`id`, `user_id`, `requested_amount_paise`, `requested_tenure`, `reason`, `status`, `principal_paise`, `interest_rate_bps`, `tenure_months`, `interest_paise`, `disbursal_paise`, `requested_at`, `approved_at`, `disbursed_at`, `closed_at`, `approved_by`)
- **emis** (`id`, `loan_id`, `seq`, `due_date`, `amount_paise`, `status`, `paid_at`, `recorded_by`)
- **events** (`id`, `actor_id`, `kind`, `entity_type`, `entity_id`, `payload_json`, `created_at`) — forensic trail

Money stored as integer paise (`amount_paise`). Interest rate stored in basis points (`_bps`, where 100 bps = 1%).

---

## 10. Out of scope for v1 (= v2+ backlog)

- Payment gateway integration (UPI, Razorpay, Stripe)
- SMS/email notifications (EMI due reminders, contribution reminders)
- Multiple groups per installation
- Member self-signup / public marketplace
- Auction / bidding-based loan allocation
- Reducing-balance interest (only flat-rate in v1)
- Member-visible audit log UI (events table exists, but no UI to browse it)
- Loan default / write-off workflow
- KYC / document upload
- Reports / data export (CSV, PDF statements)
- Multi-language / regional language UI
- Push notifications / PWA

---

## 11. Assumptions & open questions

These are reasonable defaults I've chosen — flag any to revise:

1. **Open Q1 (roster visibility):** Members see other members' names + monthly paid/unpaid status, but NOT loan details. Confirm?
2. **A1:** A single admin per group is enough for v1 (no co-admins, no admin handover).
3. **A2:** The group is **indefinite** — no fixed end date. No "wind-up and distribute pool" flow in v1.
4. **A3:** Late fee is a **fixed amount per missed contribution** (e.g. ₹50), configured by admin. It does NOT compound.
5. **A4:** Member-submitted loan reason is free text; admin reads but app doesn't categorize.
6. **A5:** EMI due dates are the **1st of each month following disbursal**, regardless of disbursal date. (Could alternatively be the disbursal date + 1mo, etc.)
7. **A6:** A loan-ineligible member is also blocked from being **approved** (not just from submitting). Admin sees the block and can either ask member to clear dues, or manually waive (with note).
8. **A7:** Mobile numbers are 10-digit Indian format. No country-code handling. Stored as digits-only string.
9. **A8:** Currency is INR only. No multi-currency support.
10. **A9:** No two-factor auth in v1.

---

## 12. Success criteria for v1

The app is "done" when a real cooperative can:

1. Run a full month: admin records contributions, app tracks dues.
2. Process at least one loan end-to-end: request → approve → disburse → repay all EMIs → close.
3. Members can log in and see correct numbers for their own dues, loans, and EMIs.
4. Pool balance is always correct and reconcilable from the ledger.
5. No member can take a loan while in arrears (unless admin waives, with note).

---

*End of PRD v0.1. Next step: review, mark open questions, then we move to design (wireframes + data model details) before implementation.*
