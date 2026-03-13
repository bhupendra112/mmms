/**
 * Pre-Sync Blocker Component
 * 
 * Blocks application usage until pre-sync is completed.
 * Shows progress during pre-sync.
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOffline } from '../contexts/OfflineContext';

export default function PreSyncBlocker({ children }) {
    const location = useLocation();
    const {
        preSyncCompleted,
        preSyncInProgress,
        preSyncError,
        preSyncProgress,
        startPreSync,
        checkPreSyncStatus,
    } = useOffline();

    const [retrying, setRetrying] = useState(false);

    // List of routes that should bypass pre-sync check (auth routes)
    const authRoutes = [
        '/login-admin',
        '/group/login',
        '/supervisor/login',
    ];

    // Check if current route is an auth route or admin/supervisor route
    const isAuthRoute = authRoutes.some(route => location.pathname === route || location.pathname.startsWith(route));
    const isAdminRoute = location.pathname.startsWith('/admin');
    const isSupervisorRoute = location.pathname.startsWith('/supervisor');

    useEffect(() => {
        // Check pre-sync status on mount
        checkPreSyncStatus();
    }, [checkPreSyncStatus]);

    // Auto-start pre-sync if not completed and not in progress (but skip if on auth route or admin/supervisor route)
    useEffect(() => {
        if (!isAuthRoute && !isAdminRoute && !isSupervisorRoute && !preSyncCompleted && !preSyncInProgress && !preSyncError && !retrying) {
            startPreSync().catch(err => {
                console.error('Pre-sync failed:', err);
            });
        }
    }, [isAuthRoute, isAdminRoute, isSupervisorRoute, preSyncCompleted, preSyncInProgress, preSyncError, startPreSync, retrying]);

    const handleRetry = async () => {
        setRetrying(true);
        try {
            await startPreSync();
        } catch (error) {
            console.error('Retry failed:', error);
        } finally {
            setRetrying(false);
        }
    };

    // Allow auth routes and admin/supervisor routes to pass through without pre-sync check
    if (isAuthRoute || isAdminRoute || isSupervisorRoute) {
        return <>{children}</>;
    }

    // Show children if pre-sync is completed
    if (preSyncCompleted) {
        return <>{children}</>;
    }

    // Calculate progress
    const progressEntries = Object.entries(preSyncProgress || {});
    const total = progressEntries.length;
    const completed = progressEntries.filter(([_, p]) => p.status === 'completed').length;
    const failed = progressEntries.filter(([_, p]) => p.status === 'failed').length;
    const fetching = progressEntries.filter(([_, p]) => p.status === 'fetching').length;
    const storing = progressEntries.filter(([_, p]) => p.status === 'storing').length;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4">
                <div className="text-center mb-6">
                    <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Initializing Application
                    </h1>
                    <p className="text-gray-600">
                        Loading master data for offline operation...
                    </p>
                </div>

                {/* Progress Bar */}
                {total > 0 && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">
                                Progress: {completed} / {total}
                            </span>
                            <span className="text-sm text-gray-500">
                                {Math.round((completed / total) * 100)}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${(completed / total) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Entity Status List */}
                {progressEntries.length > 0 && (
                    <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                        {progressEntries.map(([key, progress]) => {
                            let statusColor = 'text-gray-500';
                            let statusIcon = '○';

                            if (progress.status === 'completed') {
                                statusColor = 'text-green-600';
                                statusIcon = '✓';
                            } else if (progress.status === 'failed') {
                                statusColor = 'text-red-600';
                                statusIcon = '✗';
                            } else if (progress.status === 'fetching' || progress.status === 'storing') {
                                statusColor = 'text-blue-600';
                                statusIcon = '⟳';
                            }

                            return (
                                <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                    <div className="flex items-center gap-2">
                                        <span className={statusColor}>{statusIcon}</span>
                                        <span className="text-sm font-medium text-gray-700 capitalize">
                                            {key.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    {progress.count !== undefined && (
                                        <span className="text-xs text-gray-500">
                                            {progress.count} records
                                        </span>
                                    )}
                                    {progress.error && (
                                        <span className="text-xs text-red-600">
                                            {progress.error}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Error Display */}
                {preSyncError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 font-medium mb-2">
                            Pre-sync Error:
                        </p>
                        <p className="text-sm text-red-600">{preSyncError}</p>
                        <button
                            onClick={handleRetry}
                            disabled={retrying || preSyncInProgress}
                            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {retrying ? 'Retrying...' : 'Retry'}
                        </button>
                    </div>
                )}

                {/* Status Messages */}
                {preSyncInProgress && (
                    <div className="text-center text-sm text-gray-500">
                        {fetching > 0 && `Fetching data from server... (${fetching} in progress)`}
                        {fetching === 0 && storing > 0 && `Storing data locally... (${storing} in progress)`}
                        {fetching === 0 && storing === 0 && completed > 0 && 'Finalizing...'}
                    </div>
                )}

                {/* Warning */}
                {failed > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                            ⚠️ {failed} entity type(s) failed to sync. The application will continue, but some features may be limited.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
