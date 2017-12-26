// @flow

import type Bundle, {Module} from '.'

type MaybeAsync<T> = T | Promise<T>

export default class Patcher { /*::
  bundle: Bundle
*/
  constructor(bundle: Bundle) {
    this.bundle = bundle
  }

  indexOf(mod: Module): number {
    return mod._index
  }

  willPatch(): MaybeAsync<void> {}

  // Extra work can be avoided by providing the preceding module.
  insertModule(mod: Module, prev: ?Module): void {
    let next
    if (!prev) {
      const index = mod._index
      prev = this.bundle._first
      while (next = prev._next) {
        if (next._index >= index) break
        prev = next
      }
      if (!prev) {
        throw Error('Failed to insert module')
      }
    }
    mod._next = next || prev._next
    prev._next = mod
  }

  shiftModules(after: Module, amount: number): void {
    if (amount != 0) {
      let mod = after
      while (mod = mod._next) {
        mod._index += amount
      }
    }
  }

  deleteModule(mod: Module): void {
    const {bundle} = this
    const prev = this.findPrevious(mod)
    if (prev) {
      prev._next = mod._next
      if (!mod._next) {
        bundle._final = prev
      }
    } else {
      throw Error('Cannot delete the main module')
    }
  }

  didPatch(payload: string): MaybeAsync<string> {
    return payload
  }

  // Find the module before the given module.
  findPrevious(mod: Module): ?Module {
    let prev = this.bundle._first
    if (prev == mod) {
      return null
    }
    do {
      if (prev._next == mod) {
        return prev
      }
    } while (prev = prev._next)
  }
}
