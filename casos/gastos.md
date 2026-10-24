# Gastos por chat

**La idea:** anotar gastos como si le escribieras a un amigo. "Gasté 5.000 en el súper", "nafta 30 lucas". A fin de mes, el resumen por categoría.

## El problema

Las apps de finanzas personales piden demasiado: cargar categorías, abrir la app, completar formularios. La mayoría las abandona en una semana. Escribir un mensaje cuesta mucho menos.

## Cómo sería la charla

> **Usuario:** súper 18500
> **Agente:** Anotado: $18.500 en *Supermercado*. Este mes llevás $96.300 en comida. [Deshacer]
> **Usuario:** resumen
> **Agente:** Octubre: Comida $96.300 · Transporte $41.000 · Salidas $28.500 · Total $165.800. Gastaste 12% menos que en septiembre.

Una IA entiende el texto libre y elige la categoría. También puede leer la foto de un ticket.

## Qué usa de Linkvia

- Texto libre y fotos (`image`) que llegan al webhook.
- Respuesta de a partes (streaming) si usás un modelo de IA que tarda.
- Aviso semanal o mensual por iniciativa propia.

## Cómo cobrarlo

- **Gratis con versión paga:** anotar es gratis; el resumen mensual, los gráficos en PDF y la exportación a Excel cuestan $2.000 a $4.000 por mes.
- **Venta a empresas:** un banco o una cooperativa lo ofrece a sus socios.

## Cuidados

Nunca pedir claves del banco ni datos de tarjetas. Los datos financieros no son "sensibles" para la Ley 25.326, pero son privados: guardalos cifrados y dejá borrarlos.

## Por dónde empezar

Pedile a tu asistente de IA: "Con linkvia-para-tu-ia.md, armame un bot que use un modelo de IA para convertir mensajes como 'súper 18500' en { monto, categoría } y guarde los gastos por usuario". El patrón para IA que tarda está en [conectar-un-bot.md](../docs/conectar-un-bot.md).
