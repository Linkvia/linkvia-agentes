import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from linkvia import (  # noqa: E402
    LinkviaBot,
    LinkviaError,
    Toast,
    sign_payload,
    to_actions,
    verify_signature,
)

SECRET = "whsec_prueba"
EVENT = {
    "contractVersion": "0",
    "type": "message",
    "eventId": "ev1",
    "business": {"handle": "pizzeria"},
    "conversation": {"id": "conv-1", "channel": "app"},
    "user": {"id": "seudo", "sharedData": {}},
    "message": {"id": "m1", "text": "¿Tienen muzza?", "sentAt": "2026-11-05T12:00:00.000Z"},
}


class FakeApi:
    """Hace de API de Linkvia: guarda los pedidos y contesta lo que se le indique."""

    def __init__(self, *responses):
        self.calls = []
        self.responses = list(responses)

    def __call__(self, method, url, headers, body):
        self.calls.append((method, url, headers, json.loads(body) if body else None))
        return self.responses.pop(0) if self.responses else (200, b"{}")


class Firma(unittest.TestCase):
    def test_firma_y_verifica(self):
        header = sign_payload(SECRET, '{"a":1}', timestamp=1000)
        self.assertTrue(header.startswith("t=1000,v1="))
        self.assertTrue(verify_signature(SECRET, '{"a":1}', header, now=1000))
        self.assertTrue(verify_signature(SECRET, b'{"a":1}', header, now=1200))

    def test_rechaza_otro_cuerpo_otro_secreto_viejos_y_basura(self):
        header = sign_payload(SECRET, "{}", timestamp=1000)
        self.assertFalse(verify_signature(SECRET, "{ }", header, now=1000))
        self.assertFalse(verify_signature("whsec_otro", "{}", header, now=1000))
        self.assertFalse(verify_signature(SECRET, "{}", header, now=1301))
        for bad in [None, "", "t=abc,v1=00", "t=1000", "v1=00", "basura", "t=1000,v1=ñ"]:
            self.assertFalse(verify_signature(SECRET, "{}", bad, now=1000), bad)

    def test_acepta_tildes_en_el_cuerpo(self):
        body = json.dumps(EVENT, ensure_ascii=False)
        self.assertTrue(verify_signature(SECRET, body.encode("utf-8"), sign_payload(SECRET, body)))


class Recibir(unittest.TestCase):
    def setUp(self):
        self.bot = LinkviaBot(webhook_secret=SECRET)
        self.body = json.dumps(EVENT, ensure_ascii=False).encode("utf-8")
        self.header = sign_payload(SECRET, self.body)

    def test_contesta_un_texto(self):
        status, body = self.bot.handle(self.body, self.header, lambda e: f'Recibí: {e["message"]["text"]}')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"contractVersion": "0", "actions": [{"type": "text", "text": "Recibí: ¿Tienen muzza?"}]})

    def test_nada_acciones_y_toast(self):
        self.assertEqual(json.loads(self.bot.handle(self.body, self.header, lambda e: None)[1])["actions"], [])
        buttons = {"type": "buttons", "text": "¿Delivery?", "buttons": [{"id": "si", "title": "Sí"}]}
        self.assertEqual(json.loads(self.bot.handle(self.body, self.header, lambda e: buttons)[1])["actions"], [buttons])
        toast = json.loads(self.bot.handle(self.body, self.header, lambda e: Toast("Anotado", "Listo"))[1])
        self.assertEqual(toast, {"contractVersion": "0", "actions": [{"type": "text", "text": "Listo"}], "toast": "Anotado"})

    def test_sin_firma_401_y_no_llama_al_bot(self):
        called = []
        self.assertEqual(self.bot.handle(self.body, None, called.append), (401, b""))
        self.assertEqual(self.bot.handle(self.body, sign_payload("otro", self.body), called.append), (401, b""))
        self.assertEqual(called, [])
        with self.assertRaises(LinkviaError):
            self.bot.parse_webhook(self.body, "t=1,v1=00")

    def test_si_el_bot_falla_500(self):
        def boom(_):
            raise RuntimeError("se cayó el modelo")

        self.assertEqual(self.bot.handle(self.body, self.header, boom), (500, b""))

    def test_no_muestra_las_claves(self):
        bot = LinkviaBot(webhook_secret=SECRET, api_key="lv_secreta")
        self.assertNotIn("lv_secreta", repr(bot))
        self.assertNotIn(SECRET, repr(bot))


class Escribir(unittest.TestCase):
    def bot(self, *responses):
        api = FakeApi(*responses)
        return LinkviaBot(webhook_secret=SECRET, api_key="lv_x", api_url="https://linkvia.test/api/", transport=api), api

    def test_send_con_y_sin_aviso(self):
        bot, api = self.bot()
        bot.send("conv-1", "Tu pedido salió 🛵", notice="pedido-1042")
        method, url, headers, body = api.calls[0]
        self.assertEqual((method, url), ("POST", "https://linkvia.test/api/bot/v0/messages"))
        self.assertEqual(headers["authorization"], "Bearer lv_x")
        self.assertEqual(body, {"contractVersion": "0", "conversationId": "conv-1", "actions": [{"type": "text", "text": "Tu pedido salió 🛵"}], "notice": "pedido-1042"})
        bot.send("conv-1", [{"type": "text", "text": "a"}])
        self.assertNotIn("notice", api.calls[1][3])

    def test_send_devuelve_los_mensajes_para_mover_la_ubicacion(self):
        bot, api = self.bot((201, b'[{"id":"m9","from":"bot"}]'), (200, b"{}"))
        [sent] = bot.send("conv-1", {"type": "location", "latitude": -34.6, "longitude": -58.4, "live": 30})
        bot.edit(sent["id"], {"type": "location", "latitude": -34.61, "longitude": -58.41})
        self.assertEqual(api.calls[1][:2], ("PATCH", "https://linkvia.test/api/bot/v0/messages/m9"))

    def test_edit_delete_typing_read_history_atajos(self):
        bot, api = self.bot((200, b"{}"), (204, b""), (200, b"{}"), (200, b"{}"), (200, b'[{"id":"m1"}]'), (200, b"{}"))
        bot.edit("m/1", {"type": "text", "text": "Salió"})
        bot.delete("m1")
        bot.typing("conv-1")
        bot.read("conv-1")
        self.assertEqual(bot.history("conv 1", limit=10), [{"id": "m1"}])
        bot.set_shortcuts([{"id": "menu", "title": "Ver la carta"}])
        self.assertEqual(
            [(m, u.replace("https://linkvia.test/api", "")) for m, u, _, _ in api.calls],
            [
                ("PATCH", "/bot/v0/messages/m%2F1"),
                ("DELETE", "/bot/v0/messages/m1"),
                ("POST", "/bot/v0/typing"),
                ("POST", "/bot/v0/read"),
                ("GET", "/bot/v0/conversations/conv%201/messages?limit=10"),
                ("PUT", "/business/shortcuts"),
            ],
        )
        self.assertEqual(api.calls[0][3], {"contractVersion": "0", "action": {"type": "text", "text": "Salió"}})
        self.assertIsNone(api.calls[4][3])

    def test_errores_de_la_api(self):
        bot, _ = self.bot((429, b'{"error":"Tope de mensajes"}'))
        with self.assertRaises(LinkviaError) as ctx:
            bot.send("conv-1", "x")
        self.assertEqual((ctx.exception.status, str(ctx.exception)), (429, "Tope de mensajes"))
        bot, _ = self.bot((502, b"<html>"))
        with self.assertRaises(LinkviaError) as ctx:
            bot.typing("conv-1")
        self.assertEqual(ctx.exception.status, 502)

    def test_sin_clave_no_escribe(self):
        with self.assertRaises(LinkviaError):
            LinkviaBot(webhook_secret=SECRET).send("conv-1", "x")

    def test_stream_junta_texto_y_corta_si_tocan_detener(self):
        now = [0.0]
        bot, api = self.bot((200, b'{"messageId":"r1"}'), (200, b"{}"), (200, b'{"stopped":true}'))
        reply = bot.stream("conv-1", clock=lambda: now[0])
        reply.write("Ho")
        reply.write("la")
        self.assertEqual(len(api.calls), 1)  # todavía no pasó el tiempo: se junta
        now[0] = 1
        reply.write(", ¿qué")
        self.assertEqual(api.calls[1][3], {"text": "Hola, ¿qué"})
        now[0] = 2
        reply.write(" tal?")
        self.assertTrue(reply.stopped)
        reply.write(" (descartado)")
        reply.end()
        self.assertEqual(api.calls[3][1], "https://linkvia.test/api/bot/v0/stream/r1/end")
        self.assertEqual(len(api.calls), 4)

    def test_stream_end_con_texto_final(self):
        bot, api = self.bot((200, b'{"messageId":"r1"}'))
        reply = bot.stream("conv-1")
        reply.write("borrador")
        reply.end("Respuesta final")
        self.assertEqual(api.calls[1][3], {"text": "borrador"})
        self.assertEqual(api.calls[2][3], {"text": "Respuesta final"})


class Seguridad(unittest.TestCase):
    def test_api_url_https_salvo_localhost(self):
        with self.assertRaises(ValueError):
            LinkviaBot(webhook_secret=SECRET, api_url="http://linkvia.test/api")
        LinkviaBot(webhook_secret=SECRET, api_url="http://localhost:3000")

    def test_no_sigue_redirecciones_con_la_clave(self):
        import http.server
        import threading

        hits = []

        class Server(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                hits.append(self.path)
                self.send_response(302)
                self.send_header("location", "/robado")
                self.send_header("content-length", "0")
                self.end_headers()

            do_GET = do_POST

            def log_message(self, *args):
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Server)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            bot = LinkviaBot(webhook_secret=SECRET, api_key="lv_x", api_url=f"http://127.0.0.1:{server.server_address[1]}")
            with self.assertRaises(LinkviaError) as ctx:
                bot.typing("conv-1")
            self.assertEqual(ctx.exception.status, 302)
            self.assertEqual(hits, ["/bot/v0/typing"])
        finally:
            server.shutdown()
            server.server_close()

    def test_serve_rechaza_cuerpos_enormes(self):
        import http.client
        import threading

        bot = LinkviaBot(webhook_secret=SECRET)
        from http.server import ThreadingHTTPServer
        import linkvia

        # serve() bloquea: se levanta en un hilo con puerto libre y se le pega con un largo falso.
        original = ThreadingHTTPServer.__init__
        servers = []

        def capture(self, *args, **kwargs):
            original(self, *args, **kwargs)
            servers.append(self)

        ThreadingHTTPServer.__init__ = capture
        try:
            threading.Thread(target=bot.serve, args=(lambda e: None,), kwargs={"port": 0, "host": "127.0.0.1"}, daemon=True).start()
            while not servers:
                pass
        finally:
            ThreadingHTTPServer.__init__ = original
        server = servers[0]
        try:
            for length in [str(linkvia.MAX_BODY_BYTES + 1), "-1"]:
                conn = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
                conn.putrequest("POST", "/")
                conn.putheader("content-length", length)
                conn.endheaders()
                self.assertEqual(conn.getresponse().status, 413)
                conn.close()
        finally:
            server.shutdown()


class Acciones(unittest.TestCase):
    def test_to_actions(self):
        self.assertEqual(to_actions(None), [])
        self.assertEqual(to_actions("hola"), [{"type": "text", "text": "hola"}])
        with self.assertRaises(TypeError):
            to_actions(3)
        with self.assertRaises(TypeError):
            to_actions(Toast("x"))


if __name__ == "__main__":
    unittest.main()
