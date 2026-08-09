import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { authClient } from '#/lib/auth-client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AuthForm() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session?.user) {
      void navigate({ to: '/' })
    }
  }, [session?.user, navigate])

  useEffect(() => {
    if (session?.user || mode === 'signup') return
    const canAutoFill =
      typeof PublicKeyCredential !== 'undefined' &&
      typeof PublicKeyCredential.isConditionalMediationAvailable ===
        'function' &&
      PublicKeyCredential.isConditionalMediationAvailable()
    if (!canAutoFill) return
    void authClient.signIn.passkey({ autoFill: true })
  }, [session?.user, mode])

  const handleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result.error) {
        setError(result.error.message || 'Sign in failed')
        return
      }
      void navigate({ to: '/' })
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const context = JSON.stringify({
        email: email.trim().toLowerCase(),
        name: name.trim(),
      })
      const registerResult = await authClient.passkey.addPasskey({
        name: 'Primary passkey',
        context,
      })
      if (registerResult.error) {
        setError(registerResult.error.message || 'Sign up failed')
        return
      }

      const signInResult = await authClient.signIn.passkey()
      if (signInResult.error) {
        setError(
          signInResult.error.message ||
            'Passkey created, but sign in failed. Try signing in.',
        )
        return
      }
      void navigate({ to: '/' })
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-base">Liftr</CardTitle>
        <CardDescription>
          {mode === 'signup'
            ? 'Enter your details, then create a passkey'
            : 'Use your passkey to sign in'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as 'signin' | 'signup')
            setError('')
          }}
        >
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="signin" className="flex-1">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email-signin">Email</Label>
              <Input
                id="email-signin"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username webauthn"
                placeholder="Optional for autofill"
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <WarningCircleIcon />
                <AlertTitle>Sign in failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={() => {
                void handleSignIn()
              }}
            >
              {loading ? 'Please wait…' : 'Sign in with passkey'}
            </Button>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username webauthn"
                  required
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <WarningCircleIcon />
                  <AlertTitle>Sign up failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Please wait…' : 'Create passkey account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="justify-center text-muted-foreground">
        Passwordless sign-in with passkeys
      </CardFooter>
    </Card>
  )
}
