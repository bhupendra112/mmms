/**
 * Offline-First Payment Service
 * 
 * This is the NEW version of paymentService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old paymentService.
 * Components should use this service instead of making direct API calls.
 */

import { paymentRepository, fdRepository, recoveryRepository } from '../database/repository';
import { EntityTypes, Operations } from '../database/db';

/**
 * Create a new payment
 * Saves to IndexedDB immediately and queues for sync
 */
export const createPayment = async (data) => {
    const record = await paymentRepository.create(data);
    
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

/**
 * Get member savings - computed from local IndexedDB
 */
export const getMemberSavings = async (memberId) => {
    // Compute from recoveries and payments
    const recoveries = await recoveryRepository.getMerged({ memberId });
    const payments = await paymentRepository.getMerged({ memberId });
    
    let totalSaving = 0;
    let totalWithdrawn = 0;
    
    recoveries.forEach(recovery => {
        const memberRecoveries = recovery.memberRecoveries || recovery.recoveries || [];
        const memberRecovery = memberRecoveries.find(mr => 
            mr.memberId === memberId || mr.memberCode === memberId
        );
        if (memberRecovery) {
            totalSaving += parseFloat(memberRecovery.saving || 0);
        }
    });
    
    payments.forEach(payment => {
        if (payment.paymentType === 'saving_withdrawal') {
            totalWithdrawn += parseFloat(payment.amount || 0);
        }
    });
    
    return {
        success: true,
        data: {
            totalSaving,
            totalWithdrawn,
            availableBalance: totalSaving - totalWithdrawn,
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
