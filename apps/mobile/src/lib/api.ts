import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import * as SecureStore from 'expo-secure-store'
import type { AppRouter } from '@bowling/api'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/trpc'

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      headers: async () => {
        const token = await SecureStore.getItemAsync('auth-token')
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})
