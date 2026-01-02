# Loader and Error Handling Migration Guide

This guide explains how to update all screens to use the centralized Loader and ErrorMessage components.

## Quick Start

### Step 1: Import Required Components

```jsx
import Loader, { OverlayLoader, InlineLoader } from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useApiCall } from "../../hooks/useApiCall";
// OR use handleApiError directly:
import { handleApiError } from "../../utils/apiErrorHandler";
```

### Step 2: Replace Loading State

**Before:**
```jsx
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  try {
    setLoading(true);
    await apiCall();
  } catch (error) {
    alert(error.message);
  } finally {
    setLoading(false);
  }
};
```

**After (Option 1 - Using Hook):**
```jsx
const { loading, error, execute, clearError } = useApiCall({
  defaultErrorMessage: "Failed to perform action. Please try again.",
});

const handleSubmit = async () => {
  const result = await execute(() => apiCall());
  if (result.success) {
    // Handle success
  }
};
```

**After (Option 2 - Manual):**
```jsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const handleSubmit = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await apiCall();
    if (response.success) {
      // Handle success
    } else {
      const errorInfo = handleApiError(
        { message: response.message },
        { defaultMessage: "Failed to perform action." }
      );
      setError(errorInfo);
    }
  } catch (err) {
    const errorInfo = handleApiError(err, {
      defaultErrorMessage: "An error occurred. Please try again.",
    });
    setError(errorInfo);
  } finally {
    setLoading(false);
  }
};
```

### Step 3: Add Loader and Error Components to JSX

**Before:**
```jsx
{loading && <p>Loading...</p>}
{error && <div className="error">{error}</div>}
```

**After:**
```jsx
{error && error.shouldShow && (
  <div className="mb-6">
    <ErrorMessage 
      error={error} 
      onDismiss={() => setError(null)} 
      onRetry={handleSubmit}
    />
  </div>
)}

<div className="relative">
  <OverlayLoader loading={loading} message="Loading..." />
  {/* Your content here */}
</div>
```

## Migration Patterns

### Pattern 1: Simple API Call

**File:** `screens/admin/CreateGroup.jsx` (Already migrated)

### Pattern 2: Multiple API Calls

**File:** `screens/GroupBankMaster.jsx` (Already migrated)

### Pattern 3: Data Loading on Mount

```jsx
useEffect(() => {
  const loadData = async () => {
    const result = await execute(() => getData());
    if (result.success) {
      setData(result.data);
    }
  };
  loadData();
}, []);
```

### Pattern 4: Form Submission

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  const result = await execute(() => submitForm(formData));
  if (result.success) {
    // Reset form or navigate
  }
};
```

### Pattern 5: Multiple Loading States

```jsx
const [loadingStates, setLoadingStates] = useState({
  groups: false,
  members: false,
  banks: false,
});

const loadGroups = async () => {
  setLoadingStates(prev => ({ ...prev, groups: true }));
  try {
    // API call
  } finally {
    setLoadingStates(prev => ({ ...prev, groups: false }));
  }
};
```

## Files to Update

### High Priority (Frequently Used)
1. ✅ `screens/admin/FinancialReports.jsx` - Already updated
2. ✅ `screens/admin/CreateGroup.jsx` - Already updated
3. ✅ `screens/GroupBankMaster.jsx` - Already updated
4. ⏳ `screens/admin/GroupManagement.jsx` - Needs update
5. ⏳ `screens/admin/BankDetails.jsx` - Needs update
6. ⏳ `screens/admin/AdminMembers.jsx` - Needs update
7. ⏳ `screens/admin/ApprovalManagement.jsx` - Needs update
8. ⏳ `screens/admin/CashToBankConversion.jsx` - Needs update
9. ⏳ `screens/admin/ExpenseManagement.jsx` - Needs update
10. ⏳ `screens/admin/PaymentManagement.jsx` - Needs update
11. ⏳ `screens/admin/LoanManagement.jsx` - Needs update
12. ⏳ `screens/admin/LoanTaking.jsx` - Needs update

### Medium Priority
13. ⏳ `screens/MemberRegistration.jsx`
14. ⏳ `screens/Members.jsx`
15. ⏳ `screens/group/DemandRecovery.jsx`
16. ⏳ `screens/group/LoanManagement.jsx`
17. ⏳ `screens/group/LoanTaking.jsx`
18. ⏳ `screens/group/PaymentManagement.jsx`
19. ⏳ `screens/GroupProfile.jsx`
20. ⏳ `screens/GroupLedger.jsx`

### Low Priority (Login/Registration)
21. ⏳ `screens/LoginAdmin.jsx`
22. ⏳ `screens/LoginGroup.jsx`
23. ⏳ `screens/RegisterAdmin.jsx`

## Component Variants

### 1. Full Screen Loader
```jsx
<Loader loading={loading} message="Loading..." fullScreen={true} />
```

### 2. Overlay Loader (Recommended for content areas)
```jsx
<div className="relative">
  <OverlayLoader loading={loading} message="Loading data..." />
  {/* Your content */}
</div>
```

### 3. Inline Loader (For buttons/small areas)
```jsx
<button disabled={loading}>
  <InlineLoader loading={loading} message="Saving..." />
  {!loading && "Submit"}
</button>
```

### 4. Error Message with Retry
```jsx
<ErrorMessage 
  error={error}
  onDismiss={() => setError(null)}
  onRetry={handleRetry}
/>
```

## Best Practices

1. **Always use `error.shouldShow`** before displaying errors
2. **Use OverlayLoader** for content areas that are loading
3. **Use InlineLoader** for buttons and small UI elements
4. **Provide retry functionality** for failed operations
5. **Clear errors** when user takes action or new operation starts
6. **Use the hook** (`useApiCall`) for simpler code
7. **Use manual handling** for complex scenarios with multiple states

## Testing Checklist

After migration, verify:
- [ ] Loader shows during API calls
- [ ] Error messages display correctly
- [ ] Retry functionality works
- [ ] Errors can be dismissed
- [ ] Loading states don't block UI unnecessarily
- [ ] Error messages are user-friendly
- [ ] 401 errors redirect to login (automatic)

## Example: Complete Migration

**Before:**
```jsx
function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiCall();
      if (response.success) {
        // Success
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {loading && <p>Loading...</p>}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

**After:**
```jsx
import Loader, { OverlayLoader } from "../../components/common/Loader";
import ErrorMessage from "../../components/common/ErrorMessage";
import { useApiCall } from "../../hooks/useApiCall";

function MyComponent() {
  const { loading, error, execute, clearError } = useApiCall({
    defaultErrorMessage: "Failed to submit. Please try again.",
  });

  const handleSubmit = async () => {
    const result = await execute(() => apiCall());
    if (result.success) {
      // Success
    }
  };

  return (
    <div>
      {error && error.shouldShow && (
        <ErrorMessage 
          error={error} 
          onDismiss={clearError} 
          onRetry={handleSubmit}
        />
      )}
      <div className="relative">
        <OverlayLoader loading={loading} message="Submitting..." />
        <button onClick={handleSubmit} disabled={loading}>
          Submit
        </button>
      </div>
    </div>
  );
}
```

## Need Help?

Refer to:
- `ERROR_HANDLING_GUIDE.md` - Detailed error handling documentation
- `screens/admin/FinancialReports.jsx` - Complete example
- `screens/admin/CreateGroup.jsx` - Form submission example
- `screens/GroupBankMaster.jsx` - Multiple API calls example

