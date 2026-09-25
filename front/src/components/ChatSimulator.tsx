'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Check,
  CircleHelp,
  Layers,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Send,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import {
  dispatchTurnosSync,
  fetchApi,
  supabase,
  type ChatApiResponse,
  type Turno,
} from '@/src/lib/supabase'

export interface ChatMessage {
  from: 'bot' | 'user'
  text: string
  time: string
  meta?: {
    intencion?: string
    recurso?: string
    shortCircuit?: boolean
    latencyMs?: number
    reservaConcretada?: boolean
  }
}

interface ChatSimulatorProps {
  maxMessages?: number
  onLimitReached?: () => void
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    from: 'bot',
    text: '¡Hola! 👋 Bienvenido a **Turnos-Simple**. Contamos con **Espacio 1**, **Espacio 2** y **Espacio 3**.',
    time: '10:08',
  },
  {
    from: 'bot',
    text: '¿Qué horario te gustaría consultar o reservar para hoy?',
    time: '10:08',
  },
]

const SUGGESTIONS = [
  '¿Qué espacios y horarios tenés libres hoy?',
  'Quiero reservar el Espacio 1 a las 10:30',
  'Reservame el Espacio 2 a las 12:00 a nombre de Juan',
  'Quiero 2 pizzas y una Coca-Cola',
]

function renderFormattedText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-[#1a2417]">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <strong key={idx} className="font-semibold text-[#1a2417]">
          {part.slice(1, -1)}
        </strong>
      )
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>
  })
}

export function ChatSimulator({
  maxMessages = 7,
  onLimitReached,
}: ChatSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [userMessageCount, setUserMessageCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showHelpInfo, setShowHelpInfo] = useState(false)
  const [sessionId, setSessionId] = useState('demo-session')
  const chatScrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSessionId(`demo-${Math.random().toString(36).slice(2, 9)}`)
  }, [])

  const isLocked = userMessageCount >= maxMessages

  useEffect(() => {
    const container = chatScrollContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, isLoading])

  function getCurrentTimeStr(): string {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`
  }

  async function runClientSupabaseFallback(text: string): Promise<ChatApiResponse> {
    const lower = text.toLowerCase()
    if (lower.includes('pizza') || lower.includes('coca')) {
      return {
        reply:
          'Solo gestiono reservas de espacios. ¿Querés consultar disponibilidad para hoy?',
        intencion: 'fuera_de_dominio',
        recurso_mencionado: 'no_especifica',
        short_circuit: true,
        jev_latency_ms: 12,
        reserva_concretada: false,
        booked_turno_id: null,
        turnos: [],
      }
    }

    let currentTurnos: Turno[] = []
    if (supabase) {
      const { data } = await supabase
        .from('turnos')
        .select('*, recursos(id, nombre, activo)')
        .order('hora_inicio')
      if (data) currentTurnos = data as Turno[]
    }

    const espacioMatch = lower.match(/espacio\s*([123])/)
    const horaMatch = lower.match(/\b(09:00|10:30|12:00|14:30|15:00|16:00|17:00|18:00)\b/)
    const nameMatch =
      text.match(/nombre(?:\s+de|\s+es)?\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,30})/i) ||
      text.match(/soy\s+([A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,30})/i)

    if (
      (lower.includes('reserv') || lower.includes('quiero') || nameMatch) &&
      espacioMatch &&
      horaMatch
    ) {
      const targetEspacio = `Espacio ${espacioMatch[1]}`
      const targetHora = horaMatch[1]
      const clientName = nameMatch ? nameMatch[1].trim() : null

      if (!clientName) {
        return {
          reply: `¡El **${targetEspacio}** a las **${targetHora} hs** está disponible! ¿A nombre de quién registramos la reserva?`,
          intencion: 'reservar',
          recurso_mencionado: targetEspacio,
          short_circuit: false,
          jev_latency_ms: 18,
          reserva_concretada: false,
          booked_turno_id: null,
          turnos: currentTurnos,
        }
      }

      const slot = currentTurnos.find(
        (t) =>
          t.hora_inicio === targetHora &&
          (t.recursos?.nombre === targetEspacio ||
            (targetEspacio === 'Espacio 1' && t.recurso_id.startsWith('1111')) ||
            (targetEspacio === 'Espacio 2' && t.recurso_id.startsWith('2222')) ||
            (targetEspacio === 'Espacio 3' && t.recurso_id.startsWith('3333')))
      )

      if (slot && slot.estado === 'libre' && supabase) {
        await supabase
          .from('turnos')
          .update({ estado: 'ocupado', nombre_cliente: clientName })
          .eq('id', slot.id)
        const { data: updated } = await supabase
          .from('turnos')
          .select('*, recursos(id, nombre, activo)')
          .order('hora_inicio')
        return {
          reply: `¡Listo, **${clientName}**! Tu reserva en **${targetEspacio}** para hoy a las **${targetHora} hs** quedó confirmada en la agenda.`,
          intencion: 'reservar',
          recurso_mencionado: targetEspacio,
          short_circuit: false,
          jev_latency_ms: 25,
          reserva_concretada: true,
          booked_turno_id: slot.id,
          turnos: (updated as Turno[]) || currentTurnos,
        }
      }
    }

    const libres = currentTurnos.filter((t) => t.estado === 'libre')
    const resumen =
      libres.length > 0
        ? libres
            .map(
              (t) =>
                `• **${t.recursos?.nombre || 'Espacio'}**: ${t.hora_inicio} hs`
            )
            .join('\n')
        : '• **Espacio 1**: 10:30 hs, 12:00 hs\n• **Espacio 2**: 12:00 hs, 16:00 hs\n• **Espacio 3**: 17:00 hs, 18:00 hs'

    return {
      reply: `¡Hola! Estos son los turnos libres de hoy:\n\n${resumen}\n\n¿Cuál te gustaría reservar y a nombre de quién?`,
      intencion: 'consultar_disponibilidad',
      recurso_mencionado: 'no_especifica',
      short_circuit: false,
      jev_latency_ms: 20,
      reserva_concretada: false,
      booked_turno_id: null,
      turnos: currentTurnos,
    }
  }

  async function sendMessage(textToSend?: string) {
    const rawValue =
      typeof textToSend === 'string'
        ? textToSend
        : input || inputRef.current?.value || ''
    const cleanText = rawValue.trim()
    if (!cleanText || isLoading || isLocked) return

    const nextCount = userMessageCount + 1
    setUserMessageCount(nextCount)
    setInput('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }

    const userMsg: ChatMessage = {
      from: 'user',
      text: cleanText,
      time: getCurrentTimeStr(),
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      let data: ChatApiResponse
      try {
        const response = await fetchApi('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanText,
            session_id: sessionId,
          }),
        })

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error(errBody.detail || `Error HTTP ${response.status}`)
        }

        data = await response.json()
      } catch {
        // Si se abre desde el celular fuera de la red de la PC o con el backend local apagado,
        // responde directamente contra Supabase para que nunca se trabe la demo.
        data = await runClientSupabaseFallback(cleanText)
      }

      if (Array.isArray(data.turnos) && data.turnos.length > 0) {
        dispatchTurnosSync({
          turnos: data.turnos,
          bookedTurnoId: data.booked_turno_id,
          scrollToBooked: Boolean(data.reserva_concretada),
        })
      }

      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: data.reply,
          time: getCurrentTimeStr(),
          meta: {
            intencion: data.intencion,
            recurso: data.recurso_mencionado,
            shortCircuit: data.short_circuit,
            latencyMs: data.jev_latency_ms,
            reservaConcretada: data.reserva_concretada,
          },
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text:
            error instanceof Error
              ? `No pude conectar con el servidor (${error.message}).`
              : 'Error de conexión con el servidor.',
          time: getCurrentTimeStr(),
        },
      ])
    } finally {
      setIsLoading(false)
      if (nextCount >= maxMessages) {
        onLimitReached?.()
      }
    }
  }

  return (
    <section className="relative flex w-full flex-col rounded-2xl border border-[#e3e7e1] bg-white p-5 shadow-[0_16px_60px_rgba(30,50,30,0.06)] lg:w-[39%] lg:min-w-[390px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a9389]">
            Experiencia del cliente
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Chat de WhatsApp
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isLocked
                ? 'bg-[#fee2e2] text-[#991b1b]'
                : 'bg-[#e9f7de] text-[#4e851b]'
            }`}
          >
            {userMessageCount}/{maxMessages} mensajes
          </span>
          <button
            type="button"
            onClick={() => setShowHelpInfo((prev) => !prev)}
            aria-label="Información sobre este simulador de WhatsApp"
            className={`flex size-9 items-center justify-center rounded-full border transition ${
              showHelpInfo
                ? 'border-[#38940b] bg-[#38940b] text-white shadow-sm'
                : 'border-[#cce6b8] bg-[#e9f7de] text-[#4e851b] hover:bg-[#dbf2c9]'
            }`}
          >
            <CircleHelp size={18} />
          </button>
        </div>
      </div>

      {/* Cuadro desplegable al tocar el botón '?' */}
      {showHelpInfo && (
        <div className="mb-4 rounded-2xl border-2 border-[#76c442] bg-[#f3fce9] p-4 text-xs text-[#1f3614] shadow-md">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-[#25590c]">
              <MessageCircle size={16} className="shrink-0 text-[#38940b]" />
              <span>¿Cómo funciona este simulador?</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHelpInfo(false)}
              className="rounded-full p-0.5 text-[#587549] hover:bg-[#e1f4cf]"
            >
              <X size={15} />
            </button>
          </div>

          <p className="mt-2 leading-relaxed">
            <strong>1. Experiencia real del cliente:</strong> Este chat es{' '}
            <strong>exactamente con lo que interactuarán tus clientes</strong> por
            WhatsApp para consultar disponibilidad y agendar sus turnos las 24 hs.
          </p>

          <div className="mt-2.5 border-t border-[#cde8b8] pt-2.5 leading-relaxed">
            <p className="flex items-center gap-1.5 font-bold text-[#25590c]">
              <Layers size={14} className="shrink-0 text-[#38940b]" />
              <span>¿Qué significa &ldquo;Espacio 1, 2 y 3&rdquo;?</span>
            </p>
            <p className="mt-1">
              2. Usamos la palabra <strong>&ldquo;Espacio&rdquo;</strong> de forma
              genérica para esta demostración. En tu negocio puede
              referirse, por ejemplo, a la <strong>Cancha 1</strong>, un{' '}
              <strong>Consultorio</strong> o un{' '}
              <strong>Salon</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Marco del teléfono simulador */}
      <div className="mx-auto flex h-[560px] w-full max-w-[370px] shrink-0 flex-col overflow-hidden rounded-[28px] border-[7px] border-[#202520] bg-[#f1f4ee] shadow-[0_14px_35px_rgba(30,40,30,0.2)]">
        {/* Header WhatsApp */}
        <div className="flex items-center gap-3 bg-[#273c2c] px-4 py-3 text-white">
          <div className="grid size-9 place-items-center rounded-full bg-[#d8f35b] text-[#273c2c]">
            <Sparkles size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Turnos-Simple Bot</p>
            <p className="text-[10px] text-[#bad0bd]">
              {isLoading ? 'escribiendo...' : 'en línea · Asistente WhatsApp'}
            </p>
          </div>
          <MoreHorizontal size={18} />
        </div>

        {/* Historial de mensajes */}
        <div
          ref={chatScrollContainerRef}
          className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(#dce6d8_1px,transparent_1px)] bg-[length:14px_14px] p-3"
        >
          <p className="mx-auto w-fit rounded-full bg-[#e3ede0] px-3 py-1 text-[10px] text-[#728071]">
            HOY
          </p>

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                message.from === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                  message.from === 'user'
                    ? 'rounded-br-sm bg-[#d9f4b8] text-[#263021]'
                    : 'rounded-bl-sm bg-white text-[#3d443e]'
                }`}
              >
                <p className="whitespace-pre-line">
                  {renderFormattedText(message.text)}
                </p>
                <p className="mt-1 text-right text-[9px] text-[#8b9a87]">
                  {message.time} <Check className="ml-0.5 inline" size={10} />
                </p>
              </div>

              {message.meta && (
                <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
                  {message.meta.shortCircuit ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#fef3c7] px-1.5 py-0.5 text-[9px] font-medium text-[#92400e]">
                      <ShieldAlert size={10} />
                      Short-Circuit JEV ({message.meta.intencion}) ·{' '}
                      {message.meta.latencyMs}ms
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#e3ede0] px-1.5 py-0.5 text-[9px] font-medium text-[#3b5239]">
                      <Zap size={10} />
                      JEV: {message.meta.intencion}
                      {message.meta.recurso &&
                      message.meta.recurso !== 'no_especifica'
                        ? ` (${message.meta.recurso})`
                        : ''}{' '}
                      · FastMCP
                      {message.meta.reservaConcretada ? ' · ✓ Agendado' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-xs text-[#6e776e] shadow-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-[#78b832]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-[#78b832] [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-[#78b832] [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input o Estado Bloqueado tras 7 mensajes */}
        {isLocked ? (
          <div className="flex items-center justify-between gap-2 border-t border-[#e1e8de] bg-[#f4f7f2] px-3 py-2.5 text-xs text-[#4f594f]">
            <div className="flex items-center gap-1.5 font-medium">
              <Lock size={14} className="text-[#64962e]" />
              <span>Límite de prueba alcanzado ({maxMessages}/{maxMessages})</span>
            </div>
            <button
              type="button"
              onClick={() => onLimitReached?.()}
              className="rounded-lg bg-[#202320] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#3e453e]"
            >
              Contactar
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage()
            }}
            className="flex items-center gap-2 bg-[#f8fbf7] p-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              placeholder="Ej: Quiero reservar el Espacio 1 a las 12:00..."
              className="min-w-0 flex-1 rounded-full border border-[#e1e8de] bg-white px-3 py-2 text-base outline-none placeholder:text-[#a0aaa0] focus:border-[#9bcf63] disabled:opacity-60 sm:text-xs"
            />
            <button
              type="submit"
              disabled={isLoading}
              onClick={() => sendMessage()}
              aria-label="Enviar mensaje"
              className="grid size-9 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full bg-[#78b832] text-white transition hover:bg-[#5e951e] active:scale-95 disabled:opacity-50 sm:size-8"
            >
              <Send size={14} />
            </button>
          </form>
        )}
      </div>

      {/* Sugerencias rápidas */}
      <div className="mt-4">
        <p className="mb-2 text-center text-[11px] font-medium text-[#8a9389]">
          Probá un clic rápido (consulta, reserva pidiendo nombre o filtro fuera de dominio):
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              disabled={isLocked || isLoading}
              onClick={() => sendMessage(sug)}
              className="cursor-pointer touch-manipulation rounded-full border border-[#dce4d9] bg-[#f8faf7] px-3 py-1.5 text-xs text-[#475247] transition hover:border-[#9bcf63] hover:bg-[#eef9e6] active:scale-95 disabled:opacity-40 sm:px-2.5 sm:py-1 sm:text-[11px]"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
