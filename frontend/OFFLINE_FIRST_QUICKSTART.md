# Offline-First Architecture - Quick Start Guide

## 🚀 Getting Started

The MMMS application now runs **100% offline-first**. Here's how to use it:

### 1. Application Startup Flow

1. **Pre-Sync** - On first load, the app fetches all master data from backend
2. **Offline Mode** - Once pre-sync completes, the app works completely offline
3. **Auto-Sync** - Changes sync to backend automatically when online

### 2. Using the System

#### For Users
- ✅ Work completely offline - no internet required
- ✅ All operations save instantly locally
- ✅ Changes sync automatically when online
- ✅ See sync status with the banner at top

#### For Developers

### Creating a New Service (Offline-First)

**Step 1: Create Repository Instance**

```javascript
// In database/repository.js, add:
export const myEntityRepository = createRepository('my_entity', EntityTypes.MY_ENTITY);
```

**Step 2: Create Service File**

```javascript
// services/myEntityServiceOffline.js
import { myEntityRepository } from '../database/repository';

export const createMyEntity = async (data) => {
    const record = await myEntityRepository.create(data);
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

export const getMyEntities = async (filters = {}) => {
    const entities = await myEntityRepository.getMerged(filters);
    return {
        success: true,
        data: entities,
    };
};
```

**Step 3: Update Component**

```javascript
// Simply replace the import:
// Before: import { createMyEntity } from '../../services/myEntityService';
// After:
import { createMyEntity } from '../../services/myEntityServiceOffline';

// Rest of the code works exactly the same!
```

**Step 4: Configure API Endpoints**

Add to `database/syncEngine.js`:

```javascript
const API_ENDPOINTS = {
    my_entity: {
        create: '/api/admin/my-entity',
        update: (id) => `/api/admin/my-entity/${id}`,
        delete: (id) => `/api/admin/my-entity/${id}`,
    },
};
```

**Step 5: Configure Pre-Sync**

Add to `database/preSync.js`:

```javascript
const PRE_SYNC_CONFIG = {
    myEntity: {
        endpoint: '/api/admin/my-entity/list',
        store: 'master_my_entity',
        entityType: EntityTypes.MY_ENTITY,
    },
};
```

### 3. Key Concepts

#### Repository Pattern
- **create()** - Save to IndexedDB, queue for sync
- **update()** - Update IndexedDB, queue for sync
- **delete()** - Mark deleted, queue for sync
- **getAll()** - Get all records from IndexedDB
- **getMerged()** - Get master data + local changes combined

#### Sync Status
- `pending` - Waiting to sync
- `syncing` - Currently syncing
- `synced` - Successfully synced
- `failed` - Sync failed (will retry)

#### Data Flow
```
User Action → Repository → IndexedDB → Sync Queue → Sync Engine → Backend
                      ↓
                  UI Updates Immediately
```

### 4. Testing Offline Mode

1. Open browser DevTools
2. Go to Network tab
3. Select "Offline" checkbox
4. Try creating/updating records
5. All operations should work instantly
6. Re-enable network - data syncs automatically

### 5. Debugging

#### Check IndexedDB
1. Open DevTools → Application → IndexedDB
2. View `MMMSOfflineDB` database
3. Check `transactions` store for local data
4. Check `sync_queue` for pending syncs

#### Check Sync Status
```javascript
import syncManager from './database/syncEngine';

const stats = await syncManager.getStats();
console.log('Sync stats:', stats);
```

#### Manual Sync
```javascript
import { useOffline } from './contexts/OfflineContext';

const { triggerSync } = useOffline();
await triggerSync();
```

### 6. Migration Checklist

For each module:
- [ ] Create offline-first service file
- [ ] Update service to use repository
- [ ] Add API endpoints to syncEngine
- [ ] Add to pre-sync config
- [ ] Update component imports
- [ ] Test offline functionality
- [ ] Test sync functionality

### 7. Common Patterns

#### Show Sync Status in UI
```javascript
{expense._isLocal && (
    <span className="text-yellow-600">⏳ Pending sync</span>
)}
{expense._syncStatus === 'synced' && (
    <span className="text-green-600">✓ Synced</span>
)}
```

#### Handle Offline Errors
```javascript
const { isOnline } = useOffline();

if (!isOnline) {
    alert('Working offline. Changes will sync when connection is restored.');
}
```

#### Filter by Sync Status
```javascript
const pendingExpenses = await expenseRepository.getAll({
    syncStatus: 'pending'
});
```

## 📚 Full Documentation

See `OFFLINE_FIRST_ARCHITECTURE.md` for complete documentation.

## 🆘 Troubleshooting

**Pre-sync not starting?**
- Check authentication token
- Verify API endpoints
- Check browser console

**Sync failing?**
- Check network connectivity
- Verify API endpoints match backend
- Check sync logs in IndexedDB

**Data not appearing?**
- Ensure pre-sync completed
- Check IndexedDB in DevTools
- Verify repository queries
