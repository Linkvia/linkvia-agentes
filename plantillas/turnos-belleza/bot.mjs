// Plantilla de Linkvia: turnos para peluquería, barbería, uñas o estética.
// Agenda, confirma, recuerda el día antes, cancela, avisa si se libera un lugar y cobra seña (opcional).
// Todo lo del negocio (servicios, horarios, seña) está en config.json.
import { iniciar, enviar, texto, botones, lista, enlace, pasarAPersona, pesos } from "../comun/linkvia.mjs";
import { almacen, leerConfig, codigo } from "../comun/datos.mjs";
import { horariosLibres, diasQueAbre } from "../comun/agenda.mjs";
import { fechaLinda, instante, minutos } from "../comun/hora.mjs";
import { crearCobro, cobroAutomatico, rutaAvisos } from "../comun/mercadopago.mjs";
import { panel } from "../comun/panel.mjs";

const config = leerConfig(import.meta.url);
const { datos, guardar } = almacen(process.env.DATOS || "turnos.json", { reservas: [], espera: [], conversaciones: {} });

const servicio = (id) => config.servicios.find((s) => s.id === id);
const activas = () => datos.reservas.filter((r) => r.estado === "confirmada" || r.estado === "pendiente");
const hhmmSinPuntos = (h) => h.replace(":", "");
const conPuntos = (h) => `${h.slice(0, 2)}:${h.slice(2)}`;
const cuando = (r) => `${fechaLinda(r.fecha)} a las ${r.hora}`;

function libres(serv, fecha) {
  return horariosLibres({
    fecha,
    horario: config.horario,
    duracion: serv.duracion,
    paso: config.pasoMinutos,
    recursos: config.puestos,
    reservas: activas(),
    anticipacion: config.anticipacionMinutos,
  });
}

const menu = (saludo = config.bienvenida) =>
  botones(saludo, [
    ["turno", "Sacar turno"],
    ["mis", "Mis turnos"],
    ["humano", "Hablar con alguien"],
  ]);

function elegirServicio() {
  return [
    lista(
      "¿Qué te querés hacer?",
      "Ver servicios",
      config.servicios.map((s) => [`serv:${s.id}`, s.nombre, `${s.duracion} min · ${pesos(s.precio)}`]),
    ),
  ];
}

function elegirDia(serv) {
  const filas = diasQueAbre(config.horario, config.diasAdelante)
    .map((fecha) => {
      const n = libres(serv, fecha).length;
      return n
        ? [`dia:${serv.id}:${fecha}`, fechaLinda(fecha), `${n} horarios libres`]
        : [`espera:${serv.id}:${fecha}`, `${fechaLinda(fecha)} (completo)`, "Te aviso si se libera un lugar"];
    })
    .slice(0, 10);
  return [lista(`*${serv.nombre}*. ¿Qué día te queda bien?`, "Elegir día", filas)];
}

function elegirHora(serv, fecha, franja) {
  let horas = libres(serv, fecha).map((h) => h.hora);
  if (!horas.length) return [texto("Ese día se llenó recién. Elegí otro, por favor."), ...elegirDia(serv)];
  if (horas.length > 10 && !franja) {
    return [
      botones(`${fechaLinda(fecha)}: ¿a la mañana o a la tarde?`, [
        [`franja:${serv.id}:${fecha}:m`, "A la mañana"],
        [`franja:${serv.id}:${fecha}:t`, "A la tarde"],
      ]),
    ];
  }
  if (franja === "m") horas = horas.filter((h) => minutos(h) < 13 * 60);
  if (franja === "t") horas = horas.filter((h) => minutos(h) >= 13 * 60);
  return [
    lista(
      `${fechaLinda(fecha)}. Elegí el horario:`,
      "Ver horarios",
      horas.slice(0, 10).map((h) => [`hora:${serv.id}:${fecha}:${hhmmSinPuntos(h)}`, h]),
    ),
  ];
}

function montoSena(serv) {
  const s = config.sena;
  if (!s) return 0;
  return s.monto ?? Math.round((serv.precio * (s.porcentaje || 0)) / 100);
}

async function reservar(evento, serv, fecha, hora) {
  const lugar = libres(serv, fecha).find((h) => h.hora === hora);
  if (!lugar) return [texto("Uy, ese horario se ocupó recién."), ...elegirHora(serv, fecha)];
  const sena = montoSena(serv);
  const r = {
    id: codigo("T"),
    usuario: evento.user.id,
    conversacion: evento.conversation.id,
    nombre: evento.user.sharedData?.name,
    servicio: serv.id,
    fecha,
    hora,
    duracion: serv.duracion,
    recurso: lugar.libres[0],
    estado: sena ? "pendiente" : "confirmada",
    creada: new Date().toISOString(),
  };
  if (sena) r.venceSena = new Date(Date.now() + config.sena.minutosParaPagar * 60_000).toISOString();
  datos.reservas.push(r);
  guardar();

  const detalle = `*${serv.nombre}* el ${cuando(r)} con ${r.recurso}.`;
  if (!sena) return [texto(`¡Listo! Te esperamos: ${detalle}\nTe recuerdo el día antes. Código: ${r.id}`)];

  const link = (await crearCobro({ titulo: `Seña ${serv.nombre} ${cuando(r)}`, monto: sena, referencia: r.id, venceEnMinutos: config.sena.minutosParaPagar })) || config.linkDePago;
  const como = cobroAutomatico
    ? "Apenas se acredite te confirmo por acá."
    : `Cuando pagues, mandá el comprobante por acá y el negocio lo confirma. Indicá el código ${r.id}.`;
  return [
    texto(`Te reservo ${detalle}\nPara confirmarlo, pagá la seña de ${pesos(sena)} en los próximos ${config.sena.minutosParaPagar} minutos. ${como}`),
    enlace("Pagá la seña con Mercado Pago:", "Pagar seña", link),
  ];
}

function misTurnos(evento) {
  const mios = activas().filter((r) => r.usuario === evento.user.id && instante(r.fecha, r.hora) > new Date());
  if (!mios.length) return [botones("No tenés turnos próximos.", [["turno", "Sacar turno"], ["menu", "Volver"]])];
  return [
    lista(
      "Tus próximos turnos. Tocá uno para cancelarlo:",
      "Ver turnos",
      mios.map((r) => [`ver:${r.id}`, `${fechaLinda(r.fecha)} ${r.hora}`, `${servicio(r.servicio)?.nombre} · ${r.estado === "pendiente" ? "falta la seña" : "confirmado"}`]),
    ),
  ];
}

async function cancelar(r, motivo) {
  r.estado = "cancelada";
  r.motivo = motivo;
  guardar();
  // Avisa a quienes esperaban un lugar ese día para ese servicio.
  const esperando = datos.espera.filter((e) => e.fecha === r.fecha && e.servicio === r.servicio);
  datos.espera = datos.espera.filter((e) => !esperando.includes(e));
  guardar();
  const serv = servicio(r.servicio);
  for (const e of esperando) {
    await enviar(e.conversacion, [
      botones(`¡Se liberó un lugar para *${serv.nombre}* el ${fechaLinda(r.fecha)}! El primero que lo toma se lo queda.`, [[`dia:${serv.id}:${r.fecha}`, "Ver horarios"]]),
    ]);
  }
}

async function responder(evento) {
  if (evento.type !== "message") return [];
  datos.conversaciones[evento.user.id] = evento.conversation.id;
  const id = evento.message.choice?.id || "";
  const [accion, a, b, c] = id.split(":");

  if (accion === "turno") return elegirServicio();
  if (accion === "mis") return misTurnos(evento);
  if (accion === "humano") return [texto("Ya le aviso a alguien del local. Te escribe por acá."), pasarAPersona("Pidió hablar con una persona")];
  if (accion === "serv" && servicio(a)) return elegirDia(servicio(a));
  if (accion === "dia" && servicio(a)) return elegirHora(servicio(a), b);
  if (accion === "franja" && servicio(a)) return elegirHora(servicio(a), b, c);
  if (accion === "hora" && servicio(a)) {
    const serv = servicio(a);
    return [
      botones(`¿Confirmo *${serv.nombre}* el ${fechaLinda(b)} a las ${conPuntos(c)}? Sale ${pesos(serv.precio)}.`, [
        [`ok:${a}:${b}:${c}`, "Confirmar"],
        [`dia:${a}:${b}`, "Otro horario"],
      ]),
    ];
  }
  if (accion === "ok" && servicio(a)) return reservar(evento, servicio(a), b, conPuntos(c));
  if (accion === "espera" && servicio(a)) {
    if (!datos.espera.some((e) => e.usuario === evento.user.id && e.fecha === b && e.servicio === a)) {
      datos.espera.push({ usuario: evento.user.id, conversacion: evento.conversation.id, servicio: a, fecha: b });
      guardar();
    }
    return [texto(`Anotado. Si se libera un lugar el ${fechaLinda(b)}, te aviso por acá.`)];
  }
  const propia = datos.reservas.find((r) => r.id === a && r.usuario === evento.user.id);
  if (accion === "ver" && propia) {
    return [botones(`${servicio(propia.servicio)?.nombre}, ${cuando(propia)}. ¿Lo cancelo?`, [[`baja:${propia.id}`, "Sí, cancelar"], ["mis", "No"]])];
  }
  if (accion === "baja" && propia && propia.estado !== "cancelada") {
    await cancelar(propia, "La canceló el cliente");
    return [botones("Listo, cancelé el turno. ¿Querés sacar otro?", [["turno", "Sacar otro"], ["menu", "No, gracias"]])];
  }
  if (accion === "voy" && propia) {
    propia.confirmoAsistencia = true;
    guardar();
    return [texto(`¡Genial! Te esperamos el ${cuando(propia)}. Estamos en ${config.direccion}.`)];
  }
  return [menu()];
}

// Cada minuto: vencen las señas no pagadas y salen los recordatorios.
async function cadaMinuto() {
  const ahora = Date.now();
  for (const r of datos.reservas.filter((x) => x.estado === "pendiente" && new Date(x.venceSena).getTime() < ahora)) {
    await cancelar(r, "No llegó la seña a tiempo");
    await enviar(r.conversacion, [botones(`Liberé el turno del ${cuando(r)} porque no llegó la seña. Si querés, sacá otro.`, [["turno", "Sacar turno"]])]);
  }
  for (const r of datos.reservas.filter((x) => x.estado === "confirmada" && !x.recordado)) {
    const falta = instante(r.fecha, r.hora).getTime() - ahora;
    if (falta > 0 && falta <= config.recordatorioHorasAntes * 3600_000) {
      r.recordado = true;
      guardar();
      await enviar(r.conversacion, [
        botones(`Te recuerdo tu turno de *${servicio(r.servicio)?.nombre}* el ${cuando(r)} en ${config.direccion}.`, [
          [`voy:${r.id}`, "Ahí estaré"],
          [`baja:${r.id}`, "Cancelar"],
        ]),
      ]);
    }
  }
}

async function senaPagada(referencia) {
  const r = datos.reservas.find((x) => x.id === referencia);
  if (!r || r.estado !== "pendiente") return;
  r.estado = "confirmada";
  r.senaPagada = true;
  guardar();
  await enviar(r.conversacion, [texto(`¡Recibimos la seña! Tu turno del ${cuando(r)} está confirmado. Código: ${r.id}`)]);
}

const rutasPanel = panel({
  titulo: `Turnos de ${config.negocio}`,
  tablas: () => [
    {
      titulo: "Próximos turnos",
      columnas: ["Cuándo", "Servicio", "Con", "Cliente", "Estado", "Código"],
      filas: activas()
        .filter((r) => instante(r.fecha, r.hora).getTime() > Date.now() - 3600_000)
        .sort((x, y) => instante(x.fecha, x.hora) - instante(y.fecha, y.hora))
        .map((r) => ({
          id: r.id,
          celdas: [cuando(r), servicio(r.servicio)?.nombre, r.recurso, r.nombre || "(sin nombre)", r.estado === "pendiente" ? "Falta seña" : r.confirmoAsistencia ? "Confirmó que viene" : "Confirmado", r.id],
          acciones: [...(r.estado === "pendiente" ? [["pagada", "Seña pagada"]] : []), ["cancelar", "Cancelar"]],
        })),
    },
  ],
  alAccion: async (id, accion) => {
    const r = datos.reservas.find((x) => x.id === id);
    if (!r) return;
    if (accion === "pagada") await senaPagada(id);
    if (accion === "cancelar" && r.estado !== "cancelada") {
      await cancelar(r, "La canceló el negocio");
      await enviar(r.conversacion, [botones(`El local tuvo que cancelar tu turno del ${cuando(r)}. Perdón. ¿Sacamos otro?`, [["turno", "Sacar otro"]])]);
    }
  },
});

iniciar({ responder, cadaMinuto, rutas: { "POST /mercadopago": rutaAvisos(senaPagada), ...rutasPanel } });
