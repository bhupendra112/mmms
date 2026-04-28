const HEADS = {
    LOAN_RECEIVABLE: { code: "LOAN_RECEIVABLE", name: "Loan Receivable" },
    SAVINGS_LIABILITY: { code: "SAVINGS_LIABILITY", name: "Savings Liability" },
    FD_LIABILITY: { code: "FD_LIABILITY", name: "FD Liability" },
    CASH_ACCOUNT: { code: "CASH_ACCOUNT", name: "Cash Account" },
    BANK_ACCOUNT: { code: "BANK_ACCOUNT", name: "Bank Account" },
    INTEREST_INCOME: { code: "INTEREST_INCOME", name: "Interest Income" },
    INTEREST_EXPENSE: { code: "INTEREST_EXPENSE", name: "Interest Expense" },
    PENALTY_INCOME: { code: "PENALTY_INCOME", name: "Penalty Income" },
    EXPENSE_ACCOUNT: { code: "EXPENSE_ACCOUNT", name: "Expense Account" },
    MEMBER_FEE_INCOME: { code: "MEMBER_FEE_INCOME", name: "Member Fee Income" },
    YOGDAN_INCOME: { code: "YOGDAN_INCOME", name: "Yogdan Income" },
    CHARGE_INCOME: { code: "CHARGE_INCOME", name: "Charge Income" },
};

const asAmount = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const pushLine = (lines, { head, debit = 0, credit = 0, memberId, bankId, notes }) => {
    const debitValue = asAmount(debit);
    const creditValue = asAmount(credit);
    if (debitValue <= 0 && creditValue <= 0) return;

    lines.push({
        accountHead: head.name,
        accountHeadCode: head.code,
        debit: debitValue,
        credit: creditValue,
        memberId: memberId || undefined,
        bankId: bankId || undefined,
        notes: notes || "",
    });
};

export const getLoanDisbursementLines = ({ amount, paymentMode, bankId, memberId, notes }) => {
    const lines = [];
    const value = asAmount(amount);

    pushLine(lines, {
        head: HEADS.LOAN_RECEIVABLE,
        debit: value,
        memberId,
        notes: notes || "Loan disbursed to member/group",
    });

    pushLine(lines, {
        head: paymentMode === "Bank" ? HEADS.BANK_ACCOUNT : HEADS.CASH_ACCOUNT,
        credit: value,
        bankId: paymentMode === "Bank" ? bankId : undefined,
        notes: notes || "Loan disbursement payout",
    });

    return lines;
};

export const getRecoveryLines = ({ recovery, notes }) => {
    const lines = [];
    if (!recovery || !Array.isArray(recovery.recoveries)) return lines;

    let totalCash = 0;
    let totalBank = 0;
    let savings = 0;
    let loan = 0;
    let interest = 0;
    let penalty = 0;
    let memberFees = 0;
    let yogdan = 0;
    let fd = 0;
    let charges = 0;

    for (const memberRecovery of recovery.recoveries) {
        const amounts = memberRecovery?.amounts || {};
        const chargeTotal = amounts.charges && typeof amounts.charges === "object"
            ? Object.values(amounts.charges).reduce((sum, value) => sum + asAmount(value), 0)
            : 0;
        const computedTotal = asAmount(amounts.saving) +
            asAmount(amounts.loan) +
            asAmount(amounts.interest) +
            asAmount(amounts.yogdan) +
            asAmount(amounts.memFeesSHG) +
            asAmount(amounts.memFeesSamiti) +
            asAmount(amounts.memFeesGroup) +
            asAmount(amounts.penalty) +
            asAmount(amounts.other) +
            asAmount(amounts.fd) +
            chargeTotal;
        const entryTotal = asAmount(memberRecovery?.total || computedTotal);
        const isOnline = Boolean(memberRecovery?.paymentMode?.online);

        if (isOnline) totalBank += entryTotal;
        else totalCash += entryTotal;

        savings += asAmount(amounts.saving);
        loan += asAmount(amounts.loan);
        interest += asAmount(amounts.interest);
        penalty += asAmount(amounts.penalty);
        memberFees += asAmount(amounts.memFeesSHG) + asAmount(amounts.memFeesSamiti) + asAmount(amounts.memFeesGroup);
        yogdan += asAmount(amounts.yogdan);
        fd += asAmount(amounts.fd);

        charges += chargeTotal;
    }

    pushLine(lines, {
        head: HEADS.CASH_ACCOUNT,
        debit: totalCash,
        notes: notes || "Recovery collected in cash",
    });
    pushLine(lines, {
        head: HEADS.BANK_ACCOUNT,
        debit: totalBank,
        notes: notes || "Recovery collected in bank",
    });

    pushLine(lines, { head: HEADS.SAVINGS_LIABILITY, credit: savings, notes: "Savings collection" });
    pushLine(lines, { head: HEADS.LOAN_RECEIVABLE, credit: loan, notes: "Loan repayment collection" });
    pushLine(lines, { head: HEADS.INTEREST_INCOME, credit: interest, notes: "Loan interest collection" });
    pushLine(lines, { head: HEADS.PENALTY_INCOME, credit: penalty, notes: "Penalty collection" });
    pushLine(lines, { head: HEADS.MEMBER_FEE_INCOME, credit: memberFees, notes: "Member fee collection" });
    pushLine(lines, { head: HEADS.YOGDAN_INCOME, credit: yogdan, notes: "Yogdan collection" });
    pushLine(lines, { head: HEADS.FD_LIABILITY, credit: fd, notes: "FD collection" });
    pushLine(lines, { head: HEADS.CHARGE_INCOME, credit: charges, notes: "Charges collection" });

    return lines;
};

export const getPaymentLines = ({
    amount,
    paymentType,
    paymentMode,
    bankId,
    memberId,
    principalAmount,
    interestAmount,
    notes,
}) => {
    const lines = [];
    const totalAmount = asAmount(amount);
    const principal = asAmount(principalAmount || totalAmount);
    const interest = asAmount(interestAmount);

    const payoutHead = paymentMode === "Bank" ? HEADS.BANK_ACCOUNT : HEADS.CASH_ACCOUNT;

    if (paymentType === "fd_maturity") {
        pushLine(lines, { head: HEADS.FD_LIABILITY, debit: principal, memberId, notes: "FD maturity principal" });
    } else {
        pushLine(lines, { head: HEADS.SAVINGS_LIABILITY, debit: principal, memberId, notes: "Savings payout principal" });
    }

    if (interest > 0) {
        pushLine(lines, {
            head: HEADS.INTEREST_EXPENSE,
            debit: interest,
            memberId,
            notes: "Interest payout component",
        });
    }

    pushLine(lines, {
        head: payoutHead,
        credit: totalAmount,
        bankId: payoutHead.code === HEADS.BANK_ACCOUNT.code ? bankId : undefined,
        notes: notes || "Member payment payout",
    });

    return lines;
};

export const getCashBankTransferLines = ({
    amount,
    conversionType,
    sourceBankId,
    destinationBankId,
    notes,
}) => {
    const lines = [];
    const value = asAmount(amount);

    if (conversionType === "bank_to_bank") {
        pushLine(lines, {
            head: HEADS.BANK_ACCOUNT,
            debit: value,
            bankId: destinationBankId,
            notes: notes || "Bank to bank transfer credit leg",
        });
        pushLine(lines, {
            head: HEADS.BANK_ACCOUNT,
            credit: value,
            bankId: sourceBankId,
            notes: notes || "Bank to bank transfer debit leg",
        });
        return lines;
    }

    pushLine(lines, {
        head: HEADS.BANK_ACCOUNT,
        debit: value,
        bankId: destinationBankId,
        notes: notes || "Cash to bank deposit",
    });
    pushLine(lines, {
        head: HEADS.CASH_ACCOUNT,
        credit: value,
        notes: notes || "Cash moved to bank",
    });
    return lines;
};

export { HEADS };
