// @flow

// Traverse an object just like `Array::forEach`
export function forEach<T>(
  obj: { [string]: T },
  iterator: (value: T, key: string) => void
): void {
  const keys = Object.keys(obj)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    iterator(obj[key], key)
  }
}

export function search<T, U>(
  iterable: Iterable<T>,
  iterator: (value: T, index: number) => ?U
): ?U {
  // $FlowFixMe
  const it: Iterator<T> = iterable[Symbol.iterator]()
  let index = -1
  let next = it.next()
  while (!next.done) {
    const result = iterator(next.value, ++index)
    if (result !== undefined) {
      return result
    } else {
      next = it.next()
    }
  }
}

export async function traverse<T>(
  iterable: Iterable<T>,
  iterator: (value: T, index: number) => Promise<void>
): Promise<void> {
  // $FlowFixMe
  const it: Iterator<T> = iterable[Symbol.iterator]()
  let index = -1
  let next = it.next()
  while (!next.done) {
    await iterator(next.value, ++index)
    next = it.next()
  }
}

// Throw an error with the given message and optional error code.
export function uhoh(message: string, code: ?(number|string)): void {
  const error: any = Error(message)
  if (code) error.code = code
  Error.captureStackTrace(error, uhoh)
  throw error
}
