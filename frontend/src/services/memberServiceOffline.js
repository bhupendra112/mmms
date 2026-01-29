/**
 * Offline-First Member Service
 * 
 * This is the NEW version of memberService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old memberService.
 * Components should use this service instead of making direct API calls.
 */

import { memberRepository, loanRepository, recoveryRepository, paymentRepository, fdRepository } from '../database/repository';
import { EntityTypes, Operations, SyncStatuses } from '../database/db';
import { getMembersByGroup as fetchMembersByGroupApi } from './memberService';

/**
 * Register a new member
 * Saves to IndexedDB immediately and queues for sync
 * Note: FormData handling for file uploads is preserved
 */
export const registerMember = async (data) => {
    // For FormData, we need to handle it specially
    // In offline mode, we'll store the FormData as-is and sync when online
    if (data instanceof FormData) {
        // Convert FormData to a serializable format for IndexedDB
        const payload = {};
        for (const [key, value] of data.entries()) {
            if (value instanceof File) {
                // Store file as base64 or blob reference
                // For now, we'll store the file name and handle sync separately
                payload[key] = {
                    fileName: value.name,
                    type: value.type,
                    size: value.size,
                    _isFile: true,
                };
            } else {
                payload[key] = value;
            }
        }
        payload.groupId = payload.group_id || payload.groupId;

        const record = await memberRepository.create(payload);
        return {
            success: true,
            data: {
                ...record.payload,
                _id: record.uuid,
                id: record.uuid,
                _uuid: record.uuid,
                _syncStatus: record.syncStatus,
                _isLocal: true,
            },
        };
    }

    // Regular JSON data
    const record = await memberRepository.create(data);

    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.uuid,
            id: record.uuid,
            _uuid: record.uuid,
            _syncStatus: record.syncStatus,
            _isLocal: true,
        },
    };
};

/**
 * Get members by group.
 * When online: fetches fresh approved members from API (so newly approved appear)
 * and merges with local pending creates. When offline: uses getMerged (master + tx).
 */
export const getMembersByGroup = async (groupId) => {
    if (!groupId) {
        return { success: true, data: [] };
    }

    const localTx = await memberRepository.getAll({ groupId });
    const localPendingCreates = localTx.filter(
        (tx) =>
            tx.operation === Operations.CREATE &&
            !tx.payload?._deleted &&
            (tx.syncStatus === SyncStatuses.PENDING || tx.syncStatus === SyncStatuses.FAILED)
    );
    const localMembers = localPendingCreates.map((tx) => ({
        ...tx.payload,
        _uuid: tx.uuid,
        _syncStatus: tx.syncStatus,
        _operation: tx.operation,
        _isLocal: true,
    }));

    if (navigator.onLine) {
        try {
            const apiRes = await fetchMembersByGroupApi(groupId);
            const apiList = Array.isArray(apiRes?.data) ? apiRes.data : [];
            const members = [...apiList, ...localMembers];
            return { success: true, data: members };
        } catch (e) {
            console.warn('getMembersByGroup: API fetch failed, using local merge', e);
        }
    }

    const members = await memberRepository.getMerged({ groupId });
    return { success: true, data: members };
};

/**
 * Get auto member code - requires internet (calls backend)
 */
export const getAutoMemberCode = async (groupId) => {
    // This requires backend computation, so we need internet
    if (!navigator.onLine) {
        // Return a local estimate based on existing members
        const members = await memberRepository.getMerged({ groupId });
        const count = members.length;
        const next = count + 1;
        const memberCode = "M" + String(next).padStart(3, "0");

        return {
            success: true,
            data: { memberCode },
            _isLocal: true,
        };
    }

    // If online, this should be handled by direct API call
    // For now, return local estimate
    const members = await memberRepository.getMerged({ groupId });
    const count = members.length;
    const next = count + 1;
    const memberCode = "M" + String(next).padStart(3, "0");

    return {
        success: true,
        data: { memberCode },
        _isLocal: true,
    };
};

/**
 * Get all members
 */
export const getMembers = async (groupId) => {
    const filters = groupId ? { groupId } : {};
    const members = await memberRepository.getMerged(filters);

    return {
        success: true,
        data: members,
    };
};

/**
 * Get member detail by ID
 */
export const getMemberDetail = async (id) => {
    let record = await memberRepository.getByUuid(id);

    if (!record) {
        const masterData = await memberRepository.getMasterData();
        record = masterData.find(r =>
            r.uuid === id ||
            r.payload?._id === id ||
            r.payload?.id === id ||
            r.payload?.Member_Id === id
        );

        if (record) {
            return {
                success: true,
                data: {
                    ...record.payload,
                    _uuid: record.uuid,
                    _syncStatus: record.syncStatus,
                    _isLocal: false,
                },
            };
        }

        return {
            success: false,
            message: `Member with ID ${id} not found`,
        };
    }

    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.payload?._id || record.uuid,
            id: record.payload?._id || record.uuid,
            _uuid: record.uuid,
            _syncStatus: record.syncStatus,
            _isLocal: record.syncStatus !== 'synced',
        },
    };
};

const normId = (v) => (v == null ? '' : (typeof v === 'object' && v != null && (v._id != null || v.id != null) ? String(v._id || v.id) : String(v)));

/**
 * Get member financial ledger - same format as backend (admin) for FinancialLedger component.
 * Computed from local IndexedDB: loans, recoveries, FDs, payments.
 */
export const getMemberFinancialLedger = async (memberId, filters = {}) => {
    const mid = normId(memberId);
    const memberRes = await getMemberDetail(memberId);
    if (!memberRes?.success || !memberRes?.data) {
        return { success: true, data: [] };
    }
    const member = memberRes.data;
    const groupId = normId(member.group_id || member.group?._id || member.group || member.groupId);
    if (!groupId) {
        return { success: true, data: [] };
    }

    const fromDate = filters.fromDate ? new Date(filters.fromDate) : null;
    const toDate = filters.toDate ? new Date(filters.toDate) : null;
    toDate && toDate.setHours(23, 59, 59, 999);
    const dateInRange = (d) => {
        if (!d) return false;
        const t = new Date(d);
        if (fromDate && t < fromDate) return false;
        if (toDate && t > toDate) return false;
        return true;
    };

    const [loans, allRecoveries, fds, payments] = await Promise.all([
        loanRepository.getMerged({ memberId: mid }),
        recoveryRepository.getMerged({ groupId }),
        fdRepository.getMerged({ memberId: mid }),
        paymentRepository.getMerged({ memberId: mid }),
    ]);

    const entries = [];
    let runningSavings = parseFloat(member.openingSaving || 0) || 0;
    let runningLoan = 0;
    let runningFD = 0;
    let runningInterest = (member.isExistingMember && member.loanDetails?.overdueInterest) ? parseFloat(member.loanDetails.overdueInterest) || 0 : 0;
    let runningYogdanDue = 0;
    let runningYogdanPaid = 0;

    const pushEntry = (e) => {
        entries.push({
            date: e.date,
            receipt: e.receipt,
            savingsDeposit: e.savingsDeposit ?? 0,
            savingsWithdraw: e.savingsWithdraw ?? 0,
            savingsBalance: e.savingsBalance ?? runningSavings,
            loanPaid: e.loanPaid ?? 0,
            loanRecovered: e.loanRecovered ?? 0,
            loanBalance: e.loanBalance ?? runningLoan,
            fdDeposit: e.fdDeposit ?? 0,
            fdWithdraw: e.fdWithdraw ?? 0,
            fdBalance: e.fdBalance ?? runningFD,
            interestDue: e.interestDue ?? runningInterest,
            interestPaid: e.interestPaid ?? 0,
            yogdanDue: e.yogdanDue ?? 0,
            yogdanPaid: e.yogdanPaid ?? 0,
            other: e.other ?? 0,
            charges: e.charges || {},
        });
    };

    if (member.isExistingMember && (runningSavings > 0 || runningInterest > 0)) {
        const openingDate = member.Dt_Join || member.createdAt || new Date();
        pushEntry({
            date: openingDate,
            receipt: 'Opening',
            savingsDeposit: runningSavings,
            savingsWithdraw: 0,
            loanPaid: 0,
            loanRecovered: 0,
            fdDeposit: 0,
            fdWithdraw: 0,
            interestDue: runningInterest,
            interestPaid: 0,
            yogdanDue: 0,
            yogdanPaid: 0,
        });
    }

    const loanList = Array.isArray(loans) ? loans : [];
    loanList
        .filter((l) => dateInRange(l.date || l.loanDate))
        .sort((a, b) => new Date(a.date || a.loanDate) - new Date(b.date || b.loanDate))
        .forEach((loan) => {
            const loanDate = loan.date || loan.loanDate || loan.createdAt;
            const amount = parseFloat(loan.amount || 0);
            const type = (loan.transactionType || loan.transaction_type || '').toLowerCase();
            const purpose = loan.purpose || '';
            const yogdanAmt = Math.round((parseFloat(loan.yogdanAmount || loan.yogdan_amount || 0)) * 100) / 100;
            if (type === 'loan' && amount > 0) {
                runningLoan += amount;
                runningYogdanDue += yogdanAmt;
                pushEntry({
                    date: loanDate,
                    receipt: `Loan - ${purpose || 'N/A'}`,
                    savingsDeposit: 0,
                    savingsWithdraw: 0,
                    loanPaid: amount,
                    loanRecovered: 0,
                    loanBalance: runningLoan,
                    fdDeposit: 0,
                    fdWithdraw: 0,
                    interestDue: runningInterest,
                    interestPaid: 0,
                    yogdanDue: yogdanAmt,
                    yogdanPaid: 0,
                });
            } else if (type === 'saving' && amount > 0) {
                runningSavings += amount;
                pushEntry({
                    date: loanDate,
                    receipt: `Saving - ${purpose || 'N/A'}`,
                    savingsDeposit: amount,
                    savingsWithdraw: 0,
                    savingsBalance: runningSavings,
                    loanPaid: 0,
                    loanRecovered: 0,
                    loanBalance: runningLoan,
                    fdDeposit: 0,
                    fdWithdraw: 0,
                    interestDue: runningInterest,
                    interestPaid: 0,
                    yogdanDue: 0,
                    yogdanPaid: 0,
                });
            } else if ((type === 'fd' || type === 'f d') && amount > 0) {
                runningFD += amount;
                pushEntry({
                    date: loanDate,
                    receipt: `FD - ${purpose || loan.status || 'N/A'}`,
                    savingsDeposit: 0,
                    savingsWithdraw: 0,
                    loanPaid: 0,
                    loanRecovered: 0,
                    fdDeposit: amount,
                    fdWithdraw: 0,
                    fdBalance: runningFD,
                    interestDue: runningInterest,
                    interestPaid: 0,
                    yogdanDue: 0,
                    yogdanPaid: 0,
                });
            }
        });

    const fdList = Array.isArray(fds) ? fds : [];
    fdList
        .filter((f) => dateInRange(f.date))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach((fd) => {
            const fdDate = fd.date || fd.createdAt;
            const amount = parseFloat(fd.amount || fd.principal || 0);
            if (amount > 0) {
                runningFD += amount;
                pushEntry({
                    date: fdDate,
                    receipt: `FD - ${fd.status || 'Active'}`,
                    savingsDeposit: 0,
                    savingsWithdraw: 0,
                    loanPaid: 0,
                    loanRecovered: 0,
                    fdDeposit: amount,
                    fdWithdraw: 0,
                    fdBalance: runningFD,
                    interestDue: runningInterest,
                    interestPaid: 0,
                    yogdanDue: 0,
                    yogdanPaid: 0,
                });
            }
        });

    const paymentList = Array.isArray(payments) ? payments : [];
    paymentList
        .filter((p) => {
            const d = p.paymentDate || p.date || p.createdAt;
            return dateInRange(d) && ['approved', 'completed'].includes((p.status || '').toLowerCase());
        })
        .sort((a, b) => new Date(a.paymentDate || a.date) - new Date(b.paymentDate || b.date))
        .forEach((payment) => {
            const paymentDate = payment.paymentDate || payment.date || payment.createdAt;
            const amount = parseFloat(payment.amount || 0);
            const pType = (payment.paymentType || payment.payment_type || '').toLowerCase();
            if (pType === 'saving_withdrawal' && amount > 0) {
                runningSavings = Math.max(0, runningSavings - amount);
                pushEntry({
                    date: paymentDate,
                    receipt: 'Savings Withdrawal',
                    savingsDeposit: 0,
                    savingsWithdraw: amount,
                    savingsBalance: runningSavings,
                    loanPaid: 0,
                    loanRecovered: 0,
                    fdDeposit: 0,
                    fdWithdraw: 0,
                    interestDue: runningInterest,
                    interestPaid: 0,
                    yogdanDue: 0,
                    yogdanPaid: 0,
                });
            } else if (pType === 'fd_maturity' && amount > 0) {
                runningFD = Math.max(0, runningFD - amount);
                pushEntry({
                    date: paymentDate,
                    receipt: 'FD Maturity',
                    savingsDeposit: 0,
                    savingsWithdraw: 0,
                    loanPaid: 0,
                    loanRecovered: 0,
                    fdDeposit: 0,
                    fdWithdraw: amount,
                    fdBalance: runningFD,
                    interestDue: runningInterest,
                    interestPaid: 0,
                    yogdanDue: 0,
                    yogdanPaid: 0,
                });
            }
        });

    const recoveryList = Array.isArray(allRecoveries) ? allRecoveries : [];
    recoveryList
        .filter((r) => dateInRange(r.date || r.recoveryDate))
        .sort((a, b) => new Date(a.date || a.recoveryDate) - new Date(b.date || b.recoveryDate))
        .forEach((recovery) => {
            const recoveryDate = recovery.date || recovery.recoveryDate || recovery.createdAt;
            const recoveriesArr = recovery.recoveries || [];
            const memberRecovery = recoveriesArr.find(
                (r) => normId(r.memberId || r.member_id) === mid || normId(r.memberCode) === normId(member.Member_Id || member.memberCode)
            );
            if (!memberRecovery?.amounts) return;
            const amounts = memberRecovery.amounts;
            const savingAmount = parseFloat(amounts.saving || 0);
            const loanAmount = parseFloat(amounts.loan || 0);
            const interestAmount = parseFloat(amounts.interest || 0);
            const yogdanAmount = parseFloat(amounts.yogdan || 0);
            const fdAmount = parseFloat(amounts.fd || 0);
            const otherAmount = parseFloat(amounts.other || 0);
            const charges = amounts.charges || {};
            const hasAny = savingAmount > 0 || loanAmount > 0 || interestAmount > 0 || yogdanAmount > 0 || fdAmount > 0 || otherAmount > 0 || Object.keys(charges).length > 0;
            if (!hasAny) return;
            const interestDueBefore = runningInterest;
            const yogdanDueBefore = runningYogdanDue;
            runningSavings += savingAmount;
            runningLoan = Math.max(0, runningLoan - loanAmount);
            runningInterest = Math.max(0, runningInterest - interestAmount);
            runningFD += fdAmount;
            runningYogdanPaid += yogdanAmount;
            pushEntry({
                date: recoveryDate,
                receipt: 'Recovery',
                savingsDeposit: savingAmount,
                savingsWithdraw: 0,
                savingsBalance: runningSavings,
                loanPaid: 0,
                loanRecovered: loanAmount,
                loanBalance: runningLoan,
                fdDeposit: fdAmount,
                fdWithdraw: 0,
                fdBalance: runningFD,
                interestDue: interestDueBefore,
                interestPaid: interestAmount,
                yogdanDue: yogdanDueBefore,
                yogdanPaid: yogdanAmount,
                other: otherAmount,
                charges,
            });
        });

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));

    let recalcSavings = parseFloat(member.openingSaving || 0) || 0;
    let recalcLoan = 0;
    let recalcFD = 0;
    let recalcInterest = member.isExistingMember && member.loanDetails?.overdueInterest ? parseFloat(member.loanDetails.overdueInterest) || 0 : 0;
    let recalcYogdanDue = 0;
    let recalcYogdanPaid = 0;
    entries.forEach((entry) => {
        if (entry.receipt === 'Opening') {
            if (entry.savingsDeposit > 0) recalcSavings = entry.savingsDeposit;
            if (entry.interestDue > 0) recalcInterest = entry.interestDue;
            entry.loanPaid = 0;
        } else if (entry.receipt && entry.receipt.startsWith('Loan -')) {
            const loanAmount = entry.loanPaid || (entry.loanBalance - recalcLoan);
            if (loanAmount > 0) {
                recalcLoan += loanAmount;
                recalcYogdanDue += entry.yogdanDue || 0;
            }
            entry.loanPaid = loanAmount;
        } else if (entry.receipt && entry.receipt.startsWith('FD -')) {
            recalcFD += entry.fdDeposit || 0;
            entry.loanPaid = 0;
        } else if (entry.receipt && entry.receipt.startsWith('Saving -')) {
            recalcSavings += entry.savingsDeposit || 0;
            entry.loanPaid = 0;
        } else if (entry.receipt === 'Recovery') {
            recalcSavings += entry.savingsDeposit || 0;
            recalcLoan = Math.max(0, recalcLoan - (entry.loanRecovered || 0));
            recalcInterest = Math.max(0, recalcInterest - (entry.interestPaid || 0));
            recalcFD += entry.fdDeposit || 0;
            recalcYogdanPaid += entry.yogdanPaid || 0;
            entry.loanPaid = 0;
        } else if (entry.receipt === 'Savings Withdrawal') {
            recalcSavings = Math.max(0, recalcSavings - (entry.savingsWithdraw || 0));
            entry.loanPaid = 0;
        } else if (entry.receipt === 'FD Maturity') {
            recalcFD = Math.max(0, recalcFD - (entry.fdWithdraw || 0));
            entry.loanPaid = 0;
        }
        entry.savingsBalance = Math.round(recalcSavings * 100) / 100;
        entry.loanBalance = Math.round(recalcLoan * 100) / 100;
        entry.fdBalance = Math.round(recalcFD * 100) / 100;
        if (entry.receipt === 'Recovery') {
            entry.interestDue = Math.round((entry.interestDue || 0) * 100) / 100;
            entry.yogdanDue = Math.round((entry.yogdanDue || 0) * 100) / 100;
        } else {
            entry.interestDue = Math.round(recalcInterest * 100) / 100;
            entry.yogdanDue = entry.yogdanDue != null ? Math.round(entry.yogdanDue * 100) / 100 : 0;
        }
        entry.yogdanPaid = entry.yogdanPaid != null ? Math.round(entry.yogdanPaid * 100) / 100 : 0;
    });

    return {
        success: true,
        data: entries,
    };
};

/**
 * Export member ledger - requires internet
 */
export const exportMemberLedger = async (filters = {}) => {
    if (!navigator.onLine) {
        throw new Error('Export requires internet connection. Please sync your data first.');
    }

    return {
        success: false,
        message: 'Export is not yet implemented in offline mode. Please use online mode.',
    };
};

/**
 * Update member
 */
export const updateMember = async (memberId, data) => {
    let record = await memberRepository.getByUuid(memberId);

    if (!record) {
        const masterData = await memberRepository.getMasterData();
        const masterRecord = masterData.find(r =>
            r.uuid === memberId ||
            r.payload?._id === memberId ||
            r.payload?.id === memberId ||
            r.payload?.Member_Id === memberId
        );

        if (masterRecord) {
            const updated = await memberRepository.update(masterRecord.uuid, {
                ...masterRecord.payload,
                ...data,
            });
            return {
                success: true,
                data: {
                    ...updated.payload,
                    _id: updated.payload?._id || updated.uuid,
                    _uuid: updated.uuid,
                },
            };
        }

        return {
            success: false,
            message: `Member with ID ${memberId} not found`,
        };
    }

    const updated = await memberRepository.update(memberId, data);

    return {
        success: true,
        data: {
            ...updated.payload,
            _id: updated.payload?._id || updated.uuid,
            _uuid: updated.uuid,
        },
    };
};

/**
 * Delete member
 */
export const deleteMember = async (memberId) => {
    let record = await memberRepository.getByUuid(memberId);

    if (!record) {
        const masterData = await memberRepository.getMasterData();
        const masterRecord = masterData.find(r =>
            r.uuid === memberId ||
            r.payload?._id === memberId ||
            r.payload?.id === memberId
        );

        if (masterRecord) {
            await memberRepository.delete(masterRecord.uuid);
            return {
                success: true,
                message: 'Member deleted successfully',
            };
        }

        return {
            success: false,
            message: `Member with ID ${memberId} not found`,
        };
    }

    await memberRepository.delete(memberId);

    return {
        success: true,
        message: 'Member deleted successfully',
    };
};
