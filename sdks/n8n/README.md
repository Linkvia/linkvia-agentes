# Nodos de Linkvia para n8n

Para armar el agente de un negocio en n8n sin nodos genéricos: el **Linkvia Trigger** recibe los mensajes con la firma ya verificada y el nodo **Linkvia** contesta.

Cuando estén en npm (todavía no), se instalan desde n8n: **Settings → Community nodes → Install** con `n8n-nodes-linkvia`. Mientras tanto, en un n8n propio, como paquete en la carpeta de nodos de n8n:

```bash
git clone https://github.com/linkvia/linkvia-agentes /tmp/linkvia-agentes
cd /tmp/linkvia-agentes/sdks/n8n && npm pack          # arma n8n-nodes-linkvia-0.1.0.tgz
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install /tmp/linkvia-agentes/sdks/n8n/n8n-nodes-linkvia-0.1.0.tgz
# reiniciá n8n
```

Con Docker, lo mismo dentro de `/home/node/.n8n/nodes`. No tiene dependencias. No lo copies en `~/.n8n/custom`: ahí n8n le cambia el nombre a los nodos y las plantillas no los encuentran.

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
   - **Con lo que devuelve el último nodo**: el flujo contesta en la misma llamada; su último nodo devuelve `{"contractVersion":"0","actions":[…]}`, en menos de 10 segundos.
   - **Con el nodo Respond to Webhook (versión 1)**: lo mismo, pero con ese nodo. Las versiones nuevas de Respond to Webhook solo andan después del nodo Webhook de n8n, así que conviene la opción anterior.

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

## Plantillas

En `plantillas/` hay tres flujos listos para importar (**Workflows → Import from File**). Al abrirlos, elegí tu credencial "Linkvia API" en los nodos de Linkvia, activá el flujo y copiá la Production URL del trigger en el panel.

| Plantilla | Qué hace |
| --- | --- |
| `menu-con-botones.json` | Contesta con botones (horarios, precios, hablar con alguien), una lista de precios y el pase a una persona del equipo (`handoff`). Todo en un nodo Code: cambiá los textos por los de tu negocio. |
| `agente-con-ia.json` | Un agente con Claude: muestra "escribiendo…", lee los últimos 20 mensajes, se los pasa a la API de Anthropic y contesta. Necesita una credencial "Header Auth" con `x-api-key` y tu clave de Anthropic. Cambiá el texto de `SISTEMA` por lo que tiene que saber tu agente. |
| `aviso-de-pedido.json` | Para tu sistema de pedidos: un webhook propio (con una clave en un encabezado) que recibe `{"conversationId", "pedido", "minutos", "aviso"}` y le escribe al cliente que su pedido salió. |

Las tres se probaron en n8n 2.46 con eventos firmados como los manda Linkvia.
