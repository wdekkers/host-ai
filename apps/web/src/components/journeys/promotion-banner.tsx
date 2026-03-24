'use client'

import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type PromotionBannerProps = {
  messageCount: number
  editRate: number
  onUpgrade: () => void
}

export function PromotionBanner({ messageCount, editRate, onUpgrade }: PromotionBannerProps) {
  const editPercent = Math.round(editRate * 100)

  return (
    <Card className="bg-amber-50 border-amber-200">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <Info className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-900">Ready for auto mode?</p>
            <p className="mt-0.5 text-xs text-amber-700">
              This journey has sent <strong>{messageCount}</strong> messages with only a{' '}
              <strong>{editPercent}%</strong> edit rate. It may be ready to run autonomously.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 bg-amber-600 text-white hover:bg-amber-700 text-xs"
                onClick={onUpgrade}
              >
                Upgrade to Auto
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-300 text-amber-800 hover:bg-amber-100 text-xs"
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
