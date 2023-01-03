Bun.serve({
    port: 8081,
    websocket: {
        message(ws, message) {
            ws.send(message)
        }
    },
    fetch(req, server) {
        if (server.upgrade(req))
            return

        return new Response('Regular HTTP response')
    }
})
