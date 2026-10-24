# Turnos de belleza

Agente de turnos para peluquería, barbería, uñas, estética o depilación. El cliente saca, confirma y cancela su turno por chat, a cualquier hora, sin que nadie del local tenga que contestar.

## Qué hace

- Muestra los servicios con duración y precio.
- Ofrece los días y horarios libres según el horario del local y la cantidad de puestos (sillones o profesionales).
- Cobra una seña con Mercado Pago (opcional). Si no se paga en 30 minutos, libera el turno.
- Recuerda el turno el día antes con botones "Ahí estaré" y "Cancelar".
- Si un día está completo, anota al cliente en la lista de espera y le avisa si alguien cancela.
- Pasa la charla a una persona del local cuando el cliente lo pide.
- Panel en `/panel` con los próximos turnos, para marcar la seña pagada o cancelar.

## Cómo se ve

> **Cliente:** hola
> **Agente:** ¡Hola! Soy el asistente de turnos de *Peluquería Ana*. [Sacar turno] [Mis turnos] [Hablar con alguien]
> **Cliente:** *(toca Sacar turno, elige Corte, el viernes y las 16:00)*
> **Agente:** ¿Confirmo *Corte* el Vie 23/10 a las 16:00? Sale $12.000. [Confirmar] [Otro horario]
> **Agente:** Te reservo *Corte* con Ana. Para confirmarlo, pagá la seña de $3.600 en los próximos 30 minutos. [Pagar seña]
> *(el día antes)* **Agente:** Te recuerdo tu turno de *Corte* el Vie 23/10 a las 16:00. [Ahí estaré] [Cancelar]

## Qué se configura (`config.json`)

| Campo | Ejemplo | Nota |
|---|---|---|
| `negocio`, `bienvenida`, `direccion` | "Peluquería Ana" | Textos que ve el cliente |
| `servicios` | `{ "id": "corte", "nombre": "Corte", "duracion": 30, "precio": 12000 }` | Hasta 10. El `id` sin dos puntos |
| `puestos` | `["Ana", "Lucía"]` | Cuántos clientes se atienden a la vez |
| `horario` | `"mar": [["09:00","13:00"],["15:00","20:00"]]` | Días: lun, mar, mie, jue, vie, sab, dom |
| `pasoMinutos` | 30 | Cada cuánto empieza un turno |
| `diasAdelante` | 14 | Cuántos días se pueden reservar |
| `anticipacionMinutos` | 60 | No se reserva con menos de esto |
| `recordatorioHorasAntes` | 24 | |
| `sena` | `{ "porcentaje": 30, "minutosParaPagar": 30 }` o `{ "monto": 5000, … }` | `null` para no pedir seña |
| `linkDePago` | Link de Mercado Pago del local | Se usa si no hay cobro automático |

## Cómo venderlo

- **A quién:** locales con 1 a 5 puestos que hoy toman turnos por WhatsApp a mano y pierden clientes porque contestan tarde o se olvidan.
- **El argumento:** "Tus clientas sacan turno solas a las 11 de la noche, pagan la seña y el día antes les llega el recordatorio. Menos ausencias y nadie atado al celular."
- **La seña es la estrella:** con un 10% menos de ausencias, el agente se paga solo.
- **Precio:** cobrá más de $24.000 por mes. Podés cobrar una puesta en marcha (carga de servicios, QR impreso) de $20.000 a $40.000.
- **Objeción "mis clientas usan WhatsApp":** el link abre Linkvia en el navegador y entran con su celular; se usa igual que WhatsApp. Al local no le cuesta nada por mensaje.

## Ideas para sumar

Elegir profesional, precios distintos por profesional, descuento en días flojos, pedir una foto del pelo antes del color, reseña en Google después del turno.
