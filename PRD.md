# Mutually Aided Cooperative Society (MACS) — Product Requirements Document

**Version:** 0.3 (draft) · **Date:** 2026-05-16 · **Status:** For review

**Changelog from v0.2:**
- **Member savings can now go negative.** A negative savings balance represents money a member owes the group. The "unresolved deficit" concept is removed — the settlement cascade now fully accounts for all outstanding amounts.
- **Settlement cascade simplified:** borrower's savings applied first (capped at outstanding, so borrower doesn't go negative on their own loan), remainder split equally across guarantors and applied to their savings (guarantor savings allowed to go negative).
- Confirmed: EMI day-of-month is configured at group creation (existing §4.1 behaviour; no change to spec).

**Changelog from v0.1 (kept for context):**
- Roster visible to all members (names + monthly paid/unpaid).
- EMI due dates anchored to disbursal, fall on the group's configurable EMI day; first EMI ≥ 20 days after disbursal.
- Admin reversals of mark-as-paid allowed with append-only audit trail.
- Introduced guarantor concept; settlement cascade for member exit.

---

## 1. Overview

A web application that lets a single trusted group operate as a **mutually-aided cooperative**: every member contributes a fixed amount monthly (default **₹1,000**) into a shared pool, and members can request loans from that pool. An **admin** runs the group — they enter contributions, review loan requests, approve disbursals, track repayments, and handle member exits. Loans carry a fixed interest rate; interest is **deducted from the loan amount at disbursal**, and the loan is repaid in **fixed equal EMIs** on a group-configured EMI day. Every loan is backed by one or more **guarantors** from within the group.

This is a v1 / MVP. Payment integration is out of scope — money moves outside the app (UPI, cash, bank transfer); the app is the **ledger and workflow tool**.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Group** | The single cooperative society. v1 supports exactly one group per installation. |
| **Pool** | Cumulative cash held by the group (see §5.1 formula). |
| **Contribution** | The monthly ₹1,000 (configurable per group) every member owes. |
| **Loan** | A sum a member requests from the pool. Subject to admin approval. |
| **Disbursal amount** | Cash actually handed to borrower = Principal − Interest (see §5.3). |
| **EMI** | Equal Monthly Instalment. Principal ÷ tenure-in-months. |
| **EMI day** | The day of the month on which all loan EMIs fall due, configurable per group (e.g. 10, 15, 20). Set once during group setup. |
| **Late fee** | Fixed amount added to a member's dues when they miss a monthly contribution. |
| **Eligibility** | Whether a member is currently permitted to receive a new loan. Blocked by any unpaid contributions. |
| **Guarantor** | A group member who backs another member's loan. If the borrower exits the group with the loan still outstanding, the remainder after applying the borrower's savings is recovered from the guarantors — their savings may go negative. |
| **Savings** | A member's running balance with the group = total contributions paid in − amounts already applied to settle a loan they borrowed or guaranteed. **May be negative** if guarantor obligations have exceeded contributions. |
| **Settlement** | The process triggered when a member with an active loan deactivates: outstanding balance is recovered first from the borrower's savings (capped), then from the guarantors' savings (uncapped — may go negative). |

---

## 3. User roles

### 3.1 Admin (one per group)
- Creates/edits the group's settings (contribution amount, late fee, default interest rate, default tenure, **EMI day-of-month**, **minimum guarantors per loan**)
- Adds/removes members; resets member passwords
- Records monthly contributions (marks paid/unpaid per member, per month)
- **Reverses an erroneous mark-as-paid** (creates a reversal event in the audit trail)
- Reviews loan requests; approves with terms (principal, interest %, tenure, **guarantors**, first-EMI date) or rejects
- Records EMI repayments
- **Handles member exits** — runs the settlement workflow for borrowers with outstanding loans
- Views full ledger and pool balance

### 3.2 Member
- Logs in with username (= 10-digit mobile number) + password set by admin
- Views own dashboard: contributions paid/owed, active loans, EMI schedule, **loans they are guaranteeing**, own savings (may be negative), pool balance
- Submits a loan request (amount, proposed tenure, reason, **proposed guarantors**)
- May serve as a guarantor for other members' loans (assigned by admin)
- Views own transaction history
- Sees the group roster — every member's name + this-month's paid/unpaid status. Other members' loan details remain private.

---

## 4. User flows (v1)

### 4.1 Onboarding
1. Admin creates the group (one-time): sets group name, monthly contribution amount, default interest rate, late fee amount, default loan tenure, **EMI day-of-month** (e.g. 15), **minimum guarantors per loan** (default 1). These are locked to the group; changing them later is a v2 concern.
2. Admin adds members one by one: full name, mobile number (= username), initial password.
3. Admin shares username + temp password with member out-of-band.
4. Member logs in; can change own password from profile page (admin can also reset it).

### 4.2 Monthly contribution cycle
1. On the 1st of each month, the app creates a "contribution due" row for every active member.
2. Admin records payments as they come in: marks row "Paid" (with date + optional note).
3. Rows not marked paid by month-end remain "Unpaid" and carry forward. A **late fee** is added to the member's dues automatically.
4. Members with one or more unpaid contributions are marked **loan-ineligible**.
5. If admin marks a row Paid by mistake, they can **reverse** the action; the row returns to Unpaid status and a reversal event is recorded in the audit trail (the original mark-as-paid is preserved, not deleted).

### 4.3 Loan request → disbursal
1. Member submits a request: amount, proposed tenure (months), reason, **proposed guarantors** (one or more active members, at least the group's minimum).
2. Request appears in admin's queue. Each request shows the member's history (past contributions, past loans repaid on-time, current outstanding loans) **and a section for each proposed guarantor showing their savings + current guarantor exposure**.
3. Admin reviews and either:
   - **Approves** with final principal, interest rate, tenure, **confirmed guarantor list**, and **first-EMI date** (defaulted from group EMI day rule, see §5.3) → status: Approved
   - **Rejects** with optional reason
4. Admin marks the loan **Disbursed** when the cash is actually handed over (records date). The pool balance updates; the EMI schedule is generated.
5. Member dashboard shows the active loan, EMI schedule, and outstanding balance. **Each guarantor's dashboard shows the loan they are guaranteeing and the exposed amount.**

### 4.4 EMI repayment
1. EMI schedule lists due dates and amounts.
2. As member pays, admin marks each EMI "Paid" with date.
3. Outstanding balance updates; pool balance increases.
4. When final EMI is recorded, loan status → Closed. Guarantors' exposure for that loan drops to zero.

### 4.5 Member exit (with active loan) — settlement workflow
1. Admin selects "Deactivate member" on a member with one or more active loans as borrower.
2. App computes, per active loan: `outstanding_balance = remaining EMIs × EMI_amount`.
3. App proposes a settlement:
   - **Step 1:** Apply borrower's savings against the outstanding (capped at outstanding so the borrower's savings stop at 0 — they do not go negative as a result of their own loan settlement).
   - **Step 2:** Any remaining outstanding is split **equally** across the loan's guarantors and deducted from each guarantor's savings. **Guarantor savings may go negative** — that negative balance represents money the guarantor owes the group.
4. Admin reviews the proposed settlement, can adjust the per-guarantor split if needed (override is captured in audit trail; total must still equal the post-borrower remainder), and confirms.
5. On confirmation, the loan is closed (status: Closed via Settlement); settlement events are written; the borrower (and any affected guarantor) sees the deductions reflected in their savings.
6. Member is marked deactivated. Their roster row is hidden from new monthly cycles; their history remains queryable.
7. **Recovery of negative balances is out-of-band in v1** — admin chases the member outside the app. No in-app top-up flow yet (v2).

---

## 5. Core mechanics — the money model

### 5.1 Pool balance formula
```
pool_balance = Σ contributions_received
             + Σ EMI_repayments_received
             + Σ late_fees_received
             − Σ loan_disbursal_amounts
             ± Σ settlement_adjustments
```
Notes:
- Interest is netted out of `disbursal_amount` at the point of disbursal, so it accrues to the pool as EMIs are repaid.
- Settlement adjustments at member exit transfer outstanding-loan amounts from active EMIs to member savings deductions (which may push savings negative). The pool balance itself is unchanged by a settlement — the outstanding loan amount is reallocated, not erased.

### 5.2 Contribution accounting
- Each member, each month → one contribution row, status ∈ {Paid, Unpaid, Reversed}.
- Late fee applied automatically when month rolls over with status still Unpaid.
- Member's total dues = sum of unpaid contributions + accumulated late fees.
- "Reversed" is a terminal state for an erroneously-marked-paid row: it functions as Unpaid for accounting purposes, but the audit trail preserves both the original mark-paid event and the reversal event.

### 5.3 Loan math (flat-rate, interest deducted upfront)

Given:
- `P` = principal (the "loan amount" admin approves)
- `r` = monthly interest rate (e.g. 1%)
- `n` = tenure in months

Then:
- `interest = P × r × n` (flat-rate total interest)
- `disbursal_amount = P − interest` (cash to borrower)
- `EMI = P / n` (equal-principal instalments)
- `total_paid_by_borrower = P` (over n months)
- `effective_cost_to_borrower = interest` (paid upfront via reduced disbursal)

**Worked example:** Loan ₹10,000 at 1%/month flat for 6 months
- Interest = 10,000 × 0.01 × 6 = **₹600**
- Disbursal = 10,000 − 600 = **₹9,400** (cash to member)
- EMI = 10,000 / 6 = **₹1,666.67/month** for 6 months
- Pool: −9,400 today, +1,666.67 × 6 over six months = +₹600 net gain

**EMI schedule generation rule:**
- Let `D` = disbursal date, `E` = group EMI day-of-month, `n` = tenure.
- Default **first EMI date** = the first occurrence of day `E` that is **at least 20 days after `D`**.
  - Example, group EMI day = 15: disbursed Mar 3 → first EMI April 15 (43 days later). Disbursed Mar 20 → first EMI May 15 (56 days, since Apr 15 would be only 26 days). Disbursed Mar 25 → first EMI May 15.
- Subsequent EMIs cascade monthly on day `E`.
- Admin may **override the first-EMI date** at approval time; the schedule rebuilds from that anchor.
- Group EMI day is locked at `1..28` (avoids 29/30/31 month-edge ambiguity).

### 5.4 Loan cap & approval policy
- App enforces only: requested amount ≤ current pool balance (soft warning if not).
- Admin makes the final call based on visible signals: member's contribution history, past loans, current outstanding loans, **proposed guarantors' savings and existing exposure**, requested amount vs. pool.
- App surfaces these signals on the approval screen (§6.4).

### 5.5 Multiple concurrent loans
- A member may have more than one active loan at a time (admin's call).
- A member can be loan-ineligible (due to unpaid contributions) — checked at both request and approval time. Admin may waive ineligibility at approval with a mandatory note.

### 5.6 Guarantorship
- Every loan requires at least `min_guarantors_per_loan` (group setting; default 1) **distinct** members other than the borrower.
- Any active member may be assigned as a guarantor. v1 imposes no eligibility rules on guarantors (e.g. a member with their own active loan is allowed to guarantee another loan — admin's judgment).
- **Guarantor liability is equal split:** if two members guarantee a ₹10,000 loan, each is on the hook for ₹5,000 of the outstanding amount in a settlement scenario.
- A guarantor's **exposure for a single loan** = `outstanding_balance / number_of_guarantors`. Exposure decreases as EMIs are repaid; reaches zero when the loan closes.
- A guarantor's **total exposure** = sum of their exposure across all loans they guarantee. Visible on their own dashboard and to admin during loan-approval review.
- Guarantors cannot be changed once a loan is disbursed (v1). If a guarantor needs to exit before the loan they guarantee is fully repaid, that's a v2 problem.

### 5.7 Member exit & settlement
- Triggered when admin attempts to deactivate a member with one or more active loans as borrower.
- **Settlement cascade per outstanding loan:**
  1. Apply borrower's savings (capped at outstanding; borrower's savings won't go below 0 as a result of their own loan settlement).
  2. Any remaining outstanding is split **equally** across the loan's guarantors and deducted from each guarantor's savings. **Guarantor savings may go negative** — a negative balance represents money owed to the group.
- Settlement is **all-or-nothing per loan** — admin confirms the proposed split before any deductions are written.
- Admin may **manually adjust** the per-guarantor share at confirmation (with mandatory audit note). The override constraint: the total of all guarantor deductions = the post-borrower remainder; individual amounts within that total are free (admin can favour guarantors with higher savings, etc.).
- All settlement deductions create immutable events; the audit trail shows the cascade.
- After settlement, the loan is closed (status: `ClosedViaSettlement`); all guarantor exposures for that loan drop to zero.
- **Recovery of negative balances is out-of-band in v1** — admin chases the guarantor outside the app. No in-app top-up flow yet (v2).
- Guarantor-side deactivation (member trying to exit while still guaranteeing an active loan) is **blocked** in v1 — admin must wait until the guaranteed loan closes, or handle out-of-band.

---

## 6. Functional requirements

### 6.1 Authentication & access control
- **FR-1.1** Login via username (= 10-digit mobile number) + password.
- **FR-1.2** Two roles: `admin`, `member`. Role-based access enforced server-side.
- **FR-1.3** Member can change own password (must enter old password).
- **FR-1.4** Admin can reset any member's password (sets a new value; member must change on next login).
- **FR-1.5** Sessions expire after 30 days of inactivity.

### 6.2 Group & member management (admin)
- **FR-2.1** Admin sets group name, monthly contribution amount, default interest rate (%/month), late fee amount, default loan tenure, **EMI day-of-month (1–28)**, **minimum guarantors per loan** — all at group creation. These are locked after group creation in v1 (changes are v2).
- **FR-2.2** Admin adds a member: name, mobile (unique within group), initial password.
- **FR-2.3** Admin deactivates a member. If the member has any active loan as borrower, the **settlement workflow** (§4.5) is required before deactivation completes. If the member is currently guaranteeing any active loan, deactivation is **blocked** in v1.
- **FR-2.4** Admin views a member list with each member's: total contributed, savings (may be negative), total dues, active loans (as borrower), active loans as guarantor, total guarantor exposure, outstanding loan balance.

### 6.3 Contribution tracking
- **FR-3.1** App auto-generates contribution rows on the 1st of each month for all active members.
- **FR-3.2** Admin marks a row Paid (with date, optional note).
- **FR-3.3** App auto-applies late fee to unpaid rows when the month rolls over.
- **FR-3.4** Members with one or more unpaid contributions are flagged loan-ineligible.
- **FR-3.5** Admin can manually waive a late fee (with audit note).
- **FR-3.6** Admin can **reverse** a mark-as-paid action with a mandatory note. The reversal creates an event in the audit trail; the original Paid event is preserved and not deleted. Row status returns to Unpaid (or Reversed); any auto-applied late-fee logic re-evaluates.

### 6.4 Loan workflow
- **FR-4.1** Member submits a loan request: amount, tenure (months), reason (free text), proposed guarantors (≥ group minimum).
- **FR-4.2** Loan-ineligible members are blocked from submitting (with explanation).
- **FR-4.3** Admin sees pending requests in a queue. Each request shows: member name, requested amount, requested tenure, reason, **member context block** (contributions paid, savings, past loans count, past on-time repayment rate, current outstanding balance), and **per-proposed-guarantor block** (name, savings, current guarantor exposure).
- **FR-4.4** Admin can approve (with final amount, interest %, tenure, **confirmed guarantor list**, **first-EMI date**), reject (with reason), or hold. Final guarantor list need not match the proposed list.
- **FR-4.5** On approval, app shows the calculation (interest, disbursal, EMI, full EMI schedule with dates) before final confirm.
- **FR-4.6** Admin marks loan **Disbursed** when cash changes hands. EMI schedule locks in. Pool balance reduces by `disbursal_amount`. Guarantor exposure becomes visible to each guarantor.
- **FR-4.7** Admin records each EMI repayment.
- **FR-4.8** Loan auto-closes when last EMI is marked Paid. Guarantor exposure for that loan → zero.
- **FR-4.9** Admin cannot modify guarantors or tenure after a loan is Disbursed (v1).
- **FR-4.10** **Settlement workflow:** when admin attempts to deactivate a borrower with active loans, app proposes the settlement cascade per loan (§5.7), admin can adjust the guarantor split (total fixed), admin confirms, system applies deductions and closes loans.

### 6.5 Member dashboard
- **FR-5.1** Shows current month's contribution status and total dues.
- **FR-5.2** Shows active loan(s): principal, EMI, next due date, outstanding balance, full schedule.
- **FR-5.3** Shows total pool balance (aggregate only) and own **savings** (may be displayed as a negative number with explanatory text if owed to the group).
- **FR-5.4** Shows roster: every member's name + this-month's paid/unpaid status.
- **FR-5.5** "Request loan" button (disabled with reason if ineligible).
- **FR-5.6** Personal transaction history (contributions, loans, EMIs, settlements affecting this member).
- **FR-5.7** **Guarantor section:** lists every active loan this member is guaranteeing, with the borrower's name, original principal, outstanding balance, and the member's own exposure on that loan.

### 6.6 Admin dashboard
- **FR-6.1** Pool balance + month-over-month trend.
- **FR-6.2** This-month contribution status snapshot (paid / unpaid counts).
- **FR-6.3** Active loans summary (count, total outstanding).
- **FR-6.4** Pending loan requests count.
- **FR-6.5** **Pending settlement actions** count (deactivation attempts blocked by active loans).
- **FR-6.6** **Members with negative savings** count (post-settlement balances owed to group).
- **FR-6.7** Quick links to each workflow.

---

## 7. Non-functional requirements

- **NFR-1** Web app — responsive (works on mobile browsers; admin likely on desktop).
- **NFR-2** Currency: INR (₹), display with thousands separators (Indian numbering, e.g. ₹1,00,000). Negative values shown as `−₹X,XXX` (with explanatory tooltip on member dashboards: "amount owed to the group").
- **NFR-3** Time zone: Asia/Kolkata. All dates stored UTC, displayed in IST.
- **NFR-4** Soft-delete semantics — financial records are never hard-deleted. Deactivate, don't delete.
- **NFR-5** All financial mutations (contribution paid/reversed, loan approved/disbursed, EMI marked paid, settlement applied) recorded with `actor_user_id` + `timestamp` for forensic trail. The events table is **append-only**.
- **NFR-6** Money handled as integer paise (e.g. ₹100 → 10000) to avoid float errors. Savings field is a **signed** integer (can be negative).
- **NFR-7** Pool balance and member savings must be **derivable from the events log alone**. Any stored balance is a cache; the events log is the source of truth.

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

- **groups** (`id`, `name`, `monthly_contribution_paise`, `default_interest_rate_bps`, `late_fee_paise`, `default_tenure_months`, `emi_day_of_month`, `min_guarantors_per_loan`, `created_at`)
- **users** (`id`, `group_id`, `mobile`, `name`, `password_hash`, `role`, `must_change_password`, `active`, `deactivated_at`, `created_at`)
- **contribution_periods** (`id`, `group_id`, `year`, `month`)
- **contributions** (`id`, `period_id`, `user_id`, `status` ∈ `{Paid, Unpaid, Reversed}`, `amount_paise`, `paid_at`, `note`, `late_fee_paise`, `recorded_by`)
- **loans** (`id`, `user_id`, `requested_amount_paise`, `requested_tenure`, `reason`, `status` ∈ `{Pending, Approved, Disbursed, Closed, ClosedViaSettlement, Rejected}`, `principal_paise`, `interest_rate_bps`, `tenure_months`, `interest_paise`, `disbursal_paise`, `first_emi_date`, `requested_at`, `approved_at`, `disbursed_at`, `closed_at`, `approved_by`)
- **loan_guarantors** (`loan_id`, `user_id`) — composite PK; many-to-many between loans and guarantor users
- **emis** (`id`, `loan_id`, `seq`, `due_date`, `amount_paise`, `status` ∈ `{Pending, Paid}`, `paid_at`, `recorded_by`)
- **settlements** (`id`, `loan_id`, `triggered_by_user_id`, `triggered_at`, `outstanding_at_trigger_paise`, `borrower_applied_paise`, `guarantor_total_paise`, `note`, `confirmed_by`)
- **settlement_guarantor_applications** (`id`, `settlement_id`, `user_id`, `applied_paise`) — per-guarantor deduction within a settlement; sum equals `settlements.guarantor_total_paise`
- **events** (`id`, `actor_id`, `kind`, `entity_type`, `entity_id`, `payload_json`, `created_at`) — append-only audit log

**Derived values** (computed, never written as canonical state):
- `pool_balance` — from events log (§5.1).
- `member_savings(user_id)` — `Σ contributions_paid − Σ settlement_applications_against_this_user`. **Signed; may be negative.**
- `loan_outstanding(loan_id)` — `principal − Σ EMI_paid_amounts` (for non-settled loans) or 0 (for ClosedViaSettlement).
- `guarantor_exposure(user_id, loan_id)` — `loan_outstanding / number_of_guarantors`.

Money stored as integer paise (`*_paise`). Interest rate stored in basis points (`_bps`, where 100 bps = 1%).

---

## 10. Out of scope for v1 (= v2+ backlog)

- Payment gateway integration (UPI, Razorpay, Stripe)
- SMS/email notifications (EMI due reminders, contribution reminders, guarantor assignment notifications)
- Multiple groups per installation
- Member self-signup / public marketplace
- Auction / bidding-based loan allocation
- Reducing-balance interest (only flat-rate in v1)
- Member-visible audit log UI (events table exists, but no UI to browse it in v1)
- **In-app top-up flow** for members to clear a negative savings balance (recovery is out-of-band in v1)
- **Guarantor consent flow** (guarantors are admin-assigned in v1; no in-app accept/reject)
- **Custom per-guarantor liability split at approval time** (v1 = equal split at approval; admin may freely adjust the split at settlement time)
- **Guarantor swap mid-loan** (guarantors locked at disbursal in v1)
- **Guarantor-side member exit** (a guarantor wanting to exit while their guaranteed loan is still active — v2)
- **Editing group settings after creation** (EMI day, contribution amount, etc. — locked in v1)
- Co-admin / admin handover
- Group wind-up / final-pool-distribution / payout-to-departing-member flow
- KYC / document upload
- Reports / data export (CSV, PDF statements)
- Multi-language / regional language UI
- Push notifications / PWA
- Two-factor authentication

---

## 11. Assumptions & open questions

**Resolved across v0.1 → v0.3:**
- ✅ Roster visibility: members see other members' names + monthly paid/unpaid status (loan details remain private).
- ✅ EMI due dates: anchored to disbursal; fall on the group-configured `emi_day_of_month`; first EMI is the next occurrence at least 20 days after disbursal; admin can override at approval.
- ✅ Member exit with outstanding loan: settlement cascade — borrower's savings (capped) → guarantors' savings (uncapped, may go negative).
- ✅ Reversal of admin mistakes: allowed, with mandatory note and full audit trail.
- ✅ Member savings **may go negative** to represent debt owed to the group. No "unresolved deficit" state.
- ✅ Group settings (EMI day, contribution amount, min guarantors, etc.) are set at group creation and locked thereafter in v1.

**Still standing (defaults baked in; flag any to revise):**
- **A1** — Single admin per group. No co-admin or handover in v1.
- **A2** — Group is indefinite. No wind-up flow in v1.
- **A3** — Late fee is a fixed amount per missed contribution, non-compounding.
- **A4** — Loan reason is free text; admin reads but app doesn't categorise.
- **A5** — Loan-ineligibility blocks at both submission AND approval. Admin may waive at approval with a mandatory note.
- **A6** — Mobile numbers: 10-digit Indian format. No country-code handling.
- **A7** — Currency: INR only.
- **A8** — No 2FA in v1.
- **A9** — Group EMI day-of-month is restricted to `1..28`.
- **A10** — Default `min_guarantors_per_loan` is **1**. Admin may set higher per group at creation.
- **A11** — At loan approval, guarantor liability is **equal split**. At settlement, admin may freely adjust per-guarantor amounts (total fixed).
- **A12** — A member with their own active loan **is allowed** to guarantee other loans in v1. (Common real-world constraint is "no" — flag if you want to enforce it.)
- **A13** — Guarantors cannot be changed after a loan is Disbursed (v1).
- **A14** — Tenure: member proposes in request, admin can override at approval.
- **A15** — At settlement, the borrower's savings are capped at 0 (they don't go negative from their own loan settlement). Only **guarantors' savings may go negative**, representing money owed to the group. Recovery is out-of-band.
- **A16** — A member currently guaranteeing an active loan **cannot** be deactivated in v1 (guarantor-side exit is v2).

---

## 12. Success criteria for v1

The app is "done" when a real cooperative can:

1. Run a full month: admin records contributions, app tracks dues and applies late fees.
2. Admin can reverse a mistaken mark-as-paid with the audit trail preserved.
3. Process at least one loan end-to-end: member requests with guarantors → admin approves with confirmed guarantors → disburse → repay all EMIs → close.
4. Members can log in and see correct numbers for their own dues, loans, EMIs, savings (including negative), and **guarantor exposure**.
5. Pool balance and member savings are always correct and reconcilable from the events log.
6. No member can take a loan while in arrears unless admin waives (with note).
7. **A member with an outstanding loan can be deactivated**: the settlement cascade runs, borrower savings are applied (capped at outstanding), and any remaining outstanding is split equally across guarantors and deducted from their savings (guarantor savings may go negative). The loan closes via settlement.

---

*End of PRD v0.3. Next step: confirm A11–A16 (especially A12 — should a member with their own active loan be allowed to guarantee others?), then move to wireframes + finalised data model before implementation.*
