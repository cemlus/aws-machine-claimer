import type { Machine } from '../types';

interface Props {
  machines: Machine[];
  onSelect?: (machine: Machine) => void;
  selectedInstanceId?: string;
}

export function MachineList({ machines, onSelect, selectedInstanceId }: Props) {
  if (machines.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
        No machines available.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 font-semibold text-sm text-gray-600">
        <div className="col-span-5">Instance ID</div>
        <div className="col-span-4">Public IP</div>
        <div className="col-span-3">Status</div>
      </div>
      {machines.map((machine) => (
        <div
          key={machine.instanceId}
          className={`grid grid-cols-12 gap-4 p-4 border-t border-gray-200 cursor-pointer hover:bg-gray-50 ${
            selectedInstanceId === machine.instanceId ? 'bg-blue-50' : ''
          }`}
          onClick={() => onSelect?.(machine)}
        >
          <div className="col-span-5 font-mono text-sm">{machine.instanceId}</div>
          <div className="col-span-4 font-mono text-sm">{machine.publicIp || '-'}</div>
          <div className="col-span-3">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                machine.status === 'available'
                  ? 'bg-green-100 text-green-700'
                  : machine.status === 'leased'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {machine.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
