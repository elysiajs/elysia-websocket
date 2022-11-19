import type { WebSocketHandler } from 'bun'

import { KingWorld, getPath, type Context } from 'kingworld'
import { Router } from 'kingworld/src/router'
import { createValidationError, getSchemaValidator } from 'kingworld/src/utils'

import type { TSchema } from '@sinclair/typebox'

import type { KWWebSocket } from './types'

/**
 * Register websocket config for KingWorld
 *
 * ---
 * @example
 * ```typescript
 * import { KingWorld } from 'kingworld'
 * import websocket from '@kingworldjs/websocket'
 *
 * const app = new KingWorld()
 *     .use(websocket)
 *     .ws('/ws', {
 *         message: () => "Hi"
 *     })
 *     .listen(8080)
 * ```
 */
export const websocket = (
    app: KingWorld,
    config: Omit<WebSocketHandler, 'open' | 'message' | 'close' | 'drain'>
) => {
    app.websocketRouter = new Router()

    if (!app.config.serve)
        app.config.serve = {
            websocket: {
                ...config,
                open(ws) {
                    if (!ws.data) return

                    const route = app.websocketRouter.find(
                        getPath((ws?.data as unknown as Context).request.url)
                    )?.store['ws']

                    if (route && route.open) route.open(ws)
                },
                message(ws, message) {
                    if (!ws.data) return

                    const route = app.websocketRouter.find(
                        getPath((ws?.data as unknown as Context).request.url)
                    )?.store['ws']

                    if (route && route.message) {
                        try {
                            message = JSON.parse(message.toString())
                        } catch (error) {
                            message = message.toString()
                        }

                        if (
                            (ws.data as KWWebSocket['data']).message?.Check(
                                message
                            ) === false
                        )
                            return void ws.send(
                                createValidationError(
                                    'message',
                                    (ws.data as KWWebSocket['data']).message,
                                    message
                                ).message
                            )

                        route.message(ws, message)
                    }
                },
                close(ws, code, reason) {
                    if (!ws.data) return

                    const route = app.websocketRouter.find(
                        getPath((ws?.data as unknown as Context).request.url)
                    )?.store['ws']

                    if (route && route.close) route.close(ws, code, reason)
                },
                drain(ws) {
                    if (!ws.data) return

                    const route = app.websocketRouter.find(
                        getPath((ws?.data as unknown as Context).request.url)
                    )?.store['ws']

                    if (route && route.drain) route.drain(ws)
                }
            }
        }

    return app
}

KingWorld.prototype.ws = function (path, options) {
    if (!this.websocketRouter)
        throw new Error(
            "Can't find WebSocket. Please register WebSocket plugin first"
        )

    this.websocketRouter.register(path)['ws'] = options

    this.get(
        path,
        (context) => {
            if (
                this.server!.upgrade(context.request, {
                    headers:
                        typeof options.headers === 'function'
                            ? options.headers(context)
                            : options.headers,
                    data: {
                        ...context,
                        message: getSchemaValidator(options.schema?.message)
                    } as KWWebSocket['data']
                })
            )
                return

            context.set.status = 400

            return 'Expected a websocket connection'
        },
        {
            beforeHandle: options.beforeHandle,
            schema: {
                header: options.schema?.header,
                params: options.schema?.params,
                query: options.schema?.query
            }
        }
    )

    return this
}

export default websocket
