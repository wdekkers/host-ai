'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type JourneyAiEditPanelProps = {
  journeyId: string
  onUpdate: (updatedJourney: unknown) => void
}

export function JourneyAiEditPanel({ journeyId, onUpdate }: JourneyAiEditPanelProps) {
  const [instruction, setInstruction] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApply = async () => {
    if (!instruction.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/journeys/generate/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId, instruction: instruction.trim() }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Failed to apply changes')
      }

      const data = (await res.json()) as unknown
      onUpdate(data)
      setInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-semibold">Edit with AI</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Describe the changes you want to make, e.g. 'Add a 2-day follow-up message asking if the guest needs anything'"
          className="mb-3 min-h-20 resize-none"
          disabled={isLoading}
        />
        {error && (
          <p className="mb-3 text-xs text-destructive">{error}</p>
        )}
        <div className="flex justify-end">
          <Button
            onClick={handleApply}
            disabled={isLoading || !instruction.trim()}
          >
            {isLoading ? 'Applying...' : 'Apply Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
