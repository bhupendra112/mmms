// Reusable Form Components with consistent styling

export function Input({ label, name, value, handleChange, type = "text", required = false, placeholder = "", onKeyPress, disabled = false }) {
    return (
        <div className="flex flex-col">
            <label className="font-semibold mb-1.5 text-gray-700 text-sm">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type={type}
                name={name}
                value={value || ""}
                onChange={handleChange}
                onKeyPress={onKeyPress}
                required={required}
                placeholder={placeholder}
                disabled={disabled}
                className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
            />
        </div>
    );
}

export function Select({ label, name, value, options = [], handleChange, required = false }) {
    // Handle both array of strings and array of objects with {value, label}
    const getOptionValue = (opt) => {
        return typeof opt === "object" && opt !== null ? opt.value : opt;
    };

    const getOptionLabel = (opt) => {
        return typeof opt === "object" && opt !== null ? opt.label : opt;
    };

    // Check if first option has empty value (custom placeholder)
    const hasCustomPlaceholder = options.length > 0 && getOptionValue(options[0]) === "";
    const displayOptions = hasCustomPlaceholder ? options : [{ value: "", label: `Select ${label}` }, ...options];

    return (
        <div className="flex flex-col">
            <label className="font-semibold mb-1.5 text-gray-700 text-sm">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
                name={name}
                value={value || ""}
                onChange={handleChange}
                required={required}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
            >
                {displayOptions.map((opt, i) => (
                    <option key={i} value={getOptionValue(opt)}>
                        {getOptionLabel(opt)}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function TextArea({ label, name, value, handleChange, required = false, rows = 3, placeholder = "" }) {
    return (
        <div className="flex flex-col">
            <label className="font-semibold mb-1.5 text-gray-700 text-sm">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
                name={name}
                value={value || ""}
                onChange={handleChange}
                required={required}
                rows={rows}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm resize-none"
            />
        </div>
    );
}

export function FileInput({ label, name, value, handleChange, required = false, accept = "" }) {
    return (
        <div className="flex flex-col">
            <label className="font-semibold mb-1.5 text-gray-700 text-sm">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
                type="file"
                name={name}
                onChange={handleChange}
                accept={accept}
                required={required}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {value && (
                <p className="mt-2 text-sm text-green-600">
                    File Selected: {value.name || value}
                </p>
            )}
        </div>
    );
}

export function FormSection({ title, icon: Icon, children }) {
    return (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            {title && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-300">
                    {Icon && <Icon size={20} className="text-blue-600" />}
                    <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </div>
    );
}

