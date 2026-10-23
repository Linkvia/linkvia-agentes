# Reservas de canchas

Agente de reservas para complejos de pádel, fútbol 5, tenis o cualquier deporte por turno. El que organiza reserva, paga la seña y les pasa un link a los amigos para anotarse.

## Qué hace

- Muestra los deportes, los días y los horarios con cuántas canchas quedan libres. Si hay muchos horarios, primero pregunta la franja (mañana, tarde o noche).
- Asigna una cancha libre del deporte elegido.
- Cobra seña con Mercado Pago (opcional); si no se paga a tiempo, libera la cancha.
- Da un **link para sumarse al partido**: cada amigo que lo abre queda anotado y el organizador recibe "Se sumó Juan, van 3 de 4".
- Recordatorio unas horas antes a todos los anotados.
- Lista de espera por día: si se libera una cancha, avisa.
- Panel en `/panel` con las próximas reservas, para marcar la seña pagada o cancelar.

## Cómo se ve

> **Cliente:** hola
> **Agente:** ¡Hola! Soy el asistente de reservas de *Complejo La Red*. ¿Jugamos? [Reservar cancha] [Mis reservas] [Hablar con alguien]
> **Cliente:** *(Pádel, sábado, después de las 19, 19:00)*
> **Agente:** Te guardo *Pádel 1* el Sáb 24/10 a las 19:00 (90 min, $24.000). Pagá la seña de $12.000. [Pagar seña]
> **Agente:** Pasales este link a tus amigos para que se anoten en el partido: [Sumarse al partido]
> **Amigo:** Me sumo al partido RDZMX
> **Agente:** ¡Anotado! Partido de Pádel el Sáb 24/10 a las 19:00.

## Qué se configura (`config.json`)

| Campo | Nota |
|---|---|
| `deportes` | Por cada uno: `nombre`, `duracion` (minutos), `precio` del turno y `jugadores` (cupo del partido) |
| `canchas` | `id`, `nombre` y `deporte` de cada cancha |
| `horario`, `pasoMinutos`, `diasAdelante`, `anticipacionMinutos` | Como en las otras plantillas |
| `recordatorioHorasAntes` | 3 por defecto |
| `sena` | `{ "porcentaje": 50, "minutosParaPagar": 30 }`, o `null` |

## Cómo venderlo

- **A quién:** complejos que hoy manejan la grilla en un cuaderno o en un Excel y contestan WhatsApp todo el día.
- **El argumento:** "La grilla se llena sola, la seña entra antes y si alguien cancela, otro toma el turno en minutos. Las canchas vacías son plata perdida."
- **El gancho del link:** cada partido trae a 3 o 9 personas más al chat del complejo. Es publicidad gratis.
- **Precio:** cobrá más de $30.000 por mes, según la cantidad de canchas.

## Ideas para sumar

Turnos fijos semanales, precio distinto en hora pico, que cada jugador pague su parte, alquiler de paletas o pelotas, torneos con inscripción.
