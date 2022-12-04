# @kingworldjs/websocket
A plugin for [kingworld](https://github.com/elysiajs/elysia) that add support for websocket.

## Installation
```bash
bun add @kingworldjs/websocket
```

## Example
```typescript
import { KingWorld } from 'kingworld'
import { websocket } from '@kingworldjs/websocket'

const app = new KingWorld()
    .use(websocket())
    .ws('/ws', {
        message(ws, message) {
            ws.message('Hi')
        }
    })
    .listen(8080)
```

## API
This plugin extends `KingWorld` class with `ws` method.

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
