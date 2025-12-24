import { createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

let recoveryDB = null;

const recoverySchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100,
        },
        groupId: {
            type: 'string',
        },
        groupName: {
            type: 'string',
        },
        memberId: {
            type: 'string',
        },
        memberCode: {
            type: 'string',
        },
        memberName: {
            type: 'string',
        },
        attendance: {
            type: 'string', // 'present' or 'absent'
        },
        recoveryByOther: {
            type: 'boolean',
        },
        otherMemberId: {
            type: 'string',
        },
        amounts: {
            type: 'object',
            properties: {
                saving: { type: 'number' },
                loan: { type: 'number' },
                fd: { type: 'number' },
                interest: { type: 'number' },
                other: { type: 'number' },
            },
        },
        fd_time_period: { type: 'number' }, // Time period in months for new FD
        fd_rate_snapshot: { type: 'number' }, // Snapshot of fd_rate from group at time of FD creation
        paymentMode: {
            type: 'object',
            properties: {
                cash: { type: 'boolean' },
                online: { type: 'boolean' },
            },
        },
        onlineRef: {
            type: 'string',
        },
        screenshot: {
            type: 'string', // base64 or file path
        },
        date: {
            type: 'string',
        },
        synced: {
            type: 'boolean',
            default: false,
        },
        createdAt: {
            type: 'number',
        },
    },
    required: ['id', 'memberId', 'memberCode', 'memberName'],
};

const groupPhotoSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            maxLength: 100,
        },
        groupId: {
            type: 'string',
        },
        groupName: {
            type: 'string',
        },
        photo: {
            type: 'string', // base64 image
        },
        totalCash: {
            type: 'number',
        },
        totalOnline: {
            type: 'number',
        },
        totalAmount: {
            type: 'number',
        },
        memberCount: {
            type: 'number',
        },
        date: {
            type: 'string',
        },
        synced: {
            type: 'boolean',
            default: false,
        },
        createdAt: {
            type: 'number',
        },
    },
    required: ['id', 'groupId', 'groupName'],
};

export async function initRecoveryDB() {
    if (recoveryDB && recoveryDB.recoveries && recoveryDB.groupPhotos) {
        return recoveryDB;
    }

    try {
        // Remove existing database if it exists (to fix schema issues)
        try {
            const Dexie = (await import('dexie')).default;
            await Dexie.delete('recoverydb');
        } catch (deleteError) {
            // Ignore errors if database doesn't exist
            if (import.meta.env.DEV) {
                console.log('No existing database to delete or delete failed:', deleteError.message);
            }
        }

        // Create database
        const db = await createRxDatabase({
            name: 'recoverydb',
            storage: getRxStorageDexie(),
        });

        if (!db) {
            throw new Error('Failed to create database');
        }

        // Add collections - RxDB 15 returns collections object
        const collections = await db.addCollections({
            recoveries: {
                schema: recoverySchema,
            },
            groupPhotos: {
                schema: groupPhotoSchema,
            },
        });

        // Verify collections were created
        if (!collections || !collections.recoveries || !collections.groupPhotos) {
            throw new Error('Collections not returned from addCollections');
        }

        // In RxDB 15, collections are returned from addCollections
        // They should also be available on db object, but ensure they are
        if (!db.recoveries) {
            db.recoveries = collections.recoveries;
        }
        if (!db.groupPhotos) {
            db.groupPhotos = collections.groupPhotos;
        }

        recoveryDB = db;
        return recoveryDB;
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        recoveryDB = null;
        throw error;
    }
}

export async function saveRecovery(recoveryData) {
    if (!recoveryDB) {
        await initRecoveryDB();
    }

    // Ensure collections are ready
    if (!recoveryDB || !recoveryDB.recoveries) {
        throw new Error('Database or recoveries collection not initialized');
    }

    const recovery = {
        id: `${recoveryData.memberId}_${Date.now()}`,
        ...recoveryData,
        createdAt: Date.now(),
        synced: false,
    };

    try {
        await recoveryDB.recoveries.insert(recovery);
        return recovery;
    } catch (error) {
        console.error('Error saving recovery:', error);
        throw error;
    }
}

export async function getRecoveriesByGroup(groupId) {
    if (!recoveryDB) {
        await initRecoveryDB();
    }

    // Ensure collections are ready
    if (!recoveryDB || !recoveryDB.recoveries) {
        console.error('Database or recoveries collection not initialized');
        return [];
    }

    try {
        const recoveries = await recoveryDB.recoveries
            .find({
                selector: { groupId },
            })
            .exec();

        return recoveries.map((r) => r.toJSON());
    } catch (error) {
        console.error('Error getting recoveries:', error);
        return [];
    }
}

export async function deleteRecovery(recoveryId) {
    if (!recoveryDB) {
        await initRecoveryDB();
    }

    // Ensure collections are ready
    if (!recoveryDB || !recoveryDB.recoveries) {
        console.error('Database or recoveries collection not initialized');
        return;
    }

    try {
        const recovery = await recoveryDB.recoveries.findOne(recoveryId).exec();
        if (recovery) {
            await recovery.remove();
        }
    } catch (error) {
        console.error('Error deleting recovery:', error);
    }
}

export async function saveGroupPhoto(photoData) {
    if (!recoveryDB) {
        await initRecoveryDB();
    }

    // Ensure collections are ready
    if (!recoveryDB || !recoveryDB.groupPhotos) {
        throw new Error('Database or groupPhotos collection not initialized');
    }

    const photo = {
        id: `photo_${photoData.groupId}_${Date.now()}`,
        ...photoData,
        createdAt: Date.now(),
        synced: false,
    };

    try {
        await recoveryDB.groupPhotos.insert(photo);
        return photo;
    } catch (error) {
        console.error('Error saving group photo:', error);
        throw error;
    }
}

export async function getGroupPhoto(groupId) {
    if (!recoveryDB) {
        await initRecoveryDB();
    }

    // Ensure collections are ready
    if (!recoveryDB || !recoveryDB.groupPhotos) {
        console.error('Database or groupPhotos collection not initialized');
        return null;
    }

    try {
        const photos = await recoveryDB.groupPhotos
            .find({
                selector: { groupId },
            })
            .sort({ createdAt: 'desc' })
            .limit(1)
            .exec();

        return photos.length > 0 ? photos[0].toJSON() : null;
    } catch (error) {
        console.error('Error getting group photo:', error);
        return null;
    }
}

// Subscribe to changes
export async function subscribeToRecoveries(groupId, callback) {
    if (!recoveryDB) {
        await initRecoveryDB();
    }

    // Ensure collections are ready
    if (!recoveryDB || !recoveryDB.recoveries) {
        console.error('Database or recoveries collection not initialized');
        return null;
    }

    try {
        return recoveryDB.recoveries
            .find({
                selector: { groupId },
            })
            .$.subscribe((recoveries) => {
                callback(recoveries.map((r) => r.toJSON()));
            });
    } catch (error) {
        console.error('Error subscribing to recoveries:', error);
        return null;
    }
}

