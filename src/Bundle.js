// @flow

// TODO: Track `packages` needed by each Bundle.

import EventEmitter from 'events'
import path from 'path'

import type {Compiler} from './compilers'
import type File, {Platform} from './File'
import type Package from './Package'
import type Project from './Project'
import type Bundler from './Bundler'

import {getPlugins, getOutputType} from './plugins'
import {compileBundle} from './utils/compileBundle'
import {loadCompiler} from './compilers'
import {patchBundle} from './utils/patchBundle'
import {uhoh} from './utils'

export type BundleConfig = {
  dev: boolean,
  main: File,
  project: Project,
  platform: Platform,
}

interface ReadConfig {
  minify?: boolean,
  onStop: Function,
}

export default class Bundle { /*::
  +dev: boolean;
  +main: File;
  +type: string;
  +events: EventEmitter;
  +project: Project;
  +platform: Platform;
  map: Map<File, Module>;
  order: Module[];
  changed: Set<Module>;
  deleted: Set<Module>;
  missing: Set<Module>;
  compiler: Compiler;
  hasCompiled: boolean;
  promise: ?Promise<string>;
*/
  constructor(config: BundleConfig) {
    this.dev = config.dev
    this.main = config.main
    this.type = getOutputType(this.main.type)
    this.events = new EventEmitter()
    this.project = config.project
    this.platform = config.platform
    this.reset()

    this.addModule(this.main)
    this.bundler.events
      .on('file:reload', this.reloadModule.bind(this))
      .on('file:delete', this.deleteModule.bind(this))
  }

  get bundler(): Bundler {
    return this.main.package.bundler
  }

  get needsPatch(): boolean {
    return this.missing.size > 0 ||
      this.changed.size > 0 || this.deleted.size > 0
  }

  reset(): void {
    this.map = new Map()
    this.order = []
    this.changed = new Set()
    this.deleted = new Set()
    this.missing = new Set()
    this.compiler = loadCompiler(this)
    this.hasCompiled = false
    this.promise = null
  }

  // TODO: Add `minify` option
  read(config: ReadConfig): Promise<string> {
    let {promise} = this
    if (promise) {
      if (this.needsPatch) {
        return this.promise = patchBundle(this, config)
      } else {
        return promise
      }
    } else {
      return this.promise = compileBundle(this, config)
    }
  }

  relative(filePath: string): string {
    return path.relative(this.main.package.path, filePath)
  }

  hasFile(file: File): boolean {
    return this.map.has(file)
  }

  getModule(file: File): ?Module {
    const mod = this.map.get(file)
    if (mod) return mod
  }

  addModule(file: File): Module {
    let mod = this.map.get(file)
    if (mod) {
      // Reuse modules that have been "deleted", but not yet processed.
      if (mod.isDeleted) {
        mod.file = file
        mod.isDeleted = undefined
        this.deleted.delete(mod)
      } else {
        uhoh(`Module already exists: '${file.path}'`, 'MODULE_EXISTS')
      }
    } else {
      this.map.set(file, mod = new Module(file))
    }
    return mod
  }

  // Add the module to the dirty queue.
  reloadModule(file: File): boolean {
    const mod = this.map.get(file)
    if (mod && !mod.isDeleted) {
      this.missing.delete(mod)
      this.changed.add(mod)
      return true
    }
    return false
  }

  // Add the module to the removal queue.
  deleteModule(file: File): boolean {
    const mod = this.map.get(file)
    if (mod && !mod.isDeleted) {
      mod.isDeleted = true
      this.deleted.add(mod)
      this.changed.delete(mod)
      return true
    }
    return false
  }

  on(event: string, listener: Function): void {
    this.events.on(event, listener)
  }

  off(event: string, listener: ?Function): void {
    if (listener) {
      this.events.removeListener(event, listener)
    } else {
      this.events.removeAllListeners(event)
    }
  }
}

export class Module { /*::
  file: File;
  index: number;
  length: number;
  imports: { [ref: string]: Module };
  parents: Set<Module>;
  isDeleted: ?boolean;
*/
  constructor(file: File) {
    this.file = file
    this.index = -1
    this.length = -1
    this.imports = {}
    this.parents = new Set()
  }

  // Force this module to resolve an import again.
  unlink(dep: Module): void {
    const {imports} = this
    for (const ref in imports) {
      if (imports[ref] == this) {
        delete imports[ref]
        break
      }
    }
  }
}
