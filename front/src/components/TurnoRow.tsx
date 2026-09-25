'use client'

import React, { useState } from 'react'
import { Check, Layers, RotateCcw, Sparkles, UserPlus, X } from 'lucide-react'
import type { Turno } from '@/src/lib/supabase'

interface TurnoRowProps {
  turno: Turno
  isHighlighted?: boolean
  onManualUpdate?: (
    turnoId: string,
    nuevoEstado: 'libre' | 'ocupado',
    nombreCliente?: string
  ) => Promise<void>
}

function normalizeEspacioLabel(rawName?: string): string {
  if (!rawName) return 'Espacio 1'
  const lower = rawName.toLowerCase()
  if (lower === 'recurso a') return 'Espacio 1'
  if (lower === 'recurso b') return 'Espacio 2'
  if (lower === 'sillón 1' || lower === 'sillon 1') return 'Espacio 3'
  return rawName
}

export function TurnoRow({
  turno,
  isHighlighted = false,
  onManualUpdate,
}: TurnoRowProps) {
  const [isEditingManual, setIsEditingManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const isOccupied = turno.estado === 'ocupado'
  const espacioNombre = normalizeEspacioLabel(turno.recursos?.nombre)
  const clienteNombre = isOccupied
    ? turno.nombre_cliente || 'Cliente confirmado'
    : 'Turno disponible'

  async function handleConfirmManual(e: React.FormEvent) {
    e.preventDefault()
    if (!onManualUpdate) return
    setIsSaving(true)
    try {
      await onManualUpdate(
        turno.id,
        'ocupado',
        manualName.trim() || 'Reserva Manual'
      )
      setIsEditingManual(false)
      setManualName('')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLiberarTurno() {
    if (!onManualUpdate) return
    setIsSaving(true)
    try {
      await onManualUpdate(turno.id, 'libre')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      id={`turno-row-${turno.id}`}
      className={`relative flex flex-col justify-between rounded-xl border px-3.5 py-2.5 transition-all duration-500 ${
        isHighlighted
          ? 'scale-[1.01] border-2 border-l-[6px] border-[#298200] border-l-[#1f6600] bg-[#cdf7ab] shadow-[0_0_24px_rgba(56,170,10,0.4)] ring-4 ring-[#58cc1c]/35'
          : isOccupied
          ? 'border-[#80cf4e] border-l-[5px] border-l-[#328c07] bg-[#eafbe0] shadow-2xs'
          : 'border-dashed border-[#c5d6c0] border-l-[4px] border-l-[#b2c9ab] bg-[#fbfdfb] hover:border-[#88bf64] hover:bg-[#f3faee]'
      }`}
    >
      {/* Cabecera del rectángulo: Espacio + Badge de estado */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
            isOccupied
              ? 'bg-[#2f8506] text-white'
              : 'bg-[#e9efe7] text-[#455245]'
          }`}
        >
          <Layers size={11} />
          {espacioNombre}
        </span>

        {isHighlighted ? (
          <span className="inline-flex animate-bounce items-center gap-1 rounded-full bg-[#1e6300] px-2 py-0.5 text-[10px] font-bold text-white">
            <Sparkles size={10} />
            ¡NUEVA RESERVA!
          </span>
        ) : isOccupied ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#256b04]">
            <Check size={11} />
            Reservado
          </span>
        ) : (
          <span className="text-[10px] font-medium text-[#728270]">
            Disponible
          </span>
        )}
      </div>

      {/* Cuerpo del rectángulo: Nombre del cliente + Botón Ocupar / Liberar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-bold ${
              isOccupied ? 'text-[#153306]' : 'text-[#687568]'
            }`}
          >
            {clienteNombre}
          </p>
          <p className="text-[10px] text-[#5e6e5c]">
            {turno.hora_inicio} hs ·{' '}
            {isOccupied ? 'Confirmado en agenda' : 'Horario libre'}
          </p>
        </div>

        {isOccupied ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={handleLiberarTurno}
            className="inline-flex cursor-pointer touch-manipulation items-center gap-1 rounded-lg border border-[#7bc94c] bg-white px-3 py-1.5 text-xs font-semibold text-[#286b07] shadow-2xs transition hover:bg-[#f4fdef] active:scale-95 disabled:opacity-50 sm:px-2.5 sm:py-1 sm:text-[11px]"
          >
            <RotateCcw size={11} />
            Liberar
          </button>
        ) : isEditingManual ? (
          <form
            onSubmit={handleConfirmManual}
            className="flex w-full items-center gap-1.5 pt-1"
          >
            <input
              type="text"
              autoFocus
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Nombre del cliente..."
              className="min-w-0 flex-1 rounded-lg border border-[#72bf44] bg-white px-2.5 py-1.5 text-base text-[#202320] outline-none focus:ring-2 focus:ring-[#58cc1c] sm:py-1 sm:text-xs"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="cursor-pointer touch-manipulation rounded-lg bg-[#38940b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2c7508] active:scale-95 disabled:opacity-50 sm:px-2.5 sm:py-1"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditingManual(false)
                setManualName('')
              }}
              className="grid size-7 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-lg text-[#728071] hover:bg-[#e7eee5] sm:size-6"
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingManual(true)}
            className="inline-flex cursor-pointer touch-manipulation items-center gap-1 rounded-lg bg-[#38940b] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#2c7508] active:scale-95 sm:px-3 sm:py-1 sm:text-[11px]"
          >
            <UserPlus size={11} />
            Ocupar
          </button>
        )}
      </div>
    </div>
  )
}
