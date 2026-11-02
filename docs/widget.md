# Widget de Linkvia para tu web

Con una línea de código, tu web tiene un botón de chat con tu agente, como el botón de WhatsApp. La persona toca el botón, entra con su celular y chatea con tu agente. La charla es la misma que en la app de Linkvia: si después abre la app, sigue ahí, y tu negocio queda en su lista de chats.

## Ponerlo en tu web

Pegá esta línea en tu página, antes de `</body>` (también anda en el `<head>`). Cambiá `pizzeria` por el @ de tu negocio:

```html
<script src="https://app.linkvia.com.ar/widget.js" data-handle="pizzeria" async></script>
```

Aparece un globito abajo a la derecha. En el panel del negocio, en **QR y botón para tu web**, la línea ya sale armada con tus opciones y un botón para copiarla.

Si tu web está en WordPress, Tienda Nube, Wix u otro armador: buscá la opción para "agregar código personalizado" o "scripts en el pie de página" y pegala ahí.

## No hace más lenta tu web

El widget está hecho para no tocar la velocidad de tu sitio ni tu puntaje de PageSpeed:

- Pesa menos de 4 KB comprimido (un test lo controla en cada cambio: el límite es 5 KB).
- Se carga con `async`: nunca frena el resto de la página. Se dibuja cuando el navegador está libre.
- No usa librerías, fuentes ni imágenes de afuera: los íconos van dentro del mismo archivo.
- El chat (la app de Linkvia en un iframe) se carga recién cuando la persona toca el botón. Antes de eso no hay ningún pedido a Linkvia, ni cookies, ni nada guardado en el navegador. Al pasar el mouse por el botón el navegador prepara la conexión, así abre más rápido.
- El botón flota sobre la página: no mueve nada de lugar (sin saltos de diseño).
- Si Linkvia estuviera caído, tu web sigue igual; solo el chat no abriría.
- Va dentro de un shadow DOM: tus estilos no lo rompen y los suyos no tocan tu página. No crea variables globales.

## Dos formatos

**Globito flotante** (el de siempre): un botón redondo en una esquina que abre el chat en un panel. En el celular el chat ocupa toda la pantalla, con una cruz arriba para cerrarlo.

**Chat dentro de la página:** el chat va en un lugar de tu página que vos elegís, por ejemplo en la sección "Hacé tu pedido". Poné un contenedor donde quieras el chat y apuntá el widget a él:

```html
<div id="linkvia-chat"></div>
<script src="https://app.linkvia.com.ar/widget.js" data-handle="pizzeria" data-mode="inline" data-target="#linkvia-chat" async></script>
```

Muestra un recuadro con tu ícono y un botón "Abrir el chat"; el chat se carga al tocarlo. Si querés que se cargue solo cuando el recuadro aparece en pantalla, sumá `data-load="visible"`. Sin `data-target`, el chat va justo donde está el `<script>`.

## Opciones

Todas son atributos `data-` del `<script>`. Solo `data-handle` es obligatorio.

| Atributo | Para qué | Ejemplo |
|---|---|---|
| `data-handle` | El @ de tu negocio | `pizzeria` |
| `data-text` | Un mensaje que queda escrito (la persona lo puede cambiar antes de mandarlo) | `Hola, quiero hacer un pedido` |
| `data-start` | Nombre de campaña, para ver en el panel cuántos chats vinieron de la web | `web-home` |
| `data-mode` | `bubble` (globito, por defecto) o `inline` (dentro de la página) | `inline` |
| `data-target` | En `inline`: dónde va el chat (selector CSS) | `#linkvia-chat` |
| `data-load` | En `inline`: `click` (por defecto) o `visible` | `visible` |
| `data-preset` | Estilo listo: `linkvia` (por defecto) o `whatsapp` (ícono de teléfono, verde `#25D366`) | `whatsapp` |
| `data-color` | Color del botón: `#rrggbb`, `rgb(...)`, `hsl(...)` o un nombre | `#ff6b4a` |
| `data-icon-color` | Color del ícono (blanco por defecto) | `#111b21` |
| `data-icon` | `linkvia`, `whatsapp`, `chat`, o la dirección de tu propio ícono (SVG o PNG) | `/img/logo.svg` |
| `data-position` | `right` (por defecto) o `left` | `left` |
| `data-size` | Tamaño del globito en píxeles, de 40 a 96 (60 por defecto) | `56` |
| `data-offset` | Distancia al borde, en píxeles (20 por defecto). También `data-offset-x` y `data-offset-y` | `24` |
| `data-width`, `data-height` | Tamaño del panel (globito) o del chat (inline). En px, %, vh, vw o rem | `420`, `70vh` |
| `data-label` | Lo que lee un lector de pantalla y el cartelito al pasar el mouse | `Pedí por chat` |

Un ejemplo con todo al estilo del botón de WhatsApp, a la izquierda y un poco más chico:

```html
<script src="https://app.linkvia.com.ar/widget.js" data-handle="pizzeria" data-preset="whatsapp" data-position="left" data-size="52" async></script>
```

Si ponés un ícono propio con `data-icon`, esa imagen se baja al cargar la página (es la única excepción a "nada antes del clic"); conviene que sea un SVG chico. Un valor que no se entiende (un color mal escrito, por ejemplo) se ignora y queda el de por defecto.

## Abrirlo desde tu página

Para que un botón o un link tuyo ("Escribinos") abra el chat, mandá un evento. No hace falta ninguna variable global:

```html
<button onclick="document.dispatchEvent(new CustomEvent('linkvia:open'))">Escribinos</button>
```

También están `linkvia:close` y `linkvia:toggle`. Si tenés más de un widget en la misma página, indicá cuál: `new CustomEvent('linkvia:open', { detail: { handle: 'pizzeria' } })`. Con el teclado, `Esc` cierra el chat.

## Privacidad

- El iframe se abre sin decirle a Linkvia desde qué página vino (`no-referrer`).
- Tu web no ve nada de la charla ni de la persona: el chat vive en el dominio de Linkvia y el navegador lo separa de tu página. Tu agente recibe lo mismo que en la app: el seudónimo y solo los datos que la persona aceptó compartir.
- Solo la vista del chat (`/@negocio?embed=1`) se puede mostrar dentro de otra web; el resto de la app y el panel, no.
