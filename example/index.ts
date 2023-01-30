import { Elysia, SCHEMA, t } from 'elysia'
import { websocket } from '../src/index'

const app = new Elysia()
    .use(websocket())
    .setModel({
        "a": t.Number()
    })
    .get('/', () => Bun.file('./example/ws.html'))
    // Simple WebSocket
    .ws('/ws', {
        message(ws, message) {
            console.log(message)

            ws.send(message)
        },
        schema: {
            "body": 'a',
            "response": "a"
        }
    })
    .get('/publish/:id', ({ publish, params: { id } }) => {
        publish(
            id,
            JSON.stringify({
                message: 'Hi',
                user: 'System',
                time: Date.now()
            })
        )

        return `Publish to ${id}`
    })
    // Simple chatroom with custom room id and name
    .setModel({
        'chat.response': t.Object({
            user: t.String(),
            message: t.String(),
            time: t.Number()
        })
    })
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
    .ws('/ws/number', {
        message(ws, message) {
            ws.send(message + 1)
        },
        transform() {},
        transformMessage(message) {
            return +message
        },
        schema: {
            body: t.Number()
        }
    })
    .listen(8080, ({ hostname, port }) => {
        console.log(`Running at http://${hostname}:${port}`)
    })
