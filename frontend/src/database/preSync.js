/**
 * Pre-Sync System
 * 
 * Fetches all required master data from backend on initial load.
 * Blocks application usage until pre-sync is completed.
 * Stores data as read-only snapshots in IndexedDB.
 */

import db, { createRecord, EntityTypes, SyncStatuses } from './db';
import { getAuthToken } from '../utils/getAuthToken';

/**
 * Configuration for pre-sync endpoints.
 * Each endpoint fetches master data for a specific entity type.
 * Covers all group-panel list APIs: groups, members, loans, FDs, payments, recoveries, expenses.
 */
const PRE_SYNC_CONFIG = {
    // Groups
    groups: {
        endpoint: '/api/admin/group/list',
        store: 'master_groups',
        entityType: EntityTypes.GROUP,
    },
    
    // Members
    members: {
        endpoint: '/api/admin/member/list',
        store: 'master_members',
        entityType: EntityTypes.MEMBER,
    },
    
    // Loans
    loans: {
        endpoint: '/api/admin/loan/list',
        store: 'master_loans',
        entityType: EntityTypes.LOAN,
    },
    
    // Fixed Deposits
    fds: {
        endpoint: '/api/admin/fd/list',
        store: 'master_fds',
        entityType: EntityTypes.FD,
    },
    
    // Payments
    payments: {
        endpoint: '/api/admin/payment/list',
        store: 'master_payments',
        entityType: EntityTypes.PAYMENT,
    },
    
    // Recoveries (fetched per group so list returns data)
    recoveries: { store: 'master_recoveries', entityType: EntityTypes.RECOVERY, customFetch: null },

    // Banks (per group; full fresh data)
    banks: { store: 'master_banks', entityType: EntityTypes.BANK, customFetch: null },

    // Expenses (group panel)
    expenses: {
        endpoint: '/api/admin/expense',
        store: 'master_expenses',
        entityType: EntityTypes.EXPENSE,
    },
};

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
 * Fetch data from backend endpoint
 */
async function fetchFromBackend(endpoint) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Authentication token not found');
    }

    const baseURL = getApiOrigin();
    const url = `${baseURL}${endpoint}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    // Handle 404 gracefully - return empty array instead of throwing
    if (response.status === 404) {
        console.warn(`Endpoint ${endpoint} returned 404 - returning empty array`);
        return [];
    }

    // Handle 401 auth errors - throw specific error but don't stop the whole process
    if (response.status === 401) {
        throw new Error('Authentication failed. Please login again.');
    }

    // Handle other errors
    if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    const data = raw?.data || raw || [];

    return data;
}

/**
 * Fetch from backend with query params (e.g. ?groupId=...)
 */
async function fetchFromBackendWithQuery(endpoint, params = {}) {
    const token = getAuthToken();
    if (!token) throw new Error('Authentication token not found');
    const baseURL = getApiOrigin();
    const search = new URLSearchParams(params).toString();
    const url = `${baseURL}${endpoint}${search ? `?${search}` : ''}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (response.status === 404) return [];
    if (response.status === 401) throw new Error('Authentication failed. Please login again.');
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
    const raw = await response.json();
    return raw?.data || raw || [];
}

/**
 * Fetch recoveries per group (list returns 0 without groupId; per-group returns data).
 */
async function fetchRecoveriesForAllGroups() {
    const groups = await db.master_groups.toArray();
    const ids = groups.map((r) => r.payload?._id || r.payload?.id || r.uuid).filter(Boolean);
    const out = [];
    for (const gid of ids) {
        const sid = typeof gid === 'object' && gid?.toString ? gid.toString() : String(gid);
        const arr = await fetchFromBackendWithQuery('/api/admin/recovery/list', { groupId: sid });
        if (Array.isArray(arr)) {
            arr.forEach((r) => {
                const g = r.groupId?._id ?? r.groupId ?? r.group_id ?? r.group ?? sid;
                out.push({ ...r, groupId: typeof g === 'object' && g != null && g._id != null ? String(g._id) : String(g) });
            });
        }
    }
    return out;
}

/**
 * Fetch banks per group and flatten (full fresh data includes banks).
 */
async function fetchBanksForAllGroups() {
    const groups = await db.master_groups.toArray();
    const ids = groups.map((r) => r.payload?._id || r.payload?.id || r.uuid).filter(Boolean);
    const baseURL = getApiOrigin();
    const token = getAuthToken();
    if (!token) return [];
    const out = [];
    for (const gid of ids) {
        const sid = typeof gid === 'object' && gid?.toString ? gid.toString() : String(gid);
        const url = `${baseURL}/api/admin/group/${sid}/banks`;
        const res = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
        if (!res.ok) continue;
        const raw = await res.json().catch(() => ({}));
        const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        arr.forEach((b) => {
            const g = b.groupId ?? b.group_id ?? b.group ?? sid;
            out.push({ ...b, groupId: typeof g === 'object' && g != null && g._id != null ? String(g._id) : String(g) });
        });
    }
    return out;
}

/**
 * Store master data snapshot in IndexedDB
 */
async function storeMasterData(storeName, entityType, data) {
    const store = db[storeName];
    if (!store) {
        console.warn(`Store ${storeName} does not exist`);
        return;
    }

    // Clear existing master data
    await store.clear();

    // Store each record as a snapshot
    const records = Array.isArray(data) ? data : [];
    const snapshotRecords = records.map(item => {
        const record = createRecord({
            entityType,
            operation: 'read',
            payload: item,
            syncStatus: SyncStatuses.SYNCED, // Master data is always synced
        });
        // Use backend ID as UUID if available
        if (item._id || item.id) {
            record.uuid = item._id || item.id;
        }
        return record;
    });

    if (snapshotRecords.length > 0) {
        // Use bulkPut instead of bulkAdd to handle existing records
        await store.bulkPut(snapshotRecords);
    }

    return snapshotRecords.length;
}

/**
 * Execute pre-sync for a single entity type
 */
async function preSyncEntity(key, config, onProgress) {
    try {
        onProgress?.(key, 'fetching');

        let data;
        if (key === 'recoveries') {
            data = await fetchRecoveriesForAllGroups();
        } else if (key === 'banks') {
            data = await fetchBanksForAllGroups();
        } else {
            data = await fetchFromBackend(config.endpoint);
        }

        onProgress?.(key, 'storing');

        // Store in IndexedDB
        const count = await storeMasterData(config.store, config.entityType, data);

        onProgress?.(key, 'completed', { count });
        return { success: true, key, count };
    } catch (error) {
        // Don't throw auth errors - mark as failed but continue
        const isAuthError = error.message.includes('Authentication') || error.message.includes('401');
        onProgress?.(key, 'failed', { error: error.message, isAuthError });
        return { success: false, key, error: error.message, isAuthError };
    }
}

/**
 * Execute full pre-sync
 * 
 * @param {Function} onProgress - Progress callback (key, status, data)
 * @returns {Promise<Object>} Pre-sync results
 */
export async function executePreSync(onProgress) {
    const startTime = Date.now();
    const totalEntities = Object.keys(PRE_SYNC_CONFIG).length;
    const results = {
        success: true,
        total: totalEntities,
        completed: 0,
        failed: 0,
        details: {},
        duration: 0,
    };

    try {
        // Check if user is authenticated
        const token = getAuthToken();
        if (!token) {
            throw new Error('Not authenticated. Please login first.');
        }

        // Store pre-sync start time
        await db.app_state.put({
            key: 'preSyncStartTime',
            value: startTime,
            updatedAt: new Date().toISOString(),
        });

        // Track if any auth errors occurred
        let hasAuthError = false;

        // Execute pre-sync for each entity type
        for (const [key, config] of Object.entries(PRE_SYNC_CONFIG)) {
            try {
                const result = await preSyncEntity(key, config, onProgress);
                results.details[key] = result;
                
                if (result.success) {
                    results.completed++;
                } else {
                    results.failed++;
                    // Track auth errors but don't stop the process
                    if (result.isAuthError) {
                        hasAuthError = true;
                    }
                    // Continue with other entities even if one fails
                }
            } catch (error) {
                results.failed++;
                results.details[key] = { success: false, key, error: error.message };
                console.error(`Pre-sync failed for ${key}:`, error);
            }
        }

        // Mark pre-sync as completed (even if some endpoints failed)
        const endTime = Date.now();
        results.duration = endTime - startTime;

        // Mark as completed if we got any data or if all failures were auth errors
        const isCompleted = results.completed > 0 || (results.failed === results.total && hasAuthError);

        await db.app_state.put({
            key: 'preSyncCompleted',
            value: isCompleted,
            updatedAt: new Date().toISOString(),
        });

        await db.app_state.put({
            key: 'preSyncTimestamp',
            value: endTime,
            updatedAt: new Date().toISOString(),
        });

        await db.app_state.put({
            key: 'preSyncVersion',
            value: endTime.toString(), // Use timestamp as version
            updatedAt: new Date().toISOString(),
        });

        // Only throw error if no endpoints succeeded and it's not just auth errors
        if (results.completed === 0 && !hasAuthError) {
            results.success = false;
            results.error = 'All pre-sync endpoints failed';
            
            await db.app_state.put({
                key: 'preSyncError',
                value: results.error,
                updatedAt: new Date().toISOString(),
            });

            // Don't throw - allow app to continue with empty cache
            return results;
        }

        results.success = true;
        if (hasAuthError) {
            results.warning = 'Some endpoints failed due to authentication. Please login again.';
        }
        
        return results;
    } catch (error) {
        // Only set error state, don't throw - allow app to continue
        results.success = false;
        results.error = error.message;
        
        await db.app_state.put({
            key: 'preSyncError',
            value: error.message,
            updatedAt: new Date().toISOString(),
        });

        // Mark as completed anyway to allow app to continue
        await db.app_state.put({
            key: 'preSyncCompleted',
            value: true,
            updatedAt: new Date().toISOString(),
        });

        // Don't throw - return results to allow app to continue
        return results;
    }
}

/**
 * Check if pre-sync has been completed
 * 
 * @returns {Promise<boolean>} True if pre-sync is completed
 */
export async function isPreSyncCompleted() {
    const state = await db.app_state.get('preSyncCompleted');
    return state?.value === true;
}

/**
 * Get pre-sync status
 * 
 * @returns {Promise<Object>} Pre-sync status
 */
export async function getPreSyncStatus() {
    const [completed, timestamp, version, error] = await Promise.all([
        db.app_state.get('preSyncCompleted'),
        db.app_state.get('preSyncTimestamp'),
        db.app_state.get('preSyncVersion'),
        db.app_state.get('preSyncError'),
    ]);

    return {
        completed: completed?.value === true,
        timestamp: timestamp?.value || null,
        version: version?.value || null,
        error: error?.value || null,
    };
}

/**
 * Clear pre-sync data (for testing or reset)
 */
export async function clearPreSyncData() {
    const stores = Object.values(PRE_SYNC_CONFIG).map(config => config.store);
    
    await Promise.all([
        ...stores.map(storeName => {
            const store = db[storeName];
            return store ? store.clear() : Promise.resolve();
        }),
        db.app_state.delete('preSyncCompleted'),
        db.app_state.delete('preSyncTimestamp'),
        db.app_state.delete('preSyncVersion'),
        db.app_state.delete('preSyncError'),
        db.app_state.delete('preSyncStartTime'),
    ]);
}

export default {
    executePreSync,
    isPreSyncCompleted,
    getPreSyncStatus,
    clearPreSyncData,
};
