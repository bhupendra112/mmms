/**
 * Network Status Monitoring Service
 * 
 * Monitors internet connectivity and provides reactive updates.
 */

class NetworkService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = new Set();
        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners(true);
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners(false);
        });
    }

    /**
     * Subscribe to network status changes
     * @param {Function} callback - Callback function (isOnline) => void
     * @returns {Function} Unsubscribe function
     */
    onStatusChange(callback) {
        this.listeners.add(callback);
        // Immediately call with current status
        callback(this.isOnline);
        
        return () => {
            this.listeners.delete(callback);
        };
    }

    notifyListeners(isOnline) {
        this.listeners.forEach(callback => {
            try {
                callback(isOnline);
            } catch (error) {
                console.error('Error in network status listener:', error);
            }
        });
    }

    /**
     * Get current network status
     */
    getStatus() {
        return this.isOnline;
    }

    /**
     * Check if online (with promise-based API)
     */
    async checkConnectivity() {
        if (!navigator.onLine) {
            return false;
        }

        // Optional: ping a lightweight endpoint to verify connectivity
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            await fetch('/ping', {
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-cache',
            });
            
            clearTimeout(timeoutId);
            return true;
        } catch {
            // If ping fails, still trust navigator.onLine
            return navigator.onLine;
        }
    }
}

// Create singleton instance
export const networkService = new NetworkService();

export default networkService;
