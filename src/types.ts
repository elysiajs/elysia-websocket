import type { ServerWebSocket, WebSocketHandler } from 'bun'

import type {
    Context,
    TypedSchema,
    HookHandler,
    UnwrapSchema,
    SCHEMA,
    Elysia,
    DEFS
} from 'elysia'
import type {
    ExtractPath,
    TypedRoute,
    TypedSchemaToRoute,
    WithArray,
    ElysiaRoute,
    ElysiaInstance,
    NoReturnHandler,
    TypedRouteToEden,
    AnyTypedSchema
} from 'elysia/dist/types'
import type { ElysiaWS } from '.'

import type { Raikiri } from 'raikiri'

import type { Static, TSchema } from '@sinclair/typebox'
import type { TypeCheck } from '@sinclair/typebox/compiler'

export type WSTypedSchema<ModelName extends string = string> = Omit<
    TypedSchema<ModelName>,
    'response'
> & {
    response?: TSchema | ModelName | undefined
}

export type ElysiaWSRoute<
    Method extends string = string,
    Schema extends TypedSchema = TypedSchema,
    Instance extends ElysiaInstance = ElysiaInstance,
    Path extends string = string,
    CatchResponse = unknown
> = Elysia<{
    request: Instance['request']
    store: Instance['store'] & {
        [SCHEMA]: {
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
    }
    schema: Instance['schema']
}>

export type TypedWSSchemaToRoute<
    Schema extends WSTypedSchema = WSTypedSchema,
    Instance extends ElysiaInstance = ElysiaInstance
> = {
    body: UnwrapSchema<Schema['body'], Instance>
    headers: UnwrapSchema<
        Schema['headers'],
        Instance
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    query: UnwrapSchema<
        Schema['query'],
        Instance
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    params: UnwrapSchema<
        Schema['params'],
        Instance
    > extends infer Result extends Record<string, any>
        ? Result
        : undefined
    response: UnwrapSchema<
        Schema['params'],
        Instance
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

export type WebSocketSchemaToRoute<Schema extends WSTypedSchema> = {
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

export type TransformMessageHandler<
    Message extends TSchema | string | undefined
> = (message: UnwrapSchema<Message>) => void | UnwrapSchema<Message>

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
        message: Schema['body'] extends undefined
            ? undefined
            : TypeCheck<
                  NonNullable<Schema['body']> extends TSchema
                      ? NonNullable<Schema['body']>
                      : TSchema
              >
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
            ModelName extends string = Exclude<
                keyof Instance['store'][typeof DEFS],
                number | symbol
            >,
            Schema extends WSTypedSchema<ModelName> = WSTypedSchema<ModelName>,
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
                    message: UnwrapSchema<Schema['body'], Instance, string>
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
        ): ElysiaWSRoute<
            'subscribe',
            Schema,
            Instance,
            Path,
            Schema['response']
        >
    }
}
