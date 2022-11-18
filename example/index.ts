import { KingWorld, t } from 'kingworld'
import { websocket } from '../src/index'

const app = new KingWorld()
    .use(websocket)
    .get('/', () => Bun.file('./example/ws.html'))
    .ws('/ws', {
        message(ws, message) {
            ws.send(message)
        }
    })
    // Simple chatroom with custom room id and name
    .ws('/ws/:room/:name', {
        schema: {
            message: t.Object({
                message: t.String()
            })
        },
        open(ws) {
            const {
                data: {
                    params: { room, name }
                }
            } = ws

            ws.subscribe(room)

            ws.publish(
                room,
                JSON.stringify({
                    message: `${name} has entered the room`,
                    user: '[SYSTEM]',
                    time: Date.now()
                })
            )
        },
        message(ws, { message }) {
            const {
                data: {
                    params: { room, name }
                }
            } = ws

            ws.publish(
                room,
                JSON.stringify({
                    message,
                    user: name,
                    time: Date.now()
                })
            )
        },
        close(ws) {
            const {
                data: {
                    params: { room, name }
                }
            } = ws

            ws.publish(
                room,
                JSON.stringify({
                    message: `${name} has leave the room`,
                    user: '[SYSTEM]',
                    time: Date.now()
                })
            )
        }
    })
    .listen(8080, ({ hostname, port }) => {
        console.log(`Running at http://${hostname}:${port}`)
    })
