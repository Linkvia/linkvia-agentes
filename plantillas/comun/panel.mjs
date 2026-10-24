// Un panel web mínimo para el negocio: ver lo que entró y tocar botones (marcar pagado, listo, cancelar).
// Se abre en http://tu-agente/panel con el usuario "negocio" y la clave de PANEL_CLAVE.
import { timingSafeEqual } from "node:crypto";

const CLAVE = process.env.PANEL_CLAVE;

const escapar = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function autorizado(headers) {
  if (!CLAVE) return false;
  const [tipo, valor] = (headers.authorization || "").split(" ");
  if (tipo !== "Basic" || !valor) return false;
  const clave = Buffer.from(Buffer.from(valor, "base64").toString().split(":").slice(1).join(":"));
  const esperada = Buffer.from(CLAVE);
  return clave.length === esperada.length && timingSafeEqual(clave, esperada);
}

/**
 * - titulo: lo que se ve arriba.
 * - tablas(): [{ titulo, columnas: [..], filas: [{ id, celdas: [..], acciones: [[accion, etiqueta]] }] }]
 * - alAccion(id, accion): lo que pasa al tocar un botón.
 */
export function panel({ titulo, tablas, alAccion }) {
  const pedirClave = {
    status: 401,
    tipo: "text/plain; charset=utf-8",
    headers: { "www-authenticate": 'Basic realm="Panel del agente", charset="UTF-8"' },
    cuerpo: CLAVE ? "Clave incorrecta" : "El panel está apagado: definí PANEL_CLAVE para usarlo.",
  };

  const pagina = () => {
    const html = tablas()
      .map(
        (t) => `<h2>${escapar(t.titulo)}</h2>${
          t.filas.length
            ? `<table><tr>${t.columnas.map((c) => `<th>${escapar(c)}</th>`).join("")}<th></th></tr>${t.filas
                .map(
                  (f) =>
                    `<tr>${f.celdas.map((c) => `<td>${escapar(c)}</td>`).join("")}<td>${(f.acciones || [])
                      .map(
                        ([accion, etiqueta]) =>
                          `<form method="post"><input type="hidden" name="id" value="${escapar(f.id)}"><input type="hidden" name="accion" value="${escapar(accion)}"><button>${escapar(etiqueta)}</button></form>`,
                      )
                      .join("")}</td></tr>`,
                )
                .join("")}</table>`
            : "<p>Nada por ahora.</p>"
        }`,
      )
      .join("");
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="30"><title>${escapar(titulo)}</title><style>body{font-family:system-ui,sans-serif;margin:16px;color:#111b21;background:#efeae2}h1{color:#075e54}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:24px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}form{display:inline}button{margin:2px;padding:6px 10px;border:0;border-radius:6px;background:#25d366;color:#fff;cursor:pointer}</style></head><body><h1>${escapar(titulo)}</h1>${html}<p><small>Se actualiza solo cada 30 segundos.</small></p></body></html>`;
  };

  return {
    "GET /panel": async ({ headers }) =>
      autorizado(headers) ? { tipo: "text/html; charset=utf-8", cuerpo: pagina() } : pedirClave,
    "POST /panel": async ({ headers, cuerpo }) => {
      if (!autorizado(headers)) return pedirClave;
      const form = new URLSearchParams(cuerpo);
      await alAccion(form.get("id"), form.get("accion"));
      return { status: 303, headers: { location: "/panel" } };
    },
  };
}
