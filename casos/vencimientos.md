# Vencimientos y trámites

**La idea:** un agente que se acuerda por vos de todo lo que vence. Monotributo, VTV, seguro del auto, patente, DNI, pasaporte, licencia de conducir, la recategorización de ARCA.

## El problema

Todos tenemos fechas desparramadas en mails, papeles y apps. Se pasan, y una VTV vencida es una multa; un monotributo impago, intereses.

## Cómo sería la charla

> **Usuario:** Mi VTV vence en marzo
> **Agente:** Anotado: VTV en marzo. Te aviso el 15 de febrero para que saques turno. ¿Querés que te pase el link del turno cuando llegue la fecha? [Sí] [No]
> *(15 de febrero)* **Agente:** Tu VTV vence en marzo. Acá sacás turno: [Sacar turno VTV]

Con los botones, el usuario elige de una lista ("Monotributo", "VTV", "Seguro") y el agente pregunta solo la fecha. Para el monotributo, el agente ya sabe que vence el 20 de cada mes.

## Qué usa de Linkvia

- Botones y listas para cargar sin escribir.
- Avisos por iniciativa propia (`POST /bot/v0/messages`) el día que corresponde.
- Links (`link`) a la página oficial de cada trámite.

## Cómo cobrarlo

- **Suscripción baja:** $1.500 a $3.000 por mes.
- **Comisión por recomendar:** cuando vence el seguro, el agente ofrece cotizaciones de aseguradoras que te pagan por cliente. Bien hecho, el agente puede ser gratis.
- **Venta a contadores:** un estudio contable lo paga para sus clientes monotributistas.

## Cuidados

No pedir CUIT, claves fiscales ni datos de tarjeta. Alcanza con el tipo de vencimiento y la fecha.

## Por dónde empezar

Pasale [linkvia-para-tu-ia.md](../docs/linkvia-para-tu-ia.md) a tu asistente de IA y pedile: "Armame en Node un bot de Linkvia que guarde vencimientos por usuario en un archivo JSON, los cargue con una lista de tipos y avise 15 días antes con `POST /bot/v0/messages`". Podés copiar la tarea de avisos de cualquier [plantilla](../plantillas/).
