import type { ServerWebSocket, WebSocketHandler } from 'bun'

import type {
    Context,
    TypedSchema,
    HookHandler,
    UnwrapSchema,
    Router
} from 'elysia'
import type {
    ExtractPath,
    TypedRoute,
    TypedSchemaToRoute,
    WithArray,
    ElysiaRoute,
    ElysiaInstance,
    NoReturnHandler
} from 'elysia/dist/types'

import type { Static, TSchema } from '@sinclair/typebox'
import type { TypeCheck } from '@sinclair/typebox/compiler'
import { ElysiaWS } from '.'

export type WebSocketSchemaToRoute<Schema extends TypedSchema> = {
    body: UnwrapSchema<Schema['body']> extends Record<string, any>
        ? UnwrapSchema<Schema['body']>
        : undefined
    headers: UnwrapSchema<Schema['headers']> extends Record<string, any>
        ? UnwrapSchema<Schema['headers']>
        : undefined
    query: UnwrapSchema<Schema['query']> extends Record<string, any>
        ? UnwrapSchema<Schema['query']>
        : undefined
    params: UnwrapSchema<Schema['params']> extends Record<string, any>
        ? UnwrapSchema<Schema['params']>
        : undefined
    response: UnwrapSchema<Schema['response']> extends Record<string, any>
        ? UnwrapSchema<Schema['response']>
        : undefined
}

export type TransformMessageHandler<Message extends TSchema | undefined> = (
    message: UnwrapSchema<Message>
) => void | UnwrapSchema<Message>

export type ElysiaWSContext<
    Schema extends TypedSchema = TypedSchema,
    Path extends string = string
> = ServerWebSocket<
    Context<
        ExtractPath<Path> extends never
            ? WebSocketSchemaToRoute<Schema>
            : Omit<WebSocketSchemaToRoute<Schema>, 'params'> & {
                  params: Record<ExtractPath<Path>, string>
              }
    > & {
        id: string
        message: Schema['body'] extends undefined
            ? undefined
            : TypeCheck<NonNullable<Schema['body']>>
        transformMessage: TransformMessageHandler<Schema['body']>[]
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
              params: Record<ExtractPath<Path>, string>
          }
>

declare module 'elysia' {
    interface Elysia {
        websocketRouter: Router

        ws<
            Schema extends TypedSchema = TypedSchema,
            Path extends string = string,
            Instance extends Elysia<any> = this
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

                beforeHandle?: WithArray<HookHandler<Schema>>
                transform?: WithArray<NoReturnHandler<Schema>>
                transformMessage?: WithArray<
                    TransformMessageHandler<Schema['body']>
                >

                /**
                 * Headers to register to websocket before `upgrade`
                 */
                headers?: HeadersInit | WebSocketHeaderHandler<Schema>

                /**
                 * The {@link ServerWebSocket} has been opened
                 *
                 * @param ws The {@link ServerWebSocket} that was opened
                 */
                open?: (
                    ws: ElysiaWS<ElysiaWSContext<Schema, Path>, Schema>
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
                    ws: ElysiaWS<ElysiaWSContext<Schema, Path>, Schema>,
                    message: Schema['body'] extends NonNullable<Schema['body']>
                        ? Static<NonNullable<Schema['body']>>
                        : string
                ) => any

                /**
                 * The {@link ServerWebSocket} is being closed
                 * @param ws The {@link ServerWebSocket} that was closed
                 * @param code The close code
                 * @param message The close message
                 */
                close?: (
                    ws: ElysiaWS<ElysiaWSContext<Schema, Path>, Schema>
                ) => any

                /**
                 * The {@link ServerWebSocket} is ready for more data
                 *
                 * @param ws The {@link ServerWebSocket} that is ready
                 */
                drain?: (
                    ws: ElysiaWS<ElysiaWSContext<Schema, Path>, Schema>,
                    code: number,
                    reason: string
                ) => any
            }
        ): Instance extends Elysia<infer Instance>
            ? ElysiaRoute<
                  'subscribe',
                  Schema,
                  Instance,
                  Path,
                  Schema['response']
              >
            : this
    }
}
