import json
import time
import uuid
import urllib.request
from typing import Any

from google import genai
from google.genai import types

from config import (
    FALLBACK_GEMINI_MODELS,
    GEMINI_API_KEY,
    GEMINI_TIMEOUT_MS,
    NOMBRES_CLIENTE_INVALIDOS,
    PALABRAS_FUERA_DE_DOMINIO,
    TYPESAFE_API_KEY,
    TYPESAFE_API_URL,
)
from database import (
    buscar_recurso_por_nombre,
    db_obtener_recursos,
    db_obtener_turnos,
    local_turnos,
    normalizar_hora,
    request_ctx,
    supabase_client,
)

try:
    from mcp.server.fastmcp import FastMCP
except (ImportError, ModuleNotFoundError):
    from mcp.server.mcpserver import MCPServer as FastMCP

mcp = FastMCP("Turnos-Simple")
chat_sessions: dict[str, list[dict[str, str]]] = {}


def limpiar_sesiones_chat():
    chat_sessions.clear()


# --- Herramientas FastMCP ---
@mcp.tool()
def consultar_grilla(espacio: str = "") -> str:
    """Consulta la grilla de turnos (horarios libres y ocupados) en la base de datos en tiempo real."""
    print(f"   [Tool FastMCP] Ejecutando consultar_grilla(espacio='{espacio}')")
    recursos = db_obtener_recursos(solo_activos=True, usar_cache=True)
    turnos = db_obtener_turnos(usar_cache=True)

    recurso_filtrado = (
        buscar_recurso_por_nombre(espacio, recursos)
        if espacio and espacio not in ("no_especifica", "todos")
        else None
    )

    lineas = []
    for rec in recursos:
        if recurso_filtrado and rec["id"] != recurso_filtrado["id"]:
            continue
        turnos_rec = [t for t in turnos if t["recurso_id"] == rec["id"]]
        libres = [t["hora_inicio"] for t in turnos_rec if t["estado"] == "libre"]
        ocupados = [
            f"{t['hora_inicio']} ({t.get('nombre_cliente') or 'Reservado'})"
            for t in turnos_rec
            if t["estado"] == "ocupado"
        ]
        lineas.append(
            f"• {rec['nombre']}:\n"
            f"  - Libres: {', '.join(libres) if libres else 'Sin horarios libres'}\n"
            f"  - Ocupados: {', '.join(ocupados) if ocupados else 'Ninguno'}"
        )

    if not lineas:
        nombres_disp = ", ".join(r["nombre"] for r in recursos)
        return f"No se encontró el espacio '{espacio}'. Espacios activos disponibles: {nombres_disp}."

    return "Estado actual de la agenda en tiempo real:\n" + "\n".join(lineas)


@mcp.tool()
def crear_reserva(espacio: str, hora_inicio: str, nombre_cliente: str) -> str:
    """Reserva un turno en la base de datos asignando un espacio, horario y el nombre real del cliente."""
    print(
        f"   [Tool FastMCP] Ejecutando crear_reserva("
        f"espacio='{espacio}', hora_inicio='{hora_inicio}', nombre_cliente='{nombre_cliente}')"
    )
    cliente_limpio = (nombre_cliente or "").strip()
    if cliente_limpio.lower() in NOMBRES_CLIENTE_INVALIDOS or len(cliente_limpio) < 2:
        return "FALTA_NOMBRE_CLIENTE: ¿A nombre de quién agendamos la reserva?"

    recursos = db_obtener_recursos(solo_activos=True, usar_cache=True)
    turnos = db_obtener_turnos(usar_cache=True)
    hora_norm = normalizar_hora(hora_inicio)

    rec_obj = buscar_recurso_por_nombre(espacio, recursos)
    if not rec_obj:
        candidatos_libres = [
            t for t in turnos if t["hora_inicio"] == hora_norm and t["estado"] == "libre"
        ]
        if len(candidatos_libres) == 1:
            rec_id = candidatos_libres[0]["recurso_id"]
            rec_obj = next((r for r in recursos if r["id"] == rec_id), None)

    if not rec_obj:
        nombres_disp = ", ".join(r["nombre"] for r in recursos)
        return f"Por favor indicanos cuál de nuestros espacios querés reservar ({nombres_disp})."

    turno_existente = next(
        (t for t in turnos if t["recurso_id"] == rec_obj["id"] and t["hora_inicio"] == hora_norm),
        None,
    )

    if turno_existente and turno_existente["estado"] == "ocupado":
        libres_rec = [
            t["hora_inicio"]
            for t in turnos
            if t["recurso_id"] == rec_obj["id"] and t["estado"] == "libre"
        ]
        return (
            f"El horario **{hora_norm} hs** en **{rec_obj['nombre']}** ya está ocupado. "
            f"Horarios libres en **{rec_obj['nombre']}**: {', '.join(libres_rec) if libres_rec else 'Ninguno'}."
        )

    turno_id_final = turno_existente["id"] if turno_existente else str(uuid.uuid4())

    if supabase_client:
        try:
            if turno_existente:
                supabase_client.table("turnos").update({
                    "estado": "ocupado",
                    "nombre_cliente": cliente_limpio,
                }).eq("id", turno_existente["id"]).execute()
            else:
                ins = supabase_client.table("turnos").insert({
                    "recurso_id": rec_obj["id"],
                    "hora_inicio": hora_norm,
                    "estado": "ocupado",
                    "nombre_cliente": cliente_limpio,
                }).execute()
                if ins.data and len(ins.data) > 0:
                    turno_id_final = ins.data[0]["id"]
        except Exception as e:
            print(f"[Supabase Warning] Error al actualizar/insertar turno: {e}")

    for lista_t in (local_turnos, request_ctx.get("cached_turnos") or []):
        match = next(
            (t for t in lista_t if t["recurso_id"] == rec_obj["id"] and t["hora_inicio"] == hora_norm),
            None,
        )
        if match:
            match["estado"] = "ocupado"
            match["nombre_cliente"] = cliente_limpio

    request_ctx["concretada"] = True
    request_ctx["turno_id"] = turno_id_final

    return (
        f"¡Listo, **{cliente_limpio}**! Ya quedó confirmada tu reserva en el **{rec_obj['nombre']}** "
        f"a las **{hora_norm} hs**. ¡Te esperamos!"
    )


# --- Sistema 1: Clasificador Semántico JEV ---
def clasificar_mensaje_jev(mensaje: str, recursos_activos: list[dict[str, Any]]) -> dict[str, Any]:
    t0 = time.perf_counter()

    criterios_recursos: dict[str, str] = {}
    for rec in recursos_activos:
        nombre_rec = rec["nombre"]
        criterios_recursos[nombre_rec] = f"El usuario menciona o solicita '{nombre_rec}'"
    criterios_recursos["no_especifica"] = "El usuario no menciona ningún espacio específico en este mensaje"
    criterios_recursos["recurso_inexistente"] = (
        "El usuario pide comida u otro producto totalmente ajeno a reservar un espacio o turno"
    )

    if not TYPESAFE_API_KEY:
        msg_lower = mensaje.lower()
        if any(p in msg_lower for p in PALABRAS_FUERA_DE_DOMINIO):
            intencion = "fuera_de_dominio"
        elif any(p in msg_lower for p in ["reserv", "agend", "quiero el", "anotame", "confirm", "turno a las", "soy ", "nombre"]):
            intencion = "reserva"
        else:
            intencion = "consulta"

        rec_detectado = "no_especifica"
        for rec in recursos_activos:
            if rec["nombre"].lower() in msg_lower:
                rec_detectado = rec["nombre"]
                break

        return {
            "intencion": intencion,
            "recurso_mencionado": rec_detectado,
            "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
            "provider": "heuristic-fallback",
        }

    headers = {
        "Authorization": f"Bearer {TYPESAFE_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "jev-latest",
        "state": {
            "mensaje_usuario": mensaje,
            "espacios_disponibles": [r["nombre"] for r in recursos_activos],
        },
        "questions": {
            "intencion": {
                "type": "choice",
                "instructions": (
                    "Evalúa `mensaje_usuario` dentro de una conversación para reservar un turno o espacio. "
                    "NOTA: Si el usuario responde con un nombre propio (ej. 'Juan', 'Soy María', 'A nombre de Pedro') "
                    "o elige una hora/espacio, clasifícalo como `reserva`."
                ),
                "criteria": {
                    "consulta": "Saluda, pregunta qué horarios o espacios hay disponibles o pide información de la agenda",
                    "reserva": "Quiere reservar, elige un horario/espacio, o dice su nombre propio para completar una reserva",
                    "cancelacion": "Quiere cancelar o modificar un turno existente",
                    "fuera_de_dominio": "Pide comida (ej. una pizza), habla de política, clima o temas totalmente ajenos a turnos",
                },
            },
            "recurso_mencionado": {
                "type": "choice",
                "instructions": "¿Cuál de los `espacios_disponibles` menciona el usuario en `mensaje_usuario`?",
                "criteria": criterios_recursos,
            },
        },
    }

    req = urllib.request.Request(
        TYPESAFE_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            data = json.loads(resp.read().decode("utf-8"))
            answers = data.get("answers", {})
            intencion = answers.get("intencion", {}).get("choice", "consulta")
            recurso_mencionado = answers.get("recurso_mencionado", {}).get("choice", "no_especifica")
            return {
                "intencion": intencion,
                "recurso_mencionado": recurso_mencionado,
                "latency_ms": elapsed_ms,
                "provider": "jev-system-one",
                "raw": answers,
            }
    except Exception as e:
        print(f"[JEV Warning] Error consultando TypeSafe API ({e}). Aplicando clasificación local.")
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "intencion": "consulta",
            "recurso_mencionado": "no_especifica",
            "latency_ms": elapsed_ms,
            "provider": "fallback-on-error",
        }


# --- Sistema 2: Orquestador LLM + FastMCP ---
def ejecutar_orquestador_mcp(
    mensaje: str,
    session_id: str,
    intencion_jev: str,
    recurso_jev: str,
    recursos_activos: list[dict[str, Any]],
) -> str:
    if not GEMINI_API_KEY:
        return "Error de configuración: No se encontró `GEMINI_API_KEY` ni `GEMINI_KEY` en el entorno."

    client_gemini = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
    )

    grilla_actual = consultar_grilla()
    lista_nombres_espacios = ", ".join(r["nombre"] for r in recursos_activos)

    historial = chat_sessions.get(session_id, [])
    historial_texto = "\n".join(f"{m['role']}: {m['text']}" for m in historial[-6:])

    system_instruction = (
        "Eres el asistente virtual de reservas por WhatsApp de 'Turnos-Simple'. "
        f"Los lugares reservables se llaman Espacios ({lista_nombres_espacios}).\n\n"
        f"{grilla_actual}\n\n"
        "REGLAS OBLIGATORIAS:\n"
        "1. Ya tienes arriba el estado en tiempo real de `consultar_grilla`. Úsalo para responder qué horarios están libres sin necesidad de volver a llamar a `consultar_grilla`.\n"
        "2. SI EL USUARIO PREGUNTA QUÉ SON LOS ESPACIOS (o qué servicios ofrecemos / de qué es el lugar): "
        "Explícale con total naturalidad que **esto es una demostración interactiva** y que usamos **'Espacio 1, 2 y 3' como un nombre genérico porque no representan nada fijo: dependen de cada negocio**. "
        "Dile por ejemplo: *'En esta demo se llaman Espacio 1, 2 y 3 a modo de prueba, pero **vos en tu negocio vas a poder ofrecer por ejemplo Cancha de Fútbol 1 y 2, la silla de cada peluquero, o un consultorio**'*.\n"
        "3. OBLIGATORIO PEDIR EL NOMBRE ANTES DE RESERVAR: Para llamar a `crear_reserva` necesitas los 3 datos: `espacio` (ej. 'Espacio 1'), `hora_inicio` (ej. '10:30') y `nombre_cliente` (el nombre real del cliente).\n"
        "   - Si el cliente pide un espacio y horario pero AÚN NO DIJO SU NOMBRE en la conversación, NO llames a `crear_reserva`. Confírmale que ese espacio y horario están libres (con **negritas**) y pregúntale amablemente: '¿A nombre de quién agendamos la reserva?'.\n"
        "   - Si el cliente YA DIJO SU NOMBRE (en este mensaje o en el historial reciente junto con el espacio y horario), llama INMEDIATAMENTE a `crear_reserva(espacio, hora_inicio, nombre_cliente)`.\n"
        "4. Sé conciso, amable y usa **negritas** para destacar Espacios y horarios."
    )

    prompt_completo = (
        f"Historial reciente:\n{historial_texto}\n\nMensaje actual del cliente: {mensaje}"
        if historial_texto
        else mensaje
    )

    ultimo_error = None
    for model_name in FALLBACK_GEMINI_MODELS:
        try:
            t_llm = time.perf_counter()
            extra_cfg: dict[str, Any] = {}
            if "gemma-4" in model_name:
                extra_cfg["thinking_config"] = types.ThinkingConfig(thinking_level="MINIMAL")

            gen_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[crear_reserva],
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                temperature=0.1,
                **extra_cfg,
            )

            response = client_gemini.models.generate_content(
                model=model_name,
                contents=prompt_completo,
                config=gen_config,
            )
            print(f"[LLM Fast] Modelo '{model_name}' respondió en {(time.perf_counter()-t_llm)*1000:.0f}ms")

            if response.function_calls:
                fc = response.function_calls[0]
                args = fc.args or {}
                if fc.name == "crear_reserva":
                    texto_final = crear_reserva(
                        espacio=str(args.get("espacio", recurso_jev or "")),
                        hora_inicio=str(args.get("hora_inicio", "")),
                        nombre_cliente=str(args.get("nombre_cliente", "")),
                    )
                else:
                    texto_final = consultar_grilla(str(args.get("espacio", "")))
            else:
                texto_final = (response.text or "").strip() or "¿En qué horario te gustaría reservar?"

            historial.append({"role": "Cliente", "text": mensaje})
            historial.append({"role": "Asistente", "text": texto_final})
            chat_sessions[session_id] = historial[-10:]
            return texto_final

        except Exception as e:
            ultimo_error = e
            print(f"[LLM Warning] Modelo '{model_name}' demoró o falló ({e}). Saltando al siguiente...")
            continue

    raise RuntimeError(f"No fue posible obtener respuesta de Gemini: {ultimo_error}")
