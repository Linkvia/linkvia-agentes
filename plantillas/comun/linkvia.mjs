// Lo que comparten todas las plantillas: recibir eventos firmados de Linkvia y escribir por iniciativa propia.
// Sin dependencias: Node 18 o más nuevo.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRETO = process.env.LINKVIA_WEBHOOK_SECRET;
const CLAVE_API = process.env.LINKVIA_API_KEY;
const API = (process.env.LINKVIA_API_URL || "https://app.linkvia.com.ar/api").replace(/\/$/, "");
export const APP = (process.env.LINKVIA_APP_URL || "https://app.linkvia.com.ar").replace(/\/$/, "");

/** Comprueba que el evento viene de Linkvia (encabezado linkvia-signature). */
export function firmaValida(cuerpo, encabezado = "") {
  const partes = Object.fromEntries(encabezado.split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(partes.t);
  if (!t || !partes.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const esperada = createHmac("sha256", SECRETO).update(`${t}.${cuerpo}`).digest();
  const recibida = Buffer.from(partes.v1, "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

/**
 * Manda mensajes a una conversación sin esperar a que el cliente escriba (avisos, recordatorios).
 * Si salió bien devuelve los mensajes creados (con su `id`, para editarlos después); si no, `false`.
 */
export async function enviar(conversationId, actions) {
  if (!CLAVE_API) {
    console.warn("Falta LINKVIA_API_KEY: no puedo mandar avisos por mi cuenta.");
    return false;
  }
  try {
    const r = await fetch(`${API}/bot/v0/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${CLAVE_API}`, "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: "0", conversationId, actions }),
    });
    if (r.status === 429) console.warn("Linkvia respondió 429: llegaste al tope de 5 mensajes por día a un cliente que no te escribió en las últimas 24 horas.");
    else if (r.status === 400) console.warn("Linkvia respondió 400: revisá el mensaje (por ejemplo, un link acortado) o el cliente quitó o bloqueó al negocio.");
    else if (!r.ok) console.warn(`Linkvia respondió ${r.status} al mandar un aviso.`);
    if (!r.ok) return false;
    const creados = await r.json().catch(() => []);
    return Array.isArray(creados) ? creados : [];
  } catch (e) {
    console.warn("No pude mandar un aviso:", e.message);
    return false;
  }
}

/**
 * Cambia un mensaje que ya mandó el bot, por ejemplo la tarjeta de un pedido cuando cambia de estado
 * (un `order` se puede actualizar hasta 30 días después). Devuelve si salió bien.
 */
export async function editar(messageId, action) {
  if (!CLAVE_API || !messageId) return false;
  try {
    const r = await fetch(`${API}/bot/v0/messages/${encodeURIComponent(messageId)}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${CLAVE_API}`, "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: "0", action }),
    });
    if (!r.ok) console.warn(`Linkvia respondió ${r.status} al actualizar el mensaje ${messageId}.`);
    return r.ok;
  } catch (e) {
    console.warn("No pude actualizar un mensaje:", e.message);
    return false;
  }
}

/**
 * Arranca el servidor.
 * - responder(evento): devuelve la lista de acciones para contestar en el momento.
 * - rutas: otras direcciones, por ejemplo { "POST /mercadopago": fn, "GET /panel": fn }.
 *   Cada fn recibe { url, cuerpo, headers } y devuelve { status?, tipo?, cuerpo?, headers? }.
 * - cadaMinuto(): tareas que corren solas (recordatorios, vencimientos).
 * - atajos: [[id, título], ...] del menú principal. Si el negocio todavía no cargó su menú de atajos,
 *   se cargan al arrancar con los mismos ids que los botones, así el bot los entiende igual.
 */
export function iniciar({ responder, rutas = {}, cadaMinuto, atajos }) {
  if (atajos?.length) void cargarAtajos(atajos);
  if (!SECRETO) {
    console.error("Falta LINKVIA_WEBHOOK_SECRET. Lo da el panel de Linkvia al registrar el negocio.");
    process.exit(1);
  }
  // Si una entrega falla, Linkvia la reintenta con el mismo eventId: devolvemos la misma respuesta.
  const respondidos = new Map();

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let cuerpo = "";
    for await (const parte of req) cuerpo += parte;
    try {
      const ruta = rutas[`${req.method} ${url.pathname}`];
      if (ruta) {
        const r = (await ruta({ url, cuerpo, headers: req.headers })) || {};
        res.writeHead(r.status || 200, { "content-type": r.tipo || "application/json", ...r.headers });
        return res.end(r.cuerpo ?? "");
      }
      if (req.method !== "POST" || !firmaValida(cuerpo, req.headers["linkvia-signature"])) {
        return res.writeHead(401).end();
      }
      const evento = JSON.parse(cuerpo);
      let actions = respondidos.get(evento.eventId);
      if (!actions) {
        actions = (await responder(evento)) || [];
        if (evento.eventId) {
          respondidos.set(evento.eventId, actions);
          if (respondidos.size > 2000) respondidos.delete(respondidos.keys().next().value);
        }
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ contractVersion: "0", actions }));
    } catch (e) {
      console.error(e);
      res.writeHead(500).end();
    }
  });

  const puerto = process.env.PORT || 4000;
  servidor.listen(puerto, () => console.log(`Agente escuchando en http://localhost:${puerto}`));
  if (cadaMinuto) {
    const tarea = async () => {
      try {
        await cadaMinuto();
      } catch (e) {
        console.error("Error en la tarea de cada minuto:", e);
      }
    };
    setInterval(tarea, 60_000).unref?.();
    setTimeout(tarea, 2_000);
  }
  return servidor;
}

/**
 * Carga el menú de atajos del agente (el botón al lado del campo de texto y, en el chat vacío, los
 * primeros 4 como botones) si el negocio no tiene ninguno. Si el dueño ya armó el suyo, no lo toca.
 */
export async function cargarAtajos(atajos) {
  if (!CLAVE_API) return false;
  try {
    const headers = { authorization: `Bearer ${CLAVE_API}`, "content-type": "application/json" };
    const actual = await fetch(`${API}/business`, { headers });
    if (!actual.ok) return false;
    if ((await actual.json()).shortcuts?.length) return true;
    const r = await fetch(`${API}/business/shortcuts`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ shortcuts: atajos.slice(0, 10).map(([id, title]) => ({ id, title: corto(title, 24) })) }),
    });
    if (!r.ok) console.warn(`Linkvia respondió ${r.status} al cargar el menú de atajos.`);
    return r.ok;
  } catch (e) {
    console.warn("No pude cargar el menú de atajos:", e.message);
    return false;
  }
}

/** Atajos para armar acciones sin pasarse de los límites de Linkvia. */
export const texto = (text) => ({ type: "text", text });
export const botones = (text, lista) => ({
  type: "buttons",
  text,
  buttons: lista.slice(0, 3).map(([id, title]) => ({ id, title: corto(title, 24) })),
});
export const lista = (text, boton, filas, titulo) => ({
  type: "list",
  text,
  button: corto(boton, 24),
  sections: [
    {
      ...(titulo && { title: corto(titulo, 24) }),
      rows: filas.slice(0, 10).map(([id, title, description]) => ({
        id,
        title: corto(title, 24),
        ...(description && { description: corto(description, 72) }),
      })),
    },
  ],
});
export const enlace = (text, label, url) => ({ type: "link", text, label: corto(label, 24), url });
export const pasarAPersona = (reason) => ({ type: "handoff", reason });

export function corto(t, max) {
  t = String(t);
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

/** $12.500 */
export const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");
