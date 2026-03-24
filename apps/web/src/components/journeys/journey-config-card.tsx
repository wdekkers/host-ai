'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type JourneyConfigCardProps = {
  journey: {
    triggerType: string
    propertyIds: string[]
    approvalMode: string
    coverageSchedule: unknown
    version: number
    updatedAt: string
  }
  promotionSuggested?: boolean
}

function formatApprovalMode(mode: string): string {
  switch (mode) {
    case 'autonomous':
      return 'Autonomous'
    case 'auto_with_exceptions':
      return 'Auto + Review'
    case 'draft':
      return 'Draft'
    default:
      return mode
  }
}

function formatCoverageSchedule(schedule: unknown): string {
  if (!schedule) return 'Always on'
  if (typeof schedule === 'string') return schedule
  if (typeof schedule === 'object') {
    return JSON.stringify(schedule)
  }
  return String(schedule)
}

function formatUpdatedAt(updatedAt: string): string {
  try {
    return new Date(updatedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return updatedAt
  }
}

export function JourneyConfigCard({ journey, promotionSuggested = false }: JourneyConfigCardProps) {
  const propertiesLabel =
    journey.propertyIds.length === 0 ? 'All properties' : `${journey.propertyIds.length} properties`

  const rows: Array<{ key: string; value: React.ReactNode }> = [
    {
      key: 'Trigger',
      value: <span className="font-medium text-slate-900">{journey.triggerType}</span>,
    },
    {
      key: 'Properties',
      value: <span className="font-medium text-slate-900">{propertiesLabel}</span>,
    },
    {
      key: 'Approval Mode',
      value: (
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-slate-900">{formatApprovalMode(journey.approvalMode)}</span>
          {promotionSuggested && (
            <span className="text-xs text-primary cursor-pointer hover:underline">
              Upgrade suggested
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'Coverage',
      value: (
        <span className="font-medium text-slate-900">
          {formatCoverageSchedule(journey.coverageSchedule)}
        </span>
      ),
    },
    {
      key: 'Version',
      value: (
        <span className="font-medium text-slate-900">
          v{journey.version} · {formatUpdatedAt(journey.updatedAt)}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-500">{row.key}</span>
              <span className="text-xs text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
