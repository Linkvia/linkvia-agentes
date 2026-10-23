// Plantilla de Linkvia: reservas de canchas (pádel, fútbol 5, tenis, complejos).
// Muestra horarios libres, reserva, cobra seña (opcional), avisa si se libera un turno,
// recuerda el partido y arma la lista de jugadores con un link para pasarle a los amigos.
// Todo lo del complejo (canchas, deportes, precios, horarios) está en config.json.
import { iniciar, enviar, texto, botones, lista, enlace, pasarAPersona, pesos, APP } from "../comun/linkvia.mjs";
import { almacen, leerConfig, codigo } from "../comun/datos.mjs";
import { horariosLibres, diasQueAbre } from "../comun/agenda.mjs";
import { fechaLinda, instante, minutos } from "../comun/hora.mjs";
import { crearCobro, cobroAutomatico, rutaAvisos } from "../comun/mercadopago.mjs";
import { panel } from "../comun/panel.mjs";

const config = leerConfig(import.meta.url);
const { datos, guardar } = almacen(process.env.DATOS || "reservas.json", { reservas: [], espera: [] });

const deporte = (id) => config.deportes[id] && { id, ...config.deportes[id] };
const cancha = (id) => config.canchas.find((c) => c.id === id);
const activas = () => datos.reservas.filter((r) => r.estado === "confirmada" || r.estado === "pendiente");
const sinPuntos = (h) => h.replace(":", "");
const conPuntos = (h) => `${h.slice(0, 2)}:${h.slice(2)}`;
const cuando = (r) => `${fechaLinda(r.fecha)} a las ${r.hora}`;

function libres(dep, fecha) {
  return horariosLibres({
    fecha,
    horario: config.horario,
    duracion: dep.duracion,
    paso: config.pasoMinutos,
    recursos: config.canchas.filter((c) => c.deporte === dep.id).map((c) => c.id),
    reservas: activas(),
    anticipacion: config.anticipacionMinutos,
  });
}

const menu = (saludo = config.bienvenida) =>
  botones(saludo, [
    ["reservar", "Reservar cancha"],
    ["mis", "Mis reservas"],
    ["humano", "Hablar con alguien"],
  ]);

function elegirDeporte() {
  const ids = Object.keys(config.deportes);
  if (ids.length === 1) return elegirDia(deporte(ids[0]));
  return [lista("¿Qué vas a jugar?", "Elegir deporte", ids.map((id) => [`dep:${id}`, config.deportes[id].nombre, `${config.deportes[id].duracion} min · ${pesos(config.deportes[id].precio)}`]))];
}

function elegirDia(dep) {
  const filas = diasQueAbre(config.horario, config.diasAdelante).map((fecha) => {
    const n = libres(dep, fecha).length;
    return n
      ? [`dia:${dep.id}:${fecha}`, fechaLinda(fecha), `${n} horarios libres`]
      : [`espera:${dep.id}:${fecha}`, `${fechaLinda(fecha)} (completo)`, "Te aviso si se libera"];
  });
  return [lista(`*${dep.nombre}*. ¿Qué día?`, "Elegir día", filas)];
}

function elegirHora(dep, fecha, franja) {
  let horarios = libres(dep, fecha);
  if (!horarios.length) return [texto("Ese día se llenó recién."), ...elegirDia(dep)];
  if (horarios.length > 10 && !franja) {
    return [
      botones(`${fechaLinda(fecha)}: ¿a qué hora más o menos?`, [
        [`franja:${dep.id}:${fecha}:m`, "Antes de las 14"],
        [`franja:${dep.id}:${fecha}:t`, "De 14 a 19"],
        [`franja:${dep.id}:${fecha}:n`, "Después de las 19"],
      ]),
    ];
  }
  const m = (h) => minutos(h.hora);
  if (franja === "m") horarios = horarios.filter((h) => m(h) < 14 * 60);
  if (franja === "t") horarios = horarios.filter((h) => m(h) >= 14 * 60 && m(h) < 19 * 60);
  if (franja === "n") horarios = horarios.filter((h) => m(h) >= 19 * 60);
  if (!horarios.length) return [texto("En esa franja no queda lugar."), ...elegirHora(dep, fecha)];
  return [
    lista(
      `${fechaLinda(fecha)}. Elegí el horario:`,
      "Ver horarios",
      horarios.slice(0, 10).map((h) => [`hora:${dep.id}:${fecha}:${sinPuntos(h.hora)}`, h.hora, `${h.libres.length} ${h.libres.length === 1 ? "cancha libre" : "canchas libres"}`]),
    ),
  ];
}

const montoSena = (dep) => (config.sena ? config.sena.monto ?? Math.round((dep.precio * (config.sena.porcentaje || 0)) / 100) : 0);
const linkPartido = (handle, r) => `${APP}/@${handle}?text=${encodeURIComponent(`Me sumo al partido ${r.id}`)}`;

async function reservar(evento, dep, fecha, hora) {
  const lugar = libres(dep, fecha).find((h) => h.hora === hora);
  if (!lugar) return [texto("Uy, ese horario se ocupó recién."), ...elegirHora(dep, fecha)];
  const sena = montoSena(dep);
  const organizador = { usuario: evento.user.id, conversacion: evento.conversation.id, nombre: evento.user.sharedData?.name || "Organizador" };
  const r = {
    id: codigo("R"),
    usuario: evento.user.id,
    conversacion: evento.conversation.id,
    nombre: evento.user.sharedData?.name,
    deporte: dep.id,
    fecha,
    hora,
    duracion: dep.duracion,
    recurso: lugar.libres[0],
    estado: sena ? "pendiente" : "confirmada",
    jugadores: [organizador],
    creada: new Date().toISOString(),
  };
  if (sena) r.venceSena = new Date(Date.now() + config.sena.minutosParaPagar * 60_000).toISOString();
  datos.reservas.push(r);
  guardar();

  const detalle = `*${cancha(r.recurso).nombre}* el ${cuando(r)} (${dep.duracion} min, ${pesos(dep.precio)}).`;
  const amigos = enlace(`Pasales este link a tus amigos para que se anoten en el partido:`, "Sumarse al partido", linkPartido(evento.business.handle, r));
  if (!sena) return [texto(`¡Reservado! ${detalle} Código: ${r.id}`), amigos];
  const link = (await crearCobro({ titulo: `Seña ${cancha(r.recurso).nombre} ${cuando(r)}`, monto: sena, referencia: r.id, venceEnMinutos: config.sena.minutosParaPagar })) || config.linkDePago;
  const como = cobroAutomatico ? "Apenas se acredite te confirmo." : `Después mandá el comprobante por acá con el código ${r.id}.`;
  return [
    texto(`Te guardo ${detalle}\nPara confirmarla, pagá la seña de ${pesos(sena)} en los próximos ${config.sena.minutosParaPagar} minutos. ${como}`),
    enlace("Pagá la seña con Mercado Pago:", "Pagar seña", link),
    amigos,
  ];
}

async function sumarJugador(evento, codigoReserva) {
  const r = activas().find((x) => x.id === codigoReserva.toUpperCase());
  if (!r) return [texto("No encuentro ese partido. Fijate el código o pedile el link de nuevo a quien reservó.")];
  if (r.jugadores.some((j) => j.usuario === evento.user.id)) return [texto(`Ya estás anotado para el ${cuando(r)}.`)];
  const cupo = config.deportes[r.deporte].jugadores;
  if (r.jugadores.length >= cupo) return [texto(`El partido del ${cuando(r)} ya está completo (${cupo} jugadores).`)];
  const nombre = evento.user.sharedData?.name || `Jugador ${r.jugadores.length + 1}`;
  r.jugadores.push({ usuario: evento.user.id, conversacion: evento.conversation.id, nombre });
  guardar();
  await enviar(r.conversacion, [texto(`${nombre} se sumó al partido del ${cuando(r)}. Van ${r.jugadores.length} de ${cupo}.`)]);
  return [texto(`¡Anotado! Partido de ${config.deportes[r.deporte].nombre} el ${cuando(r)} en ${config.direccion}. Te recuerdo antes.`)];
}

function misReservas(evento) {
  const mias = activas().filter((r) => r.jugadores.some((j) => j.usuario === evento.user.id) && instante(r.fecha, r.hora) > new Date());
  if (!mias.length) return [botones("No tenés partidos próximos.", [["reservar", "Reservar cancha"], ["menu", "Volver"]])];
  return [
    lista(
      "Tus próximos partidos:",
      "Ver partidos",
      mias.map((r) => [`ver:${r.id}`, `${fechaLinda(r.fecha)} ${r.hora}`, `${cancha(r.recurso).nombre} · ${r.jugadores.length} anotados${r.estado === "pendiente" ? " · falta seña" : ""}`]),
    ),
  ];
}

async function cancelar(r, motivo) {
  r.estado = "cancelada";
  r.motivo = motivo;
  const esperando = datos.espera.filter((e) => e.fecha === r.fecha && e.deporte === r.deporte);
  datos.espera = datos.espera.filter((e) => !esperando.includes(e));
  guardar();
  for (const e of esperando) {
    await enviar(e.conversacion, [botones(`¡Se liberó una cancha de ${config.deportes[r.deporte].nombre} el ${fechaLinda(r.fecha)}! El primero que reserva se la queda.`, [[`dia:${r.deporte}:${r.fecha}`, "Ver horarios"]])]);
  }
  for (const j of r.jugadores.filter((j) => j.usuario !== r.usuario)) {
    await enviar(j.conversacion, [texto(`Se canceló el partido del ${cuando(r)}.`)]);
  }
}

async function responder(evento) {
  if (evento.type !== "message") return [];
  const id = evento.message.choice?.id || "";
  const [accion, a, b, c] = id.split(":");

  const sumarse = /me sumo.*?\b(R[A-Z0-9]{4})\b/i.exec(evento.message.text || "");
  if (!id && sumarse) return sumarJugador(evento, sumarse[1]);

  if (accion === "reservar") return elegirDeporte();
  if (accion === "mis") return misReservas(evento);
  if (accion === "humano") return [texto("Ya le aviso a alguien del complejo. Te escribe por acá."), pasarAPersona("Pidió hablar con una persona")];
  if (accion === "dep" && deporte(a)) return elegirDia(deporte(a));
  if (accion === "dia" && deporte(a)) return elegirHora(deporte(a), b);
  if (accion === "franja" && deporte(a)) return elegirHora(deporte(a), b, c);
  if (accion === "hora" && deporte(a)) {
    return [botones(`¿Reservo ${deporte(a).nombre} el ${fechaLinda(b)} a las ${conPuntos(c)}?`, [[`ok:${a}:${b}:${c}`, "Reservar"], [`dia:${a}:${b}`, "Otro horario"]])];
  }
  if (accion === "ok" && deporte(a)) return reservar(evento, deporte(a), b, conPuntos(c));
  if (accion === "espera" && deporte(a)) {
    if (!datos.espera.some((e) => e.usuario === evento.user.id && e.fecha === b && e.deporte === a)) {
      datos.espera.push({ usuario: evento.user.id, conversacion: evento.conversation.id, deporte: a, fecha: b });
      guardar();
    }
    return [texto(`Anotado. Si se libera una cancha el ${fechaLinda(b)}, te aviso por acá.`)];
  }
  const r = datos.reservas.find((x) => x.id === a);
  const esOrganizador = r?.usuario === evento.user.id;
  if (accion === "ver" && r) {
    const jugadores = r.jugadores.map((j) => j.nombre).join(", ");
    if (!esOrganizador) return [texto(`${cancha(r.recurso).nombre}, ${cuando(r)}. Anotados: ${jugadores}.`)];
    return [
      texto(`${cancha(r.recurso).nombre}, ${cuando(r)}. Anotados: ${jugadores}.`),
      enlace("Link para sumar amigos:", "Sumarse al partido", linkPartido(evento.business.handle, r)),
      botones("¿Querés cancelar la reserva?", [[`baja:${r.id}`, "Sí, cancelar"], ["mis", "No"]]),
    ];
  }
  if (accion === "baja" && r && esOrganizador && r.estado !== "cancelada") {
    await cancelar(r, "La canceló quien reservó");
    return [botones("Listo, cancelé la reserva y les avisé a los anotados.", [["reservar", "Reservar otra"]])];
  }
  return [menu()];
}

async function cadaMinuto() {
  const ahora = Date.now();
  for (const r of datos.reservas.filter((x) => x.estado === "pendiente" && new Date(x.venceSena).getTime() < ahora)) {
    await cancelar(r, "No llegó la seña a tiempo");
    await enviar(r.conversacion, [botones(`Liberé la cancha del ${cuando(r)} porque no llegó la seña.`, [["reservar", "Reservar de nuevo"]])]);
  }
  for (const r of datos.reservas.filter((x) => x.estado === "confirmada" && !x.recordado)) {
    const falta = instante(r.fecha, r.hora).getTime() - ahora;
    if (falta > 0 && falta <= config.recordatorioHorasAntes * 3600_000) {
      r.recordado = true;
      guardar();
      for (const j of r.jugadores) {
        await enviar(j.conversacion, [texto(`Recordatorio: hoy jugás a las ${r.hora} en ${cancha(r.recurso).nombre}, ${config.direccion}. ¡Buen partido!`)]);
      }
    }
  }
}

async function senaPagada(referencia) {
  const r = datos.reservas.find((x) => x.id === referencia);
  if (!r || r.estado !== "pendiente") return;
  r.estado = "confirmada";
  r.senaPagada = true;
  guardar();
  await enviar(r.conversacion, [texto(`¡Recibimos la seña! Tu reserva del ${cuando(r)} está confirmada. Código: ${r.id}`)]);
}

const rutasPanel = panel({
  titulo: `Reservas de ${config.negocio}`,
  tablas: () => [
    {
      titulo: "Próximas reservas",
      columnas: ["Cuándo", "Cancha", "Reservó", "Jugadores", "Estado", "Código"],
      filas: activas()
        .filter((r) => instante(r.fecha, r.hora).getTime() > Date.now() - 2 * 3600_000)
        .sort((x, y) => instante(x.fecha, x.hora) - instante(y.fecha, y.hora))
        .map((r) => ({
          id: r.id,
          celdas: [cuando(r), cancha(r.recurso).nombre, r.nombre || "(sin nombre)", r.jugadores.length, r.estado === "pendiente" ? "Falta seña" : "Confirmada", r.id],
          acciones: [...(r.estado === "pendiente" ? [["pagada", "Seña pagada"]] : []), ["cancelar", "Cancelar"]],
        })),
    },
  ],
  alAccion: async (id, accion) => {
    const r = datos.reservas.find((x) => x.id === id);
    if (!r) return;
    if (accion === "pagada") await senaPagada(id);
    if (accion === "cancelar" && r.estado !== "cancelada") {
      await cancelar(r, "La canceló el complejo");
      await enviar(r.conversacion, [botones(`El complejo tuvo que cancelar tu reserva del ${cuando(r)}. Perdón. ¿Buscamos otro horario?`, [["reservar", "Reservar otra"]])]);
    }
  },
});

iniciar({ responder, cadaMinuto, rutas: { "POST /mercadopago": rutaAvisos(senaPagada), ...rutasPanel } });
