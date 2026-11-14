"use strict";

const show = (...operations) => ({ show: { operation: operations } });
const conversationId = (...operations) => ({
  displayName: "Conversación",
  name: "conversationId",
  type: "string",
  required: true,
  default: "={{ $json.conversation.id }}",
  description: "El id de la conversación; si viene del Linkvia Trigger, ya está puesto",
  displayOptions: show(...operations),
});
const messageId = (...operations) => ({
  displayName: "Mensaje",
  name: "messageId",
  type: "string",
  required: true,
  default: "",
  description: "El id de uno de tus mensajes de las últimas 48 horas",
  displayOptions: show(...operations),
});

class Linkvia {
  constructor() {
    this.description = {
      displayName: "Linkvia",
      name: "linkvia",
      icon: "file:linkvia.svg",
      group: ["output"],
      version: 1,
      subtitle: '={{$parameter["operation"]}}',
      description: "Escribe en las charlas de Linkvia: mensajes, botones, escribiendo…, leído",
      defaults: { name: "Linkvia" },
      inputs: ["main"],
      outputs: ["main"],
      credentials: [{ name: "linkviaApi", required: true }],
      properties: [
        {
          displayName: "Operación",
          name: "operation",
          type: "options",
          noDataExpression: true,
          options: [
            { name: "Mandar un texto", value: "sendText", action: "Mandar un texto" },
            { name: "Mandar acciones", value: "sendActions", action: "Mandar acciones (botones, listas, fotos…)" },
            { name: "Mostrar escribiendo…", value: "typing", action: "Mostrar escribiendo" },
            { name: "Marcar leído", value: "read", action: "Marcar la charla como leída" },
            { name: "Editar un mensaje", value: "edit", action: "Editar un mensaje" },
            { name: "Mover la ubicación en vivo", value: "moveLocation", action: "Mover la ubicación en tiempo real" },
            { name: "Borrar un mensaje", value: "delete", action: "Borrar un mensaje" },
            { name: "Leer el historial", value: "history", action: "Leer los últimos mensajes" },
          ],
          default: "sendText",
        },
        conversationId("sendText", "sendActions", "typing", "read", "history"),
        messageId("edit", "delete", "moveLocation"),
        {
          displayName: "Texto",
          name: "text",
          type: "string",
          typeOptions: { rows: 3 },
          required: true,
          default: "",
          placeholder: "Hoy hay tarta de ricota de la abuela Teté hasta las 20",
          description: "Admite *negrita*, _cursiva_ y Markdown",
          displayOptions: show("sendText", "edit"),
        },
        {
          displayName: "Acciones",
          name: "actions",
          type: "json",
          required: true,
          default: '[{ "type": "buttons", "text": "¿Delivery o retiro?", "buttons": [{ "id": "delivery", "title": "Delivery" }, { "id": "retiro", "title": "Retiro" }] }]',
          description: "Una acción o una lista, con el formato de la guía para desarrolladores",
          displayOptions: show("sendActions"),
        },
        {
          displayName: "Aviso",
          name: "notice",
          type: "string",
          default: "",
          placeholder: "pedido-1042",
          description: "El id de un aviso que el usuario aceptó: el mensaje no cuenta para el tope de 24 horas",
          displayOptions: show("sendText", "sendActions"),
        },
        {
          displayName: "Latitud",
          name: "latitude",
          type: "number",
          typeOptions: { numberPrecision: 6 },
          required: true,
          default: 0,
          displayOptions: show("moveLocation"),
        },
        {
          displayName: "Longitud",
          name: "longitude",
          type: "number",
          typeOptions: { numberPrecision: 6 },
          required: true,
          default: 0,
          displayOptions: show("moveLocation"),
        },
        {
          displayName: "Nombre",
          name: "name",
          type: "string",
          default: "Tu repartidor",
          displayOptions: show("moveLocation"),
        },
        {
          displayName: "Terminarla",
          name: "end",
          type: "boolean",
          default: false,
          description: "Whether to end it here (por ejemplo, al entregar el pedido)",
          displayOptions: show("moveLocation"),
        },
        {
          displayName: "Cantidad",
          name: "limit",
          type: "number",
          typeOptions: { minValue: 1, maxValue: 200 },
          default: 50,
          displayOptions: show("history"),
        },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const credentials = await this.getCredentials("linkviaApi");
    const base = String(credentials.apiUrl || "https://app.linkvia.com.ar/api").replace(/\/+$/, "");
    const out = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const request = buildRequest(this, i);
        const response = await this.helpers.httpRequestWithAuthentication.call(this, "linkviaApi", {
          method: request.method,
          url: base + request.path,
          ...(request.body !== undefined && { body: request.body }),
          json: true,
        });
        const json = Array.isArray(response) ? { messages: response } : response && typeof response === "object" ? response : { ok: true };
        out.push({ json, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          out.push({ json: { error: error.message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }
    return [out];
  }
}

function parseActions(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const actions = Array.isArray(parsed) ? parsed : [parsed];
  if (!actions.length || actions.some((a) => !a || typeof a !== "object" || typeof a.type !== "string")) {
    throw new Error('Cada acción necesita un "type" (text, buttons, list, image…)');
  }
  return actions;
}

function buildRequest(ctx, i) {
  const operation = ctx.getNodeParameter("operation", i);
  const id = (name) => encodeURIComponent(String(ctx.getNodeParameter(name, i)));
  const conversation = () => String(ctx.getNodeParameter("conversationId", i));
  const send = (actions) => {
    const notice = ctx.getNodeParameter("notice", i, "");
    return {
      method: "POST",
      path: "/bot/v0/messages",
      body: { contractVersion: "0", conversationId: conversation(), actions, ...(notice && { notice }) },
    };
  };
  switch (operation) {
    case "sendText":
      return send([{ type: "text", text: String(ctx.getNodeParameter("text", i)) }]);
    case "sendActions":
      return send(parseActions(ctx.getNodeParameter("actions", i)));
    case "typing":
      return { method: "POST", path: "/bot/v0/typing", body: { conversationId: conversation() } };
    case "read":
      return { method: "POST", path: "/bot/v0/read", body: { conversationId: conversation() } };
    case "edit":
      return {
        method: "PATCH",
        path: `/bot/v0/messages/${id("messageId")}`,
        body: { contractVersion: "0", action: { type: "text", text: String(ctx.getNodeParameter("text", i)) } },
      };
    case "moveLocation": {
      const name = String(ctx.getNodeParameter("name", i, "")).trim();
      const action = {
        type: "location",
        latitude: Number(ctx.getNodeParameter("latitude", i)),
        longitude: Number(ctx.getNodeParameter("longitude", i)),
        ...(name && { name }),
        ...(ctx.getNodeParameter("end", i, false) && { live: 0 }),
      };
      return { method: "PATCH", path: `/bot/v0/messages/${id("messageId")}`, body: { contractVersion: "0", action } };
    }
    case "delete":
      return { method: "DELETE", path: `/bot/v0/messages/${id("messageId")}`, body: {} };
    case "history":
      return {
        method: "GET",
        path: `/bot/v0/conversations/${id("conversationId")}/messages?limit=${Number(ctx.getNodeParameter("limit", i, 50))}`,
      };
    default:
      throw new Error(`Operación desconocida: ${operation}`);
  }
}

module.exports = { Linkvia };
