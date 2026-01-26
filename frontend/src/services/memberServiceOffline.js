/**
 * Offline-First Member Service
 * 
 * This is the NEW version of memberService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old memberService.
 * Components should use this service instead of making direct API calls.
 */

import { memberRepository, loanRepository, recoveryRepository, paymentRepository } from '../database/repository';
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

/**
 * Get member financial ledger - computed from local IndexedDB
 */
export const getMemberFinancialLedger = async (memberId, filters = {}) => {
    // Compute ledger from local transactions
    const loans = await loanRepository.getMerged({ memberId });
    const recoveries = await recoveryRepository.getMerged({ memberId });
    const payments = await paymentRepository.getMerged({ memberId });
    
    // Combine and filter by date range
    let ledger = [];
    
    loans.forEach(loan => {
        if (!filters.fromDate || new Date(loan.loanDate || loan.date) >= new Date(filters.fromDate)) {
            if (!filters.toDate || new Date(loan.loanDate || loan.date) <= new Date(filters.toDate)) {
                ledger.push({
                    type: 'loan',
                    date: loan.loanDate || loan.date,
                    amount: loan.amount,
                    description: `Loan - ${loan.purpose || ''}`,
                });
            }
        }
    });
    
    recoveries.forEach(recovery => {
        const rDate = recovery.date || recovery.recoveryDate;
        if (!filters.fromDate || new Date(rDate) >= new Date(filters.fromDate)) {
            if (!filters.toDate || new Date(rDate) <= new Date(filters.toDate)) {
                ledger.push({
                    type: 'recovery',
                    date: rDate,
                    amount: recovery.total || 0,
                    description: 'Recovery',
                });
            }
        }
    });
    
    payments.forEach(payment => {
        if (!filters.fromDate || new Date(payment.date) >= new Date(filters.fromDate)) {
            if (!filters.toDate || new Date(payment.date) <= new Date(filters.toDate)) {
                ledger.push({
                    type: 'payment',
                    date: payment.date,
                    amount: payment.amount,
                    description: `Payment - ${payment.paymentType || ''}`,
                });
            }
        }
    });
    
    // Sort by date
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return {
        success: true,
        data: ledger,
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
