import { auth } from './firebase'
import { RELAY_BASE_URL } from '../config/relay'

export interface ReserveResult {
  ok: boolean
  count: number
  limit: number
  limitReached: boolean
}

export interface ReleaseResult {
  ok: boolean
  count: number
}

async function callWorker(path: string, init: RequestInit = {}): Promise<Response> {
  if (!RELAY_BASE_URL) throw new Error('Relay not configured')
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  return fetch(`${RELAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function reserveCredit(): Promise<ReserveResult> {
  const res = await callWorker('/api/usage/reserve', { method: 'POST' })
  if (!res.ok) throw new Error(`reserve failed: ${res.status}`)
  return res.json()
}

export async function releaseCredit(): Promise<ReleaseResult> {
  const res = await callWorker('/api/usage/release', { method: 'POST' })
  if (!res.ok) throw new Error(`release failed: ${res.status}`)
  return res.json()
}
