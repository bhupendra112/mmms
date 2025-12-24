import { createRxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

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

