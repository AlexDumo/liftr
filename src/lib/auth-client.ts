import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'
import { cloudflareClient } from 'better-auth-cloudflare/client'

export const authClient = createAuthClient({
  plugins: [cloudflareClient(), passkeyClient()],
})
