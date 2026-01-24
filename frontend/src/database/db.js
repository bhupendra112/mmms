/**
 * IndexedDB Database Schema
 * 
 * This is the SINGLE SOURCE OF TRUTH for all application data.
 * All UI operations read/write from/to IndexedDB only.
 * Backend APIs are used exclusively for synchronization.
 */

import Dexie from 'dexie';

/**
 * Financial-Grade Offline-First Database
 * 
 * Object Stores:
 * - master_*: Read-only snapshots from backend pre-sync
 * - transactions: All mutable operations (CRUD)
 * - operations: Queued operations pending sync
 * - sync_queue: Ordered queue for background sync
 * - sync_logs: Audit trail of sync operations
 * - documents: PDF, images, and other files as Blobs
 * - app_state: Application-level state (sync status, pre-sync completion, etc.)
 */
class MMMSDatabase extends Dexie {
    constructor() {
        super('MMMSOfflineDB');
        
        // Define schema version
        this.version(1).stores({
            // ============================================
            // MASTER DATA (Read-only snapshots from pre-sync)
            // ============================================
            
            // User management
            master_users: '&uuid, entityType, createdAt, updatedAt, syncStatus',
            
            // Group management
            master_groups: '&uuid, entityType, code, createdAt, updatedAt, syncStatus',
            
            // Member management
            master_members: '&uuid, entityType, groupId, memberCode, createdAt, updatedAt, syncStatus',
            
            // Loan management
            master_loans: '&uuid, entityType, groupId, memberId, loanCode, status, createdAt, updatedAt, syncStatus',
            
            // Fixed Deposit management
            master_fds: '&uuid, entityType, groupId, memberId, fdCode, createdAt, updatedAt, syncStatus',
            
            // Bank accounts
            master_banks: '&uuid, entityType, groupId, bankName, accountNo, createdAt, updatedAt, syncStatus',
            
            // Cash amounts
            master_cash: '&uuid, entityType, groupId, createdAt, updatedAt, syncStatus',
            
            // Expense types and configuration
            master_expense_types: '&uuid, entityType, createdAt, updatedAt, syncStatus',
            
            // Payment methods and rules
            master_payment_methods: '&uuid, entityType, createdAt, updatedAt, syncStatus',
            
            // Recovery and demand records
            master_recoveries: '&uuid, entityType, groupId, memberId, createdAt, updatedAt, syncStatus',
            master_demands: '&uuid, entityType, groupId, memberId, createdAt, updatedAt, syncStatus',
            
            // Revenue and payment records
            master_revenues: '&uuid, entityType, groupId, memberId, createdAt, updatedAt, syncStatus',
            master_payments: '&uuid, entityType, groupId, memberId, createdAt, updatedAt, syncStatus',
            
            // ============================================
            // TRANSACTIONAL DATA (Mutable operations)
            // ============================================
            
            // All transactional operations (member creation, loan creation, payments, etc.)
            transactions: '&uuid, entityType, operation, groupId, memberId, createdAt, updatedAt, syncStatus, retryCount',
            
            // ============================================
            // SYNC MANAGEMENT
            // ============================================
            
            // Ordered queue for background synchronization
            sync_queue: '++id, uuid, entityType, operation, priority, createdAt, retryCount, syncStatus',
            
            // Sync audit logs
            sync_logs: '++id, uuid, entityType, operation, status, error, syncedAt, retryCount',
            
            // ============================================
            // DOCUMENTS & FILES
            // ============================================
            
            // Store PDFs, images, and other files as Blobs
            documents: '&uuid, entityType, entityId, documentType, fileName, mimeType, size, createdAt, updatedAt, syncStatus',
            
            // ============================================
            // APPLICATION STATE
            // ============================================
            
            // Application-level state
            app_state: '&key, value, updatedAt',
        });
        
        // Define entity types for type safety
        this.entityTypes = {
            USER: 'user',
            GROUP: 'group',
            MEMBER: 'member',
            LOAN: 'loan',
            FD: 'fd',
            BANK: 'bank',
            CASH: 'cash',
            EXPENSE: 'expense',
            EXPENSE_TYPE: 'expense_type',
            PAYMENT: 'payment',
            RECOVERY: 'recovery',
            DEMAND: 'demand',
            REVENUE: 'revenue',
            DOCUMENT: 'document',
        };
        
        // Define operations for type safety
        this.operations = {
            CREATE: 'create',
            UPDATE: 'update',
            DELETE: 'delete',
            APPROVE: 'approve',
            REJECT: 'reject',
        };
        
        // Define sync statuses
        this.syncStatuses = {
            PENDING: 'pending',
            SYNCING: 'syncing',
            SYNCED: 'synced',
            FAILED: 'failed',
        };
    }
}

// Create singleton instance
export const db = new MMMSDatabase();

// Export types for use throughout application
export const EntityTypes = db.entityTypes;
export const Operations = db.operations;
export const SyncStatuses = db.syncStatuses;

/**
 * Generate UUID v4 for unique record identification
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Create a standardized record structure for IndexedDB
 * 
 * @param {Object} params
 * @param {string} params.entityType - Type of entity (EntityTypes.*)
 * @param {string} params.operation - Operation type (Operations.*)
 * @param {Object} params.payload - Actual data payload
 * @param {string} [params.uuid] - Optional UUID (generated if not provided)
 * @param {string} [params.syncStatus] - Sync status (defaults to PENDING)
 * @param {Object} [params.metadata] - Additional metadata
 * @returns {Object} Standardized record
 */
export function createRecord({ entityType, operation, payload, uuid, syncStatus = SyncStatuses.PENDING, metadata = {} }) {
    const now = new Date().toISOString();
    return {
        uuid: uuid || generateUUID(),
        entityType,
        operation,
        payload,
        syncStatus,
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
        ...metadata,
    };
}

/**
 * Update record timestamp and increment retry count if failed
 */
export function updateRecordTimestamp(record, incrementRetry = false) {
    record.updatedAt = new Date().toISOString();
    if (incrementRetry && record.syncStatus === SyncStatuses.FAILED) {
        record.retryCount = (record.retryCount || 0) + 1;
    }
    return record;
}

export default db;
