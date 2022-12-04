# @elysiajs/websocket
Plugin for [elysia](https://github.com/elysiajs/elysia) that add support for websocket.

## Installation
```bash
bun add @elysiajs/websocket
```

## Example
```typescript
import { Elysia } from 'elysia'
import { websocket } from '@elysiajs/websocket'

const app = new Elysia()
    .use(websocket())
    .ws('/ws', {
        message(ws, message) {
            ws.message('Hi')
        }
    })
    .listen(8080)
```

## API
This plugin extends `Elysia` class with `ws` method.

## ws
Register Websocket to route

Parameters:
```typescript
ws(
    path: string,
    options: Partial<WebSocketHandler<Context>> & {
        schema?: Schema
        beforeHandle?: WithArray<HookHandler>
        headers?:
            | HeadersInit
            | (Context) => HeadersInt
    }
): this
```
