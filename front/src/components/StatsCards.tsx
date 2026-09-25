'use client'

import React, { useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Sparkles,
} from 'lucide-react'
import type { Turno } from '@/src/lib/supabase'

interface StatsCardsProps {
  turnos: Turno[]
}

export function StatsCards({ turnos }: StatsCardsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const totalTurnos = turnos.length
  const confirmados = turnos.filter((t) => t.estado === 'ocupado').length
  const disponibles = turnos.filter((t) => t.estado === 'libre').length
  const porcentajeOcupacion =
    totalTurnos > 0 ? Math.round((confirmados / totalTurnos) * 100) : 0

  return (
    <div className="mt-5 border-t border-[#edf0ec] pt-4">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-[#e5ebe3] bg-[#f9fbf8] px-4 py-2.5 text-xs font-semibold text-[#3a4439] transition hover:bg-[#f0f6ee]"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-[#4e851b]" />
          <span>Métricas del día</span>
          <span className="rounded-md bg-[#e7f4dc] px-2 py-0.5 text-[10px] font-bold text-[#2f690c]">
            {porcentajeOcupacion}% ocupación ({confirmados}/{totalTurnos})
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#6e786d]">
          {isOpen ? (
            <>
              Ocultar <ChevronUp size={14} />
            </>
          ) : (
            <>
              Ver detalle <ChevronDown size={14} />
            </>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard
            label="Turnos hoy"
            value={String(totalTurnos)}
            icon={<CalendarDays size={15} />}
          />
          <StatCard
            label="Ocupados"
            value={String(confirmados)}
            icon={<Check size={15} />}
          />
          <StatCard
            label="Libres"
            value={String(disponibles)}
            icon={<Clock3 size={15} />}
          />
          <StatCard
            label="Ocupación"
            value={`${porcentajeOcupacion}%`}
            icon={<Sparkles size={15} />}
          />
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#edf0ec] bg-[#fafcfa] px-3 py-2.5">
      <div className="flex items-center justify-between text-[#75a844]">
        <span className="text-[11px] font-medium text-[#899289]">{label}</span>
        {icon}
      </div>
      <p className="mt-1 text-lg font-semibold text-[#202320]">{value}</p>
    </div>
  )
}
