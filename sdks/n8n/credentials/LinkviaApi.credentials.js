"use strict";

class LinkviaApi {
  constructor() {
    this.name = "linkviaApi";
    this.displayName = "Linkvia API";
    this.documentationUrl = "https://negocios.linkvia.com.ar/#/desarrolladores";
    this.properties = [
      {
        displayName: "Clave de API",
        name: "apiKey",
        type: "string",
        typeOptions: { password: true },
        default: "",
        placeholder: "lv_…",
        description: "La clave de API del negocio. Hace falta para escribir con el nodo Linkvia.",
      },
      {
        displayName: "Secreto del webhook",
        name: "webhookSecret",
        type: "string",
        typeOptions: { password: true },
        default: "",
        placeholder: "whsec_…",
        description: "Para verificar que los eventos que recibe el Linkvia Trigger vienen de Linkvia.",
      },
      {
        displayName: "Dirección de la API",
        name: "apiUrl",
        type: "string",
        default: "https://app.linkvia.com.ar/api",
      },
    ];
    this.authenticate = {
      type: "generic",
      properties: { headers: { Authorization: "=Bearer {{$credentials.apiKey}}" } },
    };
    // "Probar" en la credencial: lee los datos del negocio con la clave.
    this.test = { request: { baseURL: "={{$credentials.apiUrl}}", url: "/business" } };
  }
}

module.exports = { LinkviaApi };
