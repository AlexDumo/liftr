import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthForm } from '#/components/auth-form'
import { getSession } from '#/lib/auth-session'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session?.user) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <AuthForm />
    </main>
  )
}
