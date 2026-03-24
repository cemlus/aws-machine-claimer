import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function MachineList({ machines, onSelect, selectedInstanceId }) {
    if (machines.length === 0) {
        return (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700", children: "No machines available." }));
    }
    return (_jsxs("div", { className: "bg-white rounded-lg border border-gray-200 overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-12 gap-4 p-4 bg-gray-50 font-semibold text-sm text-gray-600", children: [_jsx("div", { className: "col-span-5", children: "Instance ID" }), _jsx("div", { className: "col-span-4", children: "Public IP" }), _jsx("div", { className: "col-span-3", children: "Status" })] }), machines.map((machine) => (_jsxs("div", { className: `grid grid-cols-12 gap-4 p-4 border-t border-gray-200 cursor-pointer hover:bg-gray-50 ${selectedInstanceId === machine.instanceId ? 'bg-blue-50' : ''}`, onClick: () => onSelect?.(machine), children: [_jsx("div", { className: "col-span-5 font-mono text-sm", children: machine.instanceId }), _jsx("div", { className: "col-span-4 font-mono text-sm", children: machine.publicIp || '-' }), _jsx("div", { className: "col-span-3", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-medium ${machine.status === 'available'
                                ? 'bg-green-100 text-green-700'
                                : machine.status === 'leased'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'}`, children: machine.status }) })] }, machine.instanceId)))] }));
}
//# sourceMappingURL=MachineList.js.map