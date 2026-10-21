# Bot mínimo para Linkvia. No necesita instalar nada: solo Python 3.9 o más nuevo.
#   LINKVIA_WEBHOOK_SECRET=whsec_... python3 bot.py
import hashlib, hmac, json, os, time
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = os.environ["LINKVIA_WEBHOOK_SECRET"].encode()
PORT = int(os.environ.get("PORT", 4000))

def firma_valida(cuerpo: bytes, encabezado: str) -> bool:
    """Comprueba que el mensaje viene de Linkvia (encabezado linkvia-signature)."""
    partes = dict(p.strip().split("=", 1) for p in encabezado.split(",") if "=" in p)
    try:
        t = int(partes["t"])
    except (KeyError, ValueError):
        return False
    if abs(time.time() - t) > 300:
        return False
    esperada = hmac.new(SECRET, f"{t}.".encode() + cuerpo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, partes.get("v1", ""))

def responder(evento: dict) -> list:
    """Acá va la lógica de tu agente. Devolvé una lista de acciones."""
    if evento["type"] != "message":
        return []  # ping, consent, reaction: no hace falta contestar
    texto = evento["message"]["text"].lower()
    eleccion = (evento["message"].get("choice") or {}).get("id")
    if "hola" in texto:
        return [{"type": "buttons", "text": "¡Hola! ¿En qué te ayudo?", "buttons": [
            {"id": "menu", "title": "Ver el menú"},
            {"id": "humano", "title": "Hablar con alguien"},
        ]}]
    if eleccion == "menu":
        return [{"type": "text", "text": "Hoy tenemos *muzza* a $12.000 y *napolitana* a $14.000."}]
    if eleccion == "humano":
        return [{"type": "handoff", "reason": "Pidió hablar con una persona"}]
    return [{"type": "text", "text": f'Recibí: "{evento["message"]["text"]}". Escribime "hola" para empezar.'}]

class Webhook(BaseHTTPRequestHandler):
    def do_POST(self):
        cuerpo = self.rfile.read(int(self.headers.get("content-length", 0)))
        if not firma_valida(cuerpo, self.headers.get("linkvia-signature", "")):
            self.send_response(401); self.end_headers(); return
        respuesta = json.dumps({"contractVersion": "0", "actions": responder(json.loads(cuerpo))}, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(respuesta)

print(f"Bot escuchando en http://localhost:{PORT}")
HTTPServer(("", PORT), Webhook).serve_forever()
