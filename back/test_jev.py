import os
import json
import urllib.request
import urllib.error
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env
load_dotenv()

api_key = os.getenv("TYPESAFE_API_KEY")

url = "https://api.typesafe.ai/v1/systemone"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

payload = {
    "model": "jev-latest",
    "state": "El cielo es azul durante un día despejado.",
    "questions": {
        "cielo_azul": {
            "type": "noul",
            "instructions": "¿El cielo es azul?"
        }
    }
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers=headers,
    method="POST",
)

try:
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.status}")
        print("Respuesta cruda:")
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(f"Status Code: {e.code}")
    print("Error:")
    print(e.read().decode("utf-8"))
except Exception as e:
    print(f"Error inesperado: {e}")

