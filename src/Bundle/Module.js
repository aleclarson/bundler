// @flow

// TODO: Make `_body` property a Buffer object?

import type Package from '../Package'
import type File, {Import} from '../File'

export default class Module { /*::
  file: File
  type: string
  imports: ?Map<string, Module>
  parents: Set<Module>
  _body: ?string
  _buildTag: number
*/
  constructor(file: File) {
    this.file = file
    this.type = file.type
    this.imports = null
    this.parents = new Set()
    this._body = null
    this._buildTag = 0
  }

  get path(): string {
    return this.file.path
  }

  get package(): Package {
    return this.file.package
  }

  get platform(): ?string {
    return this.file.platform
  }

  read(): string {
    const body = this._body
    if (body) return body
    throw Error('Module must be loaded before reading')
  }

  mutate(fn: (body: string) => ?string): void {
    let body = this._body
    if (body != null) {
      body = fn(body)
      if (typeof body != 'string') {
        this._body = body
      }
    }
  }

  get _unresolved(): boolean {
    const {imports} = this.file
    if (!imports) return false
    return !this.imports || imports.size != this.imports.size
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
