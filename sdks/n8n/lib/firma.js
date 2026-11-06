"use strict";
// La misma verificación que @linkvia/bot-contract/signature, sin dependencias para que n8n la cargue tal cual.
// Encabezado: `linkvia-signature: t=<segundos unix>,v1=<hex>`, con v1 = HMAC-SHA256(secreto, "<t>.<cuerpo crudo>").
const { createHmac, timingSafeEqual } = require("node:crypto");

const SIGNATURE_HEADER = "linkvia-signature";
const DEFAULT_TOLERANCE_SECONDS = 300;

function hmac(secret, timestamp, body) {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex");
}

/** body: el cuerpo crudo (Buffer o texto), tal cual llegó. */
function verifySignature(secret, body, header, opts = {}) {
  if (!secret || !header || body === undefined || body === null) return false;
  const parts = {};
  for (const piece of String(header).split(",")) {
    const i = piece.indexOf("=");
    if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || !parts.v1) return false;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) return false;
  const expected = Buffer.from(hmac(secret, timestamp, body), "hex");
  const received = Buffer.from(parts.v1, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

module.exports = { SIGNATURE_HEADER, DEFAULT_TOLERANCE_SECONDS, verifySignature };
