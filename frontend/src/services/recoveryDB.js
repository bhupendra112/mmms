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
        // Create database
        const db = await createRxDatabase({
            name: 'recoverydb',
            storage: getRxStorageDexie(),
            ignoreDuplicate: true,
        });

        if (!db) {
            throw new Error('Failed to create database');
        }

        // Add collections - RxDB 15 returns collections and adds them to db
        let collections;
        try {
            collections = await db.addCollections({
                recoveries: {
                    schema: recoverySchema,
                },
                groupPhotos: {
                    schema: groupPhotoSchema,
                },
            });
        } catch (addError) {
            // If collections already exist, they should be on db object
            console.warn('Collections might already exist, checking db object:', addError.message);
        }

        // In RxDB 15, collections are automatically added to db object as read-only properties
        // They are also returned from addCollections
        // Collections are accessible via db.recoveries and db.groupPhotos (read-only getters)
        // Wait a moment for collections to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify collections are accessible (they should be read-only properties on db)
        if (!db.recoveries || !db.groupPhotos) {
            // Log for debugging
            console.error('Collections not found:', {
                hasCollections: !!collections,
                hasRecoveriesInCollections: !!collections?.recoveries,
                hasPhotosInCollections: !!collections?.groupPhotos,
                hasDbRecoveries: !!db.recoveries,
                hasDbPhotos: !!db.groupPhotos,
                dbKeys: db ? Object.keys(db) : 'no db',
            });
            throw new Error('Collections not accessible after addCollections');
        }

        recoveryDB = db;
        console.log('✅ Recovery Database initialized successfully');
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

