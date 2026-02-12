/**
 * Offline-First Expense Service
 * 
 * This is the NEW version of expenseService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old expenseService.
 * Components should use this service instead of making direct API calls.
 */

import { expenseRepository } from '../database/repository';
import { EntityTypes, Operations } from '../database/db';

/**
 * Create a new expense
 * Saves to IndexedDB immediately and queues for sync
 * 
 * @param {Object} data - Expense data
 * @returns {Promise<Object>} Created expense record
 */
export const createExpense = async (data) => {
    // Check if we're in group panel context
    const isGroupPanel = typeof window !== 'undefined' && window.location?.pathname?.includes('/group');
    
    // Normalize groupId to string for consistent filtering in repository
    const groupId = data.groupId != null ? String(data.groupId) : data.groupId;
    const payload = {
        ...data,
        ...(groupId !== undefined ? { groupId } : {}),
        ...(isGroupPanel ? { requireApproval: true, source: 'group_sync' } : {}),
    };
    
    // Save to IndexedDB
    const record = await expenseRepository.create(payload);
    
    // Return the payload with UUID
    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.uuid, // Use UUID as ID for local records
            id: record.uuid,
            _uuid: record.uuid,
            _syncStatus: record.syncStatus,
            _isLocal: true,
        },
    };
};

/**
 * Get expenses
 * Reads from IndexedDB (merged with master data)
 * 
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Expenses data
 */
export const getExpenses = async (filters = {}) => {
    // Get merged data (master + transactions)
    const expenses = await expenseRepository.getMerged(filters);
    
    return {
        success: true,
        data: expenses,
    };
};

/**
 * Get expense detail by ID
 * 
 * @param {string} id - Expense ID (UUID or backend ID)
 * @returns {Promise<Object>} Expense detail
 */
export const getExpenseDetail = async (id) => {
    // Try to get from transactions first (local changes)
    let record = await expenseRepository.getByUuid(id);
    
    if (!record) {
        // Try to get from master data
        const masterData = await expenseRepository.getMasterData();
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
        
        throw new Error(`Expense with ID ${id} not found`);
    }
    
    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.payload?._id || record.uuid,
            id: record.payload?.id || record.uuid,
            _uuid: record.uuid,
            _syncStatus: record.syncStatus,
            _isLocal: record.syncStatus !== 'synced',
        },
    };
};

/**
 * Update an expense
 * Updates IndexedDB and queues for sync
 * 
 * @param {string} id - Expense ID (UUID or backend ID)
 * @param {Object} data - Updated expense data
 * @returns {Promise<Object>} Updated expense record
 */
export const updateExpense = async (id, data) => {
    // Find the record first
    let record = await expenseRepository.getByUuid(id);
    
    if (!record) {
        // Try to find in master data and create an update record
        const masterData = await expenseRepository.getMasterData();
        const masterRecord = masterData.find(r => 
            r.uuid === id || 
            r.payload?._id === id || 
            r.payload?.id === id
        );
        
        if (masterRecord) {
            // Create an update transaction from master data
            const updatedRecord = await expenseRepository.update(
                masterRecord.uuid,
                { ...masterRecord.payload, ...data }
            );
            
            return {
                success: true,
                data: {
                    ...updatedRecord.payload,
                    _id: updatedRecord.payload?._id || updatedRecord.uuid,
                    id: updatedRecord.payload?.id || updatedRecord.uuid,
                    _uuid: updatedRecord.uuid,
                    _syncStatus: updatedRecord.syncStatus,
                    _isLocal: true,
                },
            };
        }
        
        throw new Error(`Expense with ID ${id} not found`);
    }
    
    // Update the record
    const updatedRecord = await expenseRepository.update(id, data);
    
    return {
        success: true,
        data: {
            ...updatedRecord.payload,
            _id: updatedRecord.payload?._id || updatedRecord.uuid,
            id: updatedRecord.payload?.id || updatedRecord.uuid,
            _uuid: updatedRecord.uuid,
            _syncStatus: updatedRecord.syncStatus,
            _isLocal: updatedRecord.syncStatus !== 'synced',
        },
    };
};

/**
 * Delete an expense
 * Marks as deleted in IndexedDB and queues for sync
 * 
 * @param {string} id - Expense ID (UUID or backend ID)
 * @returns {Promise<Object>} Deletion result
 */
export const deleteExpense = async (id) => {
    // Find the record
    let record = await expenseRepository.getByUuid(id);
    
    if (!record) {
        // Try to find in master data
        const masterData = await expenseRepository.getMasterData();
        const masterRecord = masterData.find(r => 
            r.uuid === id || 
            r.payload?._id === id || 
            r.payload?.id === id
        );
        
        if (masterRecord) {
            // Create a delete transaction from master data
            await expenseRepository.delete(masterRecord.uuid);
            
            return {
                success: true,
                message: 'Expense deleted successfully',
            };
        }
        
        throw new Error(`Expense with ID ${id} not found`);
    }
    
    // Delete the record
    await expenseRepository.delete(id);
    
    return {
        success: true,
        message: 'Expense deleted successfully',
    };
};

/**
 * Search expenses
 * 
 * @param {string} searchTerm - Search term
 * @param {Object} filters - Additional filters
 * @returns {Promise<Object>} Search results
 */
export const searchExpenses = async (searchTerm, filters = {}) => {
    const expenses = await expenseRepository.search(
        searchTerm,
        ['expenseType', 'purpose'],
        filters
    );
    
    return {
        success: true,
        data: expenses.map(e => ({
            ...e.payload,
            _id: e.payload?._id || e.uuid,
            id: e.payload?.id || e.uuid,
            _uuid: e.uuid,
            _syncStatus: e.syncStatus,
            _isLocal: e.syncStatus !== 'synced',
        })),
    };
};

/**
 * Get expenses by date range
 * 
 * @param {Object} filters - Filters including fromDate and toDate
 * @returns {Promise<Object>} Filtered expenses
 */
export const getExpensesByDateRange = async (filters = {}) => {
    const expenses = await expenseRepository.getMerged(filters);
    
    // Filter by date range if provided
    let filtered = expenses;
    if (filters.fromDate || filters.toDate) {
        filtered = expenses.filter(exp => {
            if (!exp.date) return false;
            
            const expDate = new Date(exp.date);
            if (filters.fromDate && expDate < new Date(filters.fromDate)) {
                return false;
            }
            if (filters.toDate && expDate > new Date(filters.toDate)) {
                return false;
            }
            return true;
        });
    }
    
    return {
        success: true,
        data: filtered.map(e => ({
            ...e,
            _id: e._id || e._uuid,
            id: e.id || e._uuid,
        })),
    };
};

// Export all functions for backward compatibility
export default {
    createExpense,
    getExpenses,
    getExpenseDetail,
    updateExpense,
    deleteExpense,
    searchExpenses,
    getExpensesByDateRange,
};
