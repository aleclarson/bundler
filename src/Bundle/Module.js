// @flow

// TODO: Make `_body` property a Buffer object?

import type Package from '../Package'
import type File, {Import} from '../File'

export default class Module { /*::
  file: File
  type: string
  imports: ?Map<string, Module>
  parents: Set<Module>
  _status: number
  _body: ?string
  _next: ?Module
  _index: number
  _length: number
*/
  constructor(file: File) {
    this.file = file
    this.type = file.type
    this.imports = null
    this.parents = new Set()
    this._status = 201
    this._body = null
    this._next = null
    this._index = -1
    this._length = 0
  }

  // This module is new to its bundle.
  static CREATED = 201

  // This module is up-to-date.
  static OK = 200

  // This module has a missing dependency.
  static MISSING = 404

  // This module has changed.
  static CHANGED = 1

  // This module has been deleted or is unused.
  static DELETED = -1

  get path(): string {
    return this.file.path
  }

  get package(): Package {
    return this.file.package
  }

  get platform(): ?string {
    return this.file.platform
  }

  // Equals true if this module has been changed,
  // deleted, or has unresolved dependencies.
  get dirty(): boolean {
    return Math.floor(this._status % 200 / 100) != 0
  }

  // Read the module, then clear its cache.
  consume(): string {
    const body = this._body
    if (body != null) {
      this._body = undefined
      return body
    }
    if (this._status > 0) {
      throw Error('Cannot consume a module more than once')
    } else {
      throw Error('Cannot consume a deleted module')
    }
  }

  // Transform a module with the given function.
  mutate(fn: (body: string) => ?string): void {
    let body = this._body
    if (body != null) {
      body = fn(body)
      if (typeof body != 'string') {
        this._body = body
      }
    }
    if (this._status > 0) {
      throw Error('Cannot mutate a module that isn\'t loaded')
    } else {
      throw Error('Cannot mutate a deleted module')
    }
  }

  get _endIndex(): number {
    return this._index + this._length
  }

  // Force this module to resolve an import again.
  _unlink(dep: Module): void {
    const {imports} = this
    if (!imports) {
      throw Error('Cannot unlink when imports are not resolved')
    }
    for (const ref in imports) {
      if (imports.get(ref) == this) {
        imports.delete(ref)
        break
      }
    }
  }
}
