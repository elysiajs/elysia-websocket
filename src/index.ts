import type { Server, ServerWebSocket, WebSocketHandler } from 'bun'

import {
    Elysia,
    createValidationError,
    getSchemaValidator,
    DEFS,
    type Context,
    type TypedSchema,
    type UnwrapSchema,
    type ElysiaInstance
} from 'elysia'
import { Raikiri } from 'raikiri'
import { nanoid } from 'nanoid'

import type { TSchema } from '@sinclair/typebox'
import type { ElysiaWSContext, WSTypedSchema } from './types'

export const mapPathnameAndQueryRegEx = /:\/\/[^/]+([^#?]+)(?:\?([^#]+))?/

const getPath = (path: string) =>
    path.match(mapPathnameAndQueryRegEx)?.[1] ?? '/'

export class ElysiaWS<
    WS extends ElysiaWSContext<any> = ElysiaWSContext,
    Schema extends WSTypedSchema = WSTypedSchema,
    Instance extends ElysiaInstance = ElysiaInstance
> {
    raw: WS
    data: WS['data']
    isSubscribed: WS['isSubscribed']
    ref?: NonNullable<Instance['store'][typeof DEFS]>

    constructor(ws: WS) {
        this.raw = ws
        this.data = ws.data
        this.isSubscribed = ws.isSubscribed
    }

    publish(
        topic: string,
        data: UnwrapSchema<Schema['response'], Instance>,
        compress?: boolean
    ) {
        // @ts-ignore
        if (typeof data === 'object') data = JSON.stringify(data)

        this.raw.publish(topic, data as string, compress)

        return this
    }

    send(data: UnwrapSchema<Schema['response'], Instance>) {
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
        if (!app.websocketRouter) app.websocketRouter = new Raikiri()

        const router = app.websocketRouter

        if (!app.config.serve)
            app.config.serve = {
                websocket: {
                    ...config,
                    open(ws) {
                        if (!ws.data) return

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.match(
                            'subscribe',
                            getPath(url)
                        )?.store

                        if (route && route.open)
                            route.open(new ElysiaWS(ws as any))
                    },
                    message(ws, message: any): void {
                        if (!ws.data) return

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.match(
                            'subscribe',
                            getPath(url)
                        )?.store

                        if (!route?.message) return

                        message = message.toString()
                        const start = message.charCodeAt(0)

                        if (start === 47 || start === 123)
                            try {
                                message = JSON.parse(message)
                            } catch (error) {}
                        else if (!Number.isNaN(+message)) message = +message

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

                        const route = router.match(
                            'subscribe',
                            getPath(url)
                        )?.store

                        if (route && route.close)
                            route.close(new ElysiaWS(ws as any), code, reason)
                    },
                    drain(ws) {
                        if (!ws.data) return

                        const url = (ws?.data as unknown as Context).request.url
                        const index = url.indexOf('?')

                        const route = router.match(
                            'subscribe',
                            getPath(url)
                        )?.store

                        if (route && route.drain)
                            route.drain(new ElysiaWS(ws as any))
                    }
                }
            }

        return app
            .decorate('publish', app.server?.publish as Server['publish'])
            .onRequest((context) => {
                if (app.server) context.publish = app.server!.publish
            })
    }

// @ts-ignore
Elysia.prototype.ws = function (path, options) {
    if (!this.websocketRouter)
        throw new Error(
            "Can't find WebSocket. Please register WebSocket plugin first"
        )

    this.websocketRouter.add('subscribe', path, options)

    return this.get(
        path,
        // @ts-ignore
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
                        message: getSchemaValidator(
                            options.schema?.body,
                            this.store[DEFS]
                        ),
                        transformMessage: !options.transform
                            ? []
                            : Array.isArray(options.transformMessage)
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
