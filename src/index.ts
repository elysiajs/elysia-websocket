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

import type { Static, TSchema } from '@sinclair/typebox'
import type { HookHandler, WithArray } from 'elysia/dist/types'
import type {
    ElysiaWebSocket,
    WebSocketHeaderHandler,
    WebSocketSchema,
    WebSocketSchemaToTypedSchema
} from './types'

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
                                !(
                                    ws.data as ElysiaWebSocket['data']
                                ).message?.Check(message)
                            ) {
                                return void ws.send(
                                    createValidationError(
                                        'message',
                                        (ws.data as ElysiaWebSocket['data'])
                                            .message,
                                        message
                                    ).cause as string
                                )
                            }

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
                headers: options.schema?.headers,
                params: options.schema?.params,
                query: options.schema?.query
            }
        }
    )

    return this
}

export default websocket

declare module 'elysia' {
    interface Elysia {
        websocketRouter: Router

        ws<
            Schema extends WebSocketSchema = WebSocketSchema,
            Path extends string = string
        >(
            /**
             * Path to register websocket to
             */
            path: Path,
            options: Omit<
                Partial<WebSocketHandler<Context>>,
                'open' | 'message' | 'close' | 'drain'
            > & {
                schema?: Schema
                beforeHandle?: WithArray<
                    HookHandler<WebSocketSchemaToTypedSchema<Schema>>
                >
                /**
                 * Headers to register to websocket before `upgrade`
                 */
                headers?:
                    | HeadersInit
                    | WebSocketHeaderHandler<
                          WebSocketSchemaToTypedSchema<Schema>
                      >

                /**
                 * The {@link ServerWebSocket} has been opened
                 *
                 * @param ws The {@link ServerWebSocket} that was opened
                 */
                open?: (
                    ws: ElysiaWebSocket<Schema, Path>
                ) => void | Promise<void>

                /**
                 * Handle an incoming message to a {@link ServerWebSocket}
                 *
                 * @param ws The {@link ServerWebSocket} that received the message
                 * @param message The message received
                 *
                 * To change `message` to be an `ArrayBuffer` instead of a `Uint8Array`, set `ws.binaryType = "arraybuffer"`
                 */
                message?: (
                    ws: ElysiaWebSocket<Schema, Path>,
                    message: Schema['message'] extends NonNullable<
                        Schema['message']
                    >
                        ? Static<NonNullable<Schema['message']>>
                        : string
                ) => any

                /**
                 * The {@link ServerWebSocket} is being closed
                 * @param ws The {@link ServerWebSocket} that was closed
                 * @param code The close code
                 * @param message The close message
                 */
                close?: (ws: ElysiaWebSocket<Schema, Path>) => any

                /**
                 * The {@link ServerWebSocket} is ready for more data
                 *
                 * @param ws The {@link ServerWebSocket} that is ready
                 */
                drain?: (
                    ws: ElysiaWebSocket<Schema, Path>,
                    code: number,
                    reason: string
                ) => any
            }
        ): this
    }
}
