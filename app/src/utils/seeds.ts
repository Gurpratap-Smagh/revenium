const encoder = new TextEncoder()

export const seed = (value: string): Uint8Array => encoder.encode(value)
