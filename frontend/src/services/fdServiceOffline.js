/**
 * Offline-First FD Service
 * 
 * This is the NEW version of fdService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old fdService.
 * Components should use this service instead of making direct API calls.
 */

import { fdRepository } from '../database/repository';
import { EntityTypes, Operations } from '../database/db';

/**
 * Register a new FD
 * Saves to IndexedDB immediately and queues for sync
 */
export const registerFD = async (data) => {
    // Check if we're in group panel context
    const isGroupPanel = typeof window !== 'undefined' && window.location?.pathname?.includes('/group');
    
    // Add requireApproval flag for group panel requests
    const payload = {
        ...data,
        ...(isGroupPanel ? { requireApproval: true, source: 'group_sync' } : {}),
    };

    const record = await fdRepository.create(payload);

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
 * Get FDs
 * Reads from IndexedDB (merged with master data)
 */
export const getFDs = async (groupId = null, memberId = null) => {
    const filters = {};
    if (groupId) filters.groupId = groupId;
    if (memberId) filters.memberId = memberId;
    
    const fds = await fdRepository.getMerged(filters);
    
    return {
        success: true,
        data: fds,
    };
};

/**
 * Get FD detail by ID
 */
export const getFDDetail = async (id) => {
    let record = await fdRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await fdRepository.getMasterData();
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
            message: `FD with ID ${id} not found`,
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
