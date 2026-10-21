// Bot mínimo para Linkvia. No necesita instalar nada: solo Node 18 o más nuevo.
//   LINKVIA_WEBHOOK_SECRET=whsec_... node bot.mjs
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.LINKVIA_WEBHOOK_SECRET;
const PORT = process.env.PORT || 4000;

// Comprueba que el mensaje viene de Linkvia (encabezado linkvia-signature).
function firmaValida(cuerpo, encabezado = "") {
  const partes = Object.fromEntries(encabezado.split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(partes.t);
  if (!t || !partes.v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const esperada = createHmac("sha256", SECRET).update(`${t}.${cuerpo}`).digest();
  const recibida = Buffer.from(partes.v1, "hex");
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

// Acá va la lógica de tu agente. Devolvé una lista de acciones.
function responder(evento) {
  if (evento.type !== "message") return []; // ping, consent, reaction: no hace falta contestar
  const texto = evento.message.text.toLowerCase();
  if (texto.includes("hola")) {
    return [{ type: "buttons", text: "¡Hola! ¿En qué te ayudo?", buttons: [
      { id: "menu", title: "Ver el menú" },
      { id: "humano", title: "Hablar con alguien" },
    ] }];
  }
  if (evento.message.choice?.id === "menu") {
    return [{ type: "text", text: "Hoy tenemos *muzza* a $12.000 y *napolitana* a $14.000." }];
  }
  if (evento.message.choice?.id === "humano") {
    return [{ type: "handoff", reason: "Pidió hablar con una persona" }];
  }
  return [{ type: "text", text: `Recibí: "${evento.message.text}". Escribime "hola" para empezar.` }];
}

createServer(async (req, res) => {
  let cuerpo = "";
  for await (const parte of req) cuerpo += parte;
  if (req.method !== "POST" || !firmaValida(cuerpo, req.headers["linkvia-signature"])) {
    return res.writeHead(401).end();
  }
  const respuesta = { contractVersion: "0", actions: responder(JSON.parse(cuerpo)) };
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(respuesta));
}).listen(PORT, () => console.log(`Bot escuchando en http://localhost:${PORT}`));
