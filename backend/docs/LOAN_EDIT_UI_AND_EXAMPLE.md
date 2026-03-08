# Loan Edit: UI Flow & Example Scenario

## Backend API Summary

- **Preview (before save):** `POST /api/admin/loan/preview-edit/:id`  
  Body: `{ date?, amount?, time_period?, loan_rate_snapshot? }` (or `interestRate` instead of `loan_rate_snapshot`)  
  Returns: `oldTotalPayable`, `newTotalPayable`, `difference`, `status` (`overpaid` | `underpaid` | `no_change`), `overpaidAmount`, `underpaidAmount`, `oldState`, `newState`.

- **Update (save with action):** `PATCH /api/admin/loan/update/:id`  
  Body: same fields + `actionTaken` (`advance` | `refund` | `deficit` | `manual`)  
  For refund: `refundPaymentMode` (`Cash` | `Bank`), `bankId` (if Bank).  
  For manual: `manualOverrideAmount`, `manualAdjustmentType` (`overpaid` | `underpaid`), `manualAdjustmentReason`.

---

## UI Flow Steps

### 1. Loan Edit Preview Screen (before saving)

- Admin edits: **Loan date**, **Tenure**, **Interest rate**, **Amount** (and any other editable terms).
- On “Preview” or “Calculate” (or before “Save”):
  - Call `POST /api/admin/loan/preview-edit/:id` with the **proposed** values (e.g. `{ date, amount, time_period, interestRate }`).
- Show:
  - **Old total payable:** `oldTotalPayable`
  - **New total payable:** `newTotalPayable`
  - **Difference:** `difference` (new − old)
  - **Status:**
    - **Overpaid ₹X** if `status === 'overpaid'` and `overpaidAmount === X`
    - **Underpaid ₹Y** if `status === 'underpaid'` and `underpaidAmount === Y`
    - **No change** if `status === 'no_change'`

### 2. If Overpaid → Modal

- Message: *“Member has overpaid ₹X due to loan edit.”*
- Options:
  - **[Keep as advance]**  
    → On Save, send `actionTaken: 'advance'`. Credit is stored and auto-subtracted from future demand.
  - **[Refund to member]**  
    → On Save, send `actionTaken: 'refund'`. Backend creates PaymentMaster, Cash/Bank transaction, and ledger entry.
  - **[Manual adjustment]**  
    → Open Manual Adjustment Modal (see below). On Save, send `actionTaken: 'manual'` with `manualOverride*` fields.

### 3. If Underpaid → Modal

- Message: *“Member has underpaid ₹X due to loan edit.”*
- Options:
  - **[Add to future demand]**  
    → On Save, send `actionTaken: 'deficit'`. Deficit is stored and included in next demand.
  - **[Manual adjustment]**  
    → Open Manual Adjustment Modal. On Save, send `actionTaken: 'manual'` with manual override.

### 4. Manual Adjustment Modal

- **Adjustment amount** (input, number).
- **Type** (dropdown): **Credit** (overpaid) | **Deficit** (underpaid).
- **Reason** (textarea).
- This value **overrides** the system-calculated adjustment; demand uses it instead of the auto value.
- On Submit: send in update body:
  - `actionTaken: 'manual'`
  - `manualOverrideAmount: <amount>`
  - `manualAdjustmentType: 'overpaid'` or `'underpaid'`
  - `manualAdjustmentReason: '<text>'`

### 5. Save (Update) Request

- Send **all edited loan fields** plus **action** (and refund/manual fields as above).
- Example:  
  `PATCH /api/admin/loan/update/:id`  
  Body: `{ date, amount, time_period, interestRate, actionTaken: 'advance' }`.

**Example payload structure for update API:**

```json
{
  "date": "2024-01-15",
  "amount": 80000,
  "time_period": 2,
  "loan_rate_snapshot": 12,
  "interestRate": 12,
  "actionTaken": "deficit",
  "manualOverrideAmount": null,
  "manualAdjustmentType": null,
  "manualAdjustmentReason": null,
  "refundPaymentMode": "Cash",
  "bankId": null
}
```

- For **manual** adjustment: set `actionTaken: "manual"`, `manualOverrideAmount`, `manualAdjustmentType` (`"overpaid"` | `"underpaid"`), `manualAdjustmentReason`.
- For **refund**: set `actionTaken: "refund"`, and optionally `refundPaymentMode` (`"Cash"` | `"Bank"`), `bankId` (required if Bank).

---

## Example Scenario (Numbers)

### Setup

- **Loan (before edit):** Amount ₹1,00,000, Tenure 24 months, Rate 12%, Date 1 Jan 2024.
- **Recoveries (historical, unchanged):** Principal paid ₹40,000, Interest paid ₹8,000 (total paid ₹48,000).
- **As-of date:** 27 Feb 2025.

### Step 1: Admin edits loan

- Changes **amount** to **₹80,000** (principal reduced).
- **Preview** is called with `{ amount: 80000 }` (rest same).

### Step 2: System recalculation (after edit)

- **New principal due:** ₹80,000.
- **Interest till today** (recomputed on reduced principal): say **₹10,400**.
- **New total due:** ₹80,000 + ₹10,400 = **₹90,400**.
- **Total paid (unchanged):** ₹48,000.
- **Result:** Total paid (₹48,000) < New total due (₹90,400) → **Underpaid** by **₹42,400** (deficit).

So:

- **System recalculation:**  
  `totalDue = 90400`, `totalPaid = 48000`, `underpayment = 42400`, `outstanding = 40000` (₹80,000 − ₹40,000 principal paid).

### Step 3a: Admin chooses “Add to future demand”

- **Action:** `actionTaken: 'deficit'`.
- **Stored in LoanAdjustmentLog:**  
  `deficitAmount = 42400`, `actionTaken: 'deficit'`.
- **Demand sync:** Next time `calculateDemandDetails` runs for this member, `loanAdjustment.deficitAmount = 42400` is included, so **effective total unpaid** increases by ₹42,400 (deficit added to demand).

### Step 3b: Admin chooses “Manual adjustment” (e.g. waiver)

- Admin believes only **₹20,000** should be added to demand (partial waiver).
- **Manual override:** amount **₹20,000**, type **underpaid**, reason *“Partial waiver as per committee.”*
- **Stored:**  
  `manualOverride: { amount: 20000, type: 'underpaid', reason: '...' }`,  
  `deficitAmount = 20000`, `actionTaken: 'manual'`.
- **Demand:** Future demand uses **₹20,000** (manual deficit), not ₹42,400 (system underpayment).

### Step 4: Overpaid example (for completeness)

- Suppose instead the edit had **increased** total due less than what was already paid (e.g. amount reduced a lot and interest recalc is small).
- **System:** `overpayment = 5000`.
- **Keep as advance:** `actionTaken: 'advance'` → `memberCredit = 5000`; next demand is reduced by ₹5,000.
- **Refund:** `actionTaken: 'refund'` → PaymentMaster + Cash/Bank tx + “Loan Refund” ledger entry for ₹5,000.

---

## Constraints (reminder)

- **Do not** modify past **RecoveryMaster** or ledger history.
- All changes are **forward-only** (new snapshot, adjustment log, optional refund/deficit).
- Balances change only via **transactions** (refund creates PaymentMaster + Cash/Bank + ledger).
- Demand always uses **latest adjustment state** (credit/deficit from LoanAdjustmentLog; manual override stored there and used in demand).
