# Income/Expense Financial Report – Checklist

This checklist traces each report line item to its **source** (model + code path) and ensures ledger posting uses the correct **headName** so the Income/Expense report (master mapping) shows it correctly.

---

## 1. INTEREST PAID ON MEMBER SAVINGS

| Item | Source | Ledger headName | Status |
|------|--------|-----------------|--------|
| INTEREST PAID ON MEMBER SAVINGS | PaymentMaster (`paymentType: "saving_withdrawal"`) | `INTEREST PAID ON MEMBER SAVINGS` (section: expense) | ✅ Fixed: interest portion posted on create/approve |  

**Flow:**
- **Backend:** `paymentController.js` – createPayment / approvePayment for `saving_withdrawal`.
- **Interest:** Computed via `computeInterestOnSavings(totalSavings, savingRate)` (1% p.a. or group `saving_rate`, prorated YTD). Shown in `getMemberSavings` and payment UI.
- **Payment.amount:** Principal + interest (user enters total payout).
- **Ledger:** Split at post time: principal → "Saving Return" (liability); interest → "INTEREST PAID ON MEMBER SAVINGS" (expense). Second entry uses `referenceModel: "PaymentMasterInterest"` to allow two entries per payment.

---

## 2. INTEREST PAID ON MEMBER'S F.D.

| Item | Source | Ledger headName | Status |
|------|--------|-----------------|--------|
| INTEREST PAID ON MEMBER'S F.D. | PaymentMaster (`paymentType: "fd_maturity"`) + FDMaster | `INTEREST PAID ON MEMBER'S F.D.` (section: expense) | ✅ Fixed: interest portion posted on create/approve |

**Flow:**
- **Backend:** `paymentController.js` – createPayment / approvePayment for `fd_maturity`.
- **FDMaster:** `amount` (principal), `interestAmount`, `maturityAmount` (principal + interest).
- **Interest:** `payment.amount - fd.amount` (or `fd.interestAmount` / `fd.maturityAmount - fd.amount` if set).
- **Ledger:** Split: principal → "FD Return" (liability); interest → "INTEREST PAID ON MEMBER'S F.D." (expense). Second entry uses `referenceModel: "PaymentMasterFDInterest"`.

---

## 3. Other expenditure / income items

Other report heads (e.g. GROUP EXPENSES, BANK EXPENSES, INTEREST RECD ON MEMBER LOAN) come from:

- **GroupLedger** (section `income` / `expense`) – populated by:
  - Recovery posting (interest income, member fees, penalty, etc.)
  - Expense posting (`ExpenseMaster` – headName = expenseType; should match IncomeExpenseHeads seed, e.g. AUDIT FEES, TA TO MEMBERS)
  - FD/loan/revenue controllers

Ensure when adding new flows that the **headName** matches a row in `IncomeExpenseHeads` (or add seed + alias) so the report maps it and does not put it in **unmapped**.

---

## Normalization (report matching)

- **headName** is normalized: trim, collapse spaces, uppercase, remove `'` and `.`.
- Match is by **ItemName** in IncomeExpenseHeads (no LedgerCode in GroupLedger).
- Add aliases in `config/incomeExpenseHeadsSeed.js` for any head names used in app (e.g. "Interest Income", "Member Fee Group").
