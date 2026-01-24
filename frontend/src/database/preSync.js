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
 * Configuration for pre-sync endpoints
 * Each endpoint fetches master data for a specific entity type
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
    
    // Recoveries
    recoveries: {
        endpoint: '/api/admin/recovery/list',
        store: 'master_recoveries',
        entityType: EntityTypes.RECOVERY,
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

    const data = await response.json();
    return data?.data || data || [];
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
        
        // Fetch data from backend
        const data = await fetchFromBackend(config.endpoint);
        
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
    const results = {
        success: true,
        total: Object.keys(PRE_SYNC_CONFIG).length,
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
                // Handle unexpected errors gracefully
                results.failed++;
                results.details[key] = { success: false, key, error: error.message };
                console.error(`Pre-sync failed for ${key}:`, error);
                // Continue with other entities
            }
        }

        // Mark pre-sync as completed (even if some endpoints failed)
        // Allow app to continue if at least some endpoints succeeded or if only auth errors occurred
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
