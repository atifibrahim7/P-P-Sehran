import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function VendorCartConflictDialog({ open, onOpenChange, details, onProceed, onCancel, loading }) {
  const ex = details?.existingVendor
  const nw = details?.newVendor
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-left">Different vendor in cart</DialogTitle>
              <DialogDescription className="text-left text-sm leading-relaxed">
                Your cart already has items from{' '}
                <span className="font-medium text-foreground">{ex?.name ?? 'another vendor'}</span>. To add products
                from <span className="font-medium text-foreground">{nw?.name ?? 'this vendor'}</span>, the current cart
                must be cleared first.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={onProceed} disabled={loading}>
            {loading ? 'Working…' : 'Clear cart & add item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
