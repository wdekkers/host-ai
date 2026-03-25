'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Zap, Pause, Mail, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { JourneyPromptInput } from '@/components/journeys/journey-prompt-input'
import { JourneyCard } from '@/components/journeys/journey-card'

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

type FilterType = 'all' | 'active' | 'paused' | 'draft'

export function JourneysClient() {
  const router = useRouter()
  const { getToken } = useAuth()
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')

  const fetchJourneys = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/journeys', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { journeys?: Journey[] }
        setJourneys(data.journeys ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    void fetchJourneys()
  }, [fetchJourneys])

  const handleGenerate = async (prompt: string) => {
    setGenerating(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/journeys/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, propertyIds: [] }),
      })
      if (res.ok) {
        const data = (await res.json()) as { journey: { id: string } }
        router.push(`/journeys/${data.journey.id}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  const activeCount = journeys.filter((j) => j.status === 'active').length
  const pausedCount = journeys.filter((j) => j.status === 'paused').length
  const draftCount = journeys.filter((j) => j.status === 'draft').length
  const totalMessages = journeys.reduce((sum, j) => sum + (j.messageCount ?? 0), 0)

  const filterCounts: Record<FilterType, number> = {
    all: journeys.length,
    active: activeCount,
    paused: pausedCount,
    draft: draftCount,
  }

  const filtered: Journey[] = filter === 'all' ? journeys : journeys.filter((j) => j.status === filter)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Journeys</h1>
        <p className="text-sm text-slate-500">Automate your guest communication lifecycle</p>
      </div>

      <JourneyPromptInput onGenerate={handleGenerate} isLoading={generating} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <Zap className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Pause className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{pausedCount}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Paused</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <Mail className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{loading ? '—' : totalMessages}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Messages Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">—</div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Approval Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'paused', 'draft'] as FilterType[]).map((tab) => (
          <button
            key={tab}
            className={
              filter === tab
                ? 'rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white'
                : 'rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50'
            }
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({filterCounts[tab]})
          </button>
        ))}
      </div>

      {/* Journey list */}
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading journeys...</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No journeys yet. Describe what you want to automate above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((j) => (
            <JourneyCard key={j.id} journey={j} />
          ))}
        </div>
      )}
    </div>
  )
}
