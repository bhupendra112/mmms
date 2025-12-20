import React from "react";
import { AlertCircle, X, RefreshCw } from "lucide-react";
import { getErrorMessage, getErrorTitle, getErrorType } from "../../utils/errorHandler";

export default function ErrorMessage({ error, onDismiss, onRetry, className = "" }) {
    if (!error) return null;

    const message = getErrorMessage(error);
    const title = getErrorTitle(error);
    const type = getErrorType(error);

    // Determine color scheme based on error type
    const getColorClasses = () => {
        switch (type) {
            case "client":
                return "bg-red-50 border-red-200 text-red-800";
            case "server":
                return "bg-orange-50 border-orange-200 text-orange-800";
            case "network":
                return "bg-yellow-50 border-yellow-200 text-yellow-800";
            default:
                return "bg-red-50 border-red-200 text-red-800";
        }
    };

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-lg border ${getColorClasses()} ${className}`}
        >
            <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
                <div className="font-semibold mb-1">{title}</div>
                <div className="text-sm">{message}</div>
            </div>
            <div className="flex items-center gap-2">
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="Retry"
                    >
                        <RefreshCw size={16} />
                    </button>
                )}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="p-1 hover:bg-black/10 rounded transition-colors"
                        title="Dismiss"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}

