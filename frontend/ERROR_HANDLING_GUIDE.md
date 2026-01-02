# Error Handling and Loader System Guide

## Overview
This document explains the centralized error handling and loader system implemented in the frontend application.

## Components

### 1. Loader Component (`components/common/Loader.jsx`)

A reusable loader component with multiple variants:

#### Main Loader
```jsx
import Loader from "../../components/common/Loader";

<Loader 
    loading={isLoading} 
    message="Loading data..." 
    size="md" // 'sm', 'md', 'lg'
    fullScreen={false}
/>
```

#### Inline Loader
```jsx
import { InlineLoader } from "../../components/common/Loader";

<InlineLoader 
    loading={isLoading} 
    message="Saving..." 
    size="sm"
/>
```

#### Overlay Loader
```jsx
import { OverlayLoader } from "../../components/common/Loader";

<div className="relative">
    <OverlayLoader loading={isLoading} message="Loading report..." />
    {/* Your content here */}
</div>
```

### 2. Error Message Component (`components/common/ErrorMessage.jsx`)

Displays user-friendly error messages with retry and dismiss options:

```jsx
import ErrorMessage from "../../components/common/ErrorMessage";

<ErrorMessage 
    error={errorObject} 
    onDismiss={() => setError(null)}
    onRetry={handleRetry}
/>
```

## Utilities

### 1. API Error Handler (`utils/apiErrorHandler.js`)

Centralized error handling for all API calls:

```jsx
import { handleApiError } from "../../utils/apiErrorHandler";

try {
    const response = await apiCall();
    // Handle success
} catch (error) {
    const errorInfo = handleApiError(error, {
        defaultMessage: "Failed to load data.",
        on401: (err) => {
            // Handle 401 before redirect
        },
        onError: (err, info) => {
            // Custom error handling
        }
    });
    
    if (errorInfo.shouldShow) {
        setError(errorInfo);
    }
}
```

### 2. Error Handler Utilities (`utils/errorHandler.js`)

Helper functions for error processing:

- `getErrorMessage(error)` - Extract user-friendly error message
- `getErrorTitle(error)` - Get error title based on status code
- `getErrorType(error)` - Determine error type (client/server/network)
- `shouldRedirectToLogin(error)` - Check if 401 redirect needed
- `shouldShowError(error)` - Determine if error should be displayed

## Usage Pattern

### Standard API Call with Loading and Error Handling

```jsx
import { useState } from "react";
import Loader, { OverlayLoader } from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { handleApiError } from "../../utils/apiErrorHandler";

function MyComponent() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await apiCall();
            
            if (response.success) {
                setData(response.data);
            } else {
                const errorInfo = handleApiError(
                    { message: response.message },
                    { defaultMessage: "Failed to load data." }
                );
                setError(errorInfo);
            }
        } catch (err) {
            const errorInfo = handleApiError(err, {
                defaultMessage: "An error occurred. Please try again.",
            });
            setError(errorInfo);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            {error && error.shouldShow && (
                <ErrorMessage 
                    error={error}
                    onDismiss={() => setError(null)}
                    onRetry={loadData}
                />
            )}
            
            <OverlayLoader loading={loading} message="Loading..." />
            
            {data && (
                <div>
                    {/* Your content */}
                </div>
            )}
        </div>
    );
}
```

## Error Types

The system categorizes errors into types:

1. **Client Errors (4xx)**: Bad requests, validation errors, etc.
   - Color: Red
   - User action: Check input and retry

2. **Server Errors (5xx)**: Internal server errors, service unavailable
   - Color: Orange
   - User action: Wait and retry

3. **Network Errors**: Connection issues, timeouts
   - Color: Yellow
   - User action: Check internet connection

4. **Auth Errors (401)**: Session expired
   - Automatically redirects to login
   - Error not shown to user

## Best Practices

1. **Always use `handleApiError`** for consistent error handling
2. **Show loaders during API calls** to provide user feedback
3. **Use OverlayLoader** for content areas that are loading
4. **Provide retry functionality** for failed requests
5. **Dismiss errors** when user takes action
6. **Check `error.shouldShow`** before displaying errors

## Example: Financial Reports Screen

The `FinancialReports.jsx` component demonstrates the complete pattern:

- Separate loading states for different operations
- Overlay loaders for report content
- Error messages with retry functionality
- Proper error handling for all API calls

