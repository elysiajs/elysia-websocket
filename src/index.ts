import type { WebSocketHandler } from 'bun'

import { Elysia, getPath, type Context } from 'elysia'
import { Router } from 'elysia/src/router'
import { createValidationError, getSchemaValidator } from 'elysia/src/utils'

import { nanoid } from 'nanoid'

import type { ElysiaWebSocket } from './types'
import type { TSchema } from '@sinclair/typebox'

/**
 * Register websocket config for Elysia
 *
 * ---
 * @example
 * ```typescript
 * import { Elysia } from 'elysia'
 * import { websocket } from '@elysiajs/websocket'
 *
 * const app = new Elysia()
 *     .use(websocket())
 *     .ws('/ws', {
 *         message: () => "Hi"
 *     })
 *     .listen(8080)
 * ```
 */
export const websocket =
    (config?: Omit<WebSocketHandler, 'open' | 'message' | 'close' | 'drain'>) =>
    (app: Elysia) => {
        app.websocketRouter = new Router()

        if (!app.config.serve)
            app.config.serve = {
                websocket: {
                    ...config,
                    open(ws) {
                        if (!ws.data) return

                        const route = app.websocketRouter.find(
                            getPath(
                                (ws?.data as unknown as Context).request.url
                            )
                        )?.store['ws']

                        if (route && route.open) route.open(ws)
                    },
                    message(ws, message) {
                        if (!ws.data) return

                        const route = app.websocketRouter.find(
                            getPath(
                                (ws?.data as unknown as Context).request.url
                            )
                        )?.store['ws']

                        if (route && route.message) {
                            try {
                                message = JSON.parse(message.toString())
                            } catch (error) {
                                message = message.toString()
                            }

                            if (
                                (
                                    ws.data as ElysiaWebSocket['data']
                                ).message?.Check(message) === false
                            )
                                return void ws.send(
                                    createValidationError(
                                        'message',
                                        (ws.data as ElysiaWebSocket['data'])
                                            .message,
                                        message
                                    ).message
                                )

                            route.message(ws, message)
                        }
                    },
                    close(ws, code, reason) {
                        if (!ws.data) return

                        const route = app.websocketRouter.find(
                            getPath(
                                (ws?.data as unknown as Context).request.url
                            )
                        )?.store['ws']

                        if (route && route.close) route.close(ws, code, reason)
                    },
                    drain(ws) {
                        if (!ws.data) return

                        const route = app.websocketRouter.find(
                            getPath(
                                (ws?.data as unknown as Context).request.url
                            )
                        )?.store['ws']

                        if (route && route.drain) route.drain(ws)
                    }
                }
            }

        return app
    }

Elysia.prototype.ws = function (path, options) {
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
                        id: nanoid(),
                        message: getSchemaValidator(options.schema?.message)
                    } as ElysiaWebSocket['data']
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
