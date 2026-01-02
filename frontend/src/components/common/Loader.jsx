import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Reusable Loader Component
 * @param {Object} props
 * @param {boolean} props.loading - Whether to show the loader
 * @param {string} props.message - Optional message to display with loader
 * @param {string} props.size - Size of loader: 'sm', 'md', 'lg' (default: 'md')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.fullScreen - Whether to show full screen overlay (default: false)
 * @param {React.ReactNode} props.children - Content to show when loading (optional)
 */
export default function Loader({
    loading,
    message = "Loading...",
    size = "md",
    className = "",
    fullScreen = false,
    children = null,
}) {
    if (!loading) {
        return children || null;
    }

    const sizeClasses = {
        sm: "w-4 h-4",
        md: "w-8 h-8",
        lg: "w-12 h-12",
    };

    const spinnerSize = sizeClasses[size] || sizeClasses.md;

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-4 min-w-[200px]">
                    <Loader2 className={`${spinnerSize} animate-spin text-blue-600`} />
                    {message && <p className="text-gray-700 font-medium">{message}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}>
            <Loader2 className={`${spinnerSize} animate-spin text-blue-600`} />
            {message && <p className="text-gray-600 text-sm">{message}</p>}
        </div>
    );
}

/**
 * Inline Loader - For inline loading states
 */
export function InlineLoader({ loading, message, size = "sm", className = "" }) {
    if (!loading) return null;

    const sizeClasses = {
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-6 h-6",
    };

    const spinnerSize = sizeClasses[size] || sizeClasses.sm;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Loader2 className={`${spinnerSize} animate-spin text-blue-600`} />
            {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
    );
}

/**
 * Overlay Loader - For loading overlays on specific content areas
 */
export function OverlayLoader({ loading, message, className = "" }) {
    if (!loading) return null;

    return (
        <div className={`absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg ${className}`}>
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                {message && <p className="text-gray-700 font-medium text-sm">{message}</p>}
            </div>
        </div>
    );
}

