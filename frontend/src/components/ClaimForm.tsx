import { useState } from 'react';

interface Props {
  onClaim: (userId: string) => Promise<void>;
  claiming: boolean;
  disabled: boolean;
}

export function ClaimForm({ onClaim, claiming, disabled }: Props) {
  const [userId, setUserId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    await onClaim(userId.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Claim a Machine</h2>
      <div className="flex gap-3">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter your user ID"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          disabled={disabled || claiming}
        />
        <button
          type="submit"
          disabled={disabled || claiming || !userId.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition"
        >
          {claiming ? 'Claiming...' : 'Claim'}
        </button>
      </div>
    </form>
  );
}
