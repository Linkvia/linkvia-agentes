# Huerta y plantas

**La idea:** el agente sabe en qué zona vivís y te dice qué sembrar este mes, cuándo regar y qué hacer con esa plaga que apareció en los tomates (mandando una foto).

## El problema

La huerta en casa creció mucho, pero la información está desparramada y no es para tu clima. Las plantas se mueren por riego de más o de menos.

## Cómo sería la charla

> **Agente:** Estamos en octubre en Córdoba: es buen momento para tomate, zapallito y albahaca. ¿Te armo el calendario? [Sí]
> **Usuario:** 📷 *(foto de una hoja con manchas)*
> **Agente:** Parece oídio. Sacá las hojas afectadas y rociá con leche diluida 1 en 10 dos veces por semana.

## Qué usa de Linkvia

- Fotos del usuario (`image`) para identificar plagas con IA.
- Ubicación (`location`) para saber la zona.
- Avisos de riego por iniciativa propia, según el clima.

## Cómo cobrarlo

- **Suscripción baja:** $1.500 a $3.000 por mes.
- **Comisión de un vivero:** el agente recomienda plantines y semillas del vivero de la zona, que paga por cliente o por venta.
- **Publicidad de un negocio,** marcada y semanal, como en la [lista de compras](lista-de-compras.md).

## Cuidados

La ubicación se usa solo para la zona climática: no hace falta la dirección exacta.

## Por dónde empezar

Un calendario de siembra por región en un JSON y la tarea de avisos de cualquier [plantilla](../plantillas/) alcanzan para la primera versión.
