import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bowling/db'

const queryClient = postgres(process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling')
export const db = drizzle(queryClient, { schema })
