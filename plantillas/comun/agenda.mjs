// Cálculo de horarios libres para turnos y reservas.
import { diaSemana, fechaLocal, hhmm, instante, minutos } from "./hora.mjs";

/**
 * Horarios en los que entra una reserva de `duracion` minutos.
 * - horario: { "lun": [["09:00", "13:00"], ["15:00", "20:00"]], ... } (días sin abrir, sin clave)
 * - recursos: ids de lo que se reserva (sillones, profesionales, canchas)
 * - reservas: las que ocupan lugar, con { fecha, hora, duracion, recurso }
 * Devuelve [{ hora: "15:30", libres: ["sillon1"] }].
 */
export function horariosLibres({ fecha, horario, duracion, paso, recursos, reservas, anticipacion = 60, ahora = new Date() }) {
  const franjas = horario[diaSemana(fecha)] || [];
  const ocupadas = reservas.filter((r) => r.fecha === fecha);
  const salida = [];
  for (const [desde, hasta] of franjas) {
    for (let ini = minutos(desde); ini + duracion <= minutos(hasta); ini += paso || duracion) {
      const hora = hhmm(ini);
      if (instante(fecha, hora).getTime() - ahora.getTime() < anticipacion * 60_000) continue;
      const fin = ini + duracion;
      const libres = recursos.filter(
        (rec) => !ocupadas.some((r) => r.recurso === rec && ini < minutos(r.hora) + r.duracion && minutos(r.hora) < fin),
      );
      if (libres.length) salida.push({ hora, libres });
    }
  }
  return salida;
}

/** Los próximos `cantidad` días en que el lugar abre, empezando hoy. */
export function diasQueAbre(horario, cantidad, ahora = new Date()) {
  const dias = [];
  for (let i = 0; dias.length < cantidad && i < 60; i++) {
    const fecha = fechaLocal(i, ahora);
    if (horario[diaSemana(fecha)]?.length) dias.push(fecha);
  }
  return dias;
}
