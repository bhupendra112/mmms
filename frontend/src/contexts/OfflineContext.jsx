/**
 * Offline-First Context Provider
 * 
 * Provides offline-first capabilities to all components:
 * - Pre-sync status
 * - Network status
 * - Sync status
 * - Repository access
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { executePreSync, getPreSyncStatus } from '../database/preSync';
import syncManager from '../database/syncEngine';
import networkService from '../services/networkService';
import db from '../database/db';

const OfflineContext = createContext(null);

export function useOffline() {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within OfflineProvider');
    }
    return context;
}

export function OfflineProvider({ children }) {
    const [preSyncStatus, setPreSyncStatus] = useState({
        completed: false,
        inProgress: false,
        error: null,
        progress: {},
    });

    const [networkStatus, setNetworkStatus] = useState({
        isOnline: navigator.onLine,
    });

    const [syncStatus, setSyncStatus] = useState({
        isSyncing: false,
        pending: 0,
        processed: 0,
        total: 0,
    });

    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const prevOnlineRef = useRef(null);

    // Check pre-sync status on mount
    useEffect(() => {
        checkPreSyncStatus();
    }, []);

    // Subscribe to network status; when offline→online on group panel, refresh all master data
    useEffect(() => {
        const unsubscribe = networkService.onStatusChange(async (isOnline) => {
            const prevOnline = prevOnlineRef.current;
            prevOnlineRef.current = isOnline;
            setNetworkStatus({ isOnline });

            if (isOnline) {
                syncManager.startAutoSync();
                const path = typeof window !== 'undefined' ? window.location?.pathname || '' : '';
                const isGroupRoute = path.startsWith('/group') && !path.startsWith('/group/login');
                const transitionFromOffline = prevOnline === false;

                if (isGroupRoute && transitionFromOffline) {
                    try {
                        // First, sync pending loan, FD, and recovery approvals to repository (so they get added to sync_queue)
                        const { syncPendingLoanApprovals, syncPendingFDApprovals, syncPendingRecoveryApprovals } = await import('../services/approvalDB');
                        await syncPendingLoanApprovals();
                        await syncPendingFDApprovals();
                        await syncPendingRecoveryApprovals();

                        await executePreSync();
                        await syncManager.syncNow();
                        setLastRefreshedAt(Date.now());
                    } catch (err) {
                        console.error('Refresh on online failed:', err);
                        try { 
                            await syncManager.syncNow();
                        } catch (e) { 
                            console.error('Sync failed:', e); 
                        }
                    }
                } else {
                    // Also sync pending loan, FD, and recovery approvals for non-group routes
                    try {
                        const { syncPendingLoanApprovals, syncPendingFDApprovals, syncPendingRecoveryApprovals } = await import('../services/approvalDB');
                        await syncPendingLoanApprovals();
                        await syncPendingFDApprovals();
                        await syncPendingRecoveryApprovals();
                    } catch (e) {
                        console.error('Error syncing pending approvals:', e);
                    }
                    syncManager.syncNow().catch(err => console.error('Auto-sync failed:', err));
                }
            }
        });

        return unsubscribe;
    }, []);

    // Subscribe to sync status
    useEffect(() => {
        const unsubscribe = syncManager.onSyncStatusChange((data) => {
            if (data.authRequired) {
                // Handle auth error - redirect to login
                const isGroupRoute = window.location.pathname.startsWith('/group');
                if (isGroupRoute) {
                    window.location.href = '/login';
                } else {
                    window.location.href = '/login-admin';
                }
                return;
            }

            setSyncStatus(prev => ({
                ...prev,
                isSyncing: data.syncing || false,
                processed: data.processed || prev.processed,
                total: data.total || prev.total,
            }));
        });

        // Load initial sync stats
        loadSyncStats();

        // Start auto-sync if online
        if (networkStatus.isOnline) {
            syncManager.startAutoSync();
        }

        return () => {
            unsubscribe();
            syncManager.stopAutoSync();
        };
    }, [networkStatus.isOnline]);

    // Periodic sync stats update
    useEffect(() => {
        const interval = setInterval(loadSyncStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const checkPreSyncStatus = async () => {
        try {
            const status = await getPreSyncStatus();
            setPreSyncStatus({
                completed: status.completed,
                inProgress: false,
                error: status.error,
                progress: {},
            });
        } catch (error) {
            setPreSyncStatus(prev => ({
                ...prev,
                error: error.message,
            }));
        }
    };

    const loadSyncStats = async () => {
        try {
            const stats = await syncManager.getStats();
            setSyncStatus(prev => ({
                ...prev,
                pending: stats.pending,
                isSyncing: stats.isSyncing,
            }));
        } catch (error) {
            console.error('Failed to load sync stats:', error);
        }
    };

    const startPreSync = useCallback(async (onProgress) => {
        setPreSyncStatus(prev => ({
            ...prev,
            inProgress: true,
            error: null,
            progress: {},
        }));

        try {
            const progressTracker = {};
            
            const results = await executePreSync((key, status, data) => {
                progressTracker[key] = { status, ...data };
                setPreSyncStatus(prev => ({
                    ...prev,
                    progress: { ...progressTracker },
                }));
                onProgress?.(key, status, data);
            });

            setPreSyncStatus({
                completed: results.success,
                inProgress: false,
                error: results.error || null,
                progress: progressTracker,
            });

            // Start auto-sync after pre-sync completes
            if (results.success && networkStatus.isOnline) {
                syncManager.startAutoSync();
            }

            return results;
        } catch (error) {
            setPreSyncStatus(prev => ({
                ...prev,
                inProgress: false,
                error: error.message,
            }));
            throw error;
        }
    }, [networkStatus.isOnline]);

    const triggerSync = useCallback(async () => {
        if (!networkStatus.isOnline) {
            throw new Error('Cannot sync while offline');
        }
        return await syncManager.syncNow();
    }, [networkStatus.isOnline]);

    const triggerRefresh = useCallback(async () => {
        if (!networkStatus.isOnline) {
            throw new Error('Cannot refresh while offline');
        }
        try {
            await executePreSync();
            setLastRefreshedAt(Date.now());
        } catch (e) {
            throw e;
        }
    }, [networkStatus.isOnline]);

    const value = {
        // Pre-sync
        preSyncCompleted: preSyncStatus.completed,
        preSyncInProgress: preSyncStatus.inProgress,
        preSyncError: preSyncStatus.error,
        preSyncProgress: preSyncStatus.progress,
        startPreSync,
        checkPreSyncStatus,

        // Network
        isOnline: networkStatus.isOnline,
        lastRefreshedAt,

        // Sync
        isSyncing: syncStatus.isSyncing,
        syncPending: syncStatus.pending,
        triggerSync,
        triggerRefresh,

        // Database
        db,
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
}

export default OfflineContext;
