/**
 * Offline-First Loan Service
 * 
 * This is the NEW version of loanService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old loanService.
 * Components should use this service instead of making direct API calls.
 */

import { loanRepository } from '../database/repository';
import { EntityTypes, Operations } from '../database/db';

/**
 * Register a new loan
 * Saves to IndexedDB immediately and queues for sync
 */
export const registerLoan = async (data) => {
    const record = await loanRepository.create(data);
    
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
 * Get loans
 * Reads from IndexedDB (merged with master data)
 */
export const getLoans = async (groupId = null) => {
    const filters = groupId ? { groupId } : {};
    const loans = await loanRepository.getMerged(filters);
    
    return {
        success: true,
        data: loans,
    };
};

/**
 * Get loan detail by ID
 */
export const getLoanDetail = async (id) => {
    let record = await loanRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await loanRepository.getMasterData();
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
            message: `Loan with ID ${id} not found`,
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
 * Approve loan
 * Updates IndexedDB and queues for sync
 */
export const approveLoan = async (id) => {
    let record = await loanRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await loanRepository.getMasterData();
        const masterRecord = masterData.find(r => 
            r.uuid === id || 
            r.payload?._id === id || 
            r.payload?.id === id
        );
        
        if (masterRecord) {
            const updated = await loanRepository.update(masterRecord.uuid, {
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
            message: `Loan with ID ${id} not found`,
        };
    }
    
    const updated = await loanRepository.update(id, {
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
 * Reject loan
 * Updates IndexedDB and queues for sync
 */
export const rejectLoan = async (id, reason) => {
    let record = await loanRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await loanRepository.getMasterData();
        const masterRecord = masterData.find(r => 
            r.uuid === id || 
            r.payload?._id === id || 
            r.payload?.id === id
        );
        
        if (masterRecord) {
            const updated = await loanRepository.update(masterRecord.uuid, {
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
            message: `Loan with ID ${id} not found`,
        };
    }
    
    const updated = await loanRepository.update(id, {
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
