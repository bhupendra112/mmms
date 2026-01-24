/**
 * Generic Repository Pattern for IndexedDB Operations
 * 
 * This repository provides a unified interface for all IndexedDB operations.
 * All UI components should use this repository instead of direct IndexedDB access.
 * 
 * CRITICAL: This is the ONLY way UI components interact with data storage.
 */

import db, { createRecord, updateRecordTimestamp, EntityTypes, Operations, SyncStatuses } from './db';

/**
 * Base Repository Class
 * Provides common CRUD operations for all entity types
 */
export class BaseRepository {
    constructor(storeName, entityType) {
        this.storeName = storeName;
        this.entityType = entityType;
    }

    /**
     * Create a new record
     * Saves to IndexedDB and adds to sync queue
     * 
     * @param {Object} payload - Data to save
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created record with UUID
     */
    async create(payload, options = {}) {
        const record = createRecord({
            entityType: this.entityType,
            operation: Operations.CREATE,
            payload,
            syncStatus: SyncStatuses.PENDING,
            ...options.metadata,
        });

        // Save to transactions store
        await db.transactions.add(record);

        // Add to sync queue
        await db.sync_queue.add({
            uuid: record.uuid,
            entityType: this.entityType,
            operation: Operations.CREATE,
            priority: options.priority || 0,
            createdAt: record.createdAt,
            retryCount: 0,
            syncStatus: SyncStatuses.PENDING,
        });

        return record;
    }

    /**
     * Update an existing record
     * Updates IndexedDB and adds to sync queue
     * 
     * @param {string} uuid - Record UUID
     * @param {Object} payload - Updated data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Updated record
     */
    async update(uuid, payload, options = {}) {
        // Find existing record
        const existing = await db.transactions.get(uuid);
        if (!existing) {
            throw new Error(`Record with UUID ${uuid} not found`);
        }

        // Create update record
        const record = {
            ...existing,
            operation: Operations.UPDATE,
            payload: { ...existing.payload, ...payload },
            syncStatus: SyncStatuses.PENDING,
            updatedAt: new Date().toISOString(),
            ...options.metadata,
        };

        // Update in transactions store
        await db.transactions.put(record);

        // Add to sync queue
        await db.sync_queue.add({
            uuid,
            entityType: this.entityType,
            operation: Operations.UPDATE,
            priority: options.priority || 0,
            createdAt: record.updatedAt,
            retryCount: 0,
            syncStatus: SyncStatuses.PENDING,
        });

        return record;
    }

    /**
     * Delete a record
     * Marks as deleted in IndexedDB and adds to sync queue
     * 
     * @param {string} uuid - Record UUID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Deleted record
     */
    async delete(uuid, options = {}) {
        const existing = await db.transactions.get(uuid);
        if (!existing) {
            throw new Error(`Record with UUID ${uuid} not found`);
        }

        const record = {
            ...existing,
            operation: Operations.DELETE,
            payload: { ...existing.payload, _deleted: true },
            syncStatus: SyncStatuses.PENDING,
            updatedAt: new Date().toISOString(),
            ...options.metadata,
        };

        // Update in transactions store
        await db.transactions.put(record);

        // Add to sync queue
        await db.sync_queue.add({
            uuid,
            entityType: this.entityType,
            operation: Operations.DELETE,
            priority: options.priority || 0,
            createdAt: record.updatedAt,
            retryCount: 0,
            syncStatus: SyncStatuses.PENDING,
        });

        return record;
    }

    /**
     * Get a single record by UUID
     * 
     * @param {string} uuid - Record UUID
     * @returns {Promise<Object|null>} Record or null
     */
    async getByUuid(uuid) {
        return await db.transactions.get(uuid);
    }

    /**
     * Get all records of this entity type
     * 
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Array of records
     */
    async getAll(filters = {}) {
        let query = db.transactions.where('entityType').equals(this.entityType);
        
        // Apply filters
        if (filters.groupId) {
            query = query.filter(record => record.payload?.groupId === filters.groupId);
        }
        if (filters.memberId) {
            query = query.filter(record => record.payload?.memberId === filters.memberId);
        }
        if (filters.syncStatus) {
            query = query.filter(record => record.syncStatus === filters.syncStatus);
        }
        if (filters.operation) {
            query = query.filter(record => record.operation === filters.operation);
        }

        // Exclude deleted records by default
        if (!filters.includeDeleted) {
            query = query.filter(record => !record.payload?._deleted);
        }

        return await query.toArray();
    }

    /**
     * Get records with pagination
     * 
     * @param {Object} params - Pagination params
     * @returns {Promise<Object>} { records, total, page, pageSize }
     */
    async getPaginated(params = {}) {
        const { page = 1, pageSize = 50, filters = {} } = params;
        
        let query = db.transactions.where('entityType').equals(this.entityType);
        
        // Apply filters
        if (filters.groupId) {
            query = query.filter(record => record.payload?.groupId === filters.groupId);
        }
        if (filters.memberId) {
            query = query.filter(record => record.payload?.memberId === filters.memberId);
        }
        if (filters.syncStatus) {
            query = query.filter(record => record.syncStatus === filters.syncStatus);
        }
        if (!filters.includeDeleted) {
            query = query.filter(record => !record.payload?._deleted);
        }

        const allRecords = await query.toArray();
        const total = allRecords.length;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const records = allRecords.slice(startIndex, endIndex);

        return {
            records,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /**
     * Search records
     * 
     * @param {string} searchTerm - Search term
     * @param {Array<string>} fields - Fields to search in
     * @param {Object} filters - Additional filters
     * @returns {Promise<Array>} Matching records
     */
    async search(searchTerm, fields = [], filters = {}) {
        if (!searchTerm) {
            return this.getAll(filters);
        }

        const allRecords = await this.getAll(filters);
        const term = searchTerm.toLowerCase();

        return allRecords.filter(record => {
            const payload = record.payload || {};
            return fields.some(field => {
                const value = payload[field];
                return value && String(value).toLowerCase().includes(term);
            });
        });
    }

    /**
     * Get count of records
     * 
     * @param {Object} filters - Optional filters
     * @returns {Promise<number>} Count
     */
    async count(filters = {}) {
        const records = await this.getAll(filters);
        return records.length;
    }

    /**
     * Get master data snapshot (from pre-sync)
     * These are read-only snapshots
     * 
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Master data records
     */
    async getMasterData(filters = {}) {
        const masterStoreName = `master_${this.storeName.replace('master_', '')}`;
        
        if (!db[masterStoreName]) {
            console.warn(`Master store ${masterStoreName} does not exist`);
            return [];
        }

        let query = db[masterStoreName].where('entityType').equals(this.entityType);
        
        if (filters.groupId) {
            query = query.filter(record => record.payload?.groupId === filters.groupId);
        }
        if (filters.memberId) {
            query = query.filter(record => record.payload?.memberId === filters.memberId);
        }

        return await query.toArray();
    }

    /**
     * Merge master data with transactions
     * Returns combined view of master data and local changes
     * 
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Merged records
     */
    async getMerged(filters = {}) {
        const [masterData, transactions] = await Promise.all([
            this.getMasterData(filters),
            this.getAll(filters),
        ]);

        // Create a map of transactions by their backend ID (if synced) or UUID
        const transactionMap = new Map();
        transactions.forEach(tx => {
            const id = tx.payload?._id || tx.payload?.id || tx.uuid;
            transactionMap.set(id, tx);
        });

        // Merge: transactions override master data
        const merged = [];
        const processedIds = new Set();

        // Add all transactions (includes local creates)
        transactions.forEach(tx => {
            const id = tx.payload?._id || tx.payload?.id || tx.uuid;
            if (!tx.payload?._deleted) {
                merged.push({
                    ...tx.payload,
                    _uuid: tx.uuid,
                    _syncStatus: tx.syncStatus,
                    _operation: tx.operation,
                    _isLocal: tx.syncStatus === SyncStatuses.PENDING || tx.syncStatus === SyncStatuses.FAILED,
                });
                processedIds.add(id);
            }
        });

        // Add master data that hasn't been overridden
        masterData.forEach(master => {
            const id = master.payload?._id || master.payload?.id || master.uuid;
            if (!processedIds.has(id) && !transactionMap.has(id)) {
                merged.push({
                    ...master.payload,
                    _uuid: master.uuid,
                    _syncStatus: master.syncStatus,
                    _operation: 'read',
                    _isLocal: false,
                });
            }
        });

        return merged;
    }
}

/**
 * Factory function to create repository instances
 * 
 * @param {string} storeName - Store name (e.g., 'members', 'loans')
 * @param {string} entityType - Entity type (from EntityTypes)
 * @returns {BaseRepository} Repository instance
 */
export function createRepository(storeName, entityType) {
    return new BaseRepository(storeName, entityType);
}

// Pre-created repositories for common entities
export const memberRepository = createRepository('members', EntityTypes.MEMBER);
export const loanRepository = createRepository('loans', EntityTypes.LOAN);
export const expenseRepository = createRepository('expenses', EntityTypes.EXPENSE);
export const groupRepository = createRepository('groups', EntityTypes.GROUP);
export const fdRepository = createRepository('fds', EntityTypes.FD);
export const paymentRepository = createRepository('payments', EntityTypes.PAYMENT);
export const recoveryRepository = createRepository('recoveries', EntityTypes.RECOVERY);

export default BaseRepository;
