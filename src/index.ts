import type { WebSocketHandler } from 'bun'

import {
    Elysia,
    getPath,
    Router,
    createValidationError,
    getSchemaValidator,
    type Context
} from 'elysia'
import { nanoid } from 'nanoid'

import type { TSchema } from '@sinclair/typebox'
import type { ElysiaWebSocket } from './types'

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
                            message = message.toString()

                            try {
                                message = JSON.parse(message)
                            } catch (error) {
                            }

                            if (
                                (ws.data as ElysiaWebSocket['data']).message &&
                                (
                                    ws.data as ElysiaWebSocket['data']
                                ).message?.Check(message)
                            )
                                return void ws.send(
                                    createValidationError(
                                        'message',
                                        (ws.data as ElysiaWebSocket['data'])
                                            .message,
                                        message
                                    ).cause as string
                                )

                            route.message(ws, message)
                        }

                        // ? noImplicitReturns
                        return undefined
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
                headers: options.schema?.headers,
                params: options.schema?.params,
                query: options.schema?.query
            }
        }
    )

    return this
}

export default websocket
