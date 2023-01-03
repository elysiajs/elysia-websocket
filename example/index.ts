import { Elysia, t } from 'elysia'
import { websocket } from '../src/index'

const app = new Elysia()
    .get('/', () => Bun.file('./example/ws.html'))
    // Simple WebSocket
    .ws('/ws', {
        message(ws, message) {
            ws.send(message)
        }
    })
    // Simple chatroom with custom room id and name
    .ws('/ws/:room/:name', {
        schema: {
            body: t.Object({
                message: t.String()
            }),
            response: t.Object({
                user: t.String(),
                message: t.String(),
                time: t.Number()
            })
        },
        open(ws) {
            const {
                data: {
                    params: { room, name }
                }
            } = ws

            ws.subscribe(room).publish(room, {
                message: `${name} has entered the room`,
                user: '[SYSTEM]',
                time: Date.now()
            })
        },
        message(ws, { message }) {
            const {
                data: {
                    params: { room, name }
                }
            } = ws

            ws.publish(room, {
                message,
                user: name,
                time: Date.now()
            })
        },
        close(ws) {
            const {
                data: {
                    params: { room, name }
                }
            } = ws

            ws.publish(room, {
                message: `${name} has leave the room`,
                user: '[SYSTEM]',
                time: Date.now()
            })
        }
    })
    .listen(8080, ({ hostname, port }) => {
        console.log(`Running at http://${hostname}:${port}`)
    })
