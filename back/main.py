import time
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_service import (
    chat_sessions,
    clasificar_mensaje_jev,
    consultar_grilla,
    crear_reserva,
    ejecutar_orquestador_mcp,
    limpiar_sesiones_chat,
)
from config import GEMINI_API_KEY, TYPESAFE_API_KEY
from database import (
    db_actualizar_turno_manual,
    db_obtener_recursos,
    db_obtener_turnos,
    db_resetear_demo,
    limpiar_contexto_request,
    request_ctx,
    supabase_client,
)

app = FastAPI(
    title="Turnos-Simple API (JEV + FastMCP + Supabase)",
    description="Backend B2B para reservas de Espacios en tiempo real",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str = "demo-session"


class ChatResponse(BaseModel):
    reply: str
    intencion: str
    recurso_mencionado: str
    short_circuit: bool
    jev_latency_ms: float
    reserva_concretada: bool = False
    booked_turno_id: Optional[str] = None
    turnos: list[dict[str, Any]]


class ManualTurnoRequest(BaseModel):
    turno_id: str
    estado: str
    nombre_cliente: Optional[str] = None


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "supabase_connected": supabase_client is not None,
        "jev_configured": bool(TYPESAFE_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY),
    }


@app.get("/api/turnos")
def listar_turnos():
    return {
        "recursos": db_obtener_recursos(solo_activos=True),
        "turnos": db_obtener_turnos(),
    }


@app.post("/api/turnos/manual")
def actualizar_turno_manual(req: ManualTurnoRequest):
    return db_actualizar_turno_manual(
        turno_id=req.turno_id,
        estado=req.estado,
        nombre_cliente=req.nombre_cliente,
    )


@app.post("/api/reset")
def resetear_demo():
    limpiar_sesiones_chat()
    return db_resetear_demo()


@app.post("/api/chat", response_model=ChatResponse)
def procesar_chat(req: ChatRequest):
    t_start = time.perf_counter()
    mensaje = req.message.strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")

    limpiar_contexto_request()
    recursos_activos = db_obtener_recursos(solo_activos=True, usar_cache=True)
    turnos_actuales = db_obtener_turnos(usar_cache=True)

    # 1. Validación JEV (Sistema 1)
    resultado_jev = clasificar_mensaje_jev(mensaje, recursos_activos)
    intencion = resultado_jev["intencion"]
    recurso_mencionado = resultado_jev["recurso_mencionado"]
    jev_latency_ms = resultado_jev["latency_ms"]

    # 2. Short-Circuit si la intención es "fuera_de_dominio"
    tiene_historial = len(chat_sessions.get(req.session_id, [])) > 0
    if intencion == "fuera_de_dominio" and not (tiene_historial and len(mensaje.split()) <= 4):
        nombres_espacios = ", ".join(r["nombre"] for r in recursos_activos)
        mensaje_corto = (
            "¡Hola! Soy el asistente automático de reservas. "
            f"Solo puedo ayudarte a consultar disponibilidad o agendar turnos en nuestros espacios (**{nombres_espacios}**). "
            "¿Te gustaría ver los horarios libres de hoy?"
        )
        return ChatResponse(
            reply=mensaje_corto,
            intencion="fuera_de_dominio",
            recurso_mencionado=recurso_mencionado,
            short_circuit=True,
            jev_latency_ms=jev_latency_ms,
            reserva_concretada=False,
            booked_turno_id=None,
            turnos=turnos_actuales,
        )

    # 3. Ejecución MCP con Orquestador LLM (Sistema 2)
    try:
        respuesta_llm = ejecutar_orquestador_mcp(
            mensaje=mensaje,
            session_id=req.session_id,
            intencion_jev=intencion,
            recurso_jev=recurso_mencionado,
            recursos_activos=recursos_activos,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    total_ms = (time.perf_counter() - t_start) * 1000
    print(f"[POST /api/chat] Completado en {total_ms:.0f}ms totales")

    return ChatResponse(
        reply=respuesta_llm,
        intencion=intencion,
        recurso_mencionado=recurso_mencionado,
        short_circuit=False,
        jev_latency_ms=jev_latency_ms,
        reserva_concretada=bool(request_ctx["concretada"]),
        booked_turno_id=request_ctx["turno_id"],
        turnos=request_ctx["cached_turnos"] or db_obtener_turnos(),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
