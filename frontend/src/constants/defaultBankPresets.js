/**
 * Permanent default banks (name, branch, IFSC) for quick-fill across admin & group flows.
 * Admins can still type any other bank manually in the same fields.
 */
export const DEFAULT_BANK_PRESETS = [
  {
    id: "sbi-udainagar",
    bankName: "STATE BANK OF INDIA",
    branchName: "UDAINAGAR",
    ifsc: "SBIN0030165",
  },
  {
    id: "boi-udainagar",
    bankName: "BANK OF INDIA",
    branchName: "UDAINAGAR",
    ifsc: "BKID0009832",
  },
  {
    id: "boi-polakhal",
    bankName: "BANK OF INDIA",
    branchName: "Polakhal",
    ifsc: "BKID0008929",
  },
  {
    id: "mpgb-pipari",
    bankName: "MADHYA PRADESH GRAMIN BANK (MPGB)",
    branchName: "Pipari",
    ifsc: "BKID0MG0124",
  },
];
