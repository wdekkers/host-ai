'use client';

import { useState } from 'react';
import { SimulatorPanel, SimulatorToggle } from '@/components/simulator/SimulatorPanel';

interface AgentPageClientProps {
  propertyId: string;
  propertyName: string;
  children: React.ReactNode;
}

export function AgentPageClient({ propertyId, children }: AgentPageClientProps) {
  const [showSimulator, setShowSimulator] = useState(false);

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
          <SimulatorPanel propertyId={propertyId} />
        </div>
      )}
    </div>
  );
}
