import { useEffect, useState } from 'react'
import { createPractitionerPatient, updatePractitionerPatient } from '../../api/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * @param {(created: { userId: number, patientId: number, name: string, email: string }) => void} [props.onCreated]
 */
export default function PractitionerCreatePatientDialog({
  open,
  onOpenChange,
  onCreated,
  title,
  description,
  patient,
  mode = 'create',
}) {
  const STEPS = ['Basic info', 'Clinical & account', 'Address & contact']
  const dialogTitle = title ?? (mode === 'edit' ? 'Edit patient' : 'Add patient')

  const createEmptyAddress = () => ({
    addressTypeId: '0',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    city: '',
    county: '',
    country: '',
    postcode: '',
    isPreferred: false,
  })

  const createEmptyContact = () => ({ phoneNumber: '', phoneType: 'Mobile' })

  const apiGenderToForm = (value) => {
    if (value === 'MALE') return 'Male'
    if (value === 'FEMALE') return 'Female'
    return 'Unknown'
  }

  const apiSmokerToForm = (value) => {
    if (value === 'NON_SMOKER') return 'NonSmoker'
    if (value === 'SMOKER') return 'Smoker'
    return 'Unknown'
  }

  const [email, setEmail] = useState('')
  const [titleText, setTitleText] = useState('')
  const [forenames, setForenames] = useState('')
  const [surname, setSurname] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('Unknown')
  const [policyNumber, setPolicyNumber] = useState('')
  const [clientReference2, setClientReference2] = useState('')
  const [nationalInsuranceNumber, setNationalInsuranceNumber] = useState('')
  const [smokerStatus, setSmokerStatus] = useState('Unknown')
  const [password, setPassword] = useState('')
  const [addresses, setAddresses] = useState([])
  const [contacts, setContacts] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [stepError, setStepError] = useState('')
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!open) return
    if (patient) {
      setEmail(patient.email ?? '')
      setTitleText(patient.title ?? '')
      setForenames(patient.forenames ?? '')
      setSurname(patient.surname ?? '')
      setDateOfBirth(patient.dateOfBirth ?? '')
      setGender(apiGenderToForm(patient.gender))
      setPolicyNumber(patient.policyNumber ?? '')
      setClientReference2(patient.clientReference2 ?? '')
      setNationalInsuranceNumber(patient.nationalInsuranceNumber ?? '')
      setSmokerStatus(apiSmokerToForm(patient.smokerStatus))
      setPassword('')
      setAddresses(
        Array.isArray(patient.addresses) && patient.addresses.length
          ? patient.addresses.map((address) => ({
              addressTypeId: String(address.addressTypeId ?? 0),
              addressLine1: address.addressLine1 ?? '',
              addressLine2: address.addressLine2 ?? '',
              addressLine3: address.addressLine3 ?? '',
              city: address.city ?? '',
              county: address.county ?? '',
              country: address.country ?? '',
              postcode: address.postcode ?? '',
              isPreferred: Boolean(address.isPreferred),
            }))
          : [createEmptyAddress()],
      )
      setContacts(
        Array.isArray(patient.contacts) && patient.contacts.length
          ? patient.contacts.map((contact) => ({
              phoneNumber: contact.phoneNumber ?? '',
              phoneType: contact.phoneType ?? 'Mobile',
            }))
          : [createEmptyContact()],
      )
    } else {
      setEmail('')
      setTitleText('')
      setForenames('')
      setSurname('')
      setDateOfBirth('')
      setGender('Unknown')
      setPolicyNumber('')
      setClientReference2('')
      setNationalInsuranceNumber('')
      setSmokerStatus('Unknown')
      setPassword('')
      setAddresses([])
      setContacts([])
    }
    setError(null)
    setStepError('')
    setStep(0)
  }, [open, patient])

  const addAddress = () => {
    setAddresses((prev) => [...prev, createEmptyAddress()])
  }

  const addContact = () => {
    setContacts((prev) => [...prev, createEmptyContact()])
  }

  const updateAddress = (index, patch) => {
    setAddresses((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const updateContact = (index, patch) => {
    setContacts((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const removeAddress = (index) => {
    setAddresses((prev) => prev.filter((_, i) => i !== index))
  }

  const removeContact = (index) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }

  const validateStep = (currentStep) => {
    if (currentStep === 0) {
      if (!email.trim() || !forenames.trim() || !surname.trim() || !dateOfBirth.trim()) {
        return 'Please complete email, name, and date of birth to continue.'
      }
    }
    if (currentStep === 1) {
      if (!policyNumber.trim()) return 'Policy number is required.'
      if (password.trim() && password.trim().length < 8) {
        return 'Password must be at least 8 characters when provided.'
      }
    }
    if (currentStep === 2) {
      if (!addresses.length) return 'Please add at least one address.'
      if (!contacts.length) return 'Please add at least one contact.'
      if (
        addresses.some(
          (address) =>
            !address.addressLine1.trim() ||
            !address.city.trim() ||
            !address.country.trim() ||
            !address.postcode.trim(),
        )
      ) {
        return 'Please complete each address before creating the patient.'
      }
      if (contacts.some((contact) => !contact.phoneNumber.trim())) {
        return 'Please complete each contact before creating the patient.'
      }
    }
    return ''
  }

  const handleNextStep = () => {
    const message = validateStep(step)
    if (message) {
      setStepError(message)
      return
    }
    setStepError('')
    setStep((prev) => {
      const next = Math.min(prev + 1, STEPS.length - 1)
      if (next === 2) {
        setAddresses((current) => (current.length ? current : [createEmptyAddress()]))
        setContacts((current) => (current.length ? current : [createEmptyContact()]))
      }
      return next
    })
  }

  const handlePreviousStep = () => {
    setStepError('')
    setStep((prev) => Math.max(prev - 1, 0))
  }

  const submit = async (e) => {
    e.preventDefault()
    const stepValidationError = validateStep(step)
    if (stepValidationError) {
      setStepError(stepValidationError)
      return
    }

    if (step < STEPS.length - 1) {
      setStepError('')
      setStep((prev) => {
        const next = Math.min(prev + 1, STEPS.length - 1)
        if (next === 2) {
          setAddresses((current) => (current.length ? current : [createEmptyAddress()]))
          setContacts((current) => (current.length ? current : [createEmptyContact()]))
        }
        return next
      })
      return
    }

    setStepError('')
    setError(null)
    setBusy(true)
    try {
      const body = {
        email: email.trim(),
        ...(titleText.trim() ? { title: titleText.trim() } : {}),
        forenames: forenames.trim(),
        surname: surname.trim(),
        dateOfBirth: dateOfBirth.trim(),
        gender,
        policyNumber: policyNumber.trim(),
        ...(clientReference2.trim() ? { clientReference2: clientReference2.trim() } : {}),
        ...(nationalInsuranceNumber.trim()
          ? { nationalInsuranceNumber: nationalInsuranceNumber.trim() }
          : {}),
        smokerStatus,
        addresses: addresses.map((address) => ({
          addressTypeId: Number(address.addressTypeId),
          addressLine1: address.addressLine1.trim(),
          ...(address.addressLine2.trim() ? { addressLine2: address.addressLine2.trim() } : {}),
          ...(address.addressLine3.trim() ? { addressLine3: address.addressLine3.trim() } : {}),
          city: address.city.trim(),
          ...(address.county.trim() ? { county: address.county.trim() } : {}),
          country: address.country.trim(),
          postcode: address.postcode.trim(),
          isPreferred: Boolean(address.isPreferred),
        })),
        contacts: contacts.map((contact) => ({
          phoneNumber: contact.phoneNumber.trim(),
          phoneType: contact.phoneType,
        })),
        ...(password.trim() ? { password: password.trim() } : {}),
      }
      const out = mode === 'edit' && patient?.userId ? await updatePractitionerPatient(patient.userId, body) : await createPractitionerPatient(body)
      const row = {
        userId: out.userId,
        patientId: out.patientId,
        name: out.name ?? `${body.forenames} ${body.surname}`.trim(),
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" showCloseButton>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" className="my-2">
              <AlertTitle>Could not create patient</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}

          {stepError ? (
            <Alert variant="destructive" className="my-2">
              <AlertTitle>Please check the form</AlertTitle>
              <AlertDescription>{stepError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-3 rounded-md border p-3">
            <div className="text-sm font-medium">
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {STEPS.map((stepLabel, index) => (
                <div
                  key={stepLabel}
                  className={`rounded px-2 py-1 text-center text-xs ${
                    index === step
                      ? 'bg-primary text-primary-foreground'
                      : index < step
                        ? 'bg-primary/20 text-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index + 1}. {stepLabel}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 py-2">
            {step === 0 ? (
              <>
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="create-patient-title">Title</Label>
                    <Input
                      id="create-patient-title"
                      value={titleText}
                      onChange={(e) => setTitleText(e.target.value)}
                      maxLength={10}
                      placeholder="Mr"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="create-patient-forenames">Forenames</Label>
                    <Input
                      id="create-patient-forenames"
                      value={forenames}
                      onChange={(e) => setForenames(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="create-patient-surname">Surname</Label>
                    <Input
                      id="create-patient-surname"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-patient-dob">Date of birth</Label>
                    <Input
                      id="create-patient-dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="create-patient-policy-number">Policy number</Label>
                    <Input
                      id="create-patient-policy-number"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Smoker status</Label>
                    <Select value={smokerStatus} onValueChange={setSmokerStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                        <SelectItem value="NonSmoker">NonSmoker</SelectItem>
                        <SelectItem value="Smoker">Smoker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="create-patient-client-reference-2">Client reference 2</Label>
                    <Input
                      id="create-patient-client-reference-2"
                      value={clientReference2}
                      onChange={(e) => setClientReference2(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-patient-nin">National insurance number</Label>
                    <Input
                      id="create-patient-nin"
                      value={nationalInsuranceNumber}
                      onChange={(e) => setNationalInsuranceNumber(e.target.value)}
                      maxLength={50}
                    />
                  </div>
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
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>Addresses</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                      Add address
                    </Button>
                  </div>
                  {addresses.length ? (
                    <div className="space-y-4">
                      {addresses.map((address, index) => (
                        <div key={`address-${index}`} className="space-y-3 rounded-md border p-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select
                                value={address.addressTypeId}
                                onValueChange={(value) => updateAddress(index, { addressTypeId: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">Home</SelectItem>
                                  <SelectItem value="1">Work</SelectItem>
                                  <SelectItem value="2">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Address line 1</Label>
                              <Input
                                value={address.addressLine1}
                                onChange={(e) => updateAddress(index, { addressLine1: e.target.value })}
                                required
                                maxLength={255}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Address line 2</Label>
                              <Input
                                value={address.addressLine2}
                                onChange={(e) => updateAddress(index, { addressLine2: e.target.value })}
                                maxLength={255}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Address line 3</Label>
                              <Input
                                value={address.addressLine3}
                                onChange={(e) => updateAddress(index, { addressLine3: e.target.value })}
                                maxLength={255}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                value={address.city}
                                onChange={(e) => updateAddress(index, { city: e.target.value })}
                                required
                                maxLength={100}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>County</Label>
                              <Input
                                value={address.county}
                                onChange={(e) => updateAddress(index, { county: e.target.value })}
                                maxLength={100}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2 sm:col-span-2">
                              <Label>Country</Label>
                              <Input
                                value={address.country}
                                onChange={(e) => updateAddress(index, { country: e.target.value })}
                                required
                                maxLength={100}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Postcode</Label>
                              <Input
                                value={address.postcode}
                                onChange={(e) => updateAddress(index, { postcode: e.target.value })}
                                required
                                maxLength={20}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(address.isPreferred)}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setAddresses((prev) =>
                                    prev.map((item, i) =>
                                      i === index
                                        ? { ...item, isPreferred: checked }
                                        : checked
                                          ? { ...item, isPreferred: false }
                                          : item,
                                    ),
                                  )
                                }}
                              />
                              Preferred
                            </Label>
                            <Button type="button" variant="outline" size="sm" onClick={() => removeAddress(index)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>Contacts</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addContact}>
                      Add contact
                    </Button>
                  </div>
                  {contacts.length ? (
                    <div className="space-y-3">
                      {contacts.map((contact, index) => (
                        <div key={`contact-${index}`} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Phone number</Label>
                            <Input
                              value={contact.phoneNumber}
                              onChange={(e) => updateContact(index, { phoneNumber: e.target.value })}
                              required
                              maxLength={20}
                              placeholder="+92..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone type</Label>
                            <Select
                              value={contact.phoneType}
                              onValueChange={(value) => updateContact(index, { phoneType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mobile">Mobile</SelectItem>
                                <SelectItem value="Home">Home</SelectItem>
                                <SelectItem value="Work">Work</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-3">
                            <Button type="button" variant="outline" size="sm" onClick={() => removeContact(index)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={busy}>
                Back
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNextStep} disabled={busy}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={busy}>
                {busy ? (mode === 'edit' ? 'Saving…' : 'Creating…') : mode === 'edit' ? 'Save patient' : 'Create patient'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
