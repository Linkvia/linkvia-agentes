"use strict";
const { SIGNATURE_HEADER, verifySignature } = require("../../lib/firma.js");

const EMPTY_REPLY = { contractVersion: "0", actions: [] };

const EVENTS = [
  { name: "Mensaje del usuario", value: "message", description: "Texto, foto, video, audio, archivo, ubicación, botón o atajo" },
  { name: "Toque de botón (buttonTap)", value: "buttonTap" },
  { name: "Reacción", value: "reaction" },
  { name: "Empezó la charla (start)", value: "start" },
  { name: "Datos compartidos (consent)", value: "consent" },
  { name: "Devolución de una persona (handback)", value: "handback" },
  { name: "Aviso aceptado o rechazado (notice)", value: "notice" },
  { name: "Entregado o leído (status)", value: "status" },
  { name: "Pedido de borrar datos (dataDeletion)", value: "dataDeletion" },
  { name: "Contacto agendado o bloqueado (contact)", value: "contact" },
  { name: "Charla vaciada (cleared)", value: "cleared" },
  { name: "Tocó Detener (streamStopped)", value: "streamStopped" },
];

class LinkviaTrigger {
  constructor() {
    this.description = {
      displayName: "Linkvia Trigger",
      name: "linkviaTrigger",
      icon: "file:linkvia.svg",
      group: ["trigger"],
      version: 1,
      subtitle: '={{$parameter["events"].join(", ")}}',
      description: "Recibe los mensajes y eventos de Linkvia, con la firma verificada",
      defaults: { name: "Linkvia Trigger" },
      inputs: [],
      outputs: ["main"],
      credentials: [{ name: "linkviaApi", required: true }],
      webhooks: [
        {
          name: "default",
          httpMethod: "POST",
          responseMode: '={{$parameter["responseMode"]}}',
          path: "linkvia",
        },
      ],
      properties: [
        {
          displayName:
            "Copiá la Production URL de este nodo en el panel del negocio (Perfil → Webhook). Los pings de Linkvia se contestan solos y no corren el flujo.",
          name: "aviso",
          type: "notice",
          default: "",
        },
        {
          displayName: "Eventos",
          name: "events",
          type: "multiOptions",
          options: EVENTS,
          default: ["message"],
          description: "Los que no estén elegidos se contestan sin correr el flujo",
        },
        {
          displayName: "Respuesta",
          name: "responseMode",
          type: "options",
          options: [
            {
              name: "Al recibir, sin acciones",
              value: "onReceived",
              description: "Contesta enseguida; el flujo escribe después con el nodo Linkvia",
            },
            {
              name: "Con el nodo Respond to Webhook",
              value: "responseNode",
              description: 'El flujo contesta con {"contractVersion":"0","actions":[…]} en menos de 10 segundos',
            },
          ],
          default: "onReceived",
        },
      ],
    };
  }

  async webhook() {
    const req = this.getRequestObject();
    const res = this.getResponseObject();
    const credentials = await this.getCredentials("linkviaApi");
    // n8n guarda el cuerpo crudo en rawBody: la firma se calcula sobre ese, no sobre el JSON ya parseado.
    const raw = req.rawBody;
    const header = req.headers?.[SIGNATURE_HEADER] ?? this.getHeaderData()?.[SIGNATURE_HEADER];
    if (!verifySignature(credentials.webhookSecret, raw, header)) {
      res.status(401).json({ error: "La firma del evento no es válida" });
      return { noWebhookResponse: true };
    }
    const event = this.getBodyData();
    const events = this.getNodeParameter("events", []);
    if (event.type === "ping" || !events.includes(event.type)) {
      res.status(200).json(EMPTY_REPLY);
      return { noWebhookResponse: true };
    }
    if (this.getNodeParameter("responseMode", "onReceived") === "responseNode") {
      return { workflowData: [this.helpers.returnJsonArray([event])] };
    }
    res.status(200).json(EMPTY_REPLY);
    return { noWebhookResponse: true, workflowData: [this.helpers.returnJsonArray([event])] };
  }
}

module.exports = { LinkviaTrigger };
