import type { ServerWebSocket, WebSocketHandler } from 'bun'

import type { Context, TypedSchema, HookHandler, UnwrapSchema } from 'kingworld'
import type { Router } from 'kingworld/src/router'
import type {
    ExtractKWPath,
    Handler,
    KingWorldInstance,
    TypedRoute,
    TypedSchemaToRoute,
    WithArray
} from 'kingworld/src/types'

import type { Static, TSchema } from '@sinclair/typebox'
import type { TypeCheck } from '@sinclair/typebox/compiler'

export type WebSocketSchema = Omit<TypedSchema, 'body' | 'response'> & {
    /**
     * Validate websocket incoming message
     */
    message?: TSchema
}

export type WebSocketSchemaToRoute<Schema extends WebSocketSchema> = {
    body: never
    header: UnwrapSchema<Schema['header']> extends Record<string, any>
        ? UnwrapSchema<Schema['header']>
        : undefined
    query: UnwrapSchema<Schema['query']> extends Record<string, any>
        ? UnwrapSchema<Schema['query']>
        : undefined
    params: UnwrapSchema<Schema['params']> extends Record<string, any>
        ? UnwrapSchema<Schema['params']>
        : undefined
    response: undefined
}

export type WebSocketSchemaToTypedSchema<Schema extends WebSocketSchema> = {
    body: undefined
    header: Schema['header']
    query: Schema['query']
    params: Schema['params']
    response: undefined
}

export type ElysiaWebSocket<
    Schema extends WebSocketSchema = WebSocketSchema,
    Path extends string = string
> = ServerWebSocket<
    Context<
        ExtractKWPath<Path> extends never
            ? WebSocketSchemaToRoute<Schema>
            : Omit<WebSocketSchemaToRoute<Schema>, 'params'> & {
                  params: Record<ExtractKWPath<Path>, string>
              }
    > & {
        id: string
        message: Schema['message'] extends undefined
            ? undefined
            : TypeCheck<NonNullable<Schema['message']>>
    }
>

export type HeaderHandler<Route extends TypedRoute = TypedRoute> = (
    context: Context<Route>
) => HeadersInit

export type WebSocketHeaderHandler<
    Schema extends TypedSchema = TypedSchema,
    Path extends string = string
> = HeaderHandler<
    TypedSchemaToRoute<Schema>['params'] extends {}
        ? Omit<TypedSchemaToRoute<Schema>, 'response'> & {
              response: void | TypedSchemaToRoute<Schema>['response']
          }
        : Omit<
              Omit<TypedSchemaToRoute<Schema>, 'response'> & {
                  response: void | TypedSchemaToRoute<Schema>['response']
              },
              'params'
          > & {
              params: Record<ExtractKWPath<Path>, string>
          }
>

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
