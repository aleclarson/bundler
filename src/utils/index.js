// @flow

export function emptyFunction(): void {}

export function forEach<T>(iterable: { [string]: T }, iterator: (value: T, key: string) => void) {
  for (const key in iterable) {
    iterator(iterable[key], key)
  }
}

export function uhoh(message: string, code: ?(number|string)): void {
  const error: any = Error(message)
  if (code) error.code = code
  Error.captureStackTrace(error, uhoh)
  throw error
}
