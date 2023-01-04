import type { ServerWebSocket, WebSocketHandler } from 'bun'

import {
    Elysia,
    getPath,
    Router,
    createValidationError,
    getSchemaValidator,
    type Context,
    type TypedSchema,
    UnwrapSchema
} from 'elysia'
import { nanoid } from 'nanoid'

import type { TSchema } from '@sinclair/typebox'
import type { ElysiaWSContext } from './types'

export class ElysiaWS<
    WS extends ElysiaWSContext<any> = ElysiaWSContext,
    Schema extends TypedSchema = TypedSchema
> {
    raw: WS
    data: WS['data']
    isSubscribed: WS['isSubscribed']

    constructor(ws: WS) {
        this.raw = ws
        this.data = ws.data
        this.isSubscribed = ws.isSubscribed
    }

    publish(
        topic: string,
        data: UnwrapSchema<Schema['response']>,
        compress?: boolean
    ) {
        // @ts-ignore
        if (typeof data === 'object') data = JSON.stringify(data)

        this.raw.publish(topic, data as string, compress)

        return this
    }

    send(data: UnwrapSchema<Schema['response']>) {
        // @ts-ignore
        if (typeof data === 'object') data = JSON.stringify(data)

        this.raw.send(data as string)

        return this
    }

    subscribe(room: string) {
        this.raw.subscribe(room)

        return this
    }

    unsubscribe(room: string) {
        this.raw.unsubscribe(room)

        return this
    }

    cork(callback: (ws: ServerWebSocket<any>) => any) {
        this.raw.cork(callback)

        return this
    }

    close() {
        this.raw.close()

        return this
    }
}

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
        if (!app.websocketRouter) app.websocketRouter = new Router()

        const router = app.websocketRouter

        if (!app.config.serve)
            app.config.serve = {
                websocket: {
                    ...config,
                    open(ws) {
                        if (!ws.data) return

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.find(getPath(url, index), index)
                            ?.store['subscribe']

                        if (route && route.open)
                            route.open(new ElysiaWS(ws as any))
                    },
                    message(ws, message): void {
                        if (!ws.data) return

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.find(getPath(url, index), index)
                            ?.store['subscribe']

                        if (!route?.message) return

                        message = message.toString()
                        const start = message.charCodeAt(0)

                        if (start === 47 || start === 123)
                            try {
                                message = JSON.parse(message)
                            } catch (error) {}

                        for (
                            let i = 0;
                            i <
                            (ws.data as ElysiaWSContext['data'])
                                .transformMessage.length;
                            i++
                        ) {
                            const temp: any = (
                                ws.data as ElysiaWSContext['data']
                            ).transformMessage[i](message)

                            if (temp !== undefined) message = temp
                        }

                        if (
                            (ws.data as ElysiaWSContext['data']).message?.Check(
                                message
                            ) === false
                        )
                            return void ws.send(
                                createValidationError(
                                    'message',
                                    (ws.data as ElysiaWSContext['data'])
                                        .message,
                                    message
                                ).cause as string
                            )

                        route.message(new ElysiaWS(ws as any), message)
                    },
                    close(ws, code, reason) {
                        if (!ws.data) return

                        const queryIndex = (
                            ws?.data as unknown as Context
                        ).request.url.indexOf('?')

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.find(getPath(url, index), index)
                            ?.store['subscribe']

                        if (route && route.close)
                            route.close(new ElysiaWS(ws as any), code, reason)
                    },
                    drain(ws) {
                        if (!ws.data) return

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.find(getPath(url, index), index)
                            ?.store['subscribe']

                        if (route && route.drain)
                            route.drain(new ElysiaWS(ws as any))
                    }
                }
            }

        return app
    }

// @ts-ignore
Elysia.prototype.ws = function (path, options) {
    if (!this.websocketRouter)
        throw new Error(
            "Can't find WebSocket. Please register WebSocket plugin first"
        )

    this.websocketRouter.register(path)['subscribe'] = options

    return this.get(
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
                        message: getSchemaValidator(options.schema?.body),
                        transformMessage: Array.isArray(
                            options.transformMessage
                        )
                            ? options.transformMessage
                            : [options.transformMessage]
                    } as ElysiaWSContext['data']
                })
            )
                return

            context.set.status = 400

            return 'Expected a websocket connection'
        },
        {
            beforeHandle: options.beforeHandle,
            transform: options.transform,
            schema: {
                headers: options.schema?.headers,
                params: options.schema?.params,
                query: options.schema?.query
            }
        }
    )
}

export default websocket
