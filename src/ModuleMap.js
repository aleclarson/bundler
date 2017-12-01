// @flow

import type File from './File'

import {uhoh} from './utils'

export type Module = {
  file: File,
  line: number,
  length: number,
  imports: { [ref: string]: Module },
  consumers: Set<Module>,
}

export default class ModuleMap { /*::
  map: Map<File, Module>;
  order: Module[];
  changed: Set<Module>;
  deleted: Set<Module>;
*/
  constructor() {
    this.map = new Map()
    this.order = []
    this.changed = new Set()
    this.deleted = new Set()
  }

  get hasChanges(): boolean {
    return this.changed.size > 0 || this.deleted.size > 0
  }

  has(file: File): boolean {
    return this.map.has(file)
  }

  get(file: File): Module {
    const mod = this.map.get(file)
    if (mod) {
      return mod
    } else {
      throw uhoh(`Module not found: '${file.path}'`, 'MODULE_NOT_FOUND')
    }
  }

  add(file: File): Module {
    let mod = this.map.get(file)
    if (mod) {
      if (this.deleted.has(mod)) {
        this.deleted.delete(mod)
        mod.file = file
      } else {
        uhoh(`Module already exists: '${file.path}'`, 'MODULE_EXISTS')
      }
    } else {
      this.map.set(file, (mod = {
        file,
        line: -1,
        length: -1,
        imports: {},
        consumers: new Set(),
      }))
    }
    return mod
  }

  // Enqueue the file to be updated.
  change(file: File): boolean {
    const mod = this.map.get(file)
    if (mod && !this.deleted.has(mod)) {
      this.changed.add(mod)
      return true
    }
    return false
  }

  // Enqueue the file to be deleted.
  delete(file: File): boolean {
    const mod = this.map.get(file)
    if (mod && !this.deleted.has(mod)) {
      this.changed.delete(mod)
      this.deleted.add(mod)
      return true
    }
    return false
  }

  resolve(ref: string, src: File): ?Module {
    const mod = this.map.get(src)
    if (mod) return mod.imports[ref]
  }
}
