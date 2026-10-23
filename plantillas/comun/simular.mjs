// Probá tu agente sin Linkvia: este programa hace de cliente y de API de Linkvia en tu compu.
//
// Terminal 1 (el agente, apuntando a la API de prueba):
//   LINKVIA_WEBHOOK_SECRET=whsec_prueba LINKVIA_API_KEY=lv_prueba LINKVIA_API_URL=http://localhost:4001 PANEL_CLAVE=prueba node bot.mjs
// Terminal 2 (vos, como cliente):
//   node ../comun/simular.mjs
//
// Escribí como si fueras el cliente. Para tocar un botón u opción, escribí su número (1, 2, 3…).
// "compartir" acepta el último pedido de datos con datos de prueba; "no compartir" lo rechaza.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

const AGENTE = process.env.AGENTE_URL || "http://localhost:4000";
const SECRETO = process.env.LINKVIA_WEBHOOK_SECRET || "whsec_prueba";
const PUERTO_API = Number(process.env.PUERTO_API || 4001);
const USUARIO = process.env.USUARIO || "usr_prueba";
const conversacion = { id: `conv_${USUARIO}`, channel: "app" };
const datosDePrueba = { name: "Ana Prueba", phone: "+5493510000000", email: "ana@ejemplo.com", address: "Av. Siempreviva 742" };
let compartidos = {};
let opciones = [];
let pedidoDeDatos = null;

function mostrar(actions, origen = "Agente") {
  opciones = [];
  for (const a of actions) {
    const linea = (t) => console.log(`${origen}: ${t}`);
    if (a.type === "text") linea(a.text);
    else if (a.type === "buttons" || a.type === "list") {
      linea(a.text);
      const filas = a.type === "buttons" ? a.buttons : a.sections.flatMap((s) => s.rows);
      for (const f of filas) {
        opciones.push({ id: f.id, title: f.title, kind: a.type === "buttons" ? "button" : "list" });
        console.log(`   ${opciones.length}) ${f.title}${f.description ? ` · ${f.description}` : ""}`);
      }
    } else if (a.type === "carousel") {
      if (a.text) linea(a.text);
      for (const c of a.cards) {
        console.log(`   [${c.title}] ${c.description || ""}`);
        for (const b of c.buttons || []) {
          opciones.push({ id: b.id, title: b.title, kind: "button" });
          console.log(`   ${opciones.length}) ${b.title}`);
        }
      }
    } else if (a.type === "link") linea(`${a.text}\n   [${a.label}] ${a.url}`);
    else if (a.type === "requestConsent") {
      pedidoDeDatos = a;
      linea(`pide tus datos (${a.dataTypes.join(", ")}) "${a.purpose}". Escribí "compartir" o "no compartir".`);
    } else if (a.type === "handoff") linea(`(pasa la charla a una persona: ${a.reason || ""})`);
    else linea(JSON.stringify(a));
  }
}

async function mandar(evento) {
  const cuerpo = JSON.stringify({
    contractVersion: "0",
    eventId: `evt_${randomUUID()}`,
    business: { handle: "prueba" },
    conversation: conversacion,
    user: { id: USUARIO, sharedData: compartidos },
    ...evento,
  });
  const t = Math.floor(Date.now() / 1000);
  const firma = createHmac("sha256", SECRETO).update(`${t}.${cuerpo}`).digest("hex");
  const r = await fetch(AGENTE, {
    method: "POST",
    headers: { "content-type": "application/json", "linkvia-signature": `t=${t},v1=${firma}` },
    body: cuerpo,
  });
  if (!r.ok) return console.log(`(el agente respondió ${r.status})`);
  mostrar((await r.json()).actions);
}

// Hace de API de Linkvia para los avisos que el agente manda por su cuenta.
createServer(async (req, res) => {
  let cuerpo = "";
  for await (const p of req) cuerpo += p;
  if (req.url === "/bot/v0/messages") {
    const { conversationId, actions } = JSON.parse(cuerpo);
    if (conversationId === conversacion.id) mostrar(actions, "Agente (aviso)");
    else console.log(`(aviso para otra conversación: ${conversationId})`);
  }
  res.writeHead(200, { "content-type": "application/json" }).end("{}");
}).listen(PUERTO_API, () => {
  console.log(`Simulador listo. Hablando con ${AGENTE}. Escribí "hola".`);
  leer();
});

async function leer() {
  const rl = createInterface({ input: process.stdin });
  for await (const linea of rl) {
    const t = linea.trim();
    if (!t) continue;
    const n = Number(t);
    if (Number.isInteger(n) && opciones[n - 1]) {
      const o = opciones[n - 1];
      console.log(`Vos: (tocás "${o.title}")`);
      await mandar({ type: "message", message: { id: `msg_${randomUUID()}`, text: o.title, sentAt: new Date().toISOString(), choice: o } });
    } else if ((t === "compartir" || t === "no compartir") && pedidoDeDatos) {
      const acepta = t === "compartir";
      if (acepta) for (const d of pedidoDeDatos.dataTypes) compartidos[d] = datosDePrueba[d];
      await mandar({
        type: "consent",
        consent: {
          granted: acepta ? pedidoDeDatos.dataTypes : [],
          declined: acepta ? [] : pedidoDeDatos.dataTypes,
          purpose: pedidoDeDatos.purpose,
        },
      });
      pedidoDeDatos = null;
    } else {
      await mandar({ type: "message", message: { id: `msg_${randomUUID()}`, text: t, sentAt: new Date().toISOString() } });
    }
  }
  // Con entrada de un archivo, esperamos los avisos que lleguen tarde.
  setTimeout(() => process.exit(0), Number(process.env.ESPERA_FINAL_MS || 500));
}
