// Plantilla de Linkvia: pedidos para gastronomía con delivery y take away.
// Rotisería, pizzería, viandas, hamburguesería, sushi, heladería, cafetería: cualquier local con envío o retiro.
// Muestra el menú, arma el pedido, pide dirección con permiso del cliente, cobra (opcional) y avisa el estado.
// Todo lo del negocio (menú, zonas, horarios, forma de pago) está en config.json.
import { iniciar, enviar, texto, botones, lista, enlace, pasarAPersona, pesos } from "../comun/linkvia.mjs";
import { almacen, leerConfig, codigo } from "../comun/datos.mjs";
import { diaSemana, fechaLocal, horaLocal, minutos } from "../comun/hora.mjs";
import { crearCobro, cobroAutomatico, rutaAvisos } from "../comun/mercadopago.mjs";
import { panel } from "../comun/panel.mjs";

const config = leerConfig(import.meta.url);
const { datos, guardar } = almacen(process.env.DATOS || "pedidos.json", { carritos: {}, pedidos: [] });
const MINUTOS_PARA_PAGAR = 30;

const todos = config.menu.flatMap((c) => c.items);
const item = (id) => todos.find((i) => i.id === id);
const carrito = (usuario) => (datos.carritos[usuario] ||= { items: {} });
const formasDeEntrega = () => ["delivery", "retiro"].filter((f) => config[f]?.activo);

const ESTADOS = {
  eligiendo_pago: "Esperando que elijas cómo pagar",
  esperando_pago: "Esperando el pago",
  nuevo: "Recibido, en la fila de la cocina",
  preparando: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function abierto() {
  const franjas = config.horario?.[diaSemana(fechaLocal())];
  if (!config.horario) return true;
  const ahora = minutos(horaLocal());
  return (franjas || []).some(([desde, hasta]) => ahora >= minutos(desde) && ahora <= minutos(hasta));
}
const horarioDeHoy = () => (config.horario?.[diaSemana(fechaLocal())] || []).map(([d, h]) => `${d} a ${h}`).join(" y ") || "hoy no abrimos";

const menuPrincipal = (saludo = config.bienvenida) =>
  botones(saludo, [
    ["pedir", "Hacer un pedido"],
    ["estado", "Mi pedido"],
    ["humano", "Hablar con alguien"],
  ]);

function categorias() {
  if (!abierto()) return [texto(`Ahora estamos cerrados. Hoy atendemos de ${horarioDeHoy()}. ¡Te esperamos!`)];
  return [lista("¿Qué vas a pedir?", "Ver el menú", config.menu.map((c, i) => [`cat:${i}`, c.categoria, `${c.items.length} opciones`]))];
}

function productos(i) {
  const cat = config.menu[i];
  if (!cat) return categorias();
  // Con fotos se ve como carrusel; sin fotos, como lista.
  if (cat.items.some((p) => p.imagen)) {
    return [
      {
        type: "carousel",
        text: cat.categoria,
        cards: cat.items.slice(0, 10).map((p) => ({
          title: p.nombre,
          description: `${pesos(p.precio)}${p.descripcion ? ` · ${p.descripcion}` : ""}`,
          ...(p.imagen && { imageUrl: p.imagen }),
          buttons: [{ id: `add:${p.id}`, title: "Agregar" }],
        })),
      },
    ];
  }
  return [lista(`*${cat.categoria}*`, "Elegir", cat.items.map((p) => [`add:${p.id}`, p.nombre, `${pesos(p.precio)}${p.descripcion ? ` · ${p.descripcion}` : ""}`]))];
}

function subtotal(c) {
  return Object.entries(c.items).reduce((s, [id, n]) => s + (item(id)?.precio || 0) * n, 0);
}
function detalle(c) {
  return Object.entries(c.items)
    .filter(([id]) => item(id))
    .map(([id, n]) => `${n} × ${item(id).nombre}: ${pesos(item(id).precio * n)}`)
    .join("\n");
}
const envio = (c) => (c.entrega === "delivery" ? config.delivery.zonas.find((z) => z.id === c.zona)?.costo || 0 : 0);

function verPedido(usuario) {
  const c = carrito(usuario);
  if (!Object.keys(c.items).length) return [botones("Tu pedido está vacío.", [["pedir", "Ver el menú"]])];
  return [
    botones(`*Tu pedido*\n${detalle(c)}\n\nSubtotal: *${pesos(subtotal(c))}*`, [
      ["fin", "Terminar pedido"],
      ["pedir", "Agregar más"],
      ["vaciar", "Empezar de nuevo"],
    ]),
  ];
}

function agregar(usuario, id, cantidad) {
  const c = carrito(usuario);
  c.items[id] = (c.items[id] || 0) + cantidad;
  delete c.esperando;
  guardar();
  return [
    botones(`Sumé ${cantidad} × ${item(id).nombre}. Llevás ${pesos(subtotal(c))}.`, [
      ["pedir", "Agregar más"],
      ["ver", "Ver pedido"],
      ["fin", "Terminar pedido"],
    ]),
  ];
}

function elegirEntrega(evento) {
  const c = carrito(evento.user.id);
  if (!Object.keys(c.items).length) return verPedido(evento.user.id);
  const formas = formasDeEntrega();
  if (formas.length === 1) return entrega(evento, formas[0]);
  return [botones("¿Te lo llevamos o lo pasás a buscar?", [["ent:delivery", "Delivery"], ["ent:retiro", "Retiro en el local"]])];
}

function entrega(evento, forma) {
  const c = carrito(evento.user.id);
  c.entrega = forma;
  guardar();
  if (forma === "delivery") {
    if (subtotal(c) < config.delivery.minimo) {
      return [botones(`El mínimo para delivery es ${pesos(config.delivery.minimo)} y llevás ${pesos(subtotal(c))}.`, [["pedir", "Agregar más"], ["ent:retiro", "Paso a buscarlo"]])];
    }
    return [lista("¿A qué zona?", "Elegir zona", config.delivery.zonas.map((z) => [`zona:${z.id}`, z.nombre, `Envío ${pesos(z.costo)}`]))];
  }
  return pedirDatos(evento);
}

// Nombre y dirección solo con permiso del cliente (requestConsent), como pide Linkvia.
function pedirDatos(evento) {
  const c = carrito(evento.user.id);
  const tiene = evento.user.sharedData || {};
  const faltan = c.entrega === "delivery" ? ["name", "address"].filter((d) => !tiene[d]) : ["name"].filter((d) => !tiene[d]);
  if (!faltan.length) return resumen(evento);
  c.esperando = "datos";
  guardar();
  return [
    {
      type: "requestConsent",
      dataTypes: faltan,
      purpose: c.entrega === "delivery" ? "Para llevarte el pedido" : "Para tener tu pedido listo con tu nombre",
    },
  ];
}

function resumen(evento) {
  const c = carrito(evento.user.id);
  delete c.esperando;
  guardar();
  const datosCliente = evento.user.sharedData || {};
  const donde =
    c.entrega === "delivery"
      ? `Delivery a ${datosCliente.address} (envío ${pesos(envio(c))}), en unos ${config.delivery.demoraMinutos} minutos.`
      : `Retirás en ${config.retiro.direccion}, en unos ${config.retiro.demoraMinutos} minutos.`;
  return [
    botones(`*Resumen*\n${detalle(c)}\n${donde}\n\nTotal: *${pesos(subtotal(c) + envio(c))}*`, [
      ["confirmar", "Confirmar pedido"],
      ["ver", "Cambiar algo"],
    ]),
  ];
}

async function confirmar(evento) {
  const c = carrito(evento.user.id);
  if (!Object.keys(c.items).length || !c.entrega) return verPedido(evento.user.id);
  const datosCliente = evento.user.sharedData || {};
  if (c.entrega === "delivery" && !datosCliente.address) return pedirDatos(evento);
  const p = {
    id: codigo("P"),
    usuario: evento.user.id,
    conversacion: evento.conversation.id,
    nombre: datosCliente.name,
    direccion: c.entrega === "delivery" ? datosCliente.address : undefined,
    items: Object.entries(c.items).map(([id, n]) => ({ nombre: item(id).nombre, cantidad: n, precio: item(id).precio })),
    envio: envio(c),
    total: subtotal(c) + envio(c),
    entrega: c.entrega,
    zona: c.zona,
    estado: "nuevo",
    pago: "al_recibir",
    creado: new Date().toISOString(),
  };
  datos.pedidos.push(p);
  delete datos.carritos[evento.user.id];
  guardar();

  if (config.pago === "anticipado") return cobrar(p);
  if (config.pago === "a_eleccion") {
    p.estado = "eligiendo_pago";
    guardar();
    return [botones(`Pedido *${p.id}* anotado. ¿Cómo pagás?`, [[`pagar:${p.id}`, "Pagar ahora"], [`alrecibir:${p.id}`, p.entrega === "delivery" ? "Al recibir" : "Al retirar"]])];
  }
  return [texto(confirmado(p))];
}

const confirmado = (p) =>
  `¡Listo! Pedido *${p.id}* en la cocina. ${p.entrega === "delivery" ? `Llega en unos ${config.delivery.demoraMinutos} minutos.` : `Pasá a buscarlo en unos ${config.retiro.demoraMinutos} minutos por ${config.retiro.direccion}.`} Te aviso por acá cómo va.`;

async function cobrar(p) {
  p.estado = "esperando_pago";
  p.venceElPago = new Date(Date.now() + MINUTOS_PARA_PAGAR * 60_000).toISOString();
  guardar();
  const link = (await crearCobro({ titulo: `Pedido ${p.id} de ${config.negocio}`, monto: p.total, referencia: p.id, venceEnMinutos: MINUTOS_PARA_PAGAR })) || config.linkDePago;
  const como = cobroAutomatico ? "Apenas se acredite, lo mandamos a la cocina." : `Si el link no tiene el monto, poné ${pesos(p.total)}. Después mandá el comprobante por acá con el código ${p.id}.`;
  return [texto(`Pedido *${p.id}*: ${pesos(p.total)}. ${como}`), enlace("Pagá con Mercado Pago:", "Pagar pedido", link)];
}

async function pagado(referencia) {
  const p = datos.pedidos.find((x) => x.id === referencia);
  if (!p || p.estado !== "esperando_pago") return;
  p.estado = "nuevo";
  p.pago = "pagado";
  guardar();
  await enviar(p.conversacion, [texto(`¡Pago recibido! ${confirmado(p)}`)]);
}

function estado(usuario) {
  const p = datos.pedidos.filter((x) => x.usuario === usuario).at(-1);
  if (!p) return [botones("No tenés pedidos todavía.", [["pedir", "Hacer un pedido"]])];
  return [texto(`Pedido *${p.id}* (${pesos(p.total)}): ${ESTADOS[p.estado]}.`)];
}

async function responder(evento) {
  const usuario = evento.user?.id;
  if (evento.type === "consent") {
    const c = carrito(usuario);
    if (c.esperando !== "datos") return [];
    if (c.entrega === "delivery" && !evento.user.sharedData?.address) {
      return [botones("Sin la dirección no te lo podemos llevar. ¿Lo pasás a buscar?", [["ent:retiro", "Paso a buscarlo"], ["vaciar", "Cancelar pedido"]])];
    }
    return resumen(evento);
  }
  if (evento.type !== "message") return [];

  const id = evento.message.choice?.id || "";
  const [accion, a, b] = id.split(":");
  if (accion === "pedir") return categorias();
  if (accion === "cat") return productos(Number(a));
  if (accion === "add" && item(a)) {
    carrito(usuario).esperando = `cantidad:${a}`;
    guardar();
    return [botones(`¿Cuántas de *${item(a).nombre}*? Si son más, escribí el número.`, [[`cant:${a}:1`, "1"], [`cant:${a}:2`, "2"], [`cant:${a}:3`, "3"]])];
  }
  if (accion === "cant" && item(a)) return agregar(usuario, a, Number(b) || 1);
  if (accion === "ver") return verPedido(usuario);
  if (accion === "vaciar") {
    delete datos.carritos[usuario];
    guardar();
    return [botones("Listo, empezamos de cero.", [["pedir", "Ver el menú"]])];
  }
  if (accion === "fin") return elegirEntrega(evento);
  if (accion === "ent" && formasDeEntrega().includes(a)) return entrega(evento, a);
  if (accion === "zona" && config.delivery.zonas.some((z) => z.id === a)) {
    carrito(usuario).zona = a;
    guardar();
    return pedirDatos(evento);
  }
  if (accion === "confirmar") return confirmar(evento);
  if (accion === "estado") return estado(usuario);
  if (accion === "humano") return [texto("Ya le aviso a alguien del local. Te escribe por acá."), pasarAPersona("Pidió hablar con una persona")];
  const propio = datos.pedidos.find((p) => p.id === a && p.usuario === usuario && p.estado === "eligiendo_pago");
  if (accion === "pagar" && propio) return cobrar(propio);
  if (accion === "alrecibir" && propio) {
    propio.estado = "nuevo";
    guardar();
    return [texto(confirmado(propio))];
  }

  // Escribió un número después de elegir un producto.
  const esperando = carrito(usuario).esperando || "";
  const n = Number(evento.message.text.trim());
  if (esperando.startsWith("cantidad:") && Number.isInteger(n) && n > 0 && n <= 50) return agregar(usuario, esperando.slice(9), n);
  return [menuPrincipal()];
}

// Pedidos que no se pagaron a tiempo.
async function cadaMinuto() {
  for (const p of datos.pedidos.filter((x) => x.estado === "esperando_pago" && new Date(x.venceElPago) < new Date())) {
    p.estado = "cancelado";
    guardar();
    await enviar(p.conversacion, [botones(`Cancelé el pedido *${p.id}* porque no llegó el pago. Si querés, lo hacemos de nuevo.`, [["pedir", "Hacer un pedido"]])]);
  }
}

const AVISOS = {
  preparando: (p) => `Tu pedido *${p.id}* ya está en preparación. 🔥`,
  listo: (p) => (p.entrega === "delivery" ? `¡Tu pedido *${p.id}* salió! Ya va en camino. 🛵` : `¡Tu pedido *${p.id}* está listo! Te esperamos en ${config.retiro.direccion}.`),
  entregado: () => "¡Gracias por tu compra! Que lo disfrutes.",
  cancelado: (p) => `El local canceló tu pedido *${p.id}*. Si tenés dudas, escribinos por acá.`,
};

const rutasPanel = panel({
  titulo: `Pedidos de ${config.negocio}`,
  tablas: () => [
    {
      titulo: "Pedidos en curso",
      columnas: ["Código", "Hora", "Pedido", "Entrega", "Total", "Pago", "Estado"],
      filas: datos.pedidos
        .filter((p) => !["entregado", "cancelado"].includes(p.estado))
        .map((p) => ({
          id: p.id,
          celdas: [
            p.id,
            horaLocal(new Date(p.creado)),
            p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(", "),
            p.entrega === "delivery" ? `Delivery: ${p.direccion} (${p.nombre || "sin nombre"})` : `Retira ${p.nombre || "sin nombre"}`,
            pesos(p.total),
            p.pago === "pagado" ? "Pagado" : p.estado === "esperando_pago" ? "Esperando pago" : "Paga al recibir",
            ESTADOS[p.estado],
          ],
          acciones: [
            ...(p.estado === "esperando_pago" ? [["pagado", "Marcar pagado"]] : []),
            ...(p.estado === "nuevo" ? [["preparando", "En preparación"]] : []),
            ...(["nuevo", "preparando"].includes(p.estado) ? [["listo", p.entrega === "delivery" ? "Salió" : "Listo para retirar"]] : []),
            ...(p.estado === "listo" ? [["entregado", "Entregado"]] : []),
            ["cancelado", "Cancelar"],
          ],
        })),
    },
  ],
  alAccion: async (id, accion) => {
    const p = datos.pedidos.find((x) => x.id === id);
    if (!p) return;
    if (accion === "pagado") return pagado(id);
    if (!AVISOS[accion]) return;
    p.estado = accion;
    guardar();
    await enviar(p.conversacion, [texto(AVISOS[accion](p))]);
  },
});

iniciar({ responder, cadaMinuto, rutas: { "POST /mercadopago": rutaAvisos(pagado), ...rutasPanel } });
