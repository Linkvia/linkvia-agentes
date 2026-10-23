# Plantillas para vender agentes

Cuatro agentes listos para que un emprendedor los adapte a un negocio y se los cobre por mes. Cada uno resuelve un problema que tienen miles de locales iguales, así que el mismo trabajo se vende muchas veces.

| Plantilla | Para quién | Qué hace | Cuánto cobrarle al negocio |
|---|---|---|---|
| [Turnos de belleza](turnos-belleza/) | Peluquería, barbería, uñas, estética | Agenda, seña, recordatorio, cancelaciones, lista de espera | Más de $24.000 por mes |
| [Gastronomía](gastronomia/) | Rotisería, pizzería, viandas, sushi, heladería: cualquier local con delivery o take away | Menú, pedido, zonas de envío, pago, aviso de "salió" o "listo" | Más de $30.000 por mes |
| [Canchas](canchas/) | Pádel, fútbol 5, tenis, complejos | Horarios libres, seña, lista de espera, link para que se sumen los amigos | Más de $30.000 por mes |
| [Clases](clases/) | Gimnasio, yoga, pilates, danza, funcional | Cupos, lista de espera, recordatorio, cuota del mes | Más de $24.000 por mes |

Los precios son orientativos (octubre de 2026). Un local chico entra en el plan Free de Linkvia (300 conversaciones por mes), así que lo que cobrás es casi todo margen.

## Qué trae cada plantilla

- `bot.mjs`: el agente completo, en Node 18 o más nuevo, **sin instalar nada**.
- `config.json`: todo lo del negocio (nombre, servicios, horarios, precios, seña). Para un cliente nuevo, en general alcanza con cambiar este archivo.
- `README.md`: qué hace, cómo se ve la charla y cómo venderlo.
- Un **panel web** mínimo en `/panel` para que el negocio vea lo que entró y toque botones (seña pagada, pedido listo, cuota paga).
- **Cobro con Mercado Pago** de la cuenta del propio negocio: con link fijo o automático. Ver [cobrar con Mercado Pago](../docs/cobrar-con-mercado-pago.md).

La carpeta [`comun/`](comun/) tiene lo que comparten: la firma de Linkvia, el envío de avisos, el cálculo de horarios, los cobros, el panel y un simulador para probar sin Linkvia.

## Ponerlo en marcha

1. **Registrá el negocio** en [linkvia.optis.site/#/negocios](https://linkvia.optis.site/#/negocios). Guardá el secreto del webhook (`whsec_…`) y la clave de API (`lv_…`): se muestran una sola vez.
2. **Copiá la carpeta** de la plantilla junto con `comun/` (las plantillas importan `../comun/`).
3. **Editá `config.json`** con los datos del negocio.
4. **Probalo en tu compu** con el simulador, sin Linkvia:

   ```bash
   cd plantillas/turnos-belleza
   LINKVIA_WEBHOOK_SECRET=whsec_prueba LINKVIA_API_KEY=lv_prueba \
   LINKVIA_API_URL=http://localhost:4001 PANEL_CLAVE=prueba node bot.mjs
   # en otra terminal:
   node plantillas/comun/simular.mjs
   ```

   Escribí "hola" y elegí las opciones por número. El panel queda en `http://localhost:4000/panel` (usuario `negocio`, clave `prueba`).
5. **Publicalo** en un servidor con disco (un VPS chico, o un servicio como Railway o Render con disco persistente: los datos se guardan en un archivo JSON). Para probar rápido alcanza con `cloudflared tunnel --url http://localhost:4000`.
6. **Conectalo:** en el panel de Linkvia, poné la dirección pública como webhook y tocá "Probar conexión".
7. **Compartí el link** `https://linkvia.optis.site/@tu_handle` o el QR del panel en el local, en Instagram y en Google Maps.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `LINKVIA_WEBHOOK_SECRET` | Sí | Verificar que los eventos vienen de Linkvia |
| `LINKVIA_API_KEY` | Sí | Mandar avisos y recordatorios por iniciativa propia |
| `PANEL_CLAVE` | Para usar el panel | Clave del panel del negocio (usuario `negocio`) |
| `MP_ACCESS_TOKEN` | No | Cobro automático con Mercado Pago (credencial de producción del negocio) |
| `URL_PUBLICA` | Con `MP_ACCESS_TOKEN` | Dirección pública del agente, para que Mercado Pago avise los pagos en `/mercadopago` |
| `DATOS` | No | Archivo donde se guardan los datos (por defecto, uno por plantilla en la carpeta actual) |
| `PORT` | No | Puerto (por defecto 4000) |

## Un agente por negocio

Cada negocio tiene su propio @ en Linkvia, su `config.json` y su proceso del agente. Si manejás muchos, corré cada uno en su puerto, o adaptá el bot para leer el negocio de `evento.business.handle`. Está pedido en Linkvia una cuenta de gestor para manejar varios agentes desde un solo lugar.

## Cuidados

- Los datos del cliente (nombre, dirección) se piden con `requestConsent`, como exige Linkvia. Las plantillas ya lo hacen.
- No uses estas plantillas para datos de salud, como aptos médicos o historias clínicas, sin leer las [reglas para agentes con datos sensibles](../casos/README.md#datos-sensibles).
- Los archivos JSON con datos de clientes no se suben a ningún repositorio: ya están en `.gitignore`.

## Adaptarlo con IA

Pasale a Claude, ChatGPT o Cursor el `bot.mjs`, el `config.json` y [linkvia-para-tu-ia.md](../docs/linkvia-para-tu-ia.md), y pedí el cambio: "sumá que el cliente elija con qué peluquera", "agregá un descuento los martes", "pasalo a Python".
