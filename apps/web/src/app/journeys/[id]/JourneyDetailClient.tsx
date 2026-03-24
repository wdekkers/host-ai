'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { ArrowLeft, Users, Mail, Pencil, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { JourneyStepTimeline } from '@/components/journeys/journey-step-timeline'
import { JourneyAiEditPanel } from '@/components/journeys/journey-ai-edit-panel'
import { JourneyConfigCard } from '@/components/journeys/journey-config-card'
import { PromotionBanner } from '@/components/journeys/promotion-banner'

type Step = {
  type: string
  directive: string | Record<string, unknown>
  skipToStep?: number
}

type Journey = {
  id: string
  name: string
  description: string
  status: string
  approvalMode: string
  triggerType: string
  steps: Step[]
  propertyIds: string[]
  coverageSchedule: unknown
  version: number
  updatedAt: string
  enrollmentCount?: number
  messageCount?: number
  promotionSuggested?: boolean
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

export function JourneyDetailClient() {
  const params = useParams()
  const router = useRouter()
  const { getToken } = useAuth()
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : ''

  const [journey, setJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJourney = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`/api/journeys/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = (await res.json()) as Journey
        setJourney(data)
      } else {
        setError('Failed to load journey')
      }
    } catch {
      setError('Failed to load journey')
    } finally {
      setLoading(false)
    }
  }, [id, getToken])

  useEffect(() => {
    void fetchJourney()
  }, [fetchJourney])

  const handlePause = async () => {
    if (!journey) return
    try {
      const token = await getToken()
      const endpoint = journey.status === 'active' ? 'pause' : 'activate'
      const res = await fetch(`/api/journeys/${journey.id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        void fetchJourney()
      }
    } catch {
      // ignore
    }
  }

  const handleArchive = async () => {
    if (!journey) return
    try {
      const token = await getToken()
      const res = await fetch(`/api/journeys/${journey.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        router.push('/journeys')
      }
    } catch {
      // ignore
    }
  }

  const handleUpgrade = async () => {
    if (!journey) return
    try {
      const token = await getToken()
      const res = await fetch(`/api/journeys/${journey.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalMode: 'auto_with_exceptions' }),
      })
      if (res.ok) {
        void fetchJourney()
      }
    } catch {
      // ignore
    }
  }

  const handleJourneyUpdate = (updatedJourney: unknown) => {
    setJourney(updatedJourney as Journey)
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">Loading journey...</div>
    )
  }

  if (error || !journey) {
    return (
      <div className="space-y-3">
        <Link
          href="/journeys"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Journeys
        </Link>
        <p className="py-8 text-center text-sm text-slate-400">{error ?? 'Journey not found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/journeys"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Journeys
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{journey.name}</h1>
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
          <p className="mt-1 text-sm text-slate-500">{journey.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void handlePause()}>
            {journey.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => void handleArchive()}
          >
            Archive
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <Users className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{journey.enrollmentCount ?? 0}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Active Enrollments
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <Mail className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{journey.messageCount ?? 0}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Messages Drafted
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Pencil className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">—</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Edit Rate
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">—</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Completed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <JourneyStepTimeline steps={journey.steps} triggerType={journey.triggerType} />
        </div>
        <div className="lg:col-span-2 flex flex-col gap-3">
          <JourneyAiEditPanel journeyId={journey.id} onUpdate={handleJourneyUpdate} />
          <JourneyConfigCard journey={journey} promotionSuggested={journey.promotionSuggested} />
          {journey.promotionSuggested && (
            <PromotionBanner
              messageCount={journey.messageCount ?? 0}
              editRate={0}
              onUpgrade={() => void handleUpgrade()}
            />
          )}
        </div>
      </div>
    </div>
  )
}
