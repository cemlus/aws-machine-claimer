import { useState, useEffect, useCallback } from 'react';
import { FleetStatus } from './components/FleetStatus';
import { MachineList } from './components/MachineList';
import { ClaimedMachine } from './components/ClaimedMachine';
import { ClaimForm } from './components/ClaimForm';
import { getStatus, claimMachine, releaseMachine, renewLease } from './api';
import type { StatusResponse, Machine } from './types';

function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to fetch status';
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleClaim = async (userId: string) => {
    setClaiming(true);
    setError(null);
    try {
      const result = await claimMachine(userId);
      if (result.ok && result.instanceId) {
        await fetchStatus();
        // Find the claimed machine
        const claimed = status?.machines.find((m) => m.instanceId === result.instanceId);
        if (claimed) setSelectedMachine(claimed);
      } else {
        setError(result.message || 'Failed to claim machine');
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Network error while claiming';
      setError(message);
    } finally {
      setClaiming(false);
    }
  };

  const handleRelease = async (instanceId: string) => {
    setReleasing(true);
    setError(null);
    try {
      await releaseMachine(instanceId);
      setSelectedMachine(null);
      await fetchStatus();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to release machine';
      setError(message);
    } finally {
      setReleasing(false);
    }
  };

  const handleRenew = async (instanceId: string) => {
    setRenewing(true);
    setError(null);
    try {
      const result = await renewLease(instanceId);
      if (result.ok) {
        await fetchStatus();
        // Update selected machine's leaseExpiry
        setSelectedMachine((prev) => (prev ? { ...prev, leaseExpiry: result.leaseExpiry } : null));
      } else {
        setError(result.message || 'Failed to renew lease');
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Network error while renewing';
      setError(message);
    } finally {
      setRenewing(false);
    }
  };

  const availableMachines = status?.machines.filter(
    (m) => m.status === 'available'
  ) || [];

  const selectedInstanceId = selectedMachine?.instanceId ?? undefined;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">AWS Machine Claimer</h1>
          <p className="text-gray-600 mt-1">Claim and manage on-demand EC2 instances</p>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <FleetStatus status={status} loading={loading} />

        {selectedMachine ? (
          <ClaimedMachine
            machine={selectedMachine}
            onRelease={() => handleRelease(selectedMachine.instanceId)}
            onRenew={() => handleRenew(selectedMachine.instanceId)}
            releasing={releasing}
            renewing={renewing}
          />
        ) : (
          <>
            <ClaimForm onClaim={handleClaim} claiming={claiming} disabled={loading} />
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Available Machines</h2>
              {loading ? (
                <div className="animate-pulse bg-gray-100 rounded-lg p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              ) : (
                <MachineList
                  machines={availableMachines}
                  onSelect={(machine) => setSelectedMachine(machine)}
                  selectedInstanceId={selectedInstanceId}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;

