/**
 * Offline-First Group Service
 * 
 * This is the NEW version of groupService that uses the offline-first architecture.
 * Most operations are read-only from IndexedDB (groups are pre-synced).
 * 
 * IMPORTANT: This replaces the direct API calls in the old groupService.
 * Components should use this service instead of making direct API calls.
 */

import { groupRepository } from '../database/repository';
import { EntityTypes, Operations } from '../database/db';
import db from '../database/db';

/**
 * Create a new group
 * Saves to IndexedDB immediately and queues for sync
 */
export const createGroup = async (data) => {
    const record = await groupRepository.create(data);
    
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
 * Get clusters - computed from groups in IndexedDB
 */
export const getClusters = async () => {
    const groups = await groupRepository.getMerged();
    
    // Extract unique clusters
    const clusterMap = new Map();
    groups.forEach(group => {
        const clusterKey = `${group.cluster_name || ''}|${group.cluster_code || ''}`;
        if (!clusterMap.has(clusterKey)) {
            clusterMap.set(clusterKey, {
                name: group.cluster_name || '',
                code: group.cluster_code || '',
                groups: [],
            });
        }
        clusterMap.get(clusterKey).groups.push(group);
    });
    
    const clusters = Array.from(clusterMap.values());
    
    return {
        success: true,
        data: clusters,
    };
};

/**
 * Get all groups
 * Reads from IndexedDB (merged with master data)
 */
export const getGroups = async () => {
    const groups = await groupRepository.getMerged();
    
    return {
        success: true,
        data: groups,
    };
};

/**
 * Get group detail by ID
 */
export const getGroupDetail = async (id) => {
    let record = await groupRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await groupRepository.getMasterData();
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
            message: `Group with ID ${id} not found`,
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

/**
 * Get group by code
 */
export const getGroupByCode = async (groupCode) => {
    const groups = await groupRepository.getMerged();
    const group = groups.find(g => 
        g.group_code === groupCode || 
        g.code === groupCode
    );
    
    if (group) {
        return {
            success: true,
            data: group,
        };
    }
    
    return {
        success: false,
        message: `Group with code ${groupCode} not found`,
    };
};

/**
 * Create bank - requires backend (complex operation)
 */
export const createBank = async (data) => {
    // Bank creation is complex and may require backend validation
    // For offline, we'll queue it
    const record = await groupRepository.create({
        ...data,
        _operation: 'createBank',
    });
    
    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.uuid,
            _uuid: record.uuid,
            _syncStatus: record.syncStatus,
            _isLocal: true,
        },
    };
};

/**
 * Get group banks - from master_banks (PreSync) when available, else group detail
 */
export const getGroupBanks = async (groupId) => {
    const g = groupId == null ? '' : (typeof groupId === 'object' && groupId?._id != null ? String(groupId._id) : String(groupId));
    if (db.master_banks) {
        const all = await db.master_banks.toArray();
        const filtered = all.filter((r) => {
            const pg = r.payload?.groupId ?? r.payload?.group_id ?? r.payload?.group;
            const pgStr = pg == null ? '' : (typeof pg === 'object' && pg._id != null ? String(pg._id) : String(pg));
            return pgStr === g;
        });
        if (filtered.length > 0) {
            return { success: true, data: filtered.map((r) => r.payload) };
        }
    }
    const group = await getGroupDetail(groupId);
    if (group.success && group.data) {
        const banks = group.data.banks || group.data.bankmaster || [];
        return { success: true, data: Array.isArray(banks) ? banks : [banks].filter(Boolean) };
    }
    return { success: true, data: [] };
};

/**
 * Get bank detail - requires backend (complex query)
 */
export const getBankDetail = async (bankId) => {
    // This requires backend computation
    if (!navigator.onLine) {
        return {
            success: false,
            message: 'Bank detail requires internet connection',
        };
    }
    
    // If online, should be handled by direct API or sync
    return {
        success: false,
        message: 'Bank detail query not yet implemented in offline mode',
    };
};

/**
 * Get cash transactions - computed from local data
 */
export const getCashTransactions = async (groupId) => {
    // Get cash transactions from IndexedDB
    // This would need a cash transactions store
    // For now, return empty array
    return {
        success: true,
        data: [],
    };
};

/**
 * Update group
 */
export const updateGroup = async (id, data) => {
    let record = await groupRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await groupRepository.getMasterData();
        const masterRecord = masterData.find(r => 
            r.uuid === id || 
            r.payload?._id === id || 
            r.payload?.id === id
        );
        
        if (masterRecord) {
            const updated = await groupRepository.update(masterRecord.uuid, {
                ...masterRecord.payload,
                ...data,
            });
            return {
                success: true,
                data: {
                    ...updated.payload,
                    _id: updated.payload?._id || updated.uuid,
                    _uuid: updated.uuid,
                },
            };
        }
        
        return {
            success: false,
            message: `Group with ID ${id} not found`,
        };
    }
    
    const updated = await groupRepository.update(id, data);
    
    return {
        success: true,
        data: {
            ...updated.payload,
            _id: updated.payload?._id || updated.uuid,
            _uuid: updated.uuid,
        },
    };
};

/**
 * Update bank - requires backend
 */
export const updateBank = async (bankId, data) => {
    // Queue for sync
    const record = await groupRepository.create({
        ...data,
        bankId,
        _operation: 'updateBank',
    });
    
    return {
        success: true,
        data: {
            ...record.payload,
            _id: record.uuid,
            _uuid: record.uuid,
        },
    };
};

/**
 * Add group charge
 */
export const addGroupCharge = async (groupId, chargeData) => {
    const group = await getGroupDetail(groupId);
    if (!group.success) {
        return group;
    }
    
    const charges = group.data.charges || [];
    const updated = await groupRepository.update(group.data._uuid || group.data._id, {
        ...group.data,
        charges: [...charges, chargeData],
    });
    
    return {
        success: true,
        data: {
            ...updated.payload,
            _id: updated.payload?._id || updated.uuid,
            _uuid: updated.uuid,
        },
    };
};

/**
 * Update group charge
 */
export const updateGroupCharge = async (groupId, chargeId, chargeData) => {
    const group = await getGroupDetail(groupId);
    if (!group.success) {
        return group;
    }
    
    const charges = (group.data.charges || []).map(charge => 
        charge._id === chargeId || charge.id === chargeId 
            ? { ...charge, ...chargeData }
            : charge
    );
    
    const updated = await groupRepository.update(group.data._uuid || group.data._id, {
        ...group.data,
        charges,
    });
    
    return {
        success: true,
        data: {
            ...updated.payload,
            _id: updated.payload?._id || updated.uuid,
            _uuid: updated.uuid,
        },
    };
};

/**
 * Delete group charge
 */
export const deleteGroupCharge = async (groupId, chargeId) => {
    const group = await getGroupDetail(groupId);
    if (!group.success) {
        return group;
    }
    
    const charges = (group.data.charges || []).filter(charge => 
        charge._id !== chargeId && charge.id !== chargeId
    );
    
    const updated = await groupRepository.update(group.data._uuid || group.data._id, {
        ...group.data,
        charges,
    });
    
    return {
        success: true,
        data: {
            ...updated.payload,
            _id: updated.payload?._id || updated.uuid,
            _uuid: updated.uuid,
        },
    };
};

/**
 * Get group charges
 */
export const getGroupCharges = async (groupId) => {
    const group = await getGroupDetail(groupId);
    
    if (group.success && group.data) {
        return {
            success: true,
            data: group.data.charges || [],
        };
    }
    
    return {
        success: true,
        data: [],
    };
};
