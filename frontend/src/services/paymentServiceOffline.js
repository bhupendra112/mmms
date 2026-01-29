/**
 * Offline-First Payment Service
 * 
 * This is the NEW version of paymentService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old paymentService.
 * Components should use this service instead of making direct API calls.
 */

import { paymentRepository, fdRepository, recoveryRepository, groupRepository } from '../database/repository';
import db, { EntityTypes, Operations } from '../database/db';
import { getAuthToken } from '../utils/getAuthToken';

function getApiOrigin() {
    const raw = String(import.meta.env.VITE_BASE_URL || '');
    try {
        return new URL(raw).origin;
    } catch {
        const match = raw.match(/^(https?:\/\/[^/]+)/i);
        return match ? match[1] : (import.meta.env.PROD ? 'https://api.mmms.online' : 'http://localhost:8080');
    }
}

/**
 * Create a new payment
 * Saves to IndexedDB immediately and queues for sync
 * For group panel: sets requireApproval flag and pending status
 */
export const createPayment = async (data) => {
    // Check if we're in group panel context
    const isGroupPanel = typeof window !== 'undefined' && window.location?.pathname?.includes('/group');

    // Prepare payload with group panel flags
    const payload = {
        ...data,
        // Set status to pending for group panel (requires approval)
        status: isGroupPanel ? 'pending' : (data.status || 'pending'),
        // Add requireApproval flag for group panel requests
        ...(isGroupPanel ? { requireApproval: true, source: 'group_sync' } : {}),
        // Ensure paymentDate is set
        paymentDate: data.paymentDate || new Date().toISOString(),
    };

    console.log('[PAYMENT_SERVICE] Creating payment:', {
        isGroupPanel,
        hasRequireApproval: !!payload.requireApproval,
        source: payload.source,
        status: payload.status,
        paymentType: payload.paymentType,
        amount: payload.amount,
    });

    // Save to IndexedDB (will be synced to backend when online)
    const record = await paymentRepository.create(payload);

    console.log('[PAYMENT_SERVICE] Payment record created:', {
        uuid: record.uuid,
        syncStatus: record.syncStatus,
        payload: record.payload,
    });

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
 * Get matured FDs - computed from local IndexedDB
 */
export const getMaturedFDs = async (params = {}) => {
    const { groupId, memberId } = params;
    const filters = {};
    if (groupId) filters.groupId = groupId;
    if (memberId) filters.memberId = memberId;

    const fds = await fdRepository.getMerged(filters);
    const today = new Date();

    // Filter matured FDs
    const matured = fds.filter(fd => {
        if (!fd.maturityDate) return false;
        const maturityDate = new Date(fd.maturityDate);
        return maturityDate <= today && !fd.isPaid;
    });

    return {
        success: true,
        data: matured,
    };
};

// Interest on savings: same formula as backend (prorated for current year to date)
const computeInterestOnSavings = (totalSavings, savingRatePercent) => {
    if (!totalSavings || totalSavings <= 0) return 0;
    const rate = typeof savingRatePercent === 'number' && !Number.isNaN(savingRatePercent) ? savingRatePercent : 1;
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysElapsed = Math.max(0, (now - startOfYear) / (24 * 60 * 60 * 1000));
    const daysInYear = 365;
    const interest = (totalSavings * (rate / 100) * daysElapsed) / daysInYear;
    return Math.round(interest * 100) / 100;
};

/**
 * Get member savings - computed from local IndexedDB
 * Calculates: openingSaving + recovery savings - approved/completed withdrawals
 * Includes interest on savings (group saving_rate % p.a., prorated) for payment module (same as admin)
 */
export const getMemberSavings = async (memberId) => {
    // Get member to access openingSaving
    const { memberRepository } = await import('../database/repository');
    const members = await memberRepository.getMerged({});
    const member = members.find(m => {
        const mId = m._id || m.id || m.Member_Id;
        return String(mId) === String(memberId);
    });

    if (!member) {
        return {
            success: true,
            data: {
                totalSaving: 0,
                totalWithdrawn: 0,
                availableSavings: 0,
                availableBalance: 0,
                interestOnSavings: 0,
                savingRate: 1,
            },
        };
    }

    // Get member's group ID
    const groupId = member.group || member.groupId || member.Group_Name;
    if (!groupId) {
        const opening = parseFloat(member.openingSaving || 0);
        const interestOnSavings = computeInterestOnSavings(opening, 1);
        return {
            success: true,
            data: {
                totalSaving: opening,
                totalWithdrawn: 0,
                availableSavings: opening,
                availableBalance: opening,
                interestOnSavings,
                savingRate: 1,
            },
        };
    }

    // Get group's saving_rate (same as backend)
    let savingRate = 1;
    try {
        const groups = await groupRepository.getMerged({});
        const group = groups.find(g => String(g._id || g.id) === String(groupId));
        if (group && typeof group.saving_rate === 'number' && !Number.isNaN(group.saving_rate)) {
            savingRate = group.saving_rate;
        } else if (group && group.saving_rate != null) {
            const r = parseFloat(group.saving_rate);
            if (!Number.isNaN(r)) savingRate = r;
        }
    } catch (_) { /* keep default 1 */ }

    // Get all recoveries for the group (recoveries are stored by groupId, not memberId)
    const recoveries = await recoveryRepository.getMerged({ groupId });

    // Get all payments for the member
    const payments = await paymentRepository.getMerged({ memberId });

    // Start with opening savings
    const openingSaving = parseFloat(member.openingSaving || 0);
    let totalRecoverySavings = 0;
    let totalWithdrawn = 0;

    // Calculate savings from recoveries
    recoveries.forEach(recovery => {
        const memberRecoveries = recovery.memberRecoveries || recovery.recoveries || [];
        const memberRecovery = memberRecoveries.find(mr => {
            const mrId = mr.memberId || mr.id;
            const mrCode = mr.memberCode || mr.Member_Id;
            return String(mrId) === String(memberId) || String(mrCode) === String(memberId);
        });

        if (memberRecovery && memberRecovery.amounts) {
            // Only count savings from present members or absent with recovery by other
            const isPresent = memberRecovery.attendance === 'present' ||
                (memberRecovery.attendance === 'absent' && memberRecovery.recoveryByOther);
            if (isPresent) {
                totalRecoverySavings += parseFloat(memberRecovery.amounts?.saving || 0);
            }
        }
    });

    // Calculate withdrawals (only count approved/completed payments)
    payments.forEach(payment => {
        if (payment.paymentType === 'saving_withdrawal' &&
            (payment.status === 'approved' || payment.status === 'completed')) {
            totalWithdrawn += parseFloat(payment.amount || 0);
        }
    });

    const totalSaving = openingSaving + totalRecoverySavings;
    const availableSavings = Math.max(0, totalSaving - totalWithdrawn);
    const interestOnSavings = computeInterestOnSavings(totalSaving, savingRate);

    return {
        success: true,
        data: {
            totalSaving,
            totalWithdrawn,
            availableSavings,
            availableBalance: availableSavings, // Alias for compatibility
            interestOnSavings,
            savingRate,
        },
    };
};

/**
 * Get payments
 * Reads from IndexedDB (merged with master data)
 */
export const getPayments = async (params = {}) => {
    const filters = {};
    if (params.groupId) filters.groupId = params.groupId;
    if (params.memberId) filters.memberId = params.memberId;

    const payments = await paymentRepository.getMerged(filters);

    // Filter by date range if provided
    let filtered = payments;
    if (params.fromDate || params.toDate) {
        filtered = payments.filter(payment => {
            if (!payment.date) return false;
            const date = new Date(payment.date);
            if (params.fromDate && date < new Date(params.fromDate)) return false;
            if (params.toDate && date > new Date(params.toDate)) return false;
            return true;
        });
    }

    return {
        success: true,
        data: filtered,
    };
};

/**
 * Refresh payment data from backend for a group.
 * Updates local transaction records with latest backend state (e.g. status after admin approval)
 * so the group panel Payment Management shows correct details after approval.
 * Call when tab becomes visible or when returning to Payment Management while online.
 */
export const refreshPaymentsFromBackend = async (groupId) => {
    if (!groupId || typeof navigator !== 'undefined' && !navigator.onLine) {
        return { success: true, updated: 0 };
    }
    const token = getAuthToken();
    if (!token) return { success: false, updated: 0, error: 'No auth token' };
    const baseURL = getApiOrigin();
    const url = `${baseURL}/api/admin/payment/list?groupId=${encodeURIComponent(String(groupId))}`;
    let response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        return { success: false, updated: 0, error: err.message };
    }
    if (!response.ok) return { success: false, updated: 0, error: `HTTP ${response.status}` };
    const raw = await response.json().catch(() => ({}));
    const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
    const normId = (v) => (v == null ? '' : (typeof v === 'object' && v?.toString ? v.toString() : String(v)));
    const groupIdNorm = normId(groupId);
    const paymentRecords = await db.transactions
        .where('entityType')
        .equals(EntityTypes.PAYMENT)
        .filter((r) => {
            const g = r.payload?.groupId;
            const gid = g != null && typeof g === 'object' && (g._id != null || g.id != null) ? (g._id ?? g.id) : g;
            return normId(gid) === groupIdNorm;
        })
        .toArray();
    let updated = 0;
    for (const payment of list) {
        const backendId = normId(payment._id || payment.id);
        if (!backendId) continue;
        const record = paymentRecords.find(
            (r) => normId(r.payload?._id) === backendId || normId(r.payload?.id) === backendId
        );
        if (record) {
            record.payload = { ...record.payload, ...payment, _id: payment._id || payment.id, id: payment.id || payment._id };
            await db.transactions.put(record);
            updated++;
        }
    }
    return { success: true, updated };
};

/**
 * Get payment detail by ID
 */
export const getPaymentDetail = async (id) => {
    let record = await paymentRepository.getByUuid(id);

    if (!record) {
        const masterData = await paymentRepository.getMasterData();
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
            message: `Payment with ID ${id} not found`,
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

/**
 * Approve payment
 * Updates IndexedDB and queues for sync
 */
export const approvePayment = async (id) => {
    let record = await paymentRepository.getByUuid(id);

    if (!record) {
        const masterData = await paymentRepository.getMasterData();
        const masterRecord = masterData.find(r =>
            r.uuid === id ||
            r.payload?._id === id ||
            r.payload?.id === id
        );

        if (masterRecord) {
            const updated = await paymentRepository.update(masterRecord.uuid, {
                ...masterRecord.payload,
                status: 'approved',
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
            message: `Payment with ID ${id} not found`,
        };
    }

    const updated = await paymentRepository.update(id, {
        ...record.payload,
        status: 'approved',
    });

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
 * Reject payment
 * Updates IndexedDB and queues for sync
 */
export const rejectPayment = async (id, reason) => {
    let record = await paymentRepository.getByUuid(id);

    if (!record) {
        const masterData = await paymentRepository.getMasterData();
        const masterRecord = masterData.find(r =>
            r.uuid === id ||
            r.payload?._id === id ||
            r.payload?.id === id
        );

        if (masterRecord) {
            const updated = await paymentRepository.update(masterRecord.uuid, {
                ...masterRecord.payload,
                status: 'rejected',
                rejectionReason: reason,
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
            message: `Payment with ID ${id} not found`,
        };
    }

    const updated = await paymentRepository.update(id, {
        ...record.payload,
        status: 'rejected',
        rejectionReason: reason,
    });

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
 * Complete payment
 * Updates IndexedDB and queues for sync
 */
export const completePayment = async (id) => {
    let record = await paymentRepository.getByUuid(id);

    if (!record) {
        const masterData = await paymentRepository.getMasterData();
        const masterRecord = masterData.find(r =>
            r.uuid === id ||
            r.payload?._id === id ||
            r.payload?.id === id
        );

        if (masterRecord) {
            const updated = await paymentRepository.update(masterRecord.uuid, {
                ...masterRecord.payload,
                status: 'completed',
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
            message: `Payment with ID ${id} not found`,
        };
    }

    const updated = await paymentRepository.update(id, {
        ...record.payload,
        status: 'completed',
    });

    return {
        success: true,
        data: {
            ...updated.payload,
            _id: updated.payload?._id || updated.uuid,
            _uuid: updated.uuid,
        },
    };
};
