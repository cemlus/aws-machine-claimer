import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function ClaimForm({ onClaim, claiming, disabled }) {
    const [userId, setUserId] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId.trim())
            return;
        await onClaim(userId.trim());
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "bg-white rounded-lg border border-gray-200 p-6 mb-8", children: [_jsx("h2", { className: "text-xl font-bold text-gray-800 mb-4", children: "Claim a Machine" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("input", { type: "text", value: userId, onChange: (e) => setUserId(e.target.value), placeholder: "Enter your user ID", className: "flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none", disabled: disabled || claiming }), _jsx("button", { type: "submit", disabled: disabled || claiming || !userId.trim(), className: "px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition", children: claiming ? 'Claiming...' : 'Claim' })] })] }));
}
//# sourceMappingURL=ClaimForm.js.map