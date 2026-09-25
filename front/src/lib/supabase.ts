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

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

