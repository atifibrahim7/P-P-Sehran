import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString()
}

function labelForPhoneType(phoneType) {
  if (phoneType === 'Mobile') return 'Mobile'
  if (phoneType === 'Home') return 'Home'
  if (phoneType === 'Work') return 'Work'
  if (phoneType === 'Other') return 'Other'
  return 'Mobile'
}

export default function PractitionerPatientDetailsDialog({ open, onOpenChange, patient, onEdit }) {
  const addresses = Array.isArray(patient?.addresses) ? patient.addresses : []
  const contacts = Array.isArray(patient?.contacts) ? patient.contacts : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Patient info</DialogTitle>
        </DialogHeader>

        {patient ? (
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Identity</p>
                <p className="text-sm font-medium">{patient.name || '—'}</p>
                <p className="text-sm text-muted-foreground">{patient.email || '—'}</p>
                <p className="text-sm text-foreground">
                  Primary clinic: {patient.primaryPractitionerName || '—'}
                </p>
                <p className="text-xs text-muted-foreground">User ID: {patient.userId}</p>
                <p className="text-xs text-muted-foreground">Patient ID: {patient.patientId}</p>
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Clinical</p>
                <p className="text-sm text-foreground">Title: {patient.title || '—'}</p>
                <p className="text-sm text-foreground">Forenames: {patient.forenames || '—'}</p>
                <p className="text-sm text-foreground">Surname: {patient.surname || '—'}</p>
                <p className="text-sm text-foreground">DOB: {formatDate(patient.dateOfBirth)}</p>
                <p className="text-sm text-foreground">Gender: {patient.gender || '—'}</p>
                <p className="text-sm text-foreground">Policy number: {patient.policyNumber || '—'}</p>
                <p className="text-sm text-foreground">Smoker: {patient.smokerStatus || '—'}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Addresses</p>
                <Badge variant="secondary">{addresses.length}</Badge>
              </div>
              {addresses.length ? (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div key={address.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{address.addressLine1}</p>
                        {address.isPreferred ? <Badge variant="outline">Preferred</Badge> : null}
                      </div>
                      <p className="text-muted-foreground">
                        {[address.addressLine2, address.addressLine3, address.city, address.county, address.country, address.postcode]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">Type: {address.addressTypeId}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No addresses saved.</p>
              )}
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Contacts</p>
                <Badge variant="secondary">{contacts.length}</Badge>
              </div>
              {contacts.length ? (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="font-medium">{contact.phoneNumber}</p>
                      <p className="text-muted-foreground">{labelForPhoneType(contact.phoneType)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts saved.</p>
              )}
            </div>
          </div>
        ) : (
          <Alert>
            <AlertTitle>No patient selected</AlertTitle>
            <AlertDescription>Choose a patient to view details.</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {patient ? (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onEdit?.(patient)
              }}
            >
              Edit patient
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
