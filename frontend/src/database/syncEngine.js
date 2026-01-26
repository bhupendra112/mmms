/**
 * Sync Engine
 * 
 * Background synchronization system that processes sync_queue.
 * Handles retries, conflicts, and ensures reliable data sync.
 * 
 * CRITICAL: This is the ONLY component that communicates with backend APIs.
 */

import db, { updateRecordTimestamp, SyncStatuses } from './db';
import { getAuthToken } from '../utils/getAuthToken';

/**
 * Get API base URL
 */
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
 * Map entity types to their API endpoints
 */
const API_ENDPOINTS = {
    member: {
        create: '/api/admin/member/register-member',
        update: (id) => `/api/admin/member/update/${id}`,
        delete: (id) => `/api/admin/member/delete/${id}`,
    },
    loan: {
        create: '/api/admin/loan/register-loan',
        update: (id) => `/api/admin/loan/update/${id}`,
        delete: (id) => `/api/admin/loan/delete/${id}`,
        approve: (id) => `/api/admin/loan/approve/${id}`,
        reject: (id) => `/api/admin/loan/reject/${id}`,
    },
    expense: {
        create: '/api/admin/expense',
        update: (id) => `/api/admin/expense/${id}`,
        delete: (id) => `/api/admin/expense/${id}`,
    },
    payment: {
        create: '/api/admin/payment',
        update: (id) => `/api/admin/payment/${id}`,
        delete: (id) => `/api/admin/payment/${id}`,
    },
    recovery: {
        create: '/api/admin/recovery/register-recovery',
        update: (id) => `/api/admin/recovery/update-member`,
        delete: (id) => `/api/admin/recovery/${id}`,
    },
    fd: {
        create: '/api/admin/fd/create',
        update: (id) => `/api/admin/fd/${id}`,
        delete: (id) => `/api/admin/fd/${id}`,
    },
    group: {
        create: '/api/admin/group',
        update: (id) => `/api/admin/group/${id}`,
        delete: (id) => `/api/admin/group/${id}`,
    },
};

/**
 * Call backend API
 */
async function callBackendAPI(method, endpoint, payload = null) {
    // #region agent log
    if (endpoint?.includes('/recovery/')) {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:72', message: 'callBackendAPI for recovery', data: { method, endpoint, hasPayload: !!payload, payloadSize: payload ? JSON.stringify(payload).length : 0, requireApproval: payload?.requireApproval, source: payload?.source }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion
    const token = getAuthToken();
    if (!token) {
        throw new Error('Authentication token not found');
    }

    const baseURL = getApiOrigin();
    const url = `${baseURL}${endpoint}`;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    if (payload && (method === 'POST' || method === 'PUT')) {
        // Handle FormData
        if (payload instanceof FormData) {
            delete options.headers['Content-Type']; // Let browser set it
            options.body = payload;
        } else {
            options.body = JSON.stringify(payload);
        }
    }

    const response = await fetch(url, options);
    
    // #region agent log
    if (endpoint?.includes('/recovery/')) {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:104', message: 'Recovery API response status', data: { status: response.status, statusText: response.statusText, ok: response.ok, endpoint, url }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('AUTH_REQUIRED');
        }
        const errorText = await response.text();
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch {
            errorData = { message: errorText || `HTTP ${response.status}` };
        }
        
        // #region agent log
        if (endpoint?.includes('/recovery/')) {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:117', message: 'Recovery API error', data: { status: response.status, errorMessage: errorData.message, errorText }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion
        
        throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // #region agent log
    if (endpoint?.includes('/recovery/')) {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:125', message: 'Recovery API success response', data: { success: data?.success, hasData: !!data?.data, recoveryId: data?.data?._id || data?.data?.id, approvalStatus: data?.data?.approvalStatus, message: data?.message, rawDataKeys: data ? Object.keys(data) : [], dataKeys: data?.data ? Object.keys(data.data) : [] }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion
    
    return data?.data || data;
}

/**
 * Sync a single record to backend
 */
/**
 * Sanitize member payload for sync: strip offline file metadata (_isFile objects)
 * and add requireApproval so backend creates member as pending.
 */
function sanitizeMemberPayloadForSync(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };
    const fileFields = [
        'Member_Photo', 'Voter_Id_File', 'Adhar_Id_File', 'Bank_File',
        'Ration_Card_File', 'Job_Card_File', 'Adhar_Id_Pati_File',
        'Voter_Id_Pati_File', 'Bank_Pati_File',
    ];
    for (const key of fileFields) {
        const v = out[key];
        if (v && typeof v === 'object' && v._isFile === true) delete out[key];
    }
    out.requireApproval = true;
    return out;
}

async function syncRecord(record, queueItem) {
    const { entityType, operation, payload, uuid } = record;
    
    // #region agent log
    if (entityType === 'recovery') {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:142', message: 'Syncing recovery record', data: { uuid, operation, entityType, hasGroupId: !!payload.groupId, hasRecoveries: !!payload.recoveries, recoveriesCount: payload.recoveries?.length || 0, requireApproval: payload.requireApproval, source: payload.source, date: payload.date }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion

    // Get endpoint configuration
    const endpoints = API_ENDPOINTS[entityType];
    if (!endpoints) {
        throw new Error(`No API endpoint configured for entity type: ${entityType}`);
    }

    let endpoint;
    let method;
    let requestPayload = payload;

    // Determine endpoint and method based on operation
    switch (operation) {
        case 'create':
            endpoint = endpoints.create;
            method = 'POST';
            if (entityType === 'member') {
                requestPayload = sanitizeMemberPayloadForSync(payload);
            }
            // #region agent log
            if (entityType === 'recovery') {
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:163', message: 'Preparing recovery create request', data: { endpoint, method, hasGroupId: !!requestPayload.groupId, hasRecoveries: !!requestPayload.recoveries, recoveriesCount: requestPayload.recoveries?.length || 0, requireApproval: requestPayload.requireApproval, source: requestPayload.source }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
            }
            // #endregion
            break;
        case 'update':
            // For update, we need the backend ID
            const backendId = payload._id || payload.id || uuid;
            if (!endpoints.update) {
                throw new Error(`Update not supported for entity type: ${entityType}`);
            }
            endpoint = typeof endpoints.update === 'function'
                ? endpoints.update(backendId)
                : endpoints.update;
            method = 'PUT';
            // Remove _deleted flag from update payload
            requestPayload = { ...payload };
            delete requestPayload._deleted;
            break;
        case 'delete':
            const deleteId = payload._id || payload.id || uuid;
            if (!endpoints.delete) {
                throw new Error(`Delete not supported for entity type: ${entityType}`);
            }
            endpoint = typeof endpoints.delete === 'function'
                ? endpoints.delete(deleteId)
                : endpoints.delete;
            method = 'DELETE';
            requestPayload = null;
            break;
        case 'approve':
            if (!endpoints.approve) {
                throw new Error(`Approve not supported for entity type: ${entityType}`);
            }
            const approveId = payload._id || payload.id || uuid;
            endpoint = typeof endpoints.approve === 'function'
                ? endpoints.approve(approveId)
                : endpoints.approve;
            method = 'PUT';
            requestPayload = null;
            break;
        case 'reject':
            if (!endpoints.reject) {
                throw new Error(`Reject not supported for entity type: ${entityType}`);
            }
            const rejectId = payload._id || payload.id || uuid;
            endpoint = typeof endpoints.reject === 'function'
                ? endpoints.reject(rejectId)
                : endpoints.reject;
            method = 'PUT';
            requestPayload = payload.reason ? { reason: payload.reason } : null;
            break;
        default:
            throw new Error(`Unsupported operation: ${operation}`);
    }

    // Call backend API
    // #region agent log
    if (entityType === 'recovery') {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:216', message: 'Calling backend API for recovery', data: { method, endpoint, hasPayload: !!requestPayload, payloadKeys: requestPayload ? Object.keys(requestPayload) : [] }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion
    
    const responseData = await callBackendAPI(method, endpoint, requestPayload);
    
    // #region agent log
    if (entityType === 'recovery') {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:220', message: 'Backend API response for recovery', data: { hasResponse: !!responseData, success: responseData?.success, hasData: !!responseData?.data, recoveryId: responseData?.data?._id || responseData?.data?.id, approvalStatus: responseData?.data?.approvalStatus }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion

    // Update record with backend response
    if (responseData) {
        // Merge backend ID into payload
        const updatedPayload = {
            ...record.payload,
            ...responseData,
            _id: responseData._id || responseData.id || record.payload._id || record.payload.id,
            id: responseData.id || responseData._id || record.payload.id || record.payload._id,
        };

        record.payload = updatedPayload;
        record.syncStatus = SyncStatuses.SYNCED;
        updateRecordTimestamp(record);

        // Update in transactions store
        await db.transactions.put(record);
        
        // #region agent log
        if (entityType === 'recovery') {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:233', message: 'Recovery record marked as synced', data: { uuid: record.uuid, recoveryId: updatedPayload._id, syncStatus: record.syncStatus }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion
    } else {
        // No response data, but sync succeeded
        record.syncStatus = SyncStatuses.SYNCED;
        updateRecordTimestamp(record);
        await db.transactions.put(record);
        
        // #region agent log
        if (entityType === 'recovery') {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:240', message: 'Recovery record synced (no response data)', data: { uuid: record.uuid, syncStatus: record.syncStatus }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion
    }

    // Update sync queue item
    queueItem.syncStatus = SyncStatuses.SYNCED;
    await db.sync_queue.put(queueItem);

    // Log successful sync
    await db.sync_logs.add({
        uuid: uuid,
        entityType,
        operation,
        status: 'success',
        error: null,
        syncedAt: new Date().toISOString(),
        retryCount: queueItem.retryCount,
    });

    return { success: true, record, responseData };
}

/**
 * Process a single sync queue item
 */
async function processSyncItem(queueItem) {
    const { uuid, entityType, operation } = queueItem;
    
    // #region agent log
    if (entityType === 'recovery') {
        fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:302', message: 'processSyncItem for recovery', data: { uuid, entityType, operation, queueItemId: queueItem.id, syncStatus: queueItem.syncStatus }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
    }
    // #endregion

    try {
        // Get the transaction record
        const record = await db.transactions.get(uuid);
        if (!record) {
            // Transaction record not found, remove from queue
            await db.sync_queue.delete(queueItem.id);
            // #region agent log
            if (entityType === 'recovery') {
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:308', message: 'Recovery transaction record not found', data: { uuid }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
            }
            // #endregion
            return { success: false, error: 'Transaction record not found' };
        }

        // Skip if already synced
        if (record.syncStatus === SyncStatuses.SYNCED) {
            await db.sync_queue.delete(queueItem.id);
            // #region agent log
            if (entityType === 'recovery') {
                fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:315', message: 'Recovery already synced, skipping', data: { uuid, syncStatus: record.syncStatus }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
            }
            // #endregion
            return { success: true, skipped: true };
        }

        // Mark as syncing
        queueItem.syncStatus = 'syncing';
        record.syncStatus = 'syncing';
        await db.sync_queue.put(queueItem);
        await db.transactions.put(record);
        
        // #region agent log
        if (entityType === 'recovery') {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:325', message: 'Recovery marked as syncing', data: { uuid, payload: { groupId: record.payload?.groupId, date: record.payload?.date, requireApproval: record.payload?.requireApproval, source: record.payload?.source, hasRecoveries: !!record.payload?.recoveries, recoveriesCount: record.payload?.recoveries?.length || 0 } }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion

        // Sync to backend
        const result = await syncRecord(record, queueItem);
        
        // #region agent log
        if (entityType === 'recovery') {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:330', message: 'Recovery sync result', data: { uuid, success: result.success, hasError: !!result.error, error: result.error }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion

        // Remove from queue
        await db.sync_queue.delete(queueItem.id);
        
        // #region agent log
        if (entityType === 'recovery') {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:338', message: 'Recovery sync completed, removed from queue', data: { uuid, success: result.success }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion

        return result;
    } catch (error) {
        // #region agent log
        if (entityType === 'recovery') {
            fetch('http://127.0.0.1:7244/ingest/6ff7e0a4-0281-4088-97c4-e91f6a0f6b22', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'syncEngine.js:345', message: 'Recovery sync error', data: { uuid, errorMessage: error.message, errorStack: error.stack }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'RECOVERY_SYNC' }) }).catch(() => { });
        }
        // #endregion
        
        // Handle authentication errors
        if (error.message === 'AUTH_REQUIRED') {
            throw error; // Let sync manager handle auth errors
        }

        // Increment retry count
        queueItem.retryCount = (queueItem.retryCount || 0) + 1;
        queueItem.syncStatus = SyncStatuses.FAILED;

        // Update transaction record
        const record = await db.transactions.get(uuid);
        if (record) {
            record.syncStatus = SyncStatuses.FAILED;
            record.retryCount = queueItem.retryCount;
            updateRecordTimestamp(record, true);
            await db.transactions.put(record);
        }

        await db.sync_queue.put(queueItem);

        // Log failed sync
        await db.sync_logs.add({
            uuid,
            entityType,
            operation,
            status: 'failed',
            error: error.message,
            syncedAt: new Date().toISOString(),
            retryCount: queueItem.retryCount,
        });

        // Don't retry if max retries exceeded
        const MAX_RETRIES = 5;
        if (queueItem.retryCount >= MAX_RETRIES) {
            await db.sync_queue.delete(queueItem.id);
            return { success: false, error: error.message, maxRetriesExceeded: true };
        }

        return { success: false, error: error.message, retryCount: queueItem.retryCount };
    }
}

/**
 * Sync Manager Class
 * Manages the sync process and queue processing
 */
export class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
        this.listeners = new Set();
        this.isOnline = navigator.onLine;
        this.setupNetworkListeners();
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners({ online: true });
            this.startAutoSync();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners({ online: false });
            this.stopAutoSync();
        });
    }

    /**
     * Add sync status listener
     */
    onSyncStatusChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners
     */
    notifyListeners(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in sync status listener:', error);
            }
        });
    }

    /**
     * Get pending sync count
     */
    async getPendingCount() {
        return await db.sync_queue.where('syncStatus').equals(SyncStatuses.PENDING).count();
    }

    /**
     * Process sync queue
     */
    async processQueue() {
        if (this.isSyncing || !this.isOnline) {
            return { processed: 0, failed: 0 };
        }

        this.isSyncing = true;
        this.notifyListeners({ syncing: true });

        try {
            // Get pending items, ordered by priority and creation time
            const pendingItems = await db.sync_queue
                .where('syncStatus')
                .equals(SyncStatuses.PENDING)
                .sortBy('priority');

            if (pendingItems.length === 0) {
                return { processed: 0, failed: 0 };
            }

            let processed = 0;
            let failed = 0;

            // Process items sequentially (important for data consistency)
            for (const item of pendingItems) {
                try {
                    const result = await processSyncItem(item);
                    if (result.success) {
                        processed++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    // Stop syncing on auth errors
                    if (error.message === 'AUTH_REQUIRED') {
                        this.isSyncing = false;
                        this.notifyListeners({
                            syncing: false,
                            authRequired: true
                        });
                        throw error;
                    }
                    failed++;
                }

                // Notify progress
                this.notifyListeners({
                    syncing: true,
                    processed,
                    total: pendingItems.length,
                });
            }

            return { processed, failed };
        } finally {
            this.isSyncing = false;
            this.notifyListeners({ syncing: false });
        }
    }

    /**
     * Start auto-sync (polling)
     */
    startAutoSync(intervalMs = 10000) {
        if (this.syncInterval) {
            return;
        }

        this.syncInterval = setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.processQueue();
            }
        }, intervalMs);
    }

    /**
     * Stop auto-sync
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Trigger immediate sync
     */
    async syncNow() {
        if (!this.isOnline) {
            throw new Error('Cannot sync while offline');
        }
        return await this.processQueue();
    }

    /**
     * Get sync statistics
     */
    async getStats() {
        const [pending, syncing, failed, total] = await Promise.all([
            db.sync_queue.where('syncStatus').equals(SyncStatuses.PENDING).count(),
            db.sync_queue.where('syncStatus').equals('syncing').count(),
            db.sync_queue.where('syncStatus').equals(SyncStatuses.FAILED).count(),
            db.sync_queue.count(),
        ]);

        return {
            pending,
            syncing,
            failed,
            total,
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
        };
    }
}

// Create singleton instance
export const syncManager = new SyncManager();

export default syncManager;
