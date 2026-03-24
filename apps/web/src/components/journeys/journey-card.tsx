'use client'

import Link from 'next/link'
import { Zap, ListChecks, Users, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Journey = {
  id: string
  name: string
  description: string
  status: string
  approvalMode: string
  triggerType: string
  steps: unknown[]
  propertyIds: string[]
  enrollmentCount?: number
  messageCount?: number
}

type JourneyCardProps = {
  journey: Journey
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'paused':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'archived':
      return 'border-border text-foreground'
    default:
      // draft
      return 'bg-secondary text-secondary-foreground'
  }
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'archived':
      return 'outline'
    case 'draft':
      return 'secondary'
    default:
      return 'default'
  }
}

function getApprovalBadgeClass(approvalMode: string): string {
  switch (approvalMode) {
    case 'autonomous':
      return 'bg-purple-50 text-purple-800 border-purple-200'
    case 'auto_with_exceptions':
      return 'bg-amber-50 text-amber-800 border-amber-200'
    default:
      // draft / manual
      return 'bg-sky-50 text-sky-700 border-sky-200'
  }
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

export function JourneyCard({ journey }: JourneyCardProps) {
  const propertiesLabel =
    journey.propertyIds.length === 0 ? 'All properties' : `${journey.propertyIds.length} properties`

  return (
    <Link href={`/journeys/${journey.id}`} className="block">
      <Card className="hover:shadow-sm transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900 mr-1">{journey.name}</span>
            <Badge
              variant={getStatusVariant(journey.status)}
              className={
                journey.status === 'active' || journey.status === 'paused'
                  ? getStatusBadgeClass(journey.status)
                  : undefined
              }
            >
              {journey.status}
            </Badge>
            <Badge className={getApprovalBadgeClass(journey.approvalMode)}>
              {formatApprovalMode(journey.approvalMode)}
            </Badge>
          </div>
          <p className="mb-2 text-xs text-slate-500 line-clamp-2">{journey.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Zap className="h-3 w-3" />
                {journey.triggerType}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <ListChecks className="h-3 w-3" />
                {journey.steps.length} steps
              </span>
              {journey.enrollmentCount !== undefined && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3 w-3" />
                  {journey.enrollmentCount}
                </span>
              )}
              {journey.messageCount !== undefined && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Mail className="h-3 w-3" />
                  {journey.messageCount}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{propertiesLabel}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
