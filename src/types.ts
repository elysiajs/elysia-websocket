import type { ServerWebSocket, WebSocketHandler } from 'bun'

import type {
    Elysia,
    ElysiaInstance,
    Context,
    UnwrapSchema,
    TypedSchema,
    HookHandler,
    SCHEMA,
    DEFS,
    EXPOSED
} from 'elysia'
import type {
    ExtractPath,
    TypedRoute,
    TypedSchemaToRoute,
    WithArray,
    NoReturnHandler,
    AnyTypedSchema,
    TypedRouteToEden
} from 'elysia/dist/types'

import type { ElysiaWS } from '.'
import type { Raikiri } from 'raikiri'

// Mimick `@sinclair/typebox/compiler`.TypeCheck
type TypeCheck = {
    Errors(value: unknown): IterableIterator<unknown>
    Check(value: unknown): unknown
}

export type WSTypedSchema<ModelName extends string = string> = Omit<
    TypedSchema<ModelName>,
    'response'
> & {
    response?: TypedSchema<ModelName>['body']
}

export type ElysiaWSRoute<
    Method extends string = string,
    Schema extends TypedSchema = {},
    Instance extends ElysiaInstance = ElysiaInstance,
    Path extends string = string,
    CatchResponse = unknown
> = Elysia<{
    request: Instance['request']
    store: Instance['store']
    schema: Instance['schema']
    meta: Instance['meta'] &
        Record<
            typeof SCHEMA,
            {
                [path in Path]: {
                    [method in Method]: TypedSchemaToRoute<
                        Schema,
                        Instance
                    > extends infer FinalSchema extends AnyTypedSchema
                        ? Omit<FinalSchema, 'response'> & {
                              response: undefined extends FinalSchema['response']
                                  ? CatchResponse
                                  : FinalSchema['response']
                          }
                        : never
                }
            }
        >
}>

export type TypedWSSchemaToRoute<
    Schema extends WSTypedSchema = WSTypedSchema,
    Definitions extends ElysiaInstance['meta'][typeof DEFS] = {}
> = {
    body: UnwrapSchema<Schema['body'], Definitions>
    headers: UnwrapSchema<
        Schema['headers'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    query: UnwrapSchema<
        Schema['query'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    params: UnwrapSchema<
        Schema['params'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    response: UnwrapSchema<
        Schema['params'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
}

export type WSTypedSchemaToTypedSchema<Schema extends WSTypedSchema> = Omit<
    Schema,
    'response'
> & {
    response: Schema['response']
}

export type WebSocketSchemaToRoute<
    Schema extends WSTypedSchema,
    Definitions extends ElysiaInstance['meta'][typeof DEFS] = {}
> = {
    body: UnwrapSchema<
        Schema['body'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    headers: UnwrapSchema<
        Schema['headers'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    query: UnwrapSchema<
        Schema['query'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    params: UnwrapSchema<
        Schema['params'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    response: UnwrapSchema<
        Schema['response'],
        Definitions
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
}

export type TransformMessageHandler<Message extends WSTypedSchema['body']> = (
    message: UnwrapSchema<Message>
) => void | UnwrapSchema<Message>

export type ElysiaWSContext<
    Schema extends WSTypedSchema = WSTypedSchema,
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
        message: TypeCheck
        transformMessage: TransformMessageHandler<Schema['body']>[]
    }
>

export type HeaderHandler<Route extends TypedRoute = TypedRoute> = (
    context: Context<Route>
) => HeadersInit

export type WebSocketHeaderHandler<
    Schema extends WSTypedSchema = WSTypedSchema,
    Path extends string = string
> = HeaderHandler<
    TypedWSSchemaToRoute<Schema>['params'] extends {}
        ? Omit<TypedWSSchemaToRoute<Schema>, 'response'> & {
              response: void | TypedWSSchemaToRoute<Schema>['response']
          }
        : Omit<
              Omit<TypedWSSchemaToRoute<Schema>, 'response'> & {
                  response: void | TypedWSSchemaToRoute<Schema>['response']
              },
              'params'
          > & {
              params: Record<ExtractPath<Path>, string>
          }
>

declare module 'elysia' {
    interface Elysia {
        websocketRouter: Raikiri<any>

        ws<
            Instance extends ElysiaInstance = this extends Elysia<infer Inner>
                ? Inner
                : ElysiaInstance,
            Schema extends WSTypedSchema<
                Exclude<keyof Instance['meta'][typeof DEFS], number | symbol>
            > = {},
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

                beforeHandle?: WithArray<HookHandler<Schema>>
                transform?: WithArray<
                    NoReturnHandler<TypedWSSchemaToRoute<Schema>>
                >
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
                    ws: ElysiaWS<
                        ElysiaWSContext<Schema, Path>,
                        Schema,
                        Instance
                    >
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
                    ws: ElysiaWS<
                        ElysiaWSContext<Schema, Path>,
                        Schema,
                        Instance
                    >,
                    message: UnwrapSchema<
                        Schema['body'],
                        Instance['meta'][typeof DEFS],
                        string
                    >
                ) => any

                /**
                 * The {@link ServerWebSocket} is being closed
                 * @param ws The {@link ServerWebSocket} that was closed
                 * @param code The close code
                 * @param message The close message
                 */
                close?: (
                    ws: ElysiaWS<
                        ElysiaWSContext<Schema, Path>,
                        Schema,
                        Instance
                    >
                ) => any

                /**
                 * The {@link ServerWebSocket} is ready for more data
                 *
                 * @param ws The {@link ServerWebSocket} that is ready
                 */
                drain?: (
                    ws: ElysiaWS<
                        ElysiaWSContext<Schema, Path>,
                        Schema,
                        Instance
                    >,
                    code: number,
                    reason: string
                ) => any
            }
        ): Elysia<{
            request: Instance['request']
            store: Instance['store']
            schema: Instance['schema']
            meta: Instance['meta'] &
                Record<
                    typeof SCHEMA,
                    Record<
                        Path,
                        {
                            [method in 'subscribe']: TypedRouteToEden<
                                Schema,
                                Instance['meta'][typeof DEFS],
                                Path
                            >
                        }
                    >
                >
        }>
    }
}
