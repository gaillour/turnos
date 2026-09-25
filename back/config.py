import os
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv(override=True)

# --- Credenciales y Endpoints ---
TYPESAFE_API_KEY = (os.getenv("TYPESAFE_API_KEY") or "").strip()
TYPESAFE_API_URL = os.getenv("TYPESAFE_API_URL", "https://api.typesafe.ai/v1/systemone").strip()

GEMINI_API_KEY = (os.getenv("GEMINI_KEY") or os.getenv("GEMINI_API_KEY") or "").strip()
GEMINI_TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_MS", "12000"))

# Prioridad de modelos gratuitos de baja latencia
MODELOS_GEMINI = [
    os.getenv("GEMINI_MODEL", "gemma-4-26b-a4b-it").strip(),
    "gemma-4-26b-a4b-it",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
]
# Eliminar duplicados preservando el orden
FALLBACK_GEMINI_MODELS = list(dict.fromkeys(m for m in MODELOS_GEMINI if m))

SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
).strip()

# --- Configuración de Dominio y Datos Semilla ---
ESPACIOS_POR_DEFECTO = [
    {"id": "11111111-1111-4111-8111-111111111111", "nombre": "Espacio 1", "activo": True},
    {"id": "22222222-2222-4222-8222-222222222222", "nombre": "Espacio 2", "activo": True},
    {"id": "33333333-3333-4333-8333-333333333333", "nombre": "Espacio 3", "activo": True},
]

TURNOS_SEMILLA_CONFIG = [
    {"recurso_idx": 0, "hora_inicio": "09:00", "estado": "ocupado", "nombre_cliente": "Martina López"},
    {"recurso_idx": 0, "hora_inicio": "10:30", "estado": "libre", "nombre_cliente": None},
    {"recurso_idx": 0, "hora_inicio": "12:00", "estado": "libre", "nombre_cliente": None},
    {"recurso_idx": 0, "hora_inicio": "15:00", "estado": "ocupado", "nombre_cliente": "Lucía Fernández"},
    {"recurso_idx": 1, "hora_inicio": "10:30", "estado": "ocupado", "nombre_cliente": "Sofía Martínez"},
    {"recurso_idx": 1, "hora_inicio": "12:00", "estado": "libre", "nombre_cliente": None},
    {"recurso_idx": 1, "hora_inicio": "16:00", "estado": "libre", "nombre_cliente": None},
    {"recurso_idx": 2, "hora_inicio": "14:30", "estado": "ocupado", "nombre_cliente": "Camila Torres"},
    {"recurso_idx": 2, "hora_inicio": "17:00", "estado": "libre", "nombre_cliente": None},
    {"recurso_idx": 2, "hora_inicio": "18:00", "estado": "libre", "nombre_cliente": None},
]

HORARIOS_LIBRES_AL_REINICIAR = {
    ("Espacio 1", "10:30"),
    ("Espacio 1", "12:00"),
    ("Espacio 2", "12:00"),
    ("Espacio 2", "16:00"),
    ("Espacio 3", "17:00"),
    ("Espacio 3", "18:00"),
}

MAPEO_NOMBRES_ANTIGUOS = {
    "Recurso A": "Espacio 1",
    "Recurso B": "Espacio 2",
    "Sillón 1": "Espacio 3",
}

ALIAS_ESPACIOS = {
    "espacio a": "espacio 1",
    "recurso a": "espacio 1",
    "a": "espacio 1",
    "1": "espacio 1",
    "espacio b": "espacio 2",
    "recurso b": "espacio 2",
    "b": "espacio 2",
    "2": "espacio 2",
    "espacio c": "espacio 3",
    "sillón 1": "espacio 3",
    "sillon 1": "espacio 3",
    "c": "espacio 3",
    "3": "espacio 3",
}

NOMBRES_CLIENTE_INVALIDOS = {
    "",
    "cliente",
    "cliente whatsapp",
    "cliente demo",
    "usuario",
    "desconocido",
    "sin nombre",
    "none",
    "null",
    "pendiente",
}

PALABRAS_FUERA_DE_DOMINIO = [
    "pizza",
    "empanada",
    "hamburguesa",
    "clima",
    "chiste",
    "política",
    "receta",
]
