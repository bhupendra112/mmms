/**
 * Database Module Index
 * 
 * Central export point for all offline-first database functionality
 */

// Database instance
export { default as db, generateUUID, createRecord, updateRecordTimestamp, EntityTypes, Operations, SyncStatuses } from './db';

// Repository pattern
export { BaseRepository, createRepository, memberRepository, loanRepository, expenseRepository, groupRepository, fdRepository, paymentRepository, recoveryRepository } from './repository';

// Pre-sync system
export { default as preSync, executePreSync, isPreSyncCompleted, getPreSyncStatus, clearPreSyncData } from './preSync';

// Sync engine
export { default as syncManager, SyncManager } from './syncEngine';
