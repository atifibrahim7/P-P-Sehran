import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function LoginPage() {
  const { login, error, setError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await login(email, password)
      if (user.role === 'admin') navigate('/admin', { replace: true })
      else if (user.role === 'practitioner') navigate('/practitioner', { replace: true })
      else navigate('/patient', { replace: true })
    } catch {
      // error from provider
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 min-h-svh items-center justify-center bg-background px-4 py-10 bg-[#F3F0EA]  ">
      <img src="../../../src/assets/Logo.png" alt="Logo" className="w-[450px] h-24 mx-auto my-5 " />
      <Card className="w-full max-w-md border-border/80 shadow-lg">
      
        <CardHeader className="space-y-1 text-center">
          <div className="text-primary text-lg font-bold my-2">
           <p>Welcome</p>
          </div>
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <Lock className="size-5" />
             Sign in
          </CardTitle>
          <CardDescription>
          
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message ?? 'Login failed'}</AlertDescription>
            </Alert>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Dev seeds: admin@sys.local / admin123 · practitioner@sys.local / prac123 · patient@sys.local / patient123
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
