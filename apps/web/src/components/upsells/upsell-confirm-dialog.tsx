'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function formatUpsellType(type: string): string {
  switch (type) {
    case 'gap_night':
      return 'gap night';
    case 'early_checkin':
      return 'early check-in';
    case 'late_checkout':
      return 'late check-out';
    default:
      return type.replace(/_/g, ' ');
  }
}

type UpsellConfirmDialogProps = {
  upsell: { id: string; upsellType: string; estimatedRevenue: number | null } | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (id: string, actualRevenue: number) => void;
};

export function UpsellConfirmDialog({
  upsell,
  open,
  onClose,
  onConfirm,
}: UpsellConfirmDialogProps): React.JSX.Element {
  const [revenue, setRevenue] = useState<string>('');

  useEffect(() => {
    if (upsell?.estimatedRevenue != null) {
      setRevenue(String(upsell.estimatedRevenue));
    } else {
      setRevenue('');
    }
  }, [upsell]);

  const handleConfirm = () => {
    if (!upsell) return;
    const amount = parseFloat(revenue);
    if (!isNaN(amount) && amount >= 0) {
      onConfirm(upsell.id, Math.round(amount));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Confirm Upsell Revenue</DialogTitle>
        </DialogHeader>
        {upsell && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Confirm revenue for{' '}
              <span className="font-medium">{formatUpsellType(upsell.upsellType)}</span>.
              {upsell.estimatedRevenue != null && (
                <> Estimated: <span className="font-medium">${upsell.estimatedRevenue}</span>.</>
              )}
            </p>
            <div className="space-y-1">
              <label htmlFor="actual-revenue" className="text-sm font-medium text-slate-700">
                Actual Revenue ($)
              </label>
              <input
                id="actual-revenue"
                type="number"
                min="0"
                step="1"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                placeholder="Enter actual revenue"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!upsell || revenue === ''}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
