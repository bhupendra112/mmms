const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

export const calculateJVImpact = (lines = [], currentBalances = {}) => {
    let updatedSaving = round2(currentBalances.savingBalance || 0);
    let updatedLoan = round2(currentBalances.loanOutstanding || 0);
    const loanRate = round2(currentBalances.loanRate || 0);
    const interestMemberScoped = Boolean(currentBalances.interestMemberScoped);

    for (const line of lines) {
        const debit = round2(line?.debit || 0);
        const credit = round2(line?.credit || 0);
        const head = String(line?.accountHead || "").toUpperCase();

        if (head === "SAVINGS_LIABILITY") {
            updatedSaving = round2(updatedSaving + credit - debit);
        } else if (head === "LOAN_RECEIVABLE") {
            updatedLoan = round2(updatedLoan + debit - credit);
        }
    }

    const updatedInterest = interestMemberScoped
        ? round2((updatedLoan * loanRate) / 1200)
        : round2(currentBalances.interestDemand || 0);

    return { updatedSaving, updatedLoan, updatedInterest };
};
