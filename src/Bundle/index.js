// @flow

// TODO: Track `packages` needed by each Bundle.

import EventEmitter from 'events'
import path from 'path'

import type File, {Platform} from '../File'
import type Compiler from '../Compiler'
import type Package from '../Package'
import type Project from '../Project'
import type Bundler from '../Bundler'
import Module from './Module'

import {loadCompiler} from '../compilers'
import {getPlugins} from '../plugins'
import {uhoh} from '../utils'

import {compileBundle} from './compileBundle'
import {patchBundle} from './patchBundle'

export {default as Module} from './Module'
export {default as Patcher} from './Patcher'

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
  +dev: boolean
  +main: File
  +type: string
  +events: EventEmitter
  +project: Project
  +platform: Platform
  _map: Map<File, Module>
  _first: Module
  _final: Module
  _promise: ?Promise<string>
  _compiler: Compiler
  _canPatch: boolean
  _changes: Set<Module>
*/
  constructor(config: BundleConfig) {
    this.dev = config.dev
    this.main = config.main
    this.type = getBundleType(this.main)
    this.events = new EventEmitter()
    this.project = config.project
    this.platform = config.platform

    this._first = this.addModule(this.main)
    this.reset()

    this.bundler.events
      .on('file:reload', this.patchModule.bind(this))
      .on('file:delete', this.deleteModule.bind(this))
  }

  get bundler(): Bundler {
    return this.main.package.bundler
  }

  get needsPatch(): boolean {
    return this._changes.size > 0
  }

  reset(): void {
    this._map = new Map()
    this._final = this._first
    this._promise = null
    this._compiler = loadCompiler(this)
    this._canPatch = false
    this._changes = new Set()
  }

  read(config: ReadConfig): Promise<string> {
    if (!this._promise) {
      return this._promise = compileBundle(this, config)
    }
    else if (this._changes.size) {
      return this._promise = patchBundle(this, config)
    }
    return this._promise
  }

  relative(filePath: string): string {
    return path.relative(this.main.package.path, filePath)
  }

  indexOf(file: File): number {
    let i = 0
    let mod = this._first
    while (mod) {
      if (mod.file == file) {
        return i
      }
      i += 1
    }
    return -1
  }

  hasFile(file: File): boolean {
    return this._map.has(file)
  }

  getModule(file: File): ?Module {
    const mod = this._map.get(file)
    if (mod) return mod
  }

  getModules(status: ?number): Module[] {
    if (status == 200) {
      return this.getModules().filter(mod => mod._status == 200)
    } else {
      const modules = []
      if (status == null) {
        let mod = this._first
        while (mod) {
          modules.push(mod)
          mod = mod._next
        }
      } else {
        this._changes.forEach(mod => {
          if (mod._status == status) {
            modules.push(mod)
          }
        })
      }
      return modules
    }
  }

  addModule(file: File): Module {
    let mod = this._map.get(file)
    if (mod) {
      // Reuse modules that have been "deleted", but not yet processed.
      if (mod._status < 0) {
        mod._status = 200
        mod.file = file
      } else {
        uhoh(`Module already exists: '${file.path}'`, 'MODULE_EXISTS')
      }
    } else {
      mod = this._compiler.createModule(file)
      this._map.set(file, mod)
    }
    return mod
  }

  // Add the module to the dirty queue.
  patchModule(file: File): boolean {
    const mod = this._map.get(file)
    return !!mod && this._patchModule(mod)
  }

  // Add the module to the removal queue.
  deleteModule(file: File): boolean {
    const mod = this._map.get(file)
    return !!mod && this._deleteModule(mod)
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

  _patchModule(mod: Module): boolean {
    const status = mod._status

    // Deleted modules cannot be patched.
    if (status < 0) return false

    // Mark the module as changed, if necessary.
    if (status != 1 && status != 201) {
      mod._status = 1
      this._changes.add(mod)
    }
    return true
  }

  _deleteModule(mod: Module): boolean {
    if (mod._status > 0) {
      mod._body = null
      mod._status = -1
      this._changes.add(mod)
      return true
    }
    return false
  }
}

function getBundleType(main: File): string {
  const pkg = main.package
  let bundleType = main.type
  while (true) {
    const plugins = pkg.plugins[bundleType]
    if (!plugins) {
      return bundleType
    }

    let outputType
    for (let i = 0; i < plugins.length; i++) {
      const {fileTypes} = plugins[i]
      if (!fileTypes || Array.isArray(fileTypes)) {
        continue
      }
      if (fileTypes.hasOwnProperty(bundleType)) {
        outputType = fileTypes[bundleType]
        break
      }
      throw Error(`Unsupported file type: '${bundleType}'`)
    }
    if (outputType) {
      bundleType = outputType
    } else {
      return bundleType
    }
  }
  return ''
}
