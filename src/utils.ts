export const mapWebSocketResponse = (response: unknown): string | void => {
    switch (typeof response) {
        case 'string':
            return response.toString()

        case 'boolean':
        case 'number':
        case 'bigint':
            return response.toString()

        case 'function':
            return response()

        case 'object':
            try {
                return JSON.stringify(response)
            } catch (error) {
                return response?.toString()
            }
    }
}
