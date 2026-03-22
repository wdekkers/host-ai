'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical } from 'lucide-react';
import { SimulatorChat } from './SimulatorChat';
import { SimulatorBatch } from './SimulatorBatch';

interface SimulatorPanelProps {
  propertyId: string;
}

export function SimulatorToggle({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="gap-1.5"
    >
      <FlaskConical className="h-4 w-4" />
      Test Agent
    </Button>
  );
}

export function SimulatorPanel({ propertyId }: SimulatorPanelProps) {
  const [tab, setTab] = useState<'chat' | 'batch'>('chat');

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Test Agent</CardTitle>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('chat')}
              className={`px-3 py-1 text-xs rounded-full font-medium ${
                tab === 'chat'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setTab('batch')}
              className={`px-3 py-1 text-xs rounded-full font-medium ${
                tab === 'batch'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Batch Test
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tab === 'chat' ? (
          <SimulatorChat propertyId={propertyId} />
        ) : (
          <SimulatorBatch propertyId={propertyId} />
        )}
      </CardContent>
    </Card>
  );
}
