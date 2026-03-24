import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FleetStatus({ status, loading }) {
    if (loading) {
        return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-8", children: [1, 2, 3].map((i) => (_jsxs("div", { className: "bg-gray-100 rounded-lg p-6 animate-pulse", children: [_jsx("div", { className: "h-4 bg-gray-200 rounded w-1/2 mb-2" }), _jsx("div", { className: "h-8 bg-gray-300 rounded w-1/3" })] }, i))) }));
    }
    if (!status)
        return null;
    const cards = [
        { label: 'Available', value: status.available, color: 'bg-green-50 border-green-200 text-green-700' },
        { label: 'Leased', value: status.leased, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        { label: 'Total', value: status.total, color: 'bg-gray-50 border-gray-200 text-gray-700' },
    ];
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-8", children: cards.map((card) => (_jsxs("div", { className: `rounded-lg border-2 p-6 ${card.color}`, children: [_jsx("div", { className: "text-sm font-medium uppercase tracking-wide", children: card.label }), _jsx("div", { className: "text-4xl font-bold mt-2", children: card.value })] }, card.label))) }));
}
//# sourceMappingURL=FleetStatus.js.map