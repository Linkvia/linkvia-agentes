// Cobros con la cuenta de Mercado Pago del propio negocio. Linkvia no interviene en la plata.
//
// Dos modos:
// - Automático: con MP_ACCESS_TOKEN (credenciales de producción del negocio) el agente crea un link de pago
//   por cada cobro y se entera solo cuando se pagó. Necesita URL_PUBLICA para recibir los avisos.
// - Manual: sin token, el agente manda el link fijo de config.json ("linkDePago") y el negocio marca
//   el pago en el panel del agente.
const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLICA = (process.env.URL_PUBLICA || "").replace(/\/$/, "");

export const cobroAutomatico = Boolean(TOKEN);

/** Devuelve el link para pagar, o null si no se pudo crear. */
export async function crearCobro({ titulo, monto, referencia, venceEnMinutos }) {
  if (!TOKEN) return null;
  const preferencia = {
    items: [{ title: titulo, quantity: 1, unit_price: Math.round(monto), currency_id: "ARS" }],
    external_reference: referencia,
    ...(PUBLICA && { notification_url: `${PUBLICA}/mercadopago` }),
    ...(venceEnMinutos && {
      expires: true,
      expiration_date_to: new Date(Date.now() + venceEnMinutos * 60_000).toISOString(),
    }),
  };
  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(preferencia),
    });
    if (!r.ok) {
      console.warn(`Mercado Pago respondió ${r.status} al crear el cobro.`);
      return null;
    }
    return (await r.json()).init_point;
  } catch (e) {
    console.warn("No pude crear el cobro en Mercado Pago:", e.message);
    return null;
  }
}

/**
 * Ruta "POST /mercadopago" para los avisos de pago.
 * No confía en lo que dice el aviso: consulta el pago a Mercado Pago con el token del negocio.
 * alPagar(referencia, pago) se llama una vez por pago aprobado.
 */
export function rutaAvisos(alPagar) {
  const procesados = new Set();
  return async ({ url, cuerpo }) => {
    let id = url.searchParams.get("data.id") || url.searchParams.get("id");
    let tipo = url.searchParams.get("type") || url.searchParams.get("topic");
    try {
      const aviso = JSON.parse(cuerpo || "{}");
      id = aviso?.data?.id ?? id;
      tipo = aviso?.type ?? tipo;
    } catch {
      // Algunos avisos vienen solo con parámetros en la URL.
    }
    if (TOKEN && tipo === "payment" && id && !procesados.has(String(id))) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      if (r.ok) {
        const pago = await r.json();
        if (pago.status === "approved" && pago.external_reference) {
          procesados.add(String(id));
          await alPagar(pago.external_reference, pago);
        }
      }
    }
    return { status: 200 };
  };
}
