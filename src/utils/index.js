// @flow

export function emptyFunction(): void {}

export function forEach<T>(iterable: { [string]: T }, iterator: (value: T, key: string) => void) {
  for (const key in iterable) {
    iterator(iterable[key], key)
  }
}
