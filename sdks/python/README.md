# SDK de Linkvia para Python

Para conectar el bot o agente de un negocio a Linkvia desde Python: verifica la firma de los eventos, contesta, escribe después y manda respuestas de a partes. No tiene dependencias: alcanza con Python 3.9 o más nuevo.

Todavía no está publicado en PyPI. Mientras tanto se instala desde el repo:

```bash
pip install ./sdks/python
```

o se copia la carpeta `linkvia/` al proyecto del bot.

## Un bot en diez líneas

```python
import os
from linkvia import LinkviaBot

bot = LinkviaBot(
    webhook_secret=os.environ["LINKVIA_WEBHOOK_SECRET"],  # whsec_…
    api_key=os.environ.get("LINKVIA_API_KEY"),            # lv_…, para escribir después
)

def responder(evento):
    if evento["type"] != "message":
        return None  # ping, consent, start, handback…: no hace falta contestar
    return f'Recibí: {evento["message"]["text"]}'

bot.serve(responder, port=4000)
```

`responder` puede devolver `None`, un texto, una acción (`{"type": "buttons", …}`) o una lista de acciones, con el formato de [Conectar el bot de un negocio](../../docs/conectar-un-bot.md). Para contestar un `buttonTap` con un aviso breve, `Toast("Anotado", "Tu pedido quedó guardado")`.

Las claves van siempre en variables de entorno, nunca en el código.

## Con Flask, FastAPI o Django

`bot.handle` verifica la firma, llama a tu función y devuelve el código HTTP y el cuerpo. Pasale el cuerpo **crudo**, tal cual llegó: si lo parseás y lo volvés a armar, la firma no coincide.

```python
from flask import Flask, request

app = Flask(__name__)

@app.post("/linkvia")
def webhook():
    status, body = bot.handle(request.get_data(), request.headers.get("linkvia-signature"), responder)
    return body, status, {"content-type": "application/json"}
```

```python
from fastapi import FastAPI, Request, Response

app = FastAPI()

@app.post("/linkvia")
async def webhook(request: Request):
    status, body = bot.handle(await request.body(), request.headers.get("linkvia-signature"), responder)
    return Response(body, status_code=status, media_type="application/json")
```

## Sin servidor

Si tu bot corre en una compu o un script, sin dirección pública con https, poné `linkvia:sin-servidor` como webhook (en el panel, "Mi bot no tiene servidor") y pedí los mensajes con `poll`. No hace falta el secreto del webhook.

```python
from linkvia import LinkviaBot, is_message

bot = LinkviaBot(api_key=os.environ["LINKVIA_API_KEY"])
bot.poll(lambda evento: "Recibí: " + evento["message"]["text"] if is_message(evento) else None)
```

`poll` espera hasta 25 segundos a que llegue algo, llama a tu función y manda lo que devuelva a la charla. `get_updates(offset, timeout)` es el pedido suelto. Ojo: con `api_key` y sin `webhook_secret` el bot arranca igual, pero si usás webhook cada evento va a fallar con 401; revisá que la variable del secreto esté cargada.

## Escribir después

Linkvia espera la respuesta en menos de 10 segundos. Si el agente tarda más, devolvé `None` y escribí cuando esté:

```python
bot.typing(conversation_id)                       # "escribiendo…"
bot.send(conversation_id, "Tu pedido salió 🛵")
bot.send(conversation_id, "Salió", notice="pedido-1042")  # un aviso que el usuario aceptó
bot.edit(message_id, {"type": "text", "text": "Entregado ✅"})
# Ubicación en tiempo real del repartidor: se manda con "live" (minutos) y se mueve editándola.
[repartidor] = bot.send(conversation_id, {"type": "location", "latitude": -34.5889, "longitude": -58.4306, "name": "Tu repartidor", "live": 30})
location_id = repartidor["id"]
bot.edit(location_id, {"type": "location", "latitude": -34.5901, "longitude": -58.4290, "name": "Tu repartidor"})
bot.edit(location_id, {"type": "location", "latitude": -34.5920, "longitude": -58.4280, "live": 0})  # entregado: termina
bot.delete(message_id)
bot.read(conversation_id)                         # tildes azules
historial = bot.history(conversation_id, limit=20)
bot.set_shortcuts([{"id": "menu", "title": "Ver la carta"}])
```

## Respuestas de a partes (agentes de IA)

```python
reply = bot.stream(conversation_id)
for chunk in modelo.stream(pregunta):
    if reply.stopped:   # el usuario tocó Detener: cortá el modelo para no gastar
        break
    reply.write(chunk)  # se junta y se manda cada 150 ms
reply.end()
```

## Errores

Lo que responde la API con error sale como `LinkviaError`, con `status` (por ejemplo 429 cuando se pasa el tope de mensajes a alguien que no escribió en 24 horas).

## Tests

```bash
python3 -m unittest discover -s sdks/python/tests
```

`pnpm test` también los corre y compara la firma con la de `@linkvia/bot-contract`.

## Mini apps

Con la acción `webApp` tu página se abre adentro del chat con `#linkvia=<token>`. Tu página manda ese token a tu servidor y ahí:

```python
from linkvia import verify_web_app_token

session = verify_web_app_token(webhook_secret, token)  # dict con handle, userId, conversationId, messageId, iat, exp, jti; o None
```

`userId` es el mismo seudónimo de los eventos. El token vence a los 10 minutos.
