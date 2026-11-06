"use strict";
// n8n carga los nodos desde las rutas de package.json ("n8n"); esto es para usarlos desde código y en los tests.
module.exports = {
  ...require("./credentials/LinkviaApi.credentials.js"),
  ...require("./nodes/Linkvia/Linkvia.node.js"),
  ...require("./nodes/LinkviaTrigger/LinkviaTrigger.node.js"),
  ...require("./lib/firma.js"),
};
