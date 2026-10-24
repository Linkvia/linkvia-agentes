# Armado de CV y búsqueda laboral

**La idea:** el agente te hace preguntas como en una entrevista y arma tu CV en PDF. Después te avisa búsquedas que coinciden con tu perfil y te ayuda con la carta de presentación.

## El problema

Armar un CV es tedioso y la mayoría no sabe qué poner. Mucha gente busca trabajo desde el celular, sin una compu a mano.

## Cómo sería la charla

> **Agente:** Contame tu último trabajo: dónde, qué hacías y cuánto tiempo.
> **Usuario:** 3 años en un call center de Tarjeta X, atención al cliente y reclamos
> **Agente:** Lo escribí así: "Atención al cliente y resolución de reclamos (3 años). Manejo de 60 llamadas diarias". ¿Está bien? [Sí] [Cambiar]
> **Agente:** ¡Tu CV está listo! [CV_Ana_Perez.pdf]

## Qué usa de Linkvia

- Documentos (`document`) para mandar el PDF.
- Datos de contacto con permiso (`requestConsent` de nombre, teléfono y mail) para ponerlos en el CV.

## Cómo cobrarlo

- **Packs de uso:** el primer CV gratis; pack de 5 cartas de presentación a $3.000.
- **Venta a instituciones:** municipios, ONG y escuelas técnicas lo ofrecen gratis a sus inscriptos.

## Cuidados

No preguntar religión, origen, afiliación sindical, salud ni estado civil: no hacen falta para un CV y algunos son datos sensibles.

## Por dónde empezar

Pedile a tu asistente de IA un bot que guarde las respuestas por usuario y genere el PDF con una librería como PDFKit (Node) o ReportLab (Python).
