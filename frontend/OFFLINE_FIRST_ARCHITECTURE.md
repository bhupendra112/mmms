# Offline-First Architecture Documentation

## Overview

The MMMS application has been converted to a **full offline-first architecture** where IndexedDB is the single source of truth for all frontend operations. The UI never directly communicates with backend APIs - all backend communication goes through a controlled Sync Engine.

## Core Principles

1. **IndexedDB is the Single Source of Truth** - All UI operations read/write from/to IndexedDB only
2. **No Direct API Calls from UI** - Components never call `fetch()` or axios directly
3. **Background Synchronization** - Backend APIs are used exclusively for sync operations
4. **100% Offline Capability** - Application works completely without internet
5. **Zero Data Loss** - All operations are saved locally before sync
6. **Auto-Sync on Reconnect** - Data automatically syncs when internet is restored

## Architecture Components

### 1. IndexedDB Database Schema (`database/db.js`)

The database uses Dexie and contains:

#### Master Data Stores (Read-only snapshots)
- `master_users` - User master data
- `master_groups` - Group master data
- `master_members` - Member master data
- `master_loans` - Loan master data
- `master_fds` - Fixed Deposit master data
- `master_banks` - Bank account master data
- `master_cash` - Cash amount master data
- `master_expenses` - Expense master data
- `master_payments` - Payment master data
- `master_recoveries` - Recovery master data
- And more...

#### Transactional Stores
- `transactions` - All mutable operations (CRUD)
- `sync_queue` - Ordered queue for background sync
- `sync_logs` - Audit trail of sync operations
- `documents` - PDFs, images, and files as Blobs
- `app_state` - Application-level state

### 2. Repository Pattern (`database/repository.js`)

The `BaseRepository` class provides a unified interface for all IndexedDB operations:

```javascript
import { expenseRepository } from '../database/repository';

// Create
const record = await expenseRepository.create({ amount: 100, date: '2024-01-01' });

// Read
const expenses = await expenseRepository.getMerged({ groupId: '123' });

// Update
await expenseRepository.update(uuid, { amount: 150 });

// Delete
await expenseRepository.delete(uuid);
```

**Key Methods:**
- `create(payload)` - Creates record in IndexedDB and adds to sync queue
- `update(uuid, payload)` - Updates record and queues for sync
- `delete(uuid)` - Marks as deleted and queues for sync
- `getAll(filters)` - Gets all records matching filters
- `getMerged(filters)` - Gets merged view of master data + local transactions
- `getMasterData(filters)` - Gets read-only master data snapshots

### 3. Pre-Sync System (`database/preSync.js`)

Pre-sync fetches all required master data from backend on initial load:

```javascript
import { executePreSync, isPreSyncCompleted } from '../database/preSync';

// Check if pre-sync completed
const completed = await isPreSyncCompleted();

// Execute pre-sync
await executePreSync((key, status, data) => {
    console.log(`${key}: ${status}`, data);
});
```

**Features:**
- Blocks application usage until completed
- Fetches all master data types
- Stores as read-only snapshots
- Version tracking with timestamps

### 4. Sync Engine (`database/syncEngine.js`)

The Sync Engine processes the sync queue in the background:

```javascript
import syncManager from '../database/syncEngine';

// Start auto-sync (polls every 10 seconds)
syncManager.startAutoSync();

// Manual sync
await syncManager.syncNow();

// Get sync stats
const stats = await syncManager.getStats();
```

**Features:**
- Sequential processing for data consistency
- Automatic retry with exponential backoff
- Max retry limit (5 attempts)
- Conflict resolution using timestamps
- Authentication error handling

### 5. Offline Context (`contexts/OfflineContext.jsx`)

Provides offline-first capabilities to all components:

```javascript
import { useOffline } from '../contexts/OfflineContext';

function MyComponent() {
    const {
        preSyncCompleted,
        isOnline,
        isSyncing,
        syncPending,
        triggerSync,
    } = useOffline();

    // Use offline status...
}
```

### 6. Network Service (`services/networkService.js`)

Monitors internet connectivity:

```javascript
import networkService from '../services/networkService';

networkService.onStatusChange((isOnline) => {
    console.log('Network status:', isOnline);
});
```

## Data Flow

### User Action Flow

```
User Action → Repository Method → IndexedDB → Sync Queue → Sync Engine → Backend API
                ↓
            UI Updates Immediately (from IndexedDB)
```

### Read Flow

```
UI Component → Repository.getMerged() → IndexedDB (master + transactions) → UI
```

### Sync Flow

```
Sync Engine → Get from sync_queue → Process in order → Call Backend API → Update IndexedDB → Remove from queue
```

## Migration Guide

### Step 1: Update Service Files

Replace direct API calls with repository operations:

**Before:**
```javascript
import httpExpense from '../api/httpExpense';

export const createExpense = async (data) => {
    const res = await httpExpense.post('/', data);
    return res.data;
};
```

**After:**
```javascript
import { expenseRepository } from '../database/repository';

export const createExpense = async (data) => {
    const record = await expenseRepository.create(data);
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
```

### Step 2: Update Components

Update components to use offline-first services:

**Before:**
```javascript
import { getExpenses } from '../../services/expenseService';

const loadExpenses = async () => {
    const response = await getExpenses({ groupId: currentGroup.id });
    setExpenses(response.data);
};
```

**After:**
```javascript
import { getExpenses } from '../../services/expenseServiceOffline';

// Same code works! But now reads from IndexedDB
const loadExpenses = async () => {
    const response = await getExpenses({ groupId: currentGroup.id });
    setExpenses(response.data);
};
```

### Step 3: Handle Local Indicators

You can show users which data is local vs synced:

```javascript
expenses.map(expense => (
    <div>
        {expense._isLocal && <span>⏳ Pending sync</span>}
        {expense._syncStatus === 'synced' && <span>✓ Synced</span>}
    </div>
));
```

## Example: Expense Service Migration

See `services/expenseServiceOffline.js` for a complete example of:
- Creating records
- Reading merged data
- Updating records
- Deleting records
- Searching and filtering

## API Endpoint Configuration

Add new entity types to `database/syncEngine.js`:

```javascript
const API_ENDPOINTS = {
    myNewEntity: {
        create: '/api/admin/my-entity',
        update: (id) => `/api/admin/my-entity/${id}`,
        delete: (id) => `/api/admin/my-entity/${id}`,
    },
};
```

Add to pre-sync config in `database/preSync.js`:

```javascript
const PRE_SYNC_CONFIG = {
    myNewEntity: {
        endpoint: '/api/admin/my-entity/list',
        store: 'master_my_new_entity',
        entityType: EntityTypes.MY_NEW_ENTITY,
    },
};
```

## Best Practices

1. **Always use Repository methods** - Never access IndexedDB directly from components
2. **Use getMerged() for reads** - Provides combined view of master data and local changes
3. **Handle sync status** - Show users when data is pending sync
4. **Test offline scenarios** - Disable network and verify all operations work
5. **Monitor sync queue** - Use `syncManager.getStats()` to monitor pending syncs

## Troubleshooting

### Pre-sync not completing
- Check authentication token
- Verify API endpoints are correct
- Check browser console for errors

### Sync failing
- Check network connectivity
- Verify API endpoints match backend
- Check sync logs in IndexedDB (`sync_logs` store)

### Data not appearing
- Ensure pre-sync completed
- Check if data exists in IndexedDB using browser DevTools
- Verify repository queries have correct filters

## Future Enhancements

- [ ] Conflict resolution UI
- [ ] Sync progress indicators
- [ ] Batch operations
- [ ] Selective sync (sync only specific entities)
- [ ] Offline document generation
- [ ] Data compression for large datasets

## Support

For issues or questions:
1. Check browser console for errors
2. Inspect IndexedDB in DevTools → Application → IndexedDB
3. Check sync logs in `sync_logs` store
4. Review network tab for failed API calls
