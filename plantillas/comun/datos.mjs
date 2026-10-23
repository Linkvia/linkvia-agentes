// Guarda los datos del agente en un archivo JSON. Alcanza para un negocio chico; si crece, cambialo por una base.
import { readFileSync, writeFileSync, renameSync } from "node:fs";

export function almacen(archivo, inicial) {
  let leido = {};
  try {
    leido = JSON.parse(readFileSync(archivo, "utf8"));
  } catch {
    // Primera vez: arranca vacío.
  }
  const datos = { ...structuredClone(inicial), ...leido };
  return {
    datos,
    guardar() {
      writeFileSync(`${archivo}.tmp`, JSON.stringify(datos, null, 2));
      renameSync(`${archivo}.tmp`, archivo);
    },
  };
}

/** Lee la configuración del negocio (config.json al lado del bot). */
export function leerConfig(url) {
  return JSON.parse(readFileSync(new URL("./config.json", url), "utf8"));
}

/** Un código corto y fácil de dictar: R7K2. */
export function codigo(prefijo = "") {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = prefijo;
  for (let i = 0; i < 4; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}
