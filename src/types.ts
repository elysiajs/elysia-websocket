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
    WithArray
} from 'elysia/dist/types'

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
    headers: UnwrapSchema<Schema['headers']> extends Record<string, any>
        ? UnwrapSchema<Schema['headers']>
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
    headers: Schema['headers']
    query: Schema['query']
    params: Schema['params']
    response: undefined
}

export type ElysiaWebSocket<
    Schema extends WebSocketSchema = WebSocketSchema,
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
              params: Record<ExtractPath<Path>, string>
          }
>
