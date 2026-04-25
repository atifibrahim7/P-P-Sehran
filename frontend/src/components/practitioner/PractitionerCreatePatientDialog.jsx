import { useEffect, useState } from 'react'
import { createPractitionerPatient } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * @param {(created: { userId: number, name: string, email: string }) => void} [props.onCreated]
 */
export default function PractitionerCreatePatientDialog({ open, onOpenChange, onCreated, title, description }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setEmail('')
    setPassword('')
    setError(null)
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        ...(password.trim() ? { password: password.trim() } : {}),
      }
      const out = await createPractitionerPatient(body)
      const row = {
        userId: out.userId,
        name: out.name ?? body.name,
        email: out.email ?? body.email,
      }
      onCreated?.(row)
      onOpenChange(false)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" showCloseButton>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title ?? 'Add patient'}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="my-2">
              <AlertTitle>Could not create patient</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-patient-name">Full name</Label>
              <Input
                id="create-patient-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-patient-email">Email</Label>
              <Input
                id="create-patient-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-patient-pw">Password (optional)</Label>
              <Input
                id="create-patient-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create patient'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
