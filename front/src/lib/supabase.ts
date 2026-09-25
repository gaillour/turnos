import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface Recurso {
  id: string
  nombre: string
  activo: boolean
}

export interface Turno {
  id: string
  recurso_id: string
  hora_inicio: string
  estado: 'libre' | 'ocupado'
  nombre_cliente: string | null
  recursos?: Recurso
}

export interface ChatApiResponse {
  reply: string
  intencion: string
  recurso_mencionado: string
  short_circuit: boolean
  jev_latency_ms: number
  reserva_concretada: boolean
  booked_turno_id: string | null
  turnos: Turno[]
}

export interface TurnosSyncPayload {
  turnos: Turno[]
  bookedTurnoId?: string | null
  scrollToBooked?: boolean
}

const rawEnvApiUrl = process.env.NEXT_PUBLIC_API_URL || ''

// Si la variable de entorno apunta a localhost/127.0.0.1 (o está vacía), usamos ruta relativa ''
// para que el proxy de Next.js (/api/* -> 127.0.0.1:8000) funcione tanto en la PC como
// entrando desde el celular en la misma red Wi-Fi (ej. http://192.168.x.x:3000).
export const API_BASE_URL =
  !rawEnvApiUrl ||
  rawEnvApiUrl.includes('localhost') ||
  rawEnvApiUrl.includes('127.0.0.1')
    ? ''
    : rawEnvApiUrl.replace(/\/$/, '')

export async function fetchApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  try {
    const res = await fetch(`${API_BASE_URL}${cleanPath}`, init)
    if (res.ok || res.status < 500) {
      return res
    }
  } catch {
    // Si falla el proxy relativo, intentamos directo al puerto 8000 del host actual (ej. 192.168.x.x:8000)
  }

  if (typeof window !== 'undefined') {
    const directHostUrl = `http://${window.location.hostname}:8000${cleanPath}`
    return fetch(directHostUrl, init)
  }

  return fetch(`http://127.0.0.1:8000${cleanPath}`, init)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export const TURNOS_SYNC_EVENT = 'turniate:turnos-updated'

export function dispatchTurnosSync(payload: TurnosSyncPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<TurnosSyncPayload>(TURNOS_SYNC_EVENT, { detail: payload })
    )
  }
}

