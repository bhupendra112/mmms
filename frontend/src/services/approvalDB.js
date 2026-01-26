import { createRxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import Dexie from "dexie"; // Use the same Dexie instance

let approvalDB = null;

// Approval Schema
const approvalSchema = {
    version: 0,
    primaryKey: "id",
    type: "object",
    properties: {
        id: {
            type: "string",
            maxLength: 100,
        },
        type: {
            type: "string", // "member", "recovery", "loan"
        },
        status: {
            type: "string", // "pending", "approved", "rejected"
        },
        groupId: {
            type: "string",
        },
        groupName: {
            type: "string",
        },
        data: {
            type: "object", // The actual data to be approved
        },
        submittedAt: {
            type: "number",
        },
        approvedAt: {
            type: "number",
        },
        approvedBy: {
            type: "string",
        },
        rejectionReason: {
            type: "string",
        },
        synced: {
            type: "boolean",
        },
    },
    required: ["id", "type", "status", "groupId", "data", "submittedAt"],
};

// Initialize Approval Database
export const initApprovalDB = async () => {
    if (approvalDB && approvalDB.approvals) {
        return approvalDB;
    }

    try {
        const db = await createRxDatabase({
            name: "approvaldb",
            storage: getRxStorageDexie(),
            ignoreDuplicate: true, // Allow re-initialization if database already exists
        });

        // Add collections - handle case where they might already exist
        try {
            await db.addCollections({
                approvals: {
                    schema: approvalSchema,
                },
            });
        } catch (addError) {
            // Collections might already exist, check if they're accessible
            if (import.meta.env.DEV) {
            console.warn("Collections might already exist:", addError.message);
            }
        }

        // Wait a moment for collections to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify collection is accessible
        if (!db.approvals) {
            console.error("Approvals collection not found after initialization");
            throw new Error("Approvals collection not accessible after addCollections");
        }

        approvalDB = db;
        return db;
    } catch (error) {
        console.error("❌ Error initializing approval database:", error);
        // Don't throw, try to return existing db if available
        if (approvalDB) {
            return approvalDB;
        }
        throw error;
    }
};

// Create Approval Request
export const createApprovalRequest = async (type, data, groupId, groupName) => {
    if (!approvalDB) {
        await initApprovalDB();
    }

    const approval = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        status: "pending",
        groupId,
        groupName,
        data,
        submittedAt: Date.now(),
        synced: false,
    };

    await approvalDB.approvals.insert(approval);
    return approval;
};

// Get Pending Approvals
export const getPendingApprovals = async (groupId = null) => {
    if (!approvalDB) {
        await initApprovalDB();
    }

    let query = approvalDB.approvals.find({
        selector: {
            status: "pending",
        },
    });

    if (groupId) {
        query = approvalDB.approvals.find({
            selector: {
                status: "pending",
                groupId,
            },
        });
    }

    const approvals = await query.exec();
    return approvals.map((doc) => doc.toJSON());
};

// Get All Approvals
export const getAllApprovals = async (groupId = null) => {
    try {
        if (!approvalDB || !approvalDB.approvals) {
            await initApprovalDB();
        }

        if (!approvalDB || !approvalDB.approvals) {
            if (import.meta.env.DEV) {
            console.warn("Approval database not ready, returning empty array");
            }
            return [];
        }

        let query = approvalDB.approvals.find();

        if (groupId) {
            query = approvalDB.approvals.find({
                selector: {
                    groupId,
                },
            });
        }

        const approvals = await query.exec();
        const result = approvals.map((doc) => doc.toJSON());
        return result;
    } catch (error) {
        console.error("Error getting all approvals:", error);
        return [];
    }
};

// Approve Request
export const approveRequest = async (id, approvedBy) => {
    if (!approvalDB) {
        await initApprovalDB();
    }

    const approval = await approvalDB.approvals.findOne(id).exec();
    if (approval) {
        await approval.incrementalModify((doc) => {
            doc.status = "approved";
            doc.approvedAt = Date.now();
            doc.approvedBy = approvedBy;
            return doc;
        });
        return approval.toJSON();
    }
    return null;
};

// Reject Request
export const rejectRequest = async (id, approvedBy, reason) => {
    if (!approvalDB) {
        await initApprovalDB();
    }

    const approval = await approvalDB.approvals.findOne(id).exec();
    if (approval) {
        await approval.incrementalModify((doc) => {
            doc.status = "rejected";
            doc.approvedAt = Date.now();
            doc.approvedBy = approvedBy;
            doc.rejectionReason = reason;
            return doc;
        });
        return approval.toJSON();
    }
    return null;
};

// Update Approval Data
export const updateApprovalData = async (id, updatedData) => {
    if (!approvalDB) {
        await initApprovalDB();
    }

    const approval = await approvalDB.approvals.findOne(id).exec();
    if (approval) {
        await approval.incrementalModify((doc) => {
            doc.data = { ...doc.data, ...updatedData };
            return doc;
        });
        return approval.toJSON();
    }
    return null;
};

// Mark as Synced
export const markAsSynced = async (id) => {
    if (!approvalDB) {
        await initApprovalDB();
    }

    const approval = await approvalDB.approvals.findOne(id).exec();
    if (approval) {
        await approval.incrementalModify((doc) => {
            doc.synced = true;
            return doc;
        });
    }
};

// Get Unsynced Approvals
export const getUnsyncedApprovals = async () => {
    try {
        if (!approvalDB || !approvalDB.approvals) {
            await initApprovalDB();
        }

        if (!approvalDB || !approvalDB.approvals) {
            if (import.meta.env.DEV) {
            console.warn("Approval database not ready, returning empty array");
            }
            return [];
        }

        const approvals = await approvalDB.approvals.find({
            selector: {
                synced: false,
            },
        }).exec();

        return approvals.map((doc) => doc.toJSON());
    } catch (error) {
        console.error("Error getting unsynced approvals:", error);
        return [];
    }
};

// Sync pending loan approvals to repository (so they get added to sync_queue)
export const syncPendingLoanApprovals = async () => {
    try {
        if (!approvalDB || !approvalDB.approvals) {
            await initApprovalDB();
        }

        if (!approvalDB || !approvalDB.approvals) {
            return { synced: 0, errors: [] };
        }

        // Get unsynced pending loan approvals
        const approvals = await approvalDB.approvals.find({
            selector: {
                type: "loan",
                status: "pending",
                synced: false,
            },
        }).exec();

        const approvalDocs = approvals.map((doc) => doc.toJSON());
        let synced = 0;
        const errors = [];

        // Import registerLoan dynamically to avoid circular dependency
        const { registerLoan } = await import('./loanServiceOffline');

        for (const approval of approvalDocs) {
            try {
                // Convert approval request to repository record
                // This will add it to sync_queue automatically
                await registerLoan(approval.data);

                // Mark approval as synced (converted to repository)
                const approvalDoc = await approvalDB.approvals.findOne(approval.id).exec();
                if (approvalDoc) {
                    await approvalDoc.incrementalModify((doc) => {
                        doc.synced = true;
                        return doc;
                    });
                    synced++;
                }
            } catch (error) {
                console.error(`Error syncing approval ${approval.id}:`, error);
                errors.push({ approvalId: approval.id, error: error.message });
            }
        }

        return { synced, errors };
    } catch (error) {
        console.error("Error syncing pending loan approvals:", error);
        return { synced: 0, errors: [{ error: error.message }] };
    }
};

// Sync pending FD approvals to repository (so they get added to sync_queue)
export const syncPendingFDApprovals = async () => {
    try {
        if (!approvalDB || !approvalDB.approvals) {
            await initApprovalDB();
        }

        if (!approvalDB || !approvalDB.approvals) {
            return { synced: 0, errors: [] };
        }

        // Get unsynced pending FD approvals
        const approvals = await approvalDB.approvals.find({
            selector: {
                type: "fd",
                status: "pending",
                synced: false,
            },
        }).exec();

        const approvalDocs = approvals.map((doc) => doc.toJSON());
        let synced = 0;
        const errors = [];

        // Import registerFD dynamically to avoid circular dependency
        const { registerFD } = await import('./fdServiceOffline');

        for (const approval of approvalDocs) {
            try {
                // Convert approval request to repository record
                // This will add it to sync_queue automatically
                await registerFD(approval.data);

                // Mark approval as synced (converted to repository)
                const approvalDoc = await approvalDB.approvals.findOne(approval.id).exec();
                if (approvalDoc) {
                    await approvalDoc.incrementalModify((doc) => {
                        doc.synced = true;
                        return doc;
                    });
                    synced++;
                }
            } catch (error) {
                console.error(`Error syncing FD approval ${approval.id}:`, error);
                errors.push({ approvalId: approval.id, error: error.message });
            }
        }

        return { synced, errors };
    } catch (error) {
        console.error("Error syncing pending FD approvals:", error);
        return { synced: 0, errors: [{ error: error.message }] };
    }
};

// Sync pending recovery approvals
// Note: Recoveries are already in repository (saved via updateMemberRecovery)
// This function just marks approval requests as synced since the recovery data will sync automatically
export const syncPendingRecoveryApprovals = async () => {
    try {
        if (!approvalDB || !approvalDB.approvals) {
            await initApprovalDB();
        }

        if (!approvalDB || !approvalDB.approvals) {
            return { synced: 0, errors: [] };
        }

        // Get unsynced pending recovery approvals
        const approvals = await approvalDB.approvals.find({
            selector: {
                type: "recovery",
                status: "pending",
                synced: false,
            },
        }).exec();

        const approvalDocs = approvals.map((doc) => doc.toJSON());
        let synced = 0;
        const errors = [];

        // Recoveries are already in repository, so we just mark approval requests as synced
        // The actual recovery data will sync automatically when online
        for (const approval of approvalDocs) {
            try {
                // Mark approval as synced (recovery is already in repository)
                const approvalDoc = await approvalDB.approvals.findOne(approval.id).exec();
                if (approvalDoc) {
                    await approvalDoc.incrementalModify((doc) => {
                        doc.synced = true;
                        return doc;
                    });
                    synced++;
                }
            } catch (error) {
                console.error(`Error syncing recovery approval ${approval.id}:`, error);
                errors.push({ approvalId: approval.id, error: error.message });
            }
        }

        return { synced, errors };
    } catch (error) {
        console.error("Error syncing pending recovery approvals:", error);
        return { synced: 0, errors: [{ error: error.message }] };
    }
};

// Subscribe to Approvals
export const subscribeToApprovals = (callback, groupId = null) => {
    if (!approvalDB) {
        initApprovalDB().then(() => {
            setupSubscription(callback, groupId);
        });
        return () => { };
    }

    return setupSubscription(callback, groupId);
};

const setupSubscription = (callback, groupId) => {
    let query = approvalDB.approvals.find({
        selector: {
            status: "pending",
        },
    });

    if (groupId) {
        query = approvalDB.approvals.find({
            selector: {
                status: "pending",
                groupId,
            },
        });
    }

    return query.$.subscribe((approvals) => {
        callback(approvals.map((doc) => doc.toJSON()));
    });
};

