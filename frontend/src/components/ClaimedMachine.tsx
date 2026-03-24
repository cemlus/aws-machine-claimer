import type { Machine } from '../types';

interface Props {
  machine: Machine;
  onRelease: () => void;
  onRenew: () => void;
  releasing: boolean;
  renewing: boolean;
}

export function ClaimedMachine({ machine, onRelease, onRenew, releasing, renewing }: Props) {
  const formatDate = (ts: number | null) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString();
  };

  const codeServerUrl = machine.publicIp ? `http://${machine.publicIp}:8080` : null;
  const sshCommand = machine.publicIp ? `ssh ubuntu@${machine.publicIp}` : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Claimed Machine</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-sm text-gray-500">Instance ID</div>
          <div className="font-mono text-sm font-medium">{machine.instanceId}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">User ID</div>
          <div className="font-mono text-sm font-medium">{machine.userId || 'N/A'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Public IP</div>
          <div className="font-mono text-sm font-medium">{machine.publicIp || 'N/A'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Private IP</div>
          <div className="font-mono text-sm font-medium">{machine.privateIp || 'N/A'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Lease Expires</div>
          <div className="font-mono text-sm font-medium">{formatDate(machine.leaseExpiry)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Last Heartbeat</div>
          <div className="font-mono text-sm font-medium">{formatDate(machine.lastHeartbeat)}</div>
        </div>
      </div>

      {codeServerUrl && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">Code Server URL</div>
          <a href={codeServerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
            {codeServerUrl}
          </a>
        </div>
      )}

      {sshCommand && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">SSH Command</div>
          <code className="font-mono text-sm">{sshCommand}</code>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRenew}
          disabled={renewing}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg font-medium transition"
        >
          {renewing ? 'Renewing...' : 'Renew Lease (+10 min)'}
        </button>
        <button
          onClick={onRelease}
          disabled={releasing}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium transition"
        >
          {releasing ? 'Releasing...' : 'Release Machine'}
        </button>
      </div>
    </div>
  );
}
