# Gastronomía con delivery y take away

Agente de pedidos para cualquier local de comida con envío o retiro: rotisería, pizzería, viandas, hamburguesería, sushi, heladería, cafetería, panadería. El cliente arma el pedido con botones, sin audios ni "¿me pasás el menú?".

## Qué hace

- Muestra el menú por categorías, en lista o con fotos (carrusel) si cargás `imagen` en los productos.
- Arma el pedido con cantidades y muestra el subtotal.
- Delivery o retiro: zonas con costo de envío y pedido mínimo, o la dirección del local.
- Pide nombre y dirección **con permiso del cliente** (y si ya los compartió antes, no los vuelve a pedir).
- Pago anticipado, al recibir, o a elección del cliente, con Mercado Pago.
- Fuera de horario avisa que está cerrado y a qué hora abre.
- Panel en `/panel` para la cocina: pedidos en curso con botones "En preparación", "Salió" o "Listo para retirar" y "Entregado". Cada botón le avisa al cliente.

## Cómo se ve

> **Cliente:** hola
> **Agente:** ¡Hola! Bienvenido a *Rotisería Don Luis*. [Hacer un pedido] [Mi pedido] [Hablar con alguien]
> **Cliente:** *(elige Pizzas, Muzzarella, 2)*
> **Agente:** Sumé 2 × Muzzarella. Llevás $24.000. [Agregar más] [Ver pedido] [Terminar pedido]
> **Cliente:** *(Terminar, Delivery, Centro, comparte nombre y dirección)*
> **Agente:** *Resumen* 2 × Muzzarella: $24.000. Delivery a Av. Siempreviva 742 (envío $1.500). Total: *$25.500* [Confirmar pedido]
> *(la cocina toca "Salió")* **Agente:** ¡Tu pedido *PQR3Y* salió! Ya va en camino. 🛵

## Qué se configura (`config.json`)

| Campo | Nota |
|---|---|
| `menu` | Categorías (hasta 10) con productos: `id`, `nombre`, `descripcion`, `precio` y `imagen` (URL https) opcional |
| `delivery` | `activo`, `minimo`, `demoraMinutos`, `zonas` con `id`, `nombre`, `costo` |
| `retiro` | `activo`, `direccion`, `demoraMinutos` |
| `pago` | `"anticipado"`, `"al_recibir"` o `"a_eleccion"` |
| `horario` | Igual que en las otras plantillas. Sin `horario`, siempre abierto |
| `linkDePago` | Link de Mercado Pago del local, si no hay cobro automático |

## Cómo venderlo

- **A quién:** locales que hoy reciben pedidos por WhatsApp o por teléfono y se les traban los viernes a la noche.
- **El argumento:** "El pedido te llega ordenado, con dirección y pagado. Nadie escribe 'qué tenés de empanadas' diez veces. Y sin comisión por pedido como en las apps de delivery."
- **Frente a PedidosYa o Rappi:** no compite, complementa. Es el canal propio del local, sin el 20 a 30% de comisión, para los clientes que ya lo conocen.
- **Precio:** $15.000 a $25.000 por mes, más la carga inicial del menú con fotos.

## Ideas para sumar

"Lo de siempre" para repetir el último pedido, promos por día, cupón para el primer pedido, horario de entrega programado, aviso al local por mail o sonido cuando entra un pedido.
