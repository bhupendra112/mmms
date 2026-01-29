/**
 * Shared approval notification data for Admin navbar.
 * Aggregates pending approvals from approvalDB + backend (same logic as ApprovalManagement).
 * Used by AdminNavbar for notification badge and dropdown.
 */

import { initApprovalDB, getAllApprovals } from "./approvalDB";
import { getPendingConversions } from "./cashToBankService";
import { getLoans } from "./loanService";
import { getPendingMembers } from "./memberService";
import { getAllFDs } from "./fdService";
import { getRecoveries } from "./recoveryService";
import { getExpenses } from "./expenseService";
import { getPayments } from "./paymentService";

const MAX_ITEMS = 10;

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function approvalToNotificationItem(a) {
  const groupName = a.groupName || a.data?.groupName || "Group";
  let title = "";
  switch (a.type) {
    case "loan":
      title = `Loan – ${groupName}`;
      break;
    case "recovery":
      title = `Recovery – ${a.data?.date ? new Date(a.data.date).toLocaleDateString("en-GB") : groupName}`;
      break;
    case "member":
      title = `Member – ${groupName}`;
      break;
    case "fd":
      title = `FD – ${groupName}`;
      break;
    case "expense":
      title = `Expense – ${groupName}`;
      break;
    case "payment":
      title = `Payment – ${groupName}`;
      break;
    case "cash_to_bank":
      title = `Conversion – ${groupName}`;
      break;
    default:
      title = `${a.type} – ${groupName}`;
  }
  return {
    id: a.id,
    type: a.type,
    title,
    status: a.status || "pending",
    time: formatTime(a.submittedAt),
    link: "/admin/approvals",
  };
}

/**
 * Load all pending approvals for admin (same sources as ApprovalManagement).
 * Returns { count, items } for navbar notification.
 */
export async function getAdminPendingApprovals() {
  try {
    await initApprovalDB();
    let allApprovals = await getAllApprovals(null);

    try {
      const cashToBankRes = await getPendingConversions();
      if (cashToBankRes?.success && Array.isArray(cashToBankRes.data)) {
        const cashToBankApprovals = cashToBankRes.data.map((conversion) => ({
          id: conversion._id || conversion.id,
          type: "cash_to_bank",
          status: conversion.status || "pending",
          groupId: conversion.groupId?._id || conversion.groupId || "",
          groupName: conversion.groupName || conversion.groupId?.group_name || "",
          data: conversion,
          submittedAt: conversion.createdAt ? new Date(conversion.createdAt).getTime() : Date.now(),
          _isBackendApproval: true,
        }));
        allApprovals = [...allApprovals, ...cashToBankApprovals];
      }
    } catch (e) {
      // continue
    }

    try {
      const loansRes = await getLoans();
      if (loansRes?.success && Array.isArray(loansRes.data)) {
        const loanApprovals = loansRes.data.map((loan) => ({
          id: loan._id || loan.id,
          type: "loan",
          status: loan.status || "pending",
          groupId: loan.groupId?._id || loan.groupId || "",
          groupName: loan.groupName || loan.groupId?.group_name || "",
          data: loan,
          submittedAt: loan.createdAt ? new Date(loan.createdAt).getTime() : Date.now(),
          _isBackendApproval: true,
        }));
        allApprovals = [...allApprovals, ...loanApprovals];
      }
    } catch (e) {
      // continue
    }

    try {
      const membersRes = await getPendingMembers();
      if (membersRes?.success && Array.isArray(membersRes.data)) {
        const memberApprovals = membersRes.data.map((m) => ({
          id: m._id || m.id,
          type: "member",
          status: m.approvalStatus || "pending",
          groupId: m.group?._id || m.group || "",
          groupName: m.group?.group_name || "",
          data: m,
          submittedAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
          _isBackendApproval: true,
        }));
        allApprovals = [...allApprovals, ...memberApprovals];
      }
    } catch (e) {
      // continue
    }

    try {
      const fdsRes = await getAllFDs();
      if (fdsRes?.success && Array.isArray(fdsRes.data)) {
        const fdApprovals = fdsRes.data
          .filter((fd) => (fd.approvalStatus || "approved") === "pending")
          .map((fd) => ({
            id: fd._id || fd.id,
            type: "fd",
            status: fd.approvalStatus || "pending",
            groupId: fd.groupId?._id || fd.groupId || "",
            groupName: fd.groupName || fd.groupId?.group_name || "",
            data: fd,
            submittedAt: fd.createdAt ? new Date(fd.createdAt).getTime() : Date.now(),
            _isBackendApproval: true,
          }));
        allApprovals = [...allApprovals, ...fdApprovals];
      }
    } catch (e) {
      // continue
    }

    try {
      const recoveriesRes = await getRecoveries();
      if (recoveriesRes?.success && Array.isArray(recoveriesRes.data)) {
        const recoveryApprovals = recoveriesRes.data
          .filter((r) => r.approvalStatus === "pending")
          .map((recovery) => ({
            id: recovery._id || recovery.id,
            type: "recovery",
            status: recovery.approvalStatus || "approved",
            groupId: recovery.groupId?._id || recovery.groupId || "",
            groupName: recovery.groupName || recovery.groupId?.group_name || "",
            data: recovery,
            submittedAt: recovery.createdAt ? new Date(recovery.createdAt).getTime() : Date.now(),
            _isBackendApproval: true,
          }));
        allApprovals = [...allApprovals, ...recoveryApprovals];

        const recoveryByKey = new Map();
        allApprovals.forEach((a) => {
          if (a.type !== "recovery") return;
          const gid = (a.groupId?._id ?? a.groupId ?? "").toString();
          const dateStr = a.data?.date ? (typeof a.data.date === "string" ? a.data.date : new Date(a.data.date).toISOString().slice(0, 10)) : "";
          const key = `${gid}|${dateStr}`;
          const existing = recoveryByKey.get(key);
          if (!existing || (a._isBackendApproval && !existing._isBackendApproval)) recoveryByKey.set(key, a);
        });
        allApprovals = allApprovals.filter((a) => {
          if (a.type !== "recovery") return true;
          const gid = (a.groupId?._id ?? a.groupId ?? "").toString();
          const dateStr = a.data?.date ? (typeof a.data.date === "string" ? a.data.date : new Date(a.data.date).toISOString().slice(0, 10)) : "";
          return recoveryByKey.get(`${gid}|${dateStr}`) === a;
        });
      }
    } catch (e) {
      // continue
    }

    try {
      const expensesRes = await getExpenses();
      if (expensesRes?.success && Array.isArray(expensesRes.data)) {
        const expenseApprovals = expensesRes.data
          .filter((e) => e.approvalStatus === "pending")
          .map((expense) => ({
            id: expense._id || expense.id,
            type: "expense",
            status: expense.approvalStatus || "approved",
            groupId: expense.groupId?._id || expense.groupId || "",
            groupName: expense.groupName || expense.groupId?.group_name || "",
            data: expense,
            submittedAt: expense.createdAt ? new Date(expense.createdAt).getTime() : Date.now(),
            _isBackendApproval: true,
          }));
        allApprovals = [...allApprovals, ...expenseApprovals];
      }
    } catch (e) {
      // continue
    }

    try {
      const paymentsRes = await getPayments({ status: "pending" });
      if (paymentsRes?.success && Array.isArray(paymentsRes.data)) {
        const paymentApprovals = paymentsRes.data.map((payment) => ({
          id: payment._id || payment.id,
          type: "payment",
          status: payment.status || "pending",
          groupId: payment.groupId?._id || payment.groupId || "",
          groupName: payment.groupName || payment.groupId?.group_name || "",
          data: payment,
          submittedAt: payment.createdAt ? new Date(payment.createdAt).getTime() : Date.now(),
          _isBackendApproval: true,
        }));
        allApprovals = [...allApprovals, ...paymentApprovals];
      }
    } catch (e) {
      // continue
    }

    allApprovals = allApprovals.filter((a) => a.type !== "member" || a._isBackendApproval);
    allApprovals = allApprovals.filter((a) => a.status === "pending");
    allApprovals.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

    const count = allApprovals.length;
    const items = allApprovals.slice(0, MAX_ITEMS).map(approvalToNotificationItem);
    return { count, items };
  } catch (err) {
    console.error("Error loading admin pending approvals:", err);
    return { count: 0, items: [] };
  }
}

/**
 * Load approval outcomes (approved/rejected) for group panel notification.
 * Fetches from backend: getLoans, getRecoveries, getAllFDs, getExpenses, getPayments for this groupId.
 * Returns { count, items } for navbar notification.
 */
export async function getGroupApprovalOutcomes(groupId) {
  if (!groupId) return { count: 0, items: [] };
  const outcomes = [];
  const gid = typeof groupId === "string" ? groupId : (groupId?._id || groupId)?.toString?.() || groupId;

  try {
    const loansRes = await getLoans(gid);
    if (loansRes?.success && Array.isArray(loansRes.data)) {
      loansRes.data
        .filter((l) => l.status === "approved" || l.status === "rejected")
        .forEach((loan) => {
          outcomes.push({
            id: loan._id || loan.id,
            type: "loan",
            status: loan.status,
            title: `Loan ${loan.status}`,
            time: loan.createdAt ? new Date(loan.createdAt).getTime() : Date.now(),
            _raw: loan,
          });
        });
    }
  } catch (e) {
    // continue
  }

  try {
    const recoveriesRes = await getRecoveries(gid);
    if (recoveriesRes?.success && Array.isArray(recoveriesRes.data)) {
      recoveriesRes.data
        .filter((r) => (r.approvalStatus || r.status) === "approved" || (r.approvalStatus || r.status) === "rejected")
        .forEach((rec) => {
          outcomes.push({
            id: rec._id || rec.id,
            type: "recovery",
            status: rec.approvalStatus || rec.status,
            title: `Recovery ${rec.approvalStatus || rec.status}`,
            time: rec.createdAt ? new Date(rec.createdAt).getTime() : (rec.date ? new Date(rec.date).getTime() : Date.now()),
            _raw: rec,
          });
        });
    }
  } catch (e) {
    // continue
  }

  try {
    const fdsRes = await getAllFDs({ groupId: gid });
    if (fdsRes?.success && Array.isArray(fdsRes.data)) {
      fdsRes.data
        .filter((fd) => (fd.approvalStatus || fd.status) === "approved" || (fd.approvalStatus || fd.status) === "rejected")
        .forEach((fd) => {
          outcomes.push({
            id: fd._id || fd.id,
            type: "fd",
            status: fd.approvalStatus || fd.status,
            title: `FD ${fd.approvalStatus || fd.status}`,
            time: fd.createdAt ? new Date(fd.createdAt).getTime() : Date.now(),
            _raw: fd,
          });
        });
    }
  } catch (e) {
    // continue
  }

  try {
    const expensesRes = await getExpenses({ groupId: gid });
    if (expensesRes?.success && Array.isArray(expensesRes.data)) {
      expensesRes.data
        .filter((e) => (e.approvalStatus || e.status) === "approved" || (e.approvalStatus || e.status) === "rejected")
        .forEach((exp) => {
          outcomes.push({
            id: exp._id || exp.id,
            type: "expense",
            status: exp.approvalStatus || exp.status,
            title: `Expense ${exp.approvalStatus || exp.status}`,
            time: exp.createdAt ? new Date(exp.createdAt).getTime() : Date.now(),
            _raw: exp,
          });
        });
    }
  } catch (e) {
    // continue
  }

  try {
    const paymentsRes = await getPayments({ groupId: gid });
    if (paymentsRes?.success && Array.isArray(paymentsRes.data)) {
      paymentsRes.data
        .filter((p) => p.status === "approved" || p.status === "rejected" || p.status === "completed")
        .forEach((pay) => {
          outcomes.push({
            id: pay._id || pay.id,
            type: "payment",
            status: pay.status === "completed" ? "approved" : pay.status,
            title: `Payment ${pay.status}`,
            time: pay.createdAt ? new Date(pay.createdAt).getTime() : (pay.paymentDate ? new Date(pay.paymentDate).getTime() : Date.now()),
            _raw: pay,
          });
        });
    }
  } catch (e) {
    // continue
  }

  outcomes.sort((a, b) => b.time - a.time);
  const count = outcomes.length;
  const items = outcomes.slice(0, MAX_ITEMS).map((o) => ({
    id: o.id,
    type: o.type,
    title: o.title,
    status: o.status,
    time: formatTime(o.time),
    link: "/group/loans",
  }));
  return { count, items };
}
