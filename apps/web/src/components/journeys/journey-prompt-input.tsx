'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type JourneyPromptInputProps = {
  onGenerate: (prompt: string) => void
  isLoading?: boolean
}

export function JourneyPromptInput({ onGenerate, isLoading = false }: JourneyPromptInputProps) {
  const [prompt, setPrompt] = useState('')

  const handleGenerate = () => {
    if (prompt.trim()) {
      onGenerate(prompt.trim())
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
            <Sparkles className="h-4 w-4 text-sky-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900">
            Describe what you want to automate
          </span>
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Send a welcome message 1 hour after check-in, then follow up with local recommendations on day 2, and ask for a review 24 hours before checkout"
          className="mb-3 min-h-20 resize-none"
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-xs">
            Use template
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating your journey...
              </>
            ) : (
              'Generate Journey →'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
