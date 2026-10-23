# Práctica de inglés

**La idea:** 10 minutos por día de charla en inglés con un agente que corrige con paciencia, propone temas y acepta audios.

## El problema

Mucha gente estudió inglés y no lo habla porque no practica. Las clases son caras y en horarios fijos; las apps de idiomas son juegos que no te hacen hablar.

## Cómo sería la charla

> **Agente:** Good morning! Today's topic: your last trip. Where did you go?
> **Usuario:** I go to Bariloche in july
> **Agente:** Nice! Small fix: *I went* to Bariloche *in July* (past tense, and months start with a capital letter). What did you like the most?
> **Usuario:** 🎤 *(audio)*
> **Agente:** Great pronunciation of "mountains". Try "chocolate" again: /ˈtʃɒk.lət/.

## Qué usa de Linkvia

- Audios del usuario (`audio`) para transcribir y corregir pronunciación.
- Respuesta de a partes (streaming) mientras la IA piensa.
- Mensaje diario por iniciativa propia con el tema del día.

## Cómo cobrarlo

- **Suscripción:** $3.000 a $6.000 por mes. Una semana gratis.
- **Venta a empresas:** una pyme con clientes afuera lo paga para su equipo; $2.000 por persona por mes.
- **Niveles:** gratis con 3 charlas por semana; ilimitado pago.

## Cuidados

El modelo de IA tiene costo por uso: calculá cuánto te sale cada usuario activo antes de poner el precio. Linkvia no cobra por mensaje, pero el modelo sí.

## Por dónde empezar

El patrón para agentes de IA (responder al instante, pensar en segundo plano y contestar con `POST /bot/v0/messages` o streaming) está en [conectar-un-bot.md](../docs/conectar-un-bot.md).
