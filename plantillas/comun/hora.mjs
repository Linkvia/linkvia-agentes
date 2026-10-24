// Fechas y horas en hora argentina (UTC-3, sin horario de verano).
// Las fechas se guardan como "2026-10-24" y las horas como "14:30", siempre en hora local.
const ZONA = "-03:00";
const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
const NOMBRES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** La fecha de hoy (o de dentro de n días) en Argentina. */
export function fechaLocal(dias = 0, desde = new Date()) {
  const d = new Date(desde.getTime() - 3 * 3600_000 + dias * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** El instante real de una fecha y hora locales. */
export const instante = (fecha, hora) => new Date(`${fecha}T${hora}:00${ZONA}`);

/** "lun", "mar"… como en config.json. */
export const diaSemana = (fecha) => DIAS[new Date(`${fecha}T12:00:00${ZONA}`).getUTCDay()];

/** "Sáb 24/10" */
export function fechaLinda(fecha) {
  const [, m, d] = fecha.split("-");
  return `${NOMBRES[new Date(`${fecha}T12:00:00${ZONA}`).getUTCDay()]} ${d}/${m}`;
}

export const minutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};
export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** "2026-10" para llevar cuotas por mes. */
export const mesLocal = (desde = new Date()) => fechaLocal(0, desde).slice(0, 7);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreMes = (mes) => MESES[Number(mes.slice(5, 7)) - 1];

/** La hora actual en Argentina, "21:05". */
export const horaLocal = (desde = new Date()) => new Date(desde.getTime() - 3 * 3600_000).toISOString().slice(11, 16);
