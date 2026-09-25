'use client'

import { useState } from 'react'
import { Check, Copy, Info, Mail, Send, Sparkles, X } from 'lucide-react'
import { ChatSimulator } from '@/src/components/ChatSimulator'
import { DashboardAgenda } from '@/src/components/DashboardAgenda'

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'juan@turniate.com'

export default function Page() {
  const [showEnd, setShowEnd] = useState(false)
  const [senderEmail, setSenderEmail] = useState('')
  const [senderMessage, setSenderMessage] = useState(
    'Hola, probé la demo de Turnos-Simple y me gustaría implementarlo en mi negocio.'
  )
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [mailTriggered, setMailTriggered] = useState(false)

  function handleSendEmail(e: React.FormEvent) {
    e.preventDefault()
    const subject = encodeURIComponent('Quiero sumar Turnos-Simple a mi negocio')
    const body = encodeURIComponent(
      `${senderMessage}\n\nMi correo / contacto: ${senderEmail || 'No especificado'}`
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
    setMailTriggered(true)
  }

  function handleCopyEmail() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2500)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f5f4] text-[#202320]">
      <header className="flex h-16 items-center justify-between border-b border-[#e6e8e5] bg-white px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-xl bg-[#d8f35b] text-[#283500]">
            <Sparkles size={16} />
          </div>
          <span className="text-sm font-bold tracking-tight">
            Turnos-Simple{' '}
            <span className="font-normal text-[#899087]">
              / Demo Interactiva
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEnd(true)}
            className="rounded-lg bg-[#202320] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3e453e]"
          >
            Contactar / Cierre
          </button>
          <div className="grid size-8 place-items-center rounded-full bg-[#e8eee7] text-xs font-bold">
            TS
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 pt-5 lg:px-8 lg:pt-6">
        {/* Cuadro de "Espacios" AFUERA de las secciones, como barra superior general */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#6cc22f] bg-gradient-to-r from-[#eafbe0] via-[#f3fceb] to-[#e9f9df] px-4 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#38940b] text-white">
              <Info size={16} />
            </div>
            <p className="text-xs leading-relaxed text-[#1f3b0e] sm:text-sm">
              <strong>¿Qué es un &ldquo;Espacio&rdquo;?</strong> Llamamos{' '}
              <strong>Espacio 1, 2 y 3</strong> a los lugares reservables de forma
              genérica. En tu negocio se nombran según tu rubro:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[#9ad96c] bg-white px-2.5 py-1 text-xs font-semibold text-[#234d0d]">
              ⚽ Cancha 1 / 2
            </span>
            <span className="rounded-lg border border-[#9ad96c] bg-white px-2.5 py-1 text-xs font-semibold text-[#234d0d]">
              💈 Silla de peluquero
            </span>
            <span className="rounded-lg border border-[#9ad96c] bg-white px-2.5 py-1 text-xs font-semibold text-[#234d0d]">
              🩺 Consultorio
            </span>
          </div>
        </div>

        {/* Columnas principales alineadas a la misma altura */}
        <div className="flex flex-col gap-5 pb-8 lg:flex-row lg:items-start">
          <ChatSimulator
            maxMessages={7}
            onLimitReached={() => setShowEnd(true)}
          />

          <DashboardAgenda />
        </div>
      </div>

      {showEnd && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#182019]/50 p-5 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={() => setShowEnd(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-[#8a9389] hover:text-[#202320]"
            >
              <X size={20} />
            </button>

            <div className="text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#d8f35b] text-[#314400]">
                <Sparkles size={25} />
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#64962e]">
                Fin de la demostración (7 mensajes)
              </p>
              <h3 className="mt-1.5 text-2xl font-semibold tracking-tight">
                ¿Te gustaría tenerlo en tu negocio?
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#6c756c]">
                Automatizá las reservas de tus espacios por WhatsApp las 24 hs.
                Dejame un correo acá abajo y lo adaptamos a tu rubro.
              </p>
            </div>

            <form onSubmit={handleSendEmail} className="mt-5 space-y-3 text-left">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#475247]">
                  Tu correo o WhatsApp de contacto
                </label>
                <input
                  type="text"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="ejemplo@tunegocio.com o +54 9 11..."
                  className="w-full rounded-xl border border-[#d8e0d5] bg-[#fafcfa] px-3.5 py-2 text-xs outline-none focus:border-[#6cc22f] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#475247]">
                  Mensaje
                </label>
                <textarea
                  rows={3}
                  value={senderMessage}
                  onChange={(e) => setSenderMessage(e.target.value)}
                  className="w-full resize-none rounded-xl border border-[#d8e0d5] bg-[#fafcfa] px-3.5 py-2 text-xs outline-none focus:border-[#6cc22f] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#38940b] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#2d7808]"
              >
                <Send size={14} />
                {mailTriggered ? '¡Cliente de correo abierto! Enviar de nuevo' : 'Mandarme un mail ahora'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#e6ece4] bg-[#f7faf6] px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-[#475247]">
                <Mail size={14} className="text-[#4e851b]" />
                <span className="font-medium">{CONTACT_EMAIL}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-[#394239] shadow-2xs hover:bg-[#eef3ec]"
              >
                {copiedEmail ? (
                  <>
                    <Check size={12} className="text-[#38940b]" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copiar mail
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
