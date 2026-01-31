/**
 * Master mapping for Income/Expense report.
 * ItemName + Nature must be unique.
 * Transactions are matched by normalizing headName/expenseType to ItemName (no LedgerCode in DB).
 */
export const INCOME_EXPENSE_HEADS_SEED = [
    // EXPENDITURE
    { itemName: "INTEREST PAID ON MEMBER SAVINGS", ledgerCode: 212, headerName: "INTEREST PAID TO MEMBERS", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST PAID ON MEMBER'S F.D.", ledgerCode: 212, headerName: "INTEREST PAID TO MEMBERS", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST PAID TO PSDS ON G.LOAN", ledgerCode: 210, headerName: "FINANCIAL INSTITUTION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "GROUP EXPENSES", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "WRITE OFF ACCOUNT", ledgerCode: 151, headerName: "WRITE OFF ACCOUNT", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "CHARGES PAID TO BANK", ledgerCode: 208, headerName: "BANK EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST PAID TO BANK", ledgerCode: 208, headerName: "BANK EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "ASSET FUND PAID TO FEDERATION", ledgerCode: 209, headerName: "FEDERATION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "LAND & BUILDING FUND PAID TO FEDERATION", ledgerCode: 209, headerName: "FEDERATION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "SAHYOG RASHI PAID TO FEDERATION", ledgerCode: 209, headerName: "FEDERATION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "AUDIT FEES", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "STATIONARY CHARGES", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "STEEL BOX", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "TA TO MEMBERS", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST PAID TO OTHER GROUPS", ledgerCode: 213, headerName: "OTHER INSTITUTION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST PAID TO PSDS FOR AGGREGATION LOAN", ledgerCode: 210, headerName: "FINANCIAL INSTITUTION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST PAID TO PSDS FOR CATTLE LOAN", ledgerCode: 210, headerName: "FINANCIAL INSTITUTION EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "TRANSPORTATION CHARGES", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
    { itemName: "INTEREST REBATE", ledgerCode: 243, headerName: "INTEREST REBATE", headerCode: 2, nature: "EXPENDITURE" },
    // INCOME
    { itemName: "INTEREST ON GENERAL LOAN", ledgerCode: 117, headerName: "INTEREST RECD ON MEMBER LOAN", headerCode: 1, nature: "INCOME" },
    { itemName: "M.SHIP FEE FROM MEMBER (FOR GROUP)", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "PENALTY FROM MEMBERS", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "PENALTY", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "DONATION PAID OR RECEIVED", ledgerCode: 216, headerName: "DONATION", headerCode: 1, nature: "INCOME" },
    { itemName: "INTEREST RECEIVED FROM OTHER GROUP", ledgerCode: 217, headerName: "INCOME FROM OTHER INSTITUTION", headerCode: 1, nature: "INCOME" },
    { itemName: "INTEREST ON BANK FD", ledgerCode: 218, headerName: "INTEREST FROM BANKS", headerCode: 1, nature: "INCOME" },
    { itemName: "INTEREST RECEIVED ON SB A/C", ledgerCode: 218, headerName: "INTEREST FROM BANKS", headerCode: 1, nature: "INCOME" },
    { itemName: "INTEREST SUBVENTION FROM BANK", ledgerCode: 218, headerName: "INTEREST FROM BANKS", headerCode: 1, nature: "INCOME" },
    { itemName: "PENALTY FROM MITAN", ledgerCode: 219, headerName: "OTHER INCOME", headerCode: 1, nature: "INCOME" },
    { itemName: "EXCESS AMOUNT RECEIVED IN MEETING", ledgerCode: 219, headerName: "OTHER INCOME", headerCode: 1, nature: "INCOME" },
    { itemName: "MEMBER PASSBOOK CHARGES", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "REVOLVING FUND FROM NRLM", ledgerCode: 239, headerName: "INCOME FROM GOVERNMENT SCHEME", headerCode: 1, nature: "INCOME" },
    { itemName: "DIVIDEND FROM INVESTMENT", ledgerCode: 217, headerName: "INCOME FROM OTHER INSTITUTION", headerCode: 1, nature: "INCOME" },
    { itemName: "OTHER INCOME", ledgerCode: 219, headerName: "OTHER INCOME", headerCode: 1, nature: "INCOME" },
    // Aliases for headNames used in GroupLedger / app (same headers, different display names)
    { itemName: "INTEREST INCOME", ledgerCode: 117, headerName: "INTEREST RECD ON MEMBER LOAN", headerCode: 1, nature: "INCOME" },
    { itemName: "MEMBER FEE", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "MEMBER FEE GROUP", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "MEMBER FEE SHG", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "MEMBER FEE SAMITI", ledgerCode: 114, headerName: "COLLECTION FROM MEMBER", headerCode: 1, nature: "INCOME" },
    { itemName: "STATIONERY CHARGES", ledgerCode: 211, headerName: "GROUP EXPENSES", headerCode: 2, nature: "EXPENDITURE" },
];
