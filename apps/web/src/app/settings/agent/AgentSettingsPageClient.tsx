'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { SimulatorPanel, SimulatorToggle } from '@/components/simulator/SimulatorPanel';

interface AgentSettingsPageClientProps {
  children: React.ReactNode;
}

export function AgentSettingsPageClient({ children }: AgentSettingsPageClientProps) {
  const { getToken } = useAuth();
  const [showSimulator, setShowSimulator] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const fetchProperties = useCallback(async () => {
    const token = await getToken();
    const res = await fetch('/api/properties', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setProperties(data.properties ?? data);
    }
  }, [getToken]);

  useEffect(() => {
    if (showSimulator && properties.length === 0) void fetchProperties();
  }, [showSimulator, properties.length, fetchProperties]);

  return (
    <div className="flex gap-6">
      <div className={`p-4 sm:p-8 ${showSimulator ? 'max-w-2xl flex-1' : 'max-w-4xl'}`}>
        <div className="flex items-center justify-end mb-2">
          <SimulatorToggle onClick={() => setShowSimulator(!showSimulator)} />
        </div>
        {children}
      </div>

      {showSimulator && (
        <div className="w-96 shrink-0 p-4 sm:p-8 sm:pl-0">
          {!selectedPropertyId ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Select a property to test
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Choose property...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <SimulatorPanel propertyId={selectedPropertyId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
