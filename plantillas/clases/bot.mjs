// Plantilla de Linkvia: clases con cupo para gimnasio, yoga, pilates, danza o funcional.
// Reserva y cancela lugares, lleva la lista de espera, recuerda la clase y cobra la cuota del mes.
// La grilla de clases, los cupos y la cuota están en config.json.
//
// Ojo: no pidas el apto médico por el chat. Es un dato de salud (Ley 25.326); seguí pidiéndolo en papel o por mail.
import { iniciar, enviar, texto, botones, lista, enlace, pasarAPersona, pesos } from "../comun/linkvia.mjs";
import { almacen, leerConfig, codigo } from "../comun/datos.mjs";
import { diaSemana, fechaLinda, fechaLocal, horaLocal, instante, mesLocal, nombreMes } from "../comun/hora.mjs";
import { crearCobro, cobroAutomatico, rutaAvisos } from "../comun/mercadopago.mjs";
import { panel } from "../comun/panel.mjs";

const config = leerConfig(import.meta.url);
const { datos, guardar } = almacen(process.env.DATOS || "clases.json", { reservas: [], espera: [], alumnos: {} });

const clase = (id) => config.clases.find((c) => c.id === id);
const anotados = (claseId, fecha) => datos.reservas.filter((r) => r.clase === claseId && r.fecha === fecha && r.estado === "confirmada");
const titulo = (c, fecha) => `${c.nombre} ${fechaLinda(fecha)} ${c.hora}`;
const alumno = (evento) => {
  const a = (datos.alumnos[evento.user.id] ||= { conversacion: evento.conversation.id, pagos: [] });
  a.conversacion = evento.conversation.id;
  if (evento.user.sharedData?.name) a.nombre = evento.user.sharedData.name;
  return a;
};
const cuotaAlDia = (a) => a.pagos.includes(mesLocal()) || Number(fechaLocal().slice(8, 10)) <= config.cuota.venceElDia;

/** Las clases de los próximos días, en orden. */
function proximas() {
  const salida = [];
  for (let i = 0; i < config.diasAdelante; i++) {
    const fecha = fechaLocal(i);
    for (const c of config.clases.filter((x) => x.dia === diaSemana(fecha))) {
      if (instante(fecha, c.hora) > new Date()) salida.push({ c, fecha });
    }
  }
  return salida.sort((x, y) => instante(x.fecha, x.c.hora) - instante(y.fecha, y.c.hora));
}

const menu = (saludo = config.bienvenida) =>
  botones(saludo, [
    ["reservar", "Reservar una clase"],
    ["mis", "Mis clases"],
    ["mas", "Cuota y más"],
  ]);

function elegirClase() {
  const filas = proximas()
    .slice(0, 10)
    .map(({ c, fecha }) => {
      const quedan = c.cupo - anotados(c.id, fecha).length;
      return [`cl:${c.id}:${fecha}`, `${c.nombre} ${fechaLinda(fecha)}`, `${c.hora} con ${c.profe} · ${quedan > 0 ? `${quedan} lugares` : "completa, lista de espera"}`];
    });
  if (!filas.length) return [texto("No hay clases en los próximos días.")];
  return [lista("Estas son las próximas clases:", "Ver clases", filas)];
}

function anotar(evento, c, fecha) {
  const a = alumno(evento);
  if (config.exigirCuotaAlDia && !cuotaAlDia(a)) {
    return [botones(`Para reservar tenés que tener la cuota de ${nombreMes(mesLocal())} paga.`, [["cuota", "Pagar la cuota"]])];
  }
  if (anotados(c.id, fecha).some((r) => r.usuario === evento.user.id)) return [texto(`Ya estás anotado en ${titulo(c, fecha)}.`)];
  if (anotados(c.id, fecha).length >= c.cupo) {
    if (!datos.espera.some((e) => e.usuario === evento.user.id && e.clase === c.id && e.fecha === fecha)) {
      datos.espera.push({ usuario: evento.user.id, conversacion: evento.conversation.id, clase: c.id, fecha });
      guardar();
    }
    return [texto(`${titulo(c, fecha)} está completa. Te anoté en la lista de espera: si alguien cancela, te aviso por acá.`)];
  }
  datos.reservas.push({ id: codigo("C"), usuario: evento.user.id, conversacion: evento.conversation.id, clase: c.id, fecha, estado: "confirmada" });
  guardar();
  const respuesta = [texto(`¡Listo! Te anoté en *${titulo(c, fecha)}* con ${c.profe}. Si no podés venir, cancelá hasta ${config.cancelarHastaHorasAntes} horas antes así otro aprovecha el lugar.`)];
  // El nombre solo con permiso: así el profe sabe quién viene.
  if (!a.nombre && !a.pidioNombre) {
    a.pidioNombre = true;
    guardar();
    respuesta.push({ type: "requestConsent", dataTypes: ["name"], purpose: "Para que el profe sepa quién viene a la clase" });
  }
  return respuesta;
}

function misClases(evento) {
  const mias = datos.reservas.filter((r) => r.usuario === evento.user.id && r.estado === "confirmada" && instante(r.fecha, clase(r.clase).hora) > new Date());
  if (!mias.length) return [botones("No tenés clases reservadas.", [["reservar", "Reservar una clase"]])];
  return [lista("Tus próximas clases. Tocá una para cancelarla:", "Ver mis clases", mias.map((r) => [`ver:${r.id}`, `${clase(r.clase).nombre} ${fechaLinda(r.fecha)}`, clase(r.clase).hora]))];
}

async function liberarLugar(r) {
  r.estado = "cancelada";
  const c = clase(r.clase);
  const siguiente = datos.espera.find((e) => e.clase === r.clase && e.fecha === r.fecha);
  if (siguiente) datos.espera = datos.espera.filter((e) => e !== siguiente);
  guardar();
  if (siguiente) {
    await enviar(siguiente.conversacion, [botones(`¡Se liberó un lugar en *${titulo(c, r.fecha)}*! Tocá para quedártelo.`, [[`cl:${c.id}:${r.fecha}`, "Lo quiero"]])]);
  }
}

async function cuota(evento) {
  const a = alumno(evento);
  const mes = mesLocal();
  if (a.pagos.includes(mes)) return [texto(`Tu cuota de ${nombreMes(mes)} ya está paga. ¡Gracias!`)];
  const referencia = `CUOTA-${evento.user.id}-${mes}`;
  const link = (await crearCobro({ titulo: `Cuota de ${nombreMes(mes)} - ${config.negocio}`, monto: config.cuota.monto, referencia })) || config.linkDePago;
  const como = cobroAutomatico ? "Cuando se acredite te aviso." : "Después mandá el comprobante por acá y el estudio lo registra.";
  return [texto(`La cuota de ${nombreMes(mes)} es de ${pesos(config.cuota.monto)} y vence el día ${config.cuota.venceElDia}. ${como}`), enlace("Pagá con Mercado Pago:", "Pagar cuota", link)];
}

async function cuotaPagada(referencia) {
  const [, usuario, mes] = /^CUOTA-(.+)-(\d{4}-\d{2})$/.exec(referencia) || [];
  const a = datos.alumnos[usuario];
  if (!a || a.pagos.includes(mes)) return;
  a.pagos.push(mes);
  guardar();
  await enviar(a.conversacion, [texto(`¡Recibimos tu cuota de ${nombreMes(mes)}! Gracias.`)]);
}

async function responder(evento) {
  if (evento.type === "consent") {
    if (evento.user.sharedData?.name) alumno(evento);
    guardar();
    return [texto(evento.consent.granted.length ? "¡Gracias! Ya figurás con tu nombre en la lista." : "No hay problema, figurás sin nombre.")];
  }
  if (evento.type !== "message") return [];
  alumno(evento);
  const [accion, a, b] = (evento.message.choice?.id || "").split(":");

  if (accion === "reservar") return elegirClase();
  if (accion === "cl" && clase(a)) return anotar(evento, clase(a), b);
  if (accion === "mis") return misClases(evento);
  if (accion === "mas") {
    return [botones("¿Qué necesitás?", [["cuota", "Pagar la cuota"], ["grilla", "Ver horarios"], ["humano", "Hablar con alguien"]])];
  }
  if (accion === "cuota") return cuota(evento);
  if (accion === "grilla") {
    const dias = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };
    return [texto(`*Horarios*\n${config.clases.map((c) => `${dias[c.dia]} ${c.hora}: ${c.nombre} con ${c.profe}`).join("\n")}\n\n${config.direccion}`)];
  }
  if (accion === "humano") return [texto("Ya le aviso a alguien del estudio. Te escribe por acá."), pasarAPersona("Pidió hablar con una persona")];
  const propia = datos.reservas.find((r) => r.id === a && r.usuario === evento.user.id && r.estado === "confirmada");
  if (accion === "ver" && propia) {
    return [botones(`${titulo(clase(propia.clase), propia.fecha)}. ¿La cancelo?`, [[`baja:${propia.id}`, "Sí, cancelar"], ["mis", "No"]])];
  }
  if (accion === "baja" && propia) {
    const falta = instante(propia.fecha, clase(propia.clase).hora).getTime() - Date.now();
    if (falta < config.cancelarHastaHorasAntes * 3600_000) {
      return [texto(`Ya no se puede cancelar: falta menos de ${config.cancelarHastaHorasAntes} horas. Si no podés venir, avisá por acá.`)];
    }
    await liberarLugar(propia);
    return [botones("Listo, cancelé tu lugar.", [["reservar", "Reservar otra"]])];
  }
  return [menu()];
}

async function cadaMinuto() {
  const ahora = Date.now();
  // Recordatorio de cada clase.
  for (const r of datos.reservas.filter((x) => x.estado === "confirmada" && !x.recordado)) {
    const c = clase(r.clase);
    if (!c) continue;
    const falta = instante(r.fecha, c.hora).getTime() - ahora;
    if (falta > 0 && falta <= config.recordatorioHorasAntes * 3600_000) {
      r.recordado = true;
      guardar();
      await enviar(r.conversacion, [botones(`Hoy tenés *${c.nombre}* a las ${c.hora} con ${c.profe}. ¡Te esperamos!`, [[`baja:${r.id}`, "No puedo ir"]])]);
    }
  }
  // Aviso de cuota: el día del vencimiento a las 10, a quien vino en los últimos 30 días y no pagó.
  const mes = mesLocal();
  if (Number(fechaLocal().slice(8, 10)) === config.cuota.venceElDia && horaLocal() >= "10:00") {
    const desde = fechaLocal(-30);
    for (const [usuario, a] of Object.entries(datos.alumnos)) {
      const activo = datos.reservas.some((r) => r.usuario === usuario && r.fecha >= desde);
      if (activo && !a.pagos.includes(mes) && a.avisoCuota !== mes) {
        a.avisoCuota = mes;
        guardar();
        await enviar(a.conversacion, [botones(`Hoy vence la cuota de ${nombreMes(mes)} (${pesos(config.cuota.monto)}).`, [["cuota", "Pagar la cuota"]])]);
      }
    }
  }
}

const rutasPanel = panel({
  titulo: `Clases de ${config.negocio}`,
  tablas: () => [
    {
      titulo: "Próximas clases",
      columnas: ["Clase", "Profe", "Anotados", "Lista de espera"],
      filas: proximas().map(({ c, fecha }) => ({
        id: `${c.id}:${fecha}`,
        celdas: [
          titulo(c, fecha),
          c.profe,
          `${anotados(c.id, fecha).length}/${c.cupo}: ${anotados(c.id, fecha).map((r) => datos.alumnos[r.usuario]?.nombre || "sin nombre").join(", ")}`,
          datos.espera.filter((e) => e.clase === c.id && e.fecha === fecha).length,
        ],
      })),
    },
    {
      titulo: `Cuotas de ${nombreMes(mesLocal())}`,
      columnas: ["Alumno", "Estado"],
      filas: Object.entries(datos.alumnos).map(([usuario, a]) => ({
        id: usuario,
        celdas: [a.nombre || `Alumno ${usuario.slice(-4)}`, a.pagos.includes(mesLocal()) ? "Paga" : "Pendiente"],
        acciones: a.pagos.includes(mesLocal()) ? [] : [["pagada", "Marcar paga"]],
      })),
    },
  ],
  alAccion: async (id, accion) => {
    if (accion === "pagada") await cuotaPagada(`CUOTA-${id}-${mesLocal()}`);
  },
});

iniciar({ responder, cadaMinuto, rutas: { "POST /mercadopago": rutaAvisos(cuotaPagada), ...rutasPanel } });
