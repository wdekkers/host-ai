'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Step = {
  type: string
  directive: string | Record<string, unknown>
  skipToStep?: number
}

type JourneyStepTimelineProps = {
  steps: Step[]
  triggerType: string
}

function getStepCircleClass(type: string): string {
  switch (type) {
    case 'send_message':
    case 'upsell_offer':
      return 'bg-sky-50 border-2 border-sky-600 text-sky-600'
    case 'wait':
    case 'pause_ai':
    case 'resume_ai':
      return 'bg-amber-50 border-2 border-amber-600 text-amber-600'
    case 'ai_decision':
      return 'bg-purple-50 border-2 border-purple-600 text-purple-600'
    case 'create_task':
      return 'bg-green-50 border-2 border-green-600 text-green-600'
    case 'send_notification':
      return 'bg-slate-50 border-2 border-slate-600 text-slate-600'
    default:
      return 'bg-slate-50 border-2 border-slate-400 text-slate-500'
  }
}

function formatStepType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatDirective(directive: string | Record<string, unknown>): string {
  if (typeof directive === 'string') {
    return `"${directive}"`
  }
  if (typeof directive === 'object' && directive !== null) {
    if ('delayMinutes' in directive && typeof directive.delayMinutes === 'number') {
      return `Wait ${directive.delayMinutes} minutes`
    }
    if ('until' in directive) {
      const until = directive.until as string
      const offset = 'offsetHours' in directive ? directive.offsetHours : undefined
      return offset !== undefined ? `Until ${until} (${offset}h)` : `Until ${until}`
    }
  }
  return JSON.stringify(directive)
}

function getTimingBadge(step: Step): string | null {
  if (typeof step.directive === 'object' && step.directive !== null) {
    if ('delayMinutes' in step.directive && typeof step.directive.delayMinutes === 'number') {
      const mins = step.directive.delayMinutes
      if (mins >= 60) {
        return `${Math.round(mins / 60)}h delay`
      }
      return `${mins}m delay`
    }
    if ('until' in step.directive) {
      return String(step.directive.until)
    }
  }
  return null
}

export function JourneyStepTimeline({ steps, triggerType }: JourneyStepTimelineProps) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Steps</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{steps.length}</Badge>
            <span className="text-xs text-slate-400">Trigger: {triggerType}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {steps.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400">No steps defined.</p>
        ) : (
          <div className="py-2">
            {steps.map((step, index) => {
              const timingBadge = getTimingBadge(step)
              const isLast = index === steps.length - 1
              return (
                <div key={index} className="relative flex gap-3 px-4 py-2">
                  {/* Vertical connector */}
                  {!isLast && (
                    <div className="absolute left-[1.875rem] top-8 bottom-0 w-px bg-slate-100" />
                  )}
                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getStepCircleClass(step.type)}`}
                  >
                    {index + 1}
                  </div>
                  {/* Step content */}
                  <div className="flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">
                        {formatStepType(step.type)}
                      </span>
                      {timingBadge && (
                        <span className="rounded bg-slate-50 px-1.5 py-0.5 text-xs text-slate-400">
                          {timingBadge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDirective(step.directive)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
