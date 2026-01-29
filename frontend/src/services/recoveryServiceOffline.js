/**
 * Offline-First Recovery Service
 * 
 * This is the NEW version of recoveryService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old recoveryService.
 * Components should use this service instead of making direct API calls.
 */

import { recoveryRepository, loanRepository, memberRepository, groupRepository, fdRepository } from '../database/repository';
import db from '../database/db';

/**
 * Register a new recovery
 * Saves to IndexedDB immediately and queues for sync
 */
export const registerRecovery = async (data, testMode = false) => {
    const payload = { ...data };
    if (testMode) {
        payload.testMode = true;
    }

    const record = await recoveryRepository.create(payload);

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
 * Update member recovery
 */
export const updateMemberRecovery = async (groupId, date, memberRecovery, testMode = false) => {

    if (testMode) {
        memberRecovery.testMode = true;
    }

    // Find existing recovery for this group and date
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const dateStr = date; // Keep as string (en-GB format)
    const existing = recoveries.find(r => {
        const rDate = r.date || r.recoveryDate;
        if (!rDate) return false;
        // Try to match date in various formats
        const rDateStr = typeof rDate === 'string' ? rDate : new Date(rDate).toLocaleDateString("en-GB");
        return rDateStr === dateStr || rDate === dateStr;
    });

    if (existing) {
        // Merge member recovery into existing recoveries array
        const existingRecoveries = existing.recoveries || existing.memberRecoveries || [];
        const memberId = memberRecovery.memberId || memberRecovery.id;

        // Remove existing entry for this member if present
        const filtered = existingRecoveries.filter(mr =>
            (mr.memberId || mr.id) !== memberId
        );

        // Add or update the member recovery
        filtered.push(memberRecovery);

        // Check if we're in group panel context
        const isGroupPanel = typeof window !== 'undefined' && window.location?.pathname?.includes('/group');
        const updatePayload = {
            ...existing,
            recoveries: filtered,
            memberRecoveries: filtered, // Support both field names
            // Always add requireApproval flag for group panel requests
            ...(isGroupPanel ? { requireApproval: true, source: 'group_sync' } : {}),
        };

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'recoveryServiceOffline.js:74', message: 'Updating existing recovery', data: { isGroupPanel, hasRequireApproval: !!updatePayload.requireApproval, requireApproval: updatePayload.requireApproval, source: updatePayload.source, groupId, date: dateStr, recoveriesCount: filtered.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion

        const updated = await recoveryRepository.update(existing._uuid || existing._id, updatePayload);

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'recoveryServiceOffline.js:82', message: 'Recovery updated in repository', data: { uuid: updated.uuid, syncStatus: updated.syncStatus, hasRequireApproval: !!updated.payload?.requireApproval, requireApproval: updated.payload?.requireApproval, source: updated.payload?.source }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion
        return {
            success: true,
            data: {
                ...updated.payload,
                _id: updated.payload?._id || updated.uuid,
                _uuid: updated.uuid,
                _syncStatus: updated.syncStatus,
            },
        };
    } else {
        // Create new recovery record
        // Check if we're in group panel context (from window.location or other means)
        const isGroupPanel = typeof window !== 'undefined' && window.location?.pathname?.includes('/group');
        const payload = {
            groupId,
            date: dateStr,
            recoveries: [memberRecovery],
            memberRecoveries: [memberRecovery],
            // Add requireApproval flag for group panel requests
            ...(isGroupPanel ? { requireApproval: true, source: 'group_sync' } : {}),
        };
        if (testMode) {
            payload.testMode = true;
        }

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'recoveryServiceOffline.js:96', message: 'Creating new recovery', data: { isGroupPanel, hasRequireApproval: !!payload.requireApproval, requireApproval: payload.requireApproval, source: payload.source, groupId, date: dateStr, recoveriesCount: 1 }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion

        const record = await recoveryRepository.create(payload);

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'recoveryServiceOffline.js:108', message: 'Recovery created in repository', data: { uuid: record.uuid, syncStatus: record.syncStatus, hasRequireApproval: !!record.payload?.requireApproval, requireApproval: record.payload?.requireApproval, source: record.payload?.source }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'H1' }) }).catch(() => { });
        // #endregion

        return {
            success: true,
            data: {
                ...record.payload,
                _id: record.uuid,
                _uuid: record.uuid,
                _syncStatus: record.syncStatus,
            },
        };
    }
};

/**
 * Get recovery by date
 */
export const getRecoveryByDate = async (groupId, date, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const recovery = recoveries.find(r => {
        const rDate = r.date || r.recoveryDate;
        if (!rDate) return false;

        // Direct string match (handles en-GB format like "25/01/2026")
        if (rDate === date) return true;

        // Try to parse and compare dates
        try {
            // Handle string dates (could be in various formats)
            let dateObj;
            if (typeof rDate === 'string') {
                // If rDate is in en-GB format (DD/MM/YYYY), convert it
                if (rDate.includes('/')) {
                    const [day, month, year] = rDate.split('/');
                    dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else {
                    dateObj = new Date(rDate);
                }
            } else {
                dateObj = new Date(rDate);
            }

            // Check if date is valid
            if (isNaN(dateObj.getTime())) return false;

            // Convert to ISO string and compare YYYY-MM-DD format
            const rDateISO = dateObj.toISOString().split('T')[0];

            // Convert input date to YYYY-MM-DD format if it's in en-GB format
            let dateISO = date;
            if (date.includes('/')) {
                const [day, month, year] = date.split('/');
                const inputDateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                if (!isNaN(inputDateObj.getTime())) {
                    dateISO = inputDateObj.toISOString().split('T')[0];
                }
            }

            return rDateISO === dateISO;
        } catch (error) {
            // If date parsing fails, skip this recovery
            return false;
        }
    });

    if (recovery) {
        // Extract member recoveries from the recovery record
        let memberRecoveries = recovery.memberRecoveries || recovery.recoveries || [];
        // Enrich each member recovery with demandDetails (actual paid) so UI shows recovery detail not demand detail (same as admin)
        memberRecoveries = memberRecoveries.map((mr) => {
            if (mr.demandDetails) return mr; // keep backend/synced demandDetails
            const amounts = mr.amounts || {};
            const saving = parseFloat(amounts.saving ?? 0) || 0;
            const loan = parseFloat(amounts.loan ?? 0) || 0;
            const interest = parseFloat(amounts.interest ?? 0) || 0;
            const yogdan = parseFloat(amounts.yogdan ?? 0) || 0;
            const fd = parseFloat(amounts.fd ?? 0) || 0;
            const memFeesSHG = parseFloat(amounts.memFeesSHG ?? 0) || 0;
            const memFeesSamiti = parseFloat(amounts.memFeesSamiti ?? 0) || 0;
            const memFeesGroup = parseFloat(amounts.memFeesGroup ?? 0) || 0;
            const charges = amounts.charges || {};
            const chargesActual = typeof charges === 'object' && !Array.isArray(charges)
                ? charges
                : {};
            const chargesTotal = Object.values(chargesActual).reduce((sum, amt) => sum + (parseFloat(amt ?? 0) || 0), 0);
            const demandDetails = {
                saving: { prevDemand: 0, currDemand: saving, totalDemand: saving, actualPaid: saving, unpaidDemand: 0, openingBalance: 0, closingBalance: saving },
                loan: { prevDemand: 0, currDemand: loan, totalDemand: loan, actualPaid: loan, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
                interest: { prevDemand: 0, currDemand: interest, totalDemand: interest, actualPaid: interest, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
                yogdan: { prevDemand: 0, currDemand: yogdan, totalDemand: yogdan, actualPaid: yogdan, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
                fd: { actualPaid: fd, openingBalance: 0, closingBalance: fd },
                memFeesSHG: { prevDemand: 0, currDemand: memFeesSHG, totalDemand: memFeesSHG, actualPaid: memFeesSHG, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
                memFeesSamiti: { prevDemand: 0, currDemand: memFeesSamiti, totalDemand: memFeesSamiti, actualPaid: memFeesSamiti, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
                memFeesGroup: { prevDemand: 0, currDemand: memFeesGroup, totalDemand: memFeesGroup, actualPaid: memFeesGroup, unpaidDemand: 0, openingBalance: 0, closingBalance: 0 },
                charges: { chargesDue: chargesActual, chargesTotalDemand: chargesTotal, actualPaid: chargesActual, actualPaidTotal: chargesTotal, unpaidDemandTotal: 0, unpaidDemand: {} },
            };
            return { ...mr, demandDetails };
        });
        return {
            success: true,
            data: {
                ...recovery,
                recoveries: memberRecoveries,
            },
        };
    }

    return {
        success: true,
        data: {
            recoveries: [],
        },
    };
};

/**
 * Get all recoveries
 */
export const getRecoveries = async (groupId = null, testMode = false) => {
    const filters = groupId ? { groupId } : {};
    const recoveries = await recoveryRepository.getMerged(filters);

    return {
        success: true,
        data: recoveries,
    };
};

/**
 * Get recovery detail by ID
 */
export const getRecoveryDetail = async (id, testMode = false) => {
    let record = await recoveryRepository.getByUuid(id);

    if (!record) {
        const masterData = await recoveryRepository.getMasterData();
        record = masterData.find(r =>
            r.uuid === id ||
            r.payload?._id === id ||
            r.payload?.id === id
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
            message: `Recovery with ID ${id} not found`,
        };
    }

    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.payload?._id || record.uuid,
            id: record.payload?.id || record.uuid,
            _uuid: record.uuid,
            _syncStatus: record.syncStatus,
            _isLocal: record.syncStatus !== 'synced',
        },
    };
};

/**
 * Update recovery photo
 */
export const updateRecoveryPhoto = async (groupId, date, groupPhoto, cashDenominations = null, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const existing = recoveries.find(r => {
        const rDate = r.date || r.recoveryDate;
        return rDate === date || (rDate && new Date(rDate).toISOString().split('T')[0] === date);
    });

    const updateData = {
        groupId,
        date,
        groupPhoto,
    };
    if (cashDenominations) {
        updateData.cashDenominations = cashDenominations;
    }
    if (testMode) {
        updateData.testMode = true;
    }

    if (existing) {
        const updated = await recoveryRepository.update(existing._uuid || existing._id, {
            ...existing,
            ...updateData,
        });
        return {
            success: true,
            data: {
                ...updated.payload,
                _id: updated.payload?._id || updated.uuid,
                _uuid: updated.uuid,
            },
        };
    } else {
        const record = await recoveryRepository.create(updateData);
        return {
            success: true,
            data: {
                ...record.payload,
                _id: record.uuid,
                _uuid: record.uuid,
            },
        };
    }
};

/**
 * Get previous recovery data - computed from local IndexedDB
 */
export const getPreviousRecoveryData = async (groupId, memberId, date, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const targetDate = new Date(date);

    // Find recoveries before the target date
    const previousRecoveries = recoveries
        .filter(r => {
            const rDate = r.date || r.recoveryDate;
            if (!rDate) return false;
            return new Date(rDate) < targetDate;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date || a.recoveryDate);
            const dateB = new Date(b.date || b.recoveryDate);
            return dateB - dateA; // Most recent first
        });

    // Find member's recovery in the most recent previous recovery
    if (previousRecoveries.length > 0) {
        const latest = previousRecoveries[0];
        const memberRecoveries = latest.memberRecoveries || latest.recoveries || [];
        const memberRecovery = memberRecoveries.find(mr =>
            mr.memberId === memberId ||
            mr.memberCode === memberId ||
            (mr.member && (mr.member._id === memberId || mr.member.id === memberId))
        );

        if (memberRecovery) {
            return {
                success: true,
                data: memberRecovery,
            };
        }
    }

    return {
        success: true,
        data: null,
    };
};

/**
 * Get demand details - calls backend API when online, falls back to local data when offline
 */
export const getDemandDetails = async (groupId, memberId, date, testMode = false) => {
    // When online, call backend API to get full demand details
    if (navigator.onLine) {
        try {
            const httpRecovery = (await import('../api/httpRecovery')).default;
            const params = { groupId, memberId, date };
            if (testMode) {
                params.testMode = 'true';
            }
            const res = await httpRecovery.get("/demand-details", { params });
            return res.data;
        } catch (error) {
            console.error('Error fetching demand details from backend:', error);
            // Fall through to offline calculation
        }
    }

    // Offline fallback: compute from local data
    // Get previous recovery data first
    const previousDataRes = await getPreviousRecoveryData(groupId, memberId, date);
    const previousData = previousDataRes?.success ? (previousDataRes.data || {}) : {};

    // Get all required data
    // Note: Groups don't have groupId field, so get all groups and filter by _id
    const [loans, members, allGroups, fds, recoveries] = await Promise.all([
        loanRepository.getMerged({ groupId, memberId }),
        memberRepository.getMerged({ groupId }),
        groupRepository.getMerged({}), // Get all groups, then filter by _id
        fdRepository.getMerged({ groupId, memberId }),
        recoveryRepository.getMerged({ groupId })
    ]);

    // Find the specific group by _id
    const group = allGroups.find(g => {
        const gId = g._id || g.id || g.uuid;
        const targetId = groupId;
        return String(gId) === String(targetId);
    });

    const member = members.find(m => {
        const mId = m._id || m.id || m.Member_Id;
        return String(mId) === String(memberId);
    });

    if (!member) {
        return {
            success: false,
            message: 'Member not found',
            data: null,
        };
    }

    // Parse date
    let parsedDate = date ? new Date(date) : new Date();
    if (typeof date === 'string' && date.includes('/')) {
        const [d, m, y] = date.split('/');
        parsedDate = new Date(+y, +m - 1, +d);
    }
    parsedDate.setHours(0, 0, 0, 0);

    // Helper: Get cumulative payments from previous recoveries (before current date)
    const getCumulativePayments = (category) => {
        let total = 0;
        recoveries.forEach(recovery => {
            const rDate = recovery.date || recovery.recoveryDate;
            if (!rDate) return;
            const recoveryDate = new Date(rDate);
            recoveryDate.setHours(0, 0, 0, 0);
            if (recoveryDate >= parsedDate) return; // Skip current and future dates

            const memberRecoveries = recovery.memberRecoveries || recovery.recoveries || [];
            const memberRecovery = memberRecoveries.find(mr =>
                (mr.memberId || mr.id) === memberId ||
                (mr.memberCode || mr.memberId) === memberId
            );

            if (memberRecovery && memberRecovery.amounts) {
                const amounts = memberRecovery.amounts;
                if (category === 'saving') total += parseFloat(amounts.saving || 0);
                else if (category === 'loan') total += parseFloat(amounts.loan || 0);
                else if (category === 'interest') total += parseFloat(amounts.interest || 0);
                else if (category === 'yogdan') total += parseFloat(amounts.yogdan || 0);
                else if (category === 'fd') total += parseFloat(amounts.fd || 0);
            }
        });
        return total;
    };

    // ------------------ LOAN ------------------
    const memberLoanPaid = parseFloat(member.loanPaid || member.loanDetails?.loanPaid || 0);
    const isExistingMember = member.isExistingMember || false;
    const loanPaidFromRecoveries = getCumulativePayments('loan');
    const totalLoanPaid = memberLoanPaid + loanPaidFromRecoveries;

    const approvedLoans = loans.filter(l =>
        l.transactionType === 'Loan' &&
        l.status === 'approved' &&
        (!l.date || new Date(l.date) <= parsedDate)
    ).sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
    });

    // Calculate total loan amount (backend logic: for existing members with loanPaid, add it to principal)
    let totalLoanAmount = 0;
    if (approvedLoans.length > 0) {
        const principal = approvedLoans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
        totalLoanAmount = isExistingMember && memberLoanPaid > 0
            ? principal + memberLoanPaid
            : principal;
    } else {
        totalLoanAmount = parseFloat(member.loanDetails?.amount || 0);
    }

    const remainingLoan = Math.max(0, totalLoanAmount - totalLoanPaid);

    // Calculate current loan demand (monthly installment if applicable, otherwise remaining loan)
    let loanCurrDemand = remainingLoan;
    if (approvedLoans.length > 0 && group?.meeting_date_1_day && group?.meeting_date_2_day) {
        // Calculate monthly installment from all active loans
        let monthlyInstallment = 0;
        for (const loan of approvedLoans) {
            if (loan.installment_amount) {
                monthlyInstallment += parseFloat(loan.installment_amount);
            } else if (loan.time_period) {
                monthlyInstallment += parseFloat(loan.amount || 0) / parseFloat(loan.time_period);
            }
        }
        // If two meetings, divide by 2
        loanCurrDemand = monthlyInstallment / 2;
    }

    const loanPrevDemand = previousData.loan?.unpaidDemand || 0;
    const loanTotalDemand = loanPrevDemand + loanCurrDemand;
    // Unpaid demand is min of remaining loan and (total demand - actual paid)
    const loanUnpaidDemand = Math.min(remainingLoan, Math.max(0, loanTotalDemand - 0)); // actualLoan is 0 for display

    // ------------------ SAVING ------------------
    const savingPerMember = member.isExistingMember && member.saving_per_member_snapshot
        ? member.saving_per_member_snapshot
        : (group?.saving_per_member || 0);

    const openingSaving = parseFloat(member.openingSaving || 0);
    const savingPaidFromRecoveries = getCumulativePayments('saving');
    const totalSavingPaid = openingSaving + savingPaidFromRecoveries;

    const savingPrevDemand = previousData.saving?.unpaidDemand || 0;
    const savingCurrDemand = savingPerMember;
    const savingTotalDemand = savingPrevDemand + savingCurrDemand;
    const savingUnpaidDemand = Math.max(0, savingTotalDemand - 0); // actualSaving is 0 for display

    // ------------------ INTEREST ------------------
    // Get overdue interest from member
    const overdueInterest = parseFloat(member.loanDetails?.overdueInterest || 0);
    const interestPaid = getCumulativePayments('interest');
    const remainingOverdueInterest = Math.max(0, overdueInterest - interestPaid);

    // Simplified interest calculation for offline
    // In full version, this would calculate interest per loan based on meeting dates
    const interestPrevDemand = previousData.interest?.unpaidDemand || 0;
    const interestCurrDemand = remainingOverdueInterest > 0
        ? remainingOverdueInterest
        : 0; // Complex calculation simplified - would need meeting dates and loan rates
    const interestTotalDemand = interestPrevDemand + interestCurrDemand;
    const interestUnpaidDemand = Math.max(0, interestTotalDemand - 0); // actualInterest is 0 for display

    // ------------------ FD ------------------
    const openingFd = parseFloat(member.fdDetails?.amount || 0);
    const fdPaidFromRecoveries = getCumulativePayments('fd');
    const fdFromFDMaster = fds
        .filter(fd => fd.status === 'active' || fd.status === 'matured')
        .reduce((sum, fd) => sum + parseFloat(fd.amount || 0), 0);
    const totalFdPaid = openingFd + fdFromFDMaster + fdPaidFromRecoveries;

    // ------------------ YOGDAN ------------------
    // Calculate yogdan (1% of loan amount) for loans where yogdanCollected is false
    const unpaidYogdanLoans = approvedLoans.filter(loan => !loan.yogdanCollected);
    const yogdanTotalDemand = unpaidYogdanLoans.reduce((sum, loan) => {
        const loanAmount = parseFloat(loan.amount || 0);
        const yogdanAmount = loan.yogdanAmount
            ? parseFloat(loan.yogdanAmount)
            : Math.round((loanAmount * 0.01) * 100) / 100;
        return sum + yogdanAmount;
    }, 0);

    const yogdanPaidFromRecoveries = getCumulativePayments('yogdan');
    const yogdanPrevUnpaid = previousData.yogdan?.prevDemand || previousData.yogdan?.unpaidDemand || 0;
    const yogdanTotalDemandWithPrev = yogdanPrevUnpaid + yogdanTotalDemand;
    const yogdanUnpaidDemand = Math.max(0, yogdanTotalDemandWithPrev - 0); // actualYogdan is 0 for display

    // ------------------ MEMBERSHIP FEES ------------------
    // Simplified calculation based on group settings
    const memFeesSHGTotalDemand = group?.Mship_Group || 0;
    const memFeesGroupTotalDemand = group?.membership_fees || 0;

    const memFeesSHGPrevUnpaid = previousData.memFeesSHG?.prevDemand || previousData.memFeesSHG?.unpaidDemand || 0;
    const memFeesGroupPrevUnpaid = previousData.memFeesGroup?.prevDemand || previousData.memFeesGroup?.unpaidDemand || 0;

    const memFeesSHGUnpaidDemand = Math.max(0, memFeesSHGPrevUnpaid + memFeesSHGTotalDemand - 0); // actualMemFeesSHG is 0 for display
    const memFeesGroupUnpaidDemand = Math.max(0, memFeesGroupPrevUnpaid + memFeesGroupTotalDemand - 0); // actualMemFeesGroup is 0 for display

    // ------------------ CHARGES ------------------
    const chargesDue = {};
    if (group?.charges && Array.isArray(group.charges)) {
        // Simplified: calculate charges based on group charge cycles
        // This is a simplified version - full calculation would require date-based cycle logic
        group.charges.forEach(charge => {
            if (charge.name && charge.amount) {
                chargesDue[charge.name] = parseFloat(charge.amount) || 0;
            }
        });
    }

    const chargesTotalDemand = Object.values(chargesDue).reduce((sum, amt) => sum + parseFloat(amt || 0), 0);
    const chargesPrevUnpaid = previousData.charges?.unpaidDemand || {};
    const chargesPrevUnpaidTotal = Object.values(chargesPrevUnpaid).reduce((sum, amt) => sum + parseFloat(amt || 0), 0);
    const chargesUnpaidDemand = { ...chargesDue, ...chargesPrevUnpaid };
    const chargesUnpaidTotal = chargesTotalDemand + chargesPrevUnpaidTotal;

    const demandDetails = {
        loan: {
            prevDemand: loanPrevDemand,
            currDemand: loanCurrDemand,
            totalDemand: loanTotalDemand,
            actualPaid: 0,
            unpaidDemand: loanUnpaidDemand,
            openingBalance: totalLoanPaid,
            closingBalance: totalLoanPaid,
        },
        interest: {
            prevDemand: interestPrevDemand,
            currDemand: interestCurrDemand,
            totalDemand: interestTotalDemand,
            actualPaid: 0,
            unpaidDemand: interestUnpaidDemand,
            openingBalance: interestPaid,
            closingBalance: interestPaid,
        },
        saving: {
            prevDemand: savingPrevDemand,
            currDemand: savingCurrDemand,
            totalDemand: savingTotalDemand,
            actualPaid: 0,
            unpaidDemand: savingUnpaidDemand,
            openingBalance: totalSavingPaid,
            closingBalance: totalSavingPaid,
        },
        fd: {
            actualPaid: 0,
            openingBalance: totalFdPaid,
            closingBalance: totalFdPaid,
        },
        yogdan: {
            prevDemand: yogdanPrevUnpaid,
            currDemand: yogdanTotalDemand,
            totalDemand: yogdanTotalDemandWithPrev,
            actualPaid: 0,
            unpaidDemand: yogdanUnpaidDemand,
            openingBalance: yogdanPaidFromRecoveries,
            closingBalance: yogdanPaidFromRecoveries,
        },
        memFeesSHG: {
            prevDemand: memFeesSHGPrevUnpaid,
            currDemand: memFeesSHGTotalDemand,
            totalDemand: memFeesSHGPrevUnpaid + memFeesSHGTotalDemand,
            actualPaid: 0,
            unpaidDemand: memFeesSHGUnpaidDemand,
        },
        memFeesGroup: {
            prevDemand: memFeesGroupPrevUnpaid,
            currDemand: memFeesGroupTotalDemand,
            totalDemand: memFeesGroupPrevUnpaid + memFeesGroupTotalDemand,
            actualPaid: 0,
            unpaidDemand: memFeesGroupUnpaidDemand,
        },
        charges: {
            chargesDue,
            chargesTotalDemand,
            chargesPrevUnpaid,
            chargesPrevUnpaidTotal,
            actualPaid: {},
            actualPaidTotal: 0,
            unpaidDemand: chargesUnpaidDemand,
            unpaidDemandTotal: chargesUnpaidTotal,
        },
    };

    return {
        success: true,
        data: demandDetails,
    };
};

/**
 * Get member loan totals - computed from local IndexedDB
 */
export const getMemberLoanTotals = async (groupId, memberId, testMode = false) => {
    const loans = await loanRepository.getMerged({ groupId, memberId });

    const totals = loans.reduce((acc, loan) => {
        const amount = parseFloat(loan.amount || 0);
        const paid = parseFloat(loan.loanPaid || 0);
        acc.totalLoan += amount;
        acc.totalPaid += paid;
        acc.totalRemaining += (amount - paid);
        return acc;
    }, { totalLoan: 0, totalPaid: 0, totalRemaining: 0 });

    return {
        success: true,
        data: totals,
    };
};

/**
 * Get member revenue remaining - computed from local IndexedDB
 */
export const getMemberRevenueRemaining = async (groupId, memberId, testMode = false) => {
    // Compute from recoveries and demands
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const memberRecoveries = [];

    recoveries.forEach(recovery => {
        const members = recovery.memberRecoveries || recovery.recoveries || [];
        members.forEach(mr => {
            if (mr.memberId === memberId || mr.memberCode === memberId) {
                memberRecoveries.push({ ...mr, date: recovery.date || recovery.recoveryDate });
            }
        });
    });

    // Calculate totals from recoveries
    const totals = memberRecoveries.reduce((acc, mr) => {
        acc.totalSaving += parseFloat(mr.saving || 0);
        acc.totalLoanRecovery += parseFloat(mr.loan || 0);
        acc.totalInterest += parseFloat(mr.interest || 0);
        acc.totalYogdan += parseFloat(mr.yogdan || 0);
        acc.totalCharges += parseFloat(mr.charges || 0);
        return acc;
    }, {
        totalSaving: 0,
        totalLoanRecovery: 0,
        totalInterest: 0,
        totalYogdan: 0,
        totalCharges: 0,
    });

    return {
        success: true,
        data: totals,
    };
};

/**
 * Get group recovery details
 */
export const getGroupRecoveryDetails = async (groupId, filters = {}, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });

    let filtered = recoveries;
    if (filters.fromDate || filters.toDate) {
        filtered = recoveries.filter(r => {
            const rDate = r.date || r.recoveryDate;
            if (!rDate) return false;
            const date = new Date(rDate);
            if (filters.fromDate && date < new Date(filters.fromDate)) return false;
            if (filters.toDate && date > new Date(filters.toDate)) return false;
            return true;
        });
    }

    return {
        success: true,
        data: filtered,
    };
};

/**
 * Export recovery PDF - requires internet (returns error if offline)
 */
export const exportRecoveryPDF = async (groupId, date) => {
    // PDF export requires backend - queue this operation
    // For now, return an error indicating internet is required
    if (!navigator.onLine) {
        throw new Error('PDF export requires internet connection. Please sync your data first.');
    }

    // If online, this should be handled by sync engine or direct API call
    // For now, return a placeholder
    return {
        success: false,
        message: 'PDF export is not yet implemented in offline mode. Please use online mode.',
    };
};

/**
 * Get member recovery status (same shape as backend: recoveredToday so group panel blocks duplicate recovery same day)
 */
export const getMemberRecoveryStatus = async (memberId, groupId, date) => {
    const recovery = await getRecoveryByDate(groupId, date);

    if (recovery.data) {
        const memberRecoveries = recovery.data.memberRecoveries || recovery.data.recoveries || [];
        const memberRecovery = memberRecoveries.find(mr =>
            mr.memberId === memberId ||
            mr.memberId?.toString() === memberId ||
            mr.memberCode === memberId
        );

        const isRecovered = memberRecovery && (
            memberRecovery.attendance === 'present' ||
            (memberRecovery.attendance === 'absent' && memberRecovery.recoveryByOther)
        );

        return {
            success: true,
            data: {
                recoveredToday: !!isRecovered,
                recoveryId: recovery.data._id || recovery.data.id || null,
                amount: memberRecovery?.total ?? 0,
                recovery: isRecovered ? memberRecovery : null,
            },
        };
    }

    return {
        success: true,
        data: {
            recoveredToday: false,
            recoveryId: null,
            amount: 0,
            recovery: null,
        },
    };
};
