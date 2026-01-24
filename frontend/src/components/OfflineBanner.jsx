/**
 * Offline Banner Component
 * 
 * Shows banner when offline and displays sync status.
 */

import React from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

export default function OfflineBanner() {
    const {
        isOnline,
        isSyncing,
        syncPending,
        triggerSync,
    } = useOffline();

    const handleSync = async () => {
        if (!isOnline) {
            return;
        }
        try {
            await triggerSync();
        } catch (error) {
            console.error('Manual sync failed:', error);
        }
    };

    if (isOnline && syncPending === 0) {
        // All synced, show subtle success indicator
        return (
            <div className="bg-green-50 border-b border-green-200 px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">All data synchronized</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!isOnline) {
        return (
            <div className="bg-red-50 border-b border-red-200 px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-700">
                        <WifiOff size={16} />
                        <span className="text-sm font-medium">
                            You are offline. Working in offline mode. Changes will sync when connection is restored.
                        </span>
                    </div>
                    {syncPending > 0 && (
                        <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                            {syncPending} pending
                        </span>
                    )}
                </div>
            </div>
        );
    }

    if (syncPending > 0) {
        return (
            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-700">
                        <Wifi size={16} />
                        <span className="text-sm font-medium">
                            {isSyncing ? (
                                <>
                                    <RefreshCw size={14} className="inline animate-spin mr-1" />
                                    Syncing {syncPending} change(s)...
                                </>
                            ) : (
                                <>
                                    {syncPending} change(s) pending sync
                                </>
                            )}
                        </span>
                    </div>
                    {!isSyncing && (
                        <button
                            onClick={handleSync}
                            className="text-xs text-yellow-700 hover:text-yellow-900 underline"
                        >
                            Sync now
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
