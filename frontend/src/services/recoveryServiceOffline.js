/**
 * Offline-First Recovery Service
 * 
 * This is the NEW version of recoveryService that uses the offline-first architecture.
 * All operations are saved to IndexedDB first, then synced to backend in background.
 * 
 * IMPORTANT: This replaces the direct API calls in the old recoveryService.
 * Components should use this service instead of making direct API calls.
 */

import { recoveryRepository, loanRepository, memberRepository } from '../database/repository';
import db from '../database/db';

/**
 * Register a new recovery
 * Saves to IndexedDB immediately and queues for sync
 */
export const registerRecovery = async (data, testMode = false) => {
    const payload = { ...data };
    if (testMode) {
        payload.testMode = true;
    }
    
    const record = await recoveryRepository.create(payload);
    
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
 * Update member recovery
 */
export const updateMemberRecovery = async (groupId, date, memberRecovery, testMode = false) => {
    if (testMode) {
        memberRecovery.testMode = true;
    }
    
    // Find existing recovery for this group and date
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const dateStr = date; // Keep as string (en-GB format)
    const existing = recoveries.find(r => {
        const rDate = r.date || r.recoveryDate;
        if (!rDate) return false;
        // Try to match date in various formats
        const rDateStr = typeof rDate === 'string' ? rDate : new Date(rDate).toLocaleDateString("en-GB");
        return rDateStr === dateStr || rDate === dateStr;
    });
    
    if (existing) {
        // Merge member recovery into existing recoveries array
        const existingRecoveries = existing.recoveries || existing.memberRecoveries || [];
        const memberId = memberRecovery.memberId || memberRecovery.id;
        
        // Remove existing entry for this member if present
        const filtered = existingRecoveries.filter(mr => 
            (mr.memberId || mr.id) !== memberId
        );
        
        // Add or update the member recovery
        filtered.push(memberRecovery);
        
        const updated = await recoveryRepository.update(existing._uuid || existing._id, {
            ...existing,
            recoveries: filtered,
            memberRecoveries: filtered, // Support both field names
        });
        return {
            success: true,
            data: {
                ...updated.payload,
                _id: updated.payload?._id || updated.uuid,
                _uuid: updated.uuid,
                _syncStatus: updated.syncStatus,
            },
        };
    } else {
        // Create new recovery record
        const payload = {
            groupId,
            date: dateStr,
            recoveries: [memberRecovery],
            memberRecoveries: [memberRecovery],
        };
        if (testMode) {
            payload.testMode = true;
        }
        
        const record = await recoveryRepository.create(payload);
        return {
            success: true,
            data: {
                ...record.payload,
                _id: record.uuid,
                _uuid: record.uuid,
                _syncStatus: record.syncStatus,
            },
        };
    }
};

/**
 * Get recovery by date
 */
export const getRecoveryByDate = async (groupId, date, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const recovery = recoveries.find(r => {
        const rDate = r.date || r.recoveryDate;
        return rDate === date || (rDate && new Date(rDate).toISOString().split('T')[0] === date);
    });
    
    if (recovery) {
        // Extract member recoveries from the recovery record
        const memberRecoveries = recovery.memberRecoveries || recovery.recoveries || [];
        return {
            success: true,
            data: {
                ...recovery,
                recoveries: memberRecoveries,
            },
        };
    }
    
    return {
        success: true,
        data: {
            recoveries: [],
        },
    };
};

/**
 * Get all recoveries
 */
export const getRecoveries = async (groupId = null, testMode = false) => {
    const filters = groupId ? { groupId } : {};
    const recoveries = await recoveryRepository.getMerged(filters);
    
    return {
        success: true,
        data: recoveries,
    };
};

/**
 * Get recovery detail by ID
 */
export const getRecoveryDetail = async (id, testMode = false) => {
    let record = await recoveryRepository.getByUuid(id);
    
    if (!record) {
        const masterData = await recoveryRepository.getMasterData();
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
            message: `Recovery with ID ${id} not found`,
        };
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
 * Update recovery photo
 */
export const updateRecoveryPhoto = async (groupId, date, groupPhoto, cashDenominations = null, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const existing = recoveries.find(r => {
        const rDate = r.date || r.recoveryDate;
        return rDate === date || (rDate && new Date(rDate).toISOString().split('T')[0] === date);
    });
    
    const updateData = {
        groupId,
        date,
        groupPhoto,
    };
    if (cashDenominations) {
        updateData.cashDenominations = cashDenominations;
    }
    if (testMode) {
        updateData.testMode = true;
    }
    
    if (existing) {
        const updated = await recoveryRepository.update(existing._uuid || existing._id, {
            ...existing,
            ...updateData,
        });
        return {
            success: true,
            data: {
                ...updated.payload,
                _id: updated.payload?._id || updated.uuid,
                _uuid: updated.uuid,
            },
        };
    } else {
        const record = await recoveryRepository.create(updateData);
        return {
            success: true,
            data: {
                ...record.payload,
                _id: record.uuid,
                _uuid: record.uuid,
            },
        };
    }
};

/**
 * Get previous recovery data - computed from local IndexedDB
 */
export const getPreviousRecoveryData = async (groupId, memberId, date, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const targetDate = new Date(date);
    
    // Find recoveries before the target date
    const previousRecoveries = recoveries
        .filter(r => {
            const rDate = r.date || r.recoveryDate;
            if (!rDate) return false;
            return new Date(rDate) < targetDate;
        })
        .sort((a, b) => {
            const dateA = new Date(a.date || a.recoveryDate);
            const dateB = new Date(b.date || b.recoveryDate);
            return dateB - dateA; // Most recent first
        });
    
    // Find member's recovery in the most recent previous recovery
    if (previousRecoveries.length > 0) {
        const latest = previousRecoveries[0];
        const memberRecoveries = latest.memberRecoveries || latest.recoveries || [];
        const memberRecovery = memberRecoveries.find(mr => 
            mr.memberId === memberId || 
            mr.memberCode === memberId ||
            (mr.member && (mr.member._id === memberId || mr.member.id === memberId))
        );
        
        if (memberRecovery) {
            return {
                success: true,
                data: memberRecovery,
            };
        }
    }
    
    return {
        success: true,
        data: null,
    };
};

/**
 * Get demand details - computed from local IndexedDB
 */
export const getDemandDetails = async (groupId, memberId, date, testMode = false) => {
    // This would typically compute from loans, revenues, etc.
    // For offline, we'll compute from local data
    const loans = await loanRepository.getMerged({ groupId, memberId });
    const members = await memberRepository.getMerged({ groupId });
    const member = members.find(m => 
        m._id === memberId || 
        m.id === memberId ||
        m.Member_Id === memberId
    );
    
    // Compute demand from loans and member data
    const totalLoan = loans.reduce((sum, loan) => sum + (parseFloat(loan.amount || 0) - parseFloat(loan.loanPaid || 0)), 0);
    
    return {
        success: true,
        data: {
            memberId,
            memberName: member?.Member_Nm || member?.name || '',
            totalLoan,
            // Add other demand calculations as needed
        },
    };
};

/**
 * Get member loan totals - computed from local IndexedDB
 */
export const getMemberLoanTotals = async (groupId, memberId, testMode = false) => {
    const loans = await loanRepository.getMerged({ groupId, memberId });
    
    const totals = loans.reduce((acc, loan) => {
        const amount = parseFloat(loan.amount || 0);
        const paid = parseFloat(loan.loanPaid || 0);
        acc.totalLoan += amount;
        acc.totalPaid += paid;
        acc.totalRemaining += (amount - paid);
        return acc;
    }, { totalLoan: 0, totalPaid: 0, totalRemaining: 0 });
    
    return {
        success: true,
        data: totals,
    };
};

/**
 * Get member revenue remaining - computed from local IndexedDB
 */
export const getMemberRevenueRemaining = async (groupId, memberId, testMode = false) => {
    // Compute from recoveries and demands
    const recoveries = await recoveryRepository.getMerged({ groupId });
    const memberRecoveries = [];
    
    recoveries.forEach(recovery => {
        const members = recovery.memberRecoveries || recovery.recoveries || [];
        members.forEach(mr => {
            if (mr.memberId === memberId || mr.memberCode === memberId) {
                memberRecoveries.push({ ...mr, date: recovery.date || recovery.recoveryDate });
            }
        });
    });
    
    // Calculate totals from recoveries
    const totals = memberRecoveries.reduce((acc, mr) => {
        acc.totalSaving += parseFloat(mr.saving || 0);
        acc.totalLoanRecovery += parseFloat(mr.loan || 0);
        acc.totalInterest += parseFloat(mr.interest || 0);
        acc.totalYogdan += parseFloat(mr.yogdan || 0);
        acc.totalCharges += parseFloat(mr.charges || 0);
        return acc;
    }, {
        totalSaving: 0,
        totalLoanRecovery: 0,
        totalInterest: 0,
        totalYogdan: 0,
        totalCharges: 0,
    });
    
    return {
        success: true,
        data: totals,
    };
};

/**
 * Get group recovery details
 */
export const getGroupRecoveryDetails = async (groupId, filters = {}, testMode = false) => {
    const recoveries = await recoveryRepository.getMerged({ groupId });
    
    let filtered = recoveries;
    if (filters.fromDate || filters.toDate) {
        filtered = recoveries.filter(r => {
            const rDate = r.date || r.recoveryDate;
            if (!rDate) return false;
            const date = new Date(rDate);
            if (filters.fromDate && date < new Date(filters.fromDate)) return false;
            if (filters.toDate && date > new Date(filters.toDate)) return false;
            return true;
        });
    }
    
    return {
        success: true,
        data: filtered,
    };
};

/**
 * Export recovery PDF - requires internet (returns error if offline)
 */
export const exportRecoveryPDF = async (groupId, date) => {
    // PDF export requires backend - queue this operation
    // For now, return an error indicating internet is required
    if (!navigator.onLine) {
        throw new Error('PDF export requires internet connection. Please sync your data first.');
    }
    
    // If online, this should be handled by sync engine or direct API call
    // For now, return a placeholder
    return {
        success: false,
        message: 'PDF export is not yet implemented in offline mode. Please use online mode.',
    };
};

/**
 * Get member recovery status
 */
export const getMemberRecoveryStatus = async (memberId, groupId, date) => {
    const recovery = await getRecoveryByDate(groupId, date);
    
    if (recovery.data) {
        const memberRecoveries = recovery.data.memberRecoveries || recovery.data.recoveries || [];
        const memberRecovery = memberRecoveries.find(mr => 
            mr.memberId === memberId || 
            mr.memberCode === memberId
        );
        
        return {
            success: true,
            data: memberRecovery || null,
        };
    }
    
    return {
        success: true,
        data: null,
    };
};
