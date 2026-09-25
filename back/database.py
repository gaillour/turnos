import uuid
from typing import Any, Optional

from config import (
    ALIAS_ESPACIOS,
    ESPACIOS_POR_DEFECTO,
    HORARIOS_LIBRES_AL_REINICIAR,
    MAPEO_NOMBRES_ANTIGUOS,
    SUPABASE_KEY,
    SUPABASE_URL,
    TURNOS_SEMILLA_CONFIG,
)

# --- Inicialización de Supabase ---
supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client

        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"[Supabase] Cliente conectado a {SUPABASE_URL}")
    except Exception as e:
        print(f"[Supabase] Aviso: No se pudo inicializar el cliente ({e}). Usando estado local de respaldo.")


def crear_seed_local() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    recursos = [dict(r) for r in ESPACIOS_POR_DEFECTO]
    turnos = []
    for item in TURNOS_SEMILLA_CONFIG:
        rec_id = recursos[item["recurso_idx"]]["id"]
        turnos.append({
            "id": str(uuid.uuid4()),
            "recurso_id": rec_id,
            "hora_inicio": item["hora_inicio"],
            "estado": item["estado"],
            "nombre_cliente": item["nombre_cliente"],
        })
    return recursos, turnos


local_recursos, local_turnos = crear_seed_local()

# Contexto por request para evitar múltiples lecturas HTTP a Supabase en un mismo turno
request_ctx: dict[str, Any] = {
    "concretada": False,
    "turno_id": None,
    "cached_recursos": None,
    "cached_turnos": None,
}


def limpiar_contexto_request():
    request_ctx["concretada"] = False
    request_ctx["turno_id"] = None
    request_ctx["cached_recursos"] = None
    request_ctx["cached_turnos"] = None


def asegurar_nombres_espacios_supabase():
    if not supabase_client:
        return
    try:
        res = supabase_client.table("recursos").select("*").execute()
        for row in res.data or []:
            nuevo_nombre = MAPEO_NOMBRES_ANTIGUOS.get(row.get("nombre"))
            if nuevo_nombre:
                supabase_client.table("recursos").update({"nombre": nuevo_nombre}).eq("id", row["id"]).execute()
    except Exception as e:
        print(f"[Supabase] Aviso al normalizar nombres de espacios: {e}")


asegurar_nombres_espacios_supabase()


def db_obtener_recursos(solo_activos: bool = True, usar_cache: bool = False) -> list[dict[str, Any]]:
    if usar_cache and request_ctx.get("cached_recursos") is not None:
        return request_ctx["cached_recursos"]

    if supabase_client:
        try:
            query = supabase_client.table("recursos").select("*").order("nombre")
            if solo_activos:
                query = query.eq("activo", True)
            res = query.execute()
            if res.data:
                if usar_cache:
                    request_ctx["cached_recursos"] = res.data
                return res.data
        except Exception as e:
            print(f"[Supabase Warning] Error leyendo recursos: {e}")

    datos = [r for r in local_recursos if r.get("activo", True)] if solo_activos else list(local_recursos)
    if usar_cache:
        request_ctx["cached_recursos"] = datos
    return datos


def db_obtener_turnos(usar_cache: bool = False) -> list[dict[str, Any]]:
    if usar_cache and request_ctx.get("cached_turnos") is not None:
        return request_ctx["cached_turnos"]

    if supabase_client:
        try:
            res = (
                supabase_client.table("turnos")
                .select("*, recursos(id, nombre, activo)")
                .order("hora_inicio")
                .execute()
            )
            if res.data is not None and len(res.data) > 0:
                if usar_cache:
                    request_ctx["cached_turnos"] = res.data
                return res.data
        except Exception as e:
            print(f"[Supabase Warning] Error leyendo turnos: {e}")

    recursos_map = {r["id"]: r for r in local_recursos}
    enriched = []
    for t in sorted(local_turnos, key=lambda x: x["hora_inicio"]):
        enriched.append({
            **t,
            "recursos": recursos_map.get(t["recurso_id"], {"id": t["recurso_id"], "nombre": "Espacio", "activo": True}),
        })
    if usar_cache:
        request_ctx["cached_turnos"] = enriched
    return enriched


def normalizar_hora(hora: str) -> str:
    h = hora.lower().replace("hs", "").replace("hrs", "").replace("h", "").replace(".", ":").strip()
    if ":" not in h and h.isdigit():
        return f"{int(h):02d}:00"
    if ":" in h:
        partes = h.split(":")
        if len(partes) == 2 and partes[0].isdigit() and partes[1].isdigit():
            return f"{int(partes[0]):02d}:{int(partes[1]):02d}"
    return h


def buscar_recurso_por_nombre(nombre_buscado: str, recursos: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not nombre_buscado:
        return None
    nb = nombre_buscado.lower().strip()
    nb_canon = ALIAS_ESPACIOS.get(nb, nb)

    for r in recursos:
        if r["nombre"].lower() == nb_canon or r["nombre"].lower() == nb:
            return r
    for r in recursos:
        if nb_canon in r["nombre"].lower() or r["nombre"].lower() in nb_canon:
            return r
    tokens = nb_canon.replace("_", " ").split()
    for r in recursos:
        r_tokens = r["nombre"].lower().split()
        if tokens and r_tokens and tokens[-1] == r_tokens[-1]:
            return r
    return None


def db_actualizar_turno_manual(turno_id: str, estado: str, nombre_cliente: Optional[str] = None) -> dict[str, Any]:
    nuevo_estado = estado if estado in ("libre", "ocupado") else "ocupado"
    cliente = (nombre_cliente or "Reserva Manual").strip() if nuevo_estado == "ocupado" else None

    if supabase_client:
        try:
            supabase_client.table("turnos").update({
                "estado": nuevo_estado,
                "nombre_cliente": cliente,
            }).eq("id", turno_id).execute()
        except Exception as e:
            print(f"[Supabase Warning] Error en actualización manual: {e}")

    for t in local_turnos:
        if t["id"] == turno_id:
            t["estado"] = nuevo_estado
            t["nombre_cliente"] = cliente
            break

    return {
        "status": "ok",
        "booked_turno_id": turno_id if nuevo_estado == "ocupado" else None,
        "recursos": db_obtener_recursos(solo_activos=True),
        "turnos": db_obtener_turnos(),
    }


def db_resetear_demo() -> dict[str, Any]:
    global local_recursos, local_turnos
    local_recursos, local_turnos = crear_seed_local()

    if supabase_client:
        try:
            asegurar_nombres_espacios_supabase()
            turnos_db = db_obtener_turnos()
            for t in turnos_db:
                rec_nombre = (t.get("recursos") or {}).get("nombre")
                if (rec_nombre, t["hora_inicio"]) in HORARIOS_LIBRES_AL_REINICIAR:
                    supabase_client.table("turnos").update({
                        "estado": "libre",
                        "nombre_cliente": None,
                    }).eq("id", t["id"]).execute()
        except Exception as e:
            print(f"[Supabase Warning] Error reseteando demo en Supabase: {e}")

    return {
        "status": "reset_ok",
        "recursos": db_obtener_recursos(solo_activos=True),
        "turnos": db_obtener_turnos(),
    }
