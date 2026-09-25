'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Radio, RotateCcw } from 'lucide-react'
import {
  API_BASE_URL,
  supabase,
  TURNOS_SYNC_EVENT,
  type Recurso,
  type Turno,
  type TurnosSyncPayload,
} from '@/src/lib/supabase'
import { StatsCards } from '@/src/components/StatsCards'
import { TurnoRow } from '@/src/components/TurnoRow'

const FALLBACK_RECURSOS: Recurso[] = [
  { id: '11111111-1111-4111-8111-111111111111', nombre: 'Espacio 1', activo: true },
  { id: '22222222-2222-4222-8222-222222222222', nombre: 'Espacio 2', activo: true },
  { id: '33333333-3333-4333-8333-333333333333', nombre: 'Espacio 3', activo: true },
]

const FALLBACK_TURNOS: Turno[] = [
  {
    id: 't-1',
    recurso_id: '11111111-1111-4111-8111-111111111111',
    hora_inicio: '09:00',
    estado: 'ocupado',
    nombre_cliente: 'Martina López',
    recursos: FALLBACK_RECURSOS[0],
  },
  {
    id: 't-2',
    recurso_id: '11111111-1111-4111-8111-111111111111',
    hora_inicio: '10:30',
    estado: 'libre',
    nombre_cliente: null,
    recursos: FALLBACK_RECURSOS[0],
  },
  {
    id: 't-3',
    recurso_id: '22222222-2222-4222-8222-222222222222',
    hora_inicio: '10:30',
    estado: 'ocupado',
    nombre_cliente: 'Sofía Martínez',
    recursos: FALLBACK_RECURSOS[1],
  },
  {
    id: 't-4',
    recurso_id: '11111111-1111-4111-8111-111111111111',
    hora_inicio: '12:00',
    estado: 'libre',
    nombre_cliente: null,
    recursos: FALLBACK_RECURSOS[0],
  },
  {
    id: 't-5',
    recurso_id: '22222222-2222-4222-8222-222222222222',
    hora_inicio: '12:00',
    estado: 'libre',
    nombre_cliente: null,
    recursos: FALLBACK_RECURSOS[1],
  },
  {
    id: 't-6',
    recurso_id: '33333333-3333-4333-8333-333333333333',
    hora_inicio: '14:30',
    estado: 'ocupado',
    nombre_cliente: 'Camila Torres',
    recursos: FALLBACK_RECURSOS[2],
  },
  {
    id: 't-7',
    recurso_id: '11111111-1111-4111-8111-111111111111',
    hora_inicio: '15:00',
    estado: 'ocupado',
    nombre_cliente: 'Lucía Fernández',
    recursos: FALLBACK_RECURSOS[0],
  },
  {
    id: 't-8',
    recurso_id: '22222222-2222-4222-8222-222222222222',
    hora_inicio: '16:00',
    estado: 'libre',
    nombre_cliente: null,
    recursos: FALLBACK_RECURSOS[1],
  },
  {
    id: 't-9',
    recurso_id: '33333333-3333-4333-8333-333333333333',
    hora_inicio: '17:00',
    estado: 'libre',
    nombre_cliente: null,
    recursos: FALLBACK_RECURSOS[2],
  },
  {
    id: 't-10',
    recurso_id: '33333333-3333-4333-8333-333333333333',
    hora_inicio: '18:00',
    estado: 'libre',
    nombre_cliente: null,
    recursos: FALLBACK_RECURSOS[2],
  },
]

function normalizeEspacioName(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'recurso a') return 'Espacio 1'
  if (lower === 'recurso b') return 'Espacio 2'
  if (lower === 'sillón 1' || lower === 'sillon 1') return 'Espacio 3'
  return name
}

export function DashboardAgenda() {
  const [turnos, setTurnos] = useState<Turno[]>(FALLBACK_TURNOS)
  const [recursos, setRecursos] = useState<Recurso[]>(FALLBACK_RECURSOS)
  const [espacioSeleccionado, setEspacioSeleccionado] = useState<string>('todos')
  const [realtimeStatus, setRealtimeStatus] = useState<'conectado' | 'sincronizado'>(
    'sincronizado'
  )
  const [highlightedTurnoId, setHighlightedTurnoId] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const triggerHighlight = useCallback(
    (turnoId: string | null | undefined, shouldScroll = false) => {
      if (!turnoId) return
      setHighlightedTurnoId(turnoId)
      if (shouldScroll && typeof document !== 'undefined') {
        setTimeout(() => {
          const el = document.getElementById(`turno-row-${turnoId}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)
      }
      setTimeout(() => {
        setHighlightedTurnoId((prev) => (prev === turnoId ? null : prev))
      }, 6000)
    },
    []
  )

  const cargarAgendaInicial = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/turnos`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.recursos) && data.recursos.length > 0) {
          setRecursos(
            data.recursos.map((r: Recurso) => ({
              ...r,
              nombre: normalizeEspacioName(r.nombre),
            }))
          )
        }
        if (Array.isArray(data.turnos) && data.turnos.length > 0) {
          setTurnos(
            data.turnos.map((t: Turno) => ({
              ...t,
              recursos: t.recursos
                ? { ...t.recursos, nombre: normalizeEspacioName(t.recursos.nombre) }
                : undefined,
            }))
          )
          return
        }
      }
    } catch {
      // Fallback a Supabase directo si el backend está apagado
    }

    if (supabase) {
      try {
        const [{ data: recData }, { data: turData }] = await Promise.all([
          supabase.from('recursos').select('*').eq('activo', true).order('nombre'),
          supabase.from('turnos').select('*, recursos(id, nombre, activo)').order('hora_inicio'),
        ])
        if (recData && recData.length > 0) {
          setRecursos(
            (recData as Recurso[]).map((r) => ({
              ...r,
              nombre: normalizeEspacioName(r.nombre),
            }))
          )
        }
        if (turData && turData.length > 0) {
          setTurnos(
            (turData as Turno[]).map((t) => ({
              ...t,
              recursos: t.recursos
                ? { ...t.recursos, nombre: normalizeEspacioName(t.recursos.nombre) }
                : undefined,
            }))
          )
          setRealtimeStatus('conectado')
        }
      } catch {
        // Mantiene datos semilla locales
      }
    }
  }, [])

  useEffect(() => {
    cargarAgendaInicial()

    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
    if (supabase) {
      channel = supabase
        .channel('turnos-realtime-agenda')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'turnos' },
          (payload) => {
            cargarAgendaInicial()
            if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
              triggerHighlight(String(payload.new.id), false)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'turnos' },
          (payload) => {
            cargarAgendaInicial()
            if (
              payload.new &&
              typeof payload.new === 'object' &&
              'id' in payload.new &&
              payload.new.estado === 'ocupado'
            ) {
              triggerHighlight(String(payload.new.id), false)
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('conectado')
          }
        })
    }

    const handleCustomSync = (event: Event) => {
      const customEvt = event as CustomEvent<TurnosSyncPayload>
      const detail = customEvt.detail
      if (detail && Array.isArray(detail.turnos) && detail.turnos.length > 0) {
        setTurnos(
          detail.turnos.map((t) => ({
            ...t,
            recursos: t.recursos
              ? { ...t.recursos, nombre: normalizeEspacioName(t.recursos.nombre) }
              : undefined,
          }))
        )
        if (detail.bookedTurnoId) {
          setEspacioSeleccionado('todos')
          triggerHighlight(detail.bookedTurnoId, Boolean(detail.scrollToBooked))
        }
      }
    }
    window.addEventListener(TURNOS_SYNC_EVENT, handleCustomSync)

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
      window.removeEventListener(TURNOS_SYNC_EVENT, handleCustomSync)
    }
  }, [cargarAgendaInicial, triggerHighlight])

  async function handleManualUpdate(
    turnoId: string,
    nuevoEstado: 'libre' | 'ocupado',
    nombreCliente?: string
  ) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/turnos/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: turnoId,
          estado: nuevoEstado,
          nombre_cliente: nombreCliente || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.turnos)) {
          setTurnos(
            data.turnos.map((t: Turno) => ({
              ...t,
              recursos: t.recursos
                ? { ...t.recursos, nombre: normalizeEspacioName(t.recursos.nombre) }
                : undefined,
            }))
          )
        }
        if (nuevoEstado === 'ocupado') {
          triggerHighlight(turnoId, false)
        }
        return
      }
    } catch {
      setTurnos((prev) =>
        prev.map((t) =>
          t.id === turnoId
            ? {
                ...t,
                estado: nuevoEstado,
                nombre_cliente:
                  nuevoEstado === 'ocupado'
                    ? nombreCliente || 'Reserva Manual'
                    : null,
              }
            : t
        )
      )
      if (nuevoEstado === 'ocupado') {
        triggerHighlight(turnoId, false)
      }
    }
  }

  async function handleResetDemo() {
    setIsResetting(true)
    setHighlightedTurnoId(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/reset`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.turnos)) {
          setTurnos(
            data.turnos.map((t: Turno) => ({
              ...t,
              recursos: t.recursos
                ? { ...t.recursos, nombre: normalizeEspacioName(t.recursos.nombre) }
                : undefined,
            }))
          )
        }
        if (Array.isArray(data.recursos)) {
          setRecursos(
            data.recursos.map((r: Recurso) => ({
              ...r,
              nombre: normalizeEspacioName(r.nombre),
            }))
          )
        }
      }
    } catch {
      setTurnos(FALLBACK_TURNOS)
    } finally {
      setIsResetting(false)
    }
  }

  const turnosFiltrados = useMemo(() => {
    const base =
      espacioSeleccionado === 'todos'
        ? turnos
        : turnos.filter(
            (t) =>
              t.recurso_id === espacioSeleccionado ||
              t.recursos?.nombre === espacioSeleccionado
          )
    return [...base].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  }, [turnos, espacioSeleccionado])

  // Agrupar por hora fija para renderizar como la vista de Día de Google Calendar
  const bloquesPorHora = useMemo(() => {
    const mapa = new Map<string, Turno[]>()
    for (const t of turnosFiltrados) {
      const lista = mapa.get(t.hora_inicio) || []
      lista.push(t)
      mapa.set(t.hora_inicio, lista)
    }
    return Array.from(mapa.entries())
  }, [turnosFiltrados])

  const cantOcupados = turnosFiltrados.filter((t) => t.estado === 'ocupado').length
  const cantLibres = turnosFiltrados.filter((t) => t.estado === 'libre').length

  return (
    <section className="min-w-0 flex-1 rounded-2xl border border-[#e3e7e1] bg-white p-5 shadow-[0_16px_60px_rgba(30,50,30,0.06)] lg:p-6">
      {/* Cabecera directa */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ec] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a9389]">
              Vista Día · Calendario en vivo
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef7e9] px-2 py-0.5 text-[10px] font-semibold text-[#568723]">
              <Radio size={10} className="animate-pulse" />
              {realtimeStatus === 'conectado' ? 'Realtime activo' : 'Sincronizado'}
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Agenda de Hoy
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-[#e5ece3] bg-[#f8faf7] px-3 py-1.5 text-xs sm:flex">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#2d7a08]">
              <span className="size-2.5 rounded-full bg-[#38940b]" />
              {cantOcupados} reservados
            </span>
            <span className="text-[#c4cec2]">·</span>
            <span className="font-medium text-[#5e685e]">
              {cantLibres} disponibles
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isResetting}
            className="flex items-center gap-1.5 rounded-xl border border-[#dce2da] bg-[#fafcfa] px-3 py-2 text-xs font-semibold text-[#394239] transition hover:bg-[#eef2ed] disabled:opacity-50"
          >
            <RotateCcw size={13} className={isResetting ? 'animate-spin' : ''} />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Filtro rápido por Espacio */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEspacioSeleccionado('todos')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              espacioSeleccionado === 'todos'
                ? 'bg-[#202320] text-white shadow-2xs'
                : 'bg-[#f3f5f2] text-[#5e675e] hover:bg-[#e6ebe4]'
            }`}
          >
            Todos los espacios ({turnos.length})
          </button>
          {recursos.map((rec) => {
            const countRec = turnos.filter((t) => t.recurso_id === rec.id).length
            return (
              <button
                key={rec.id}
                type="button"
                onClick={() => setEspacioSeleccionado(rec.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  espacioSeleccionado === rec.id
                    ? 'bg-[#38940b] text-white shadow-2xs'
                    : 'bg-[#f3f5f2] text-[#5e675e] hover:bg-[#e6ebe4]'
                }`}
              >
                {rec.nombre} ({countRec})
              </button>
            )
          })}
        </div>
      </div>

      {/* GRILLA ESTILO GOOGLE CALENDAR (Vista de un Día con horas fijas a la izquierda) */}
      <div className="overflow-hidden rounded-2xl border border-[#e2e8e0] bg-[#fcfdfc]">
        {/* Cabecera de la tabla horaria */}
        <div className="flex items-center border-b border-[#e2e8e0] bg-[#f4f7f3] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#667365]">
          <div className="flex w-20 shrink-0 items-center gap-1">
            <Clock size={12} />
            <span>Hora</span>
          </div>
          <div className="flex-1 pl-3">
            Bloques de Espacios (Disponibles y Reservados)
          </div>
        </div>

        {/* Filas por cada Hora fija del día */}
        <div className="divide-y divide-[#e6ece4]">
          {bloquesPorHora.map(([hora, turnosDeEstaHora]) => (
            <div
              key={hora}
              className="flex flex-col gap-2 px-4 py-3 transition hover:bg-[#f7faf6] sm:flex-row sm:items-start"
            >
              {/* Columna izquierda: Hora fija */}
              <div className="flex w-20 shrink-0 items-baseline gap-1 pt-1 sm:flex-col sm:gap-0">
                <span className="text-sm font-extrabold tracking-tight text-[#252e24]">
                  {hora}
                </span>
                <span className="text-[10px] font-semibold uppercase text-[#889487]">
                  hs
                </span>
              </div>

              {/* Columna derecha: Rectángulos de turnos en esa franja horaria */}
              <div
                className={`grid flex-1 gap-2.5 sm:pl-3 ${
                  turnosDeEstaHora.length > 1
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {turnosDeEstaHora.map((turno) => (
                  <TurnoRow
                    key={turno.id}
                    turno={turno}
                    isHighlighted={highlightedTurnoId === turno.id}
                    onManualUpdate={handleManualUpdate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estadísticas compactas y desplegables al pie */}
      <StatsCards turnos={turnosFiltrados} />
    </section>
  )
}
