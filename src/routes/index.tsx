import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'
import { getSession } from '#/lib/auth-session'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  component: WelcomePage,
})

function WelcomePage() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
        Welcome {user.name}!
      </h1>
      <Button
        variant="outline"
        onClick={() => {
          void authClient.signOut().then(() => {
            void navigate({ to: '/login' })
          })
        }}
      >
        Sign out
      </Button>
    </main>
  )
}
