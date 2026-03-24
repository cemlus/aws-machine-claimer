import type { StatusResponse } from '../types';

interface Props {
  status: StatusResponse | null;
  loading: boolean;
}

export function FleetStatus({ status, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-300 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!status) return null;

  const cards = [
    { label: 'Available', value: status.available, color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Leased', value: status.leased, color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Total', value: status.total, color: 'bg-gray-50 border-gray-200 text-gray-700' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg border-2 p-6 ${card.color}`}>
          <div className="text-sm font-medium uppercase tracking-wide">{card.label}</div>
          <div className="text-4xl font-bold mt-2">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
