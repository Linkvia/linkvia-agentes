# Clases y cupos

Agente para estudios y gimnasios con clases de cupo limitado: yoga, pilates, funcional, danza, spinning. Los alumnos reservan su lugar, cancelan si no van y pagan la cuota por chat.

## Qué hace

- Muestra las clases de los próximos días con los lugares que quedan.
- Reserva un lugar; si está completa, anota en la lista de espera y avisa al primero cuando alguien cancela.
- Deja cancelar hasta unas horas antes (configurable), para que el lugar no quede vacío.
- Recuerda la clase unas horas antes, con botón "No puedo ir".
- Cobra la cuota del mes con Mercado Pago y avisa el día del vencimiento a quien vino y no pagó.
- Opcional: no deja reservar sin la cuota al día.
- Panel en `/panel` con los anotados de cada clase y el estado de las cuotas.

**No pidas el apto médico por el chat.** Es un dato de salud y la Ley 25.326 lo protege especialmente. Seguí pidiéndolo en papel o por mail.

## Cómo se ve

> **Alumna:** hola
> **Agente:** ¡Hola! Soy el asistente de *Estudio Prana*. [Reservar una clase] [Mis clases] [Cuota y más]
> **Alumna:** *(elige Yoga suave Sáb 24/10 · 10:00 con Caro · 11 lugares)*
> **Agente:** ¡Listo! Te anoté en *Yoga suave Sáb 24/10 10:00* con Caro. Si no podés venir, cancelá hasta 2 horas antes.
> *(el sábado a las 7)* **Agente:** Hoy tenés *Yoga suave* a las 10:00 con Caro. ¡Te esperamos! [No puedo ir]

## Qué se configura (`config.json`)

| Campo | Nota |
|---|---|
| `clases` | Grilla semanal: `id`, `nombre`, `dia`, `hora`, `duracion`, `cupo`, `profe` |
| `diasAdelante` | Cuántos días se ven para reservar (7) |
| `cancelarHastaHorasAntes` | 2 |
| `recordatorioHorasAntes` | 3 |
| `cuota` | `{ "monto": 30000, "venceElDia": 10 }` |
| `exigirCuotaAlDia` | `true` para no dejar reservar con la cuota vencida |

## Cómo venderlo

- **A quién:** estudios de 1 a 3 salas que hoy arman la lista en un grupo de WhatsApp ("¿quién viene mañana?").
- **El argumento:** "Las clases se llenan sin perseguir a nadie, los que faltan liberan el lugar y la cuota se cobra sola. Y los alumnos no quedan en un grupo con 80 personas."
- **Precio:** $12.000 a $20.000 por mes.

## Ideas para sumar

Packs de clases (8 por mes), clase de prueba gratis, profes con su propia agenda, avisos de clases suspendidas a todos los anotados.
