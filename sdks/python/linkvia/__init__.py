"""SDK de Linkvia para Python: conectar el bot o agente de un negocio.

Uso típico, sin instalar nada más (solo Python 3.9 o más nuevo):

    from linkvia import LinkviaBot

    bot = LinkviaBot(webhook_secret=os.environ["LINKVIA_WEBHOOK_SECRET"], api_key=os.environ.get("LINKVIA_API_KEY"))

    def responder(evento):
        if evento["type"] != "message":
            return None
        return f'Recibí: {evento["message"]["text"]}'

    bot.serve(responder, port=4000)

Con Flask, FastAPI o Django se usa ``bot.handle(cuerpo_crudo, encabezado_de_firma, responder)``,
que devuelve el código HTTP y el cuerpo de la respuesta.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

__all__ = [
    "CONTRACT_VERSION",
    "DEFAULT_API_URL",
    "DEFAULT_TOLERANCE_SECONDS",
    "SIGNATURE_HEADER",
    "LinkviaBot",
    "LinkviaError",
    "ReplyStream",
    "Toast",
    "is_message",
    "sign_payload",
    "to_actions",
    "verify_signature",
]

__version__ = "0.1.0"

CONTRACT_VERSION = "0"
DEFAULT_API_URL = "https://app.linkvia.com.ar/api"
SIGNATURE_HEADER = "linkvia-signature"
#: Tolerancia por defecto entre el ``t`` firmado y el reloj del bot.
DEFAULT_TOLERANCE_SECONDS = 300
#: Tope del cuerpo que acepta ``serve``: los eventos de Linkvia son mucho más chicos.
MAX_BODY_BYTES = 1024 * 1024

Action = Dict[str, Any]
Event = Dict[str, Any]
#: Lo que puede devolver el bot: nada, un texto, una acción, una lista de acciones o un ``Toast``.
Reply = Union[None, str, Action, List[Action], "Toast"]
#: Para tests u otro cliente HTTP: recibe método, url, encabezados y cuerpo; devuelve código y cuerpo.
Transport = Callable[[str, str, Dict[str, str], Optional[bytes]], Tuple[int, bytes]]


class LinkviaError(Exception):
    """Un error de Linkvia: firma inválida, falta la clave o la API respondió con error."""

    def __init__(self, message: str, status: int) -> None:
        super().__init__(message)
        self.status = status


class Toast:
    """Para contestar un ``buttonTap``: un aviso breve que ve el usuario y, si querés, mensajes."""

    def __init__(self, toast: str, reply: Reply = None) -> None:
        self.toast = toast
        self.reply = reply


# --- Firma ---


def _bytes(value: Union[str, bytes]) -> bytes:
    return value.encode("utf-8") if isinstance(value, str) else value


def _hmac(secret: str, timestamp: int, body: bytes) -> str:
    return hmac.new(_bytes(secret), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()


def sign_payload(secret: str, body: Union[str, bytes], timestamp: Optional[int] = None) -> str:
    """Arma el encabezado ``linkvia-signature`` (``t=<unix>,v1=<hex>``). Sirve para tests."""
    t = int(time.time()) if timestamp is None else timestamp
    return f"t={t},v1={_hmac(secret, t, _bytes(body))}"


def verify_signature(
    secret: str,
    body: Union[str, bytes],
    header: Optional[str],
    tolerance: int = DEFAULT_TOLERANCE_SECONDS,
    now: Optional[int] = None,
) -> bool:
    """Comprueba que el evento viene de Linkvia y que no es viejo (alguien que reenvía uno capturado).

    ``body`` tiene que ser el cuerpo crudo, tal cual llegó: si se parsea y se vuelve a armar el JSON,
    la firma no coincide.
    """
    if not header:
        return False
    parts: Dict[str, str] = {}
    for piece in header.split(","):
        key, sep, value = piece.strip().partition("=")
        if sep:
            parts[key] = value
    try:
        timestamp = int(parts.get("t", ""))
    except ValueError:
        return False
    given = parts.get("v1", "")
    if not given:
        return False
    current = int(time.time()) if now is None else now
    if abs(current - timestamp) > tolerance:
        return False
    # En bytes: compare_digest con textos no ASCII tira un error en vez de devolver False.
    return hmac.compare_digest(_hmac(secret, timestamp, _bytes(body)).encode(), given.encode("utf-8"))


# --- Respuestas ---


def to_actions(reply: Reply) -> List[Action]:
    """Pasa lo que devolvió el bot a una lista de acciones de Linkvia."""
    if reply is None:
        return []
    if isinstance(reply, Toast):
        raise TypeError("Un Toast solo se devuelve al contestar un evento, no se manda con send")
    if isinstance(reply, str):
        return [{"type": "text", "text": reply}]
    if isinstance(reply, dict):
        return [reply]
    if isinstance(reply, (list, tuple)):
        return list(reply)
    raise TypeError(f"No sé mandar {type(reply).__name__}: devolvé un texto, una acción o una lista de acciones")


def is_message(event: Event) -> bool:
    """Si el evento es un mensaje del usuario (lo más común)."""
    return event.get("type") == "message"


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    # urllib copia Authorization al seguir una redirección, aunque sea a otro dominio: no se siguen.
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


def _default_transport(timeout: float) -> Transport:
    opener = urllib.request.build_opener(_NoRedirect)

    def transport(method: str, url: str, headers: Dict[str, str], body: Optional[bytes]) -> Tuple[int, bytes]:
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with opener.open(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as err:
            return err.code, err.read()

    return transport


class ReplyStream:
    """Una respuesta que se escribe de a partes: el usuario la ve crecer, como en ChatGPT.

    ``write`` junta el texto y lo manda cada ``flush_seconds`` (no en cada llamada). Si el usuario tocó
    Detener, ``stopped`` pasa a ``True``: cortá ahí el modelo para no gastar.

        reply = bot.stream(conversation_id)
        for chunk in modelo:
            if reply.stopped:
                break
            reply.write(chunk)
        reply.end()
    """

    def __init__(self, bot: "LinkviaBot", message_id: str, flush_seconds: float, clock: Callable[[], float]) -> None:
        self._bot = bot
        self.message_id = message_id
        self._flush_seconds = flush_seconds
        self._clock = clock
        self._pending = ""
        self._last = clock()
        self.stopped = False

    def write(self, text: str) -> None:
        if not text or self.stopped:
            return
        self._pending += text
        if self._clock() - self._last >= self._flush_seconds:
            self.flush()

    def flush(self) -> None:
        """Manda lo que esté juntado, ya."""
        self._last = self._clock()
        if not self._pending or self.stopped:
            self._pending = ""
            return
        text, self._pending = self._pending, ""
        result = self._bot._call("POST", f"/bot/v0/stream/{urllib.parse.quote(self.message_id, safe='')}", {"text": text})
        if isinstance(result, dict) and result.get("stopped"):
            self.stopped = True

    def end(self, final_text: Optional[str] = None) -> None:
        """Manda lo que falte y la termina. Con ``final_text``, ese reemplaza todo."""
        self.flush()
        body = {} if final_text is None else {"text": final_text}
        self._bot._call("POST", f"/bot/v0/stream/{urllib.parse.quote(self.message_id, safe='')}/end", body)


class LinkviaBot:
    """El bot de un negocio conectado a Linkvia.

    :param webhook_secret: el secreto del webhook (``whsec_…``), para verificar los eventos.
    :param api_key: la clave de API del negocio (``lv_…``). Hace falta para escribir por iniciativa propia.
    :param api_url: la dirección de la API de Linkvia, terminada en ``/api``.
    """

    def __init__(
        self,
        webhook_secret: str,
        api_key: Optional[str] = None,
        api_url: str = DEFAULT_API_URL,
        timeout: float = 30,
        transport: Optional[Transport] = None,
    ) -> None:
        if not webhook_secret:
            raise ValueError("Falta webhook_secret")
        self._webhook_secret = webhook_secret
        self._api_key = api_key
        self.api_url = api_url.rstrip("/")
        host = urllib.parse.urlsplit(self.api_url).hostname or ""
        if not self.api_url.startswith("https://") and host not in ("localhost", "127.0.0.1"):
            raise ValueError("api_url tiene que ser https (salvo localhost, para desarrollo)")
        self._transport = transport or _default_transport(timeout)

    def __repr__(self) -> str:
        # Nunca mostrar las claves en logs.
        return f"LinkviaBot(api_url={self.api_url!r})"

    # --- Recibir ---

    def parse_webhook(self, raw_body: Union[str, bytes], signature: Optional[str]) -> Event:
        """Verifica la firma y devuelve el evento. Tira ``LinkviaError`` (401) si no viene de Linkvia."""
        if not verify_signature(self._webhook_secret, raw_body, signature):
            raise LinkviaError("La firma del evento no es válida", 401)
        return json.loads(_bytes(raw_body).decode("utf-8"))

    def handle(
        self, raw_body: Union[str, bytes], signature: Optional[str], on_event: Callable[[Event], Reply]
    ) -> Tuple[int, bytes]:
        """Para cualquier framework: verifica la firma, llama a ``on_event`` y devuelve (código, cuerpo JSON).

        Linkvia espera la respuesta en menos de 10 segundos: si el agente tarda más, devolvé ``None``
        y contestá después con ``send`` o ``stream``.

            @app.post("/linkvia")
            def webhook():
                status, body = bot.handle(request.get_data(), request.headers.get("linkvia-signature"), responder)
                return body, status, {"content-type": "application/json"}
        """
        try:
            event = self.parse_webhook(raw_body, signature)
        except (LinkviaError, ValueError):
            return 401, b""
        try:
            result = on_event(event)
            if isinstance(result, Toast):
                response = {"contractVersion": CONTRACT_VERSION, "actions": to_actions(result.reply), "toast": result.toast}
            else:
                response = {"contractVersion": CONTRACT_VERSION, "actions": to_actions(result)}
        except Exception as err:  # el bot falló: Linkvia lo toma como error y reintenta
            print(f"[linkvia] El bot falló con un evento {event.get('type')}: {err!r}")
            return 500, b""
        return 200, json.dumps(response, ensure_ascii=False).encode("utf-8")

    def serve(self, on_event: Callable[[Event], Reply], port: int = 4000, host: str = "") -> None:
        """Levanta un servidor con lo que trae Python (``http.server``) y atiende el webhook en cualquier ruta."""
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        bot = self

        class Webhook(BaseHTTPRequestHandler):
            timeout = 30  # una conexión que no manda nada no se queda con un hilo

            def do_POST(self) -> None:  # noqa: N802 (nombre de http.server)
                try:
                    length = int(self.headers.get("content-length") or 0)
                except ValueError:
                    length = -1
                if length < 0 or length > MAX_BODY_BYTES:
                    self.send_response(413)
                    self.send_header("content-length", "0")
                    self.send_header("connection", "close")
                    self.end_headers()
                    self.close_connection = True
                    return
                status, body = bot.handle(self.rfile.read(length), self.headers.get(SIGNATURE_HEADER), on_event)
                self.send_response(status)
                if body:
                    self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self) -> None:  # noqa: N802
                self.send_response(405)
                self.send_header("content-length", "0")
                self.end_headers()

            def log_message(self, format: str, *args: Any) -> None:  # sin ruido por cada pedido
                pass

        server = ThreadingHTTPServer((host, port), Webhook)
        print(f"[linkvia] Bot escuchando en http://localhost:{server.server_address[1]}")
        try:
            server.serve_forever()
        finally:
            server.server_close()

    # --- Escribir después ---

    def send(self, conversation_id: str, reply: Reply, notice: Optional[str] = None) -> List[Dict[str, Any]]:
        """Escribe en una conversación cuando quiera (respuesta que tardó, aviso de pedido).

        Si el usuario no escribió en las últimas 24 horas, hay un tope de mensajes por día (error 429).
        Con ``notice`` (el id de un aviso que el usuario aceptó) no hay tope. Devuelve los mensajes
        que se mandaron, con su ``id`` (para editarlos o mover una ubicación en tiempo real).
        """
        body: Dict[str, Any] = {"contractVersion": CONTRACT_VERSION, "conversationId": conversation_id, "actions": to_actions(reply)}
        if notice:
            body["notice"] = notice
        return self._call("POST", "/bot/v0/messages", body) or []

    def edit(self, message_id: str, action: Action) -> None:
        """Edita uno de tus mensajes de las últimas 48 horas: el usuario ve "Editado".

        Con una ``location`` mueve una ubicación en tiempo real (la que se mandó con ``live``), sin
        "Editado"; ``"live": 0`` la termina. El nombre que no se mande queda el de antes.
        """
        self._call("PATCH", f"/bot/v0/messages/{urllib.parse.quote(message_id, safe='')}", {"contractVersion": CONTRACT_VERSION, "action": action})

    def delete(self, message_id: str) -> None:
        """Borra uno de tus mensajes de las últimas 48 horas: queda "Se eliminó este mensaje"."""
        self._call("DELETE", f"/bot/v0/messages/{urllib.parse.quote(message_id, safe='')}", {})

    def typing(self, conversation_id: str) -> None:
        """Muestra "escribiendo…" por 15 segundos (o hasta que llegue el mensaje)."""
        self._call("POST", "/bot/v0/typing", {"conversationId": conversation_id})

    def read(self, conversation_id: str) -> None:
        """Marca la charla como leída: tildes azules."""
        self._call("POST", "/bot/v0/read", {"conversationId": conversation_id})

    def history(self, conversation_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Los últimos mensajes de la charla, para darle contexto al agente."""
        path = f"/bot/v0/conversations/{urllib.parse.quote(conversation_id, safe='')}/messages?limit={int(limit)}"
        return self._call("GET", path)

    def stream(self, conversation_id: str, flush_seconds: float = 0.15, clock: Callable[[], float] = time.monotonic) -> ReplyStream:
        """Empieza una respuesta de a partes. Ver ``ReplyStream``."""
        result = self._call("POST", "/bot/v0/stream", {"conversationId": conversation_id})
        return ReplyStream(self, result["messageId"], flush_seconds, clock)

    # --- Configurar el agente ---

    def set_shortcuts(self, shortcuts: List[Dict[str, str]]) -> None:
        """Carga el menú de atajos del agente (de 0 a 10), reemplazando el que había.

        Al tocar un atajo llega un mensaje con ``message.choice: {id, title, kind: "shortcut"}``.
        """
        self._call("PUT", "/business/shortcuts", {"shortcuts": shortcuts})

    def _call(self, method: str, path: str, body: Optional[Any] = None) -> Any:
        if not self._api_key:
            raise LinkviaError("Falta api_key para escribir por iniciativa propia", 401)
        headers = {"authorization": f"Bearer {self._api_key}", "user-agent": f"linkvia-python/{__version__}"}
        data = None
        if body is not None:
            headers["content-type"] = "application/json"
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        status, raw = self._transport(method, f"{self.api_url}{path}", headers, data)
        if status == 204 or not raw:
            if status >= 300:
                raise LinkviaError(f"Linkvia respondió {status}", status)
            return None
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except ValueError:
            parsed = {}
        if status >= 300:  # una redirección tampoco es una respuesta válida: no se sigue
            message = parsed.get("error") if isinstance(parsed, dict) else None
            raise LinkviaError(message or f"Linkvia respondió {status}", status)
        return parsed
