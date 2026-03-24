'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AiStatus = 'active' | 'paused';

type AiStatusToggleProps = {
  reservationId: string;
  initialStatus?: AiStatus;
};

type PauseOption = {
  label: string;
  pauseDurationMinutes: number | null;
};

const PAUSE_OPTIONS: PauseOption[] = [
  { label: '15 minutes', pauseDurationMinutes: 15 },
  { label: '1 hour', pauseDurationMinutes: 60 },
  { label: '24 hours', pauseDurationMinutes: 1440 },
  { label: 'Until I resume', pauseDurationMinutes: null },
];

export function AiStatusToggle({
  reservationId,
  initialStatus = 'active',
}: AiStatusToggleProps): React.ReactElement {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<AiStatus>(initialStatus);

  const updateStatus = async (
    newStatus: AiStatus,
    pauseDurationMinutes?: number | null,
  ): Promise<void> => {
    try {
      const token = await getToken();
      const body: { status: AiStatus; pauseDurationMinutes?: number | null } = {
        status: newStatus,
      };
      if (newStatus === 'paused') {
        body.pauseDurationMinutes = pauseDurationMinutes ?? null;
      }
      const res = await fetch(`/api/conversations/${reservationId}/ai-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch {
      // silently ignore fetch errors
    }
  };

  if (status === 'paused') {
    return (
      <button
        type="button"
        onClick={() => void updateStatus('active')}
        className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-amber-100 transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
        <span className="text-xs font-medium text-amber-800">AI Paused</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-green-100 transition-colors focus:outline-none">
        <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-xs font-medium text-green-800">AI Active</span>
        <ChevronDown className="h-3 w-3 text-green-700" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Pause AI for this conversation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PAUSE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.label}
            onClick={() => void updateStatus('paused', option.pauseDurationMinutes)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
