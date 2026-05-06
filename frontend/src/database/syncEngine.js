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
/** Max retries for a failed sync item before removing from queue */
const MAX_RETRIES = 5;

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
        create: '/api/admin/payment/create',
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
        throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
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

/**
 * Sanitize payment payload for sync: remove metadata fields and ensure proper format
 */
function sanitizePaymentPayloadForSync(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };

    // Remove metadata fields that shouldn't be sent to backend
    delete out._uuid;
    delete out._id;
    delete out._syncStatus;
    delete out._operation;
    delete out._isLocal;
    delete out._deleted;

    // Ensure required fields are present and properly formatted
    if (out.paymentDate && typeof out.paymentDate === 'string') {
        // Convert ISO string to Date if needed, or keep as is
        // Backend expects Date or ISO string
    }

    // Ensure amount is a number
    if (out.amount !== undefined) {
        out.amount = parseFloat(out.amount) || 0;
    }

    // IMPORTANT: Keep requireApproval and source flags for group panel payments
    // Backend will use these to set approval status correctly
    // Don't delete these fields - they're needed for approval workflow

    return out;
}

/**
 * Sanitize loan payload for sync: remove sync metadata but preserve
 * requireApproval/source flags so backend can set correct approval status.
 */
function sanitizeLoanPayloadForSync(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };

    // Remove local/sync metadata fields
    delete out._uuid;
    delete out._id;
    delete out._syncStatus;
    delete out._operation;
    delete out._isLocal;
    delete out._deleted;
    delete out._repositoryUuid;

    // Intentionally keep requireApproval and source
    return out;
}

/**
 * Sanitize expense payload for sync: remove sync metadata but preserve
 * requireApproval/source so backend creates pending expense and does not create
 * cash/bank transactions until admin approves.
 */
function sanitizeExpensePayloadForSync(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };

    delete out._uuid;
    delete out._id;
    delete out._syncStatus;
    delete out._operation;
    delete out._isLocal;
    delete out._deleted;

    // Ensure groupId is a string for backend (ObjectId string)
    if (out.groupId != null) out.groupId = String(out.groupId);
    // Omit empty bankId so backend doesn't receive invalid ObjectId when paymentMode is Cash
    if (out.paymentMode !== 'Bank' || !out.bankId) delete out.bankId;
    else if (out.bankId != null) out.bankId = String(out.bankId);

    return out;
}

/** Strip client demandDetails / loanSnapshots; backend recomputes. Ensures clientRequestId for idempotent POST. */
function sanitizeRecoveryPayloadForSync(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };
    delete out._uuid;
    delete out._id;
    delete out._syncStatus;
    delete out._operation;
    delete out._isLocal;
    delete out._deleted;
    if (out.groupId != null) out.groupId = String(out.groupId);
    if (!out.clientRequestId && typeof globalThis.crypto?.randomUUID === 'function') {
        out.clientRequestId = globalThis.crypto.randomUUID();
    }
    if (Array.isArray(out.recoveries)) {
        out.recoveries = out.recoveries.map((r) => {
            if (!r || typeof r !== 'object') return r;
            const { demandDetails, loanSnapshots, ...rest } = r;
            return rest;
        });
    }
    return out;
}

async function syncRecord(record, queueItem) {
    const { entityType, operation, payload, uuid } = record;

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
            } else if (entityType === 'payment') {
                requestPayload = sanitizePaymentPayloadForSync(payload);
            } else if (entityType === 'loan') {
                requestPayload = sanitizeLoanPayloadForSync(payload);
            } else if (entityType === 'expense') {
                requestPayload = sanitizeExpensePayloadForSync(payload);
            } else if (entityType === 'recovery') {
                requestPayload = sanitizeRecoveryPayloadForSync(payload);
            }
            break;
        case 'update':
            // Special handling for recovery: always use create endpoint (register-recovery) 
            // because we're syncing the entire recovery session, not individual member updates
            if (entityType === 'recovery') {
                endpoint = endpoints.create; // Use register-recovery endpoint
                method = 'POST';
                requestPayload = sanitizeRecoveryPayloadForSync(payload);
                break;
            }

            // For other entity types, use standard update logic
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

    // Defensive check: Ensure recovery updates use POST and register-recovery endpoint
    if (entityType === 'recovery' && operation === 'update') {
        if (method !== 'POST' || !endpoint.includes('register-recovery')) {
            endpoint = '/api/admin/recovery/register-recovery';
            method = 'POST';
        }
    }

    const responseData = await callBackendAPI(method, endpoint, requestPayload);

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
    } else {
        // No response data, but sync succeeded
        record.syncStatus = SyncStatuses.SYNCED;
        updateRecordTimestamp(record);
        await db.transactions.put(record);
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

    try {
        const record = await db.transactions.get(uuid);
        if (!record) {
            await db.sync_queue.delete(queueItem.id);
            return { success: false, error: 'Transaction record not found' };
        }

        if (record.syncStatus === SyncStatuses.SYNCED) {
            await db.sync_queue.delete(queueItem.id);
            return { success: true, skipped: true };
        }

        queueItem.syncStatus = 'syncing';
        record.syncStatus = 'syncing';
        await db.sync_queue.put(queueItem);
        await db.transactions.put(record);

        const result = await syncRecord(record, queueItem);

        await db.sync_queue.delete(queueItem.id);

        // After successful loan create sync, remove from local transactions so the loan
        // only appears from master data (no duplicate in merged list)
        if (entityType === 'loan' && operation === 'create' && result?.success) {
            await db.transactions.delete(uuid);
        }

        return result;
    } catch (error) {
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
            // Sync pending items immediately when coming online (don't wait for next interval)
            this.processQueue().catch((err) => console.error('[SYNC_ENGINE] processQueue on online:', err));
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
            // Get PENDING items and FAILED items that are still retryable (retryCount < MAX_RETRIES)
            // so that payments that failed while offline get retried when we come back online
            const [pendingList, failedList] = await Promise.all([
                db.sync_queue.where('syncStatus').equals(SyncStatuses.PENDING).toArray(),
                db.sync_queue.where('syncStatus').equals(SyncStatuses.FAILED).filter((q) => (q.retryCount || 0) < MAX_RETRIES).toArray(),
            ]);
            const pendingItems = [...pendingList, ...failedList].sort(
                (a, b) => (a.priority || 0) - (b.priority || 0) || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            );

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
