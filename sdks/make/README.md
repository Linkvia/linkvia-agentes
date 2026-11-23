# Linkvia en Make

Cómo conectar un escenario de [Make](https://www.make.com) a Linkvia con los módulos que ya trae Make (Webhooks, JSON, HTTP y Router), sin instalar nada. **En prueba**: los pasos siguen el contrato de Linkvia, pero todavía no los corrimos en una cuenta de Make; si algo no anda igual, avisanos.

Lo que hace falta del panel del negocio (las credenciales de tu bot): la **clave de API** (`lv_…`) y el **secreto del webhook** (`whsec_…`). Guardalos en Make como datos del escenario o en una conexión, nunca en un texto que compartas.

## Antes de empezar: cuánto gasta

Linkvia le manda un `ping` al webhook cada 5 minutos para avisarte si tu bot se cae. En Make cada `ping` cuenta como una operación (unas 8.700 por mes), además de las de cada mensaje. El plan gratis de Make no alcanza; uno pago chico, sí. En n8n los pings no corren el flujo.

## 1. Recibir el mensaje y verificar la firma

1. **Webhooks → Custom webhook**. Creá uno nuevo y, en las opciones avanzadas, prendé **Get request headers** y **JSON pass-through** (así llega el cuerpo crudo en `value`, que es lo que se firma). Copiá la dirección y ponela en el panel del negocio como webhook.
2. **Tools → Set multiple variables**, con:
   - `firma`: `get(map(1.__IMTHEADERS__; value; name; "linkvia-signature"); 1)`
   - `t`: `replace(get(split(firma; ","); 1); "t="; "")`
   - `v1`: `replace(get(split(firma; ","); 2); "v1="; "")`
3. Un **filtro** antes de seguir, con las dos condiciones:
   - `sha256(t + "." + 1.value; "hex"; "whsec_…tu secreto")` es igual a `v1`.
   - `abs(timestamp - t)` es menor que `300` (la firma tiene menos de 5 minutos).

   Si no pasa, el escenario termina y Linkvia ve un error: así nadie más puede hacerse pasar por Linkvia.
4. **JSON → Parse JSON** sobre `1.value`. De acá salen `type`, `conversation.id`, `message.text`, `message.choice.id`…

## 2. Contestar

Linkvia espera la respuesta en la misma llamada, en menos de 10 segundos, y siempre en JSON. Por eso cada camino del escenario tiene que terminar en **Webhooks → Webhook response**, con estado `200`, el encabezado `Content-Type: application/json` y un cuerpo así:

```json
{ "contractVersion": "0", "actions": [{ "type": "text", "text": "¡Hola! ¿En qué te ayudo?" }] }
```

Si el escenario no contesta (o contesta el `Accepted` que Make pone solo), Linkvia lo toma como que el bot falló.

Con un **Router** después de Parse JSON armás el menú, igual que la plantilla de n8n `menu-con-botones.json`:

| Camino | Filtro | Cuerpo de la respuesta |
| --- | --- | --- |
| Ping | `type` = `ping` | `{"contractVersion":"0","actions":[]}` |
| Horarios | `message.choice.id` = `horarios` | un `text` con los horarios |
| Persona | `message.choice.id` = `persona` | un `text` y `{"type":"handoff","reason":"Pidió hablar con una persona"}` |
| El resto | (sin filtro, el último) | `{"type":"buttons","text":"¿En qué te ayudo?","buttons":[{"id":"horarios","title":"Horarios"},{"id":"persona","title":"Hablar con alguien"}]}` |

Las acciones posibles (botones, listas, fotos, ubicación, encuestas…) están en la guía para desarrolladores, en la sección 3.

## 3. Escribir más tarde (agentes de IA, avisos de pedido)

Si el escenario tarda más de 10 segundos (por ejemplo, porque le pregunta a una IA), contestá enseguida con `{"contractVersion":"0","actions":[]}` en el Webhook response y escribí después con **HTTP → Make a request**:

- URL: `https://app.linkvia.com.ar/api/bot/v0/messages`, método `POST`.
- Encabezado `Authorization`: `Bearer lv_…tu clave`.
- Cuerpo (JSON): `{"contractVersion":"0","conversationId":"{{conversation.id}}","actions":[{"type":"text","text":"…"}]}`.

Lo mismo sirve para avisarle a un cliente desde otro escenario (cuando el pedido sale, por ejemplo), con el `conversationId` que guardaste. Si la persona no te escribió en las últimas 24 horas, hay un tope de 5 mensajes por día; uno con un aviso que aceptó no cuenta: sumá `"notice": "pedido-1042"`. Antes de la IA, `POST /bot/v0/typing` con `{"conversationId": "…"}` muestra "escribiendo…", y `GET /bot/v0/conversations/{id}/messages?limit=20` trae la charla para pasársela.

## Lo que el bot nunca recibe

Ni el teléfono ni el id interno de la persona: `user.id` es un seudónimo. Los datos que la persona eligió compartir llegan con el evento `consent`.
