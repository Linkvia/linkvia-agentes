# Nodos de Linkvia para n8n

Para armar el agente de un negocio en n8n sin nodos genéricos: el **Linkvia Trigger** recibe los mensajes con la firma ya verificada y el nodo **Linkvia** contesta.

> **En prueba:** los nodos pasan sus pruebas automáticas, pero todavía no los probamos en un n8n de verdad. Si algo no anda, contanos por WhatsApp o en un issue de este repo.

Todavía no están publicados en npm. Mientras tanto, en un n8n propio:

```bash
cd ~/.n8n/custom          # creala si no existe
git clone https://github.com/linkvia/linkvia-agentes /tmp/linkvia-agentes
cp -r /tmp/linkvia-agentes/sdks/n8n n8n-nodes-linkvia
# reiniciá n8n
```

(o con Docker, montá la carpeta en `/home/node/.n8n/custom/n8n-nodes-linkvia`). No tiene dependencias: no hace falta `npm install`.

## Credencial "Linkvia API"

| Campo | De dónde sale |
| --- | --- |
| Clave de API (`lv_…`) | El alta del negocio o el panel (Perfil → Clave de API). La usa el nodo Linkvia para escribir. |
| Secreto del webhook (`whsec_…`) | El alta o el panel. El trigger rechaza (401) lo que no esté firmado con él. |
| Dirección de la API | `https://app.linkvia.com.ar/api` |

## Linkvia Trigger

1. Sumá el nodo y copiá su **Production URL** en el panel del negocio (Perfil → Webhook). Activá el flujo.
2. Elegí qué eventos corren el flujo (por defecto, los mensajes). Los pings de Linkvia y los eventos no elegidos se contestan solos.
3. Elegí cómo contestar:
   - **Al recibir, sin acciones** (por defecto): Linkvia recibe el OK enseguida y el flujo escribe cuando quiera con el nodo Linkvia. Sirve para agentes de IA que tardan.
   - **Con el nodo Respond to Webhook**: el flujo contesta en la misma llamada con `{"contractVersion":"0","actions":[…]}`, en menos de 10 segundos.

El evento sale tal cual llega (ver [Conectar el bot de un negocio](../../docs/conectar-un-bot.md)): `{{ $json.message.text }}`, `{{ $json.conversation.id }}`, `{{ $json.message.choice.id }}`…

## Linkvia

| Operación | Qué hace |
| --- | --- |
| Mandar un texto | `POST /bot/v0/messages` con un texto (admite Markdown). Con **Aviso**, el id de un aviso aceptado. |
| Mandar acciones | Una acción o una lista en JSON: botones, listas, fotos, `requestLocation`, carrusel… |
| Mostrar escribiendo… | "escribiendo…" por 15 segundos |
| Marcar leído | Tildes azules |
| Editar / Borrar un mensaje | Uno de tus mensajes de las últimas 48 horas |
| Mover la ubicación en vivo | Mueve una ubicación en tiempo real (la del repartidor), como mucho cada 5 segundos. Con **Terminarla**, se corta en ese punto. Se empieza con **Mandar acciones**: `{"type":"location","latitude":…,"longitude":…,"name":"Tu repartidor","live":30}`, y el id sale en `messages[0].id`. |
| Leer el historial | Los últimos mensajes, en `messages`, para darle contexto al agente |

**Conversación** viene puesta como `{{ $json.conversation.id }}`: si el nodo va después del trigger, no hay que tocarla.

## Un agente de ejemplo

Linkvia Trigger → Linkvia (Mostrar escribiendo…) → tu modelo de IA → Linkvia (Mandar un texto con `{{ $json.output }}`).

## Tests

`pnpm test` los prueba con un n8n de mentira (`packages/sdk/src/n8n.test.ts`).
