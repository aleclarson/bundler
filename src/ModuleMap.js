// @flow

export type Module = {
  file: File,
  line: number,
  length: number,
  imports: { [ref: string]: Module },
  consumers: Set<Module>,
}

export default class ModuleMap { /*::
  order: Module[];
  modules: { [id: string]: Module };
  changed: Set<Module>;
  deleted: Set<Module>;
*/
  constructor() {
    this.order = []
    this.modules = {}
    this.changed = new Set()
    this.deleted = new Set()
  }

  get hasChanges(): boolean {
    return this.changed.size > 0 || this.deleted.size > 0
  }

  has(id: string): boolean {
    return this.modules.hasOwnProperty(id)
  }

  get(id: string): Module {
    const mod = this.modules[id]
    if (mod) return mod
    throw Error(`Module does not exist: '${id}'`)
  }

  add(file: File): Module {
    const {id} = file

    let mod = this.modules[id]
    if (mod) {
      if (this.deleted.has(mod)) {
        this.deleted.delete(mod)
        mod.file = file
      } else {
        throw Error(`Module already exists: '${id}'`)
      }
    } else {
      this.modules[id] = mod = {
        file,
        line: -1,
        length: -1,
        imports: {},
        consumers: new Set(),
      }
    }
    return mod
  }

  // Enqueue the file to be updated.
  change(file: File): boolean {
    const mod = this.modules[file.id]
    if (mod && !this.deleted.has(mod)) {
      this.changed.add(mod)
      return true
    }
    return false
  }

  // Enqueue the file to be deleted.
  delete(file: File): boolean {
    const mod = this.modules[file.id]
    if (mod && !this.deleted.has(mod)) {
      this.changed.delete(mod)
      this.deleted.add(mod)
      return true
    }
    return false
  }

  resolve(ref: string, src: File): ?Module {
    const mod = this.modules[src.id]
    if (mod) return mod.imports[ref]
  }
}
