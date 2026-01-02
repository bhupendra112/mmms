import httpFinancialReport from "../api/httpFinancialReport";

export const getReceiptPaymentAccount = async (groupId, fromDate, toDate) => {
  const params = { groupId };
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  const res = await httpFinancialReport.get("/receipt-payment", { params });
  return res.data;
};

export const getIncomeExpenseAccount = async (groupId, fromDate, toDate) => {
  const params = { groupId };
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  const res = await httpFinancialReport.get("/income-expense", { params });
  return res.data;
};

export const getBalanceSheet = async (groupId, asOnDate) => {
  const params = { groupId, asOnDate };
  const res = await httpFinancialReport.get("/balance-sheet", { params });
  return res.data;
};

