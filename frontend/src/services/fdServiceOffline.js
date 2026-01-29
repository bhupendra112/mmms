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
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'fdServiceOffline.js:18', message: 'Creating FD in repository', data: { isGroupPanel, hasRequireApproval: !!payload.requireApproval, requireApproval: payload.requireApproval, source: payload.source, hasGroupId: !!payload.groupId, hasMemberId: !!payload.memberId, hasAmount: !!payload.amount, amount: payload.amount, hasFdRateSnapshot: !!payload.fd_rate_snapshot, fdRateSnapshot: payload.fd_rate_snapshot }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_SYNC' }) }).catch(() => {});
    // #endregion
    
    const record = await fdRepository.create(payload);
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'fdServiceOffline.js:32', message: 'FD created in repository', data: { uuid: record.uuid, syncStatus: record.syncStatus, hasRequireApproval: !!record.payload?.requireApproval, requireApproval: record.payload?.requireApproval, source: record.payload?.source }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'FD_SYNC' }) }).catch(() => {});
    // #endregion
    
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
