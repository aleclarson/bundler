// @flow

// TODO: Track `packages` needed by each Bundle.

import EventEmitter from 'events'
import crypto from 'crypto'
import path from 'path'
import fs from 'fsx'
import os from 'os'

import type File, {Platform} from '../File'
import type Compiler from '../Compiler'
import type Package from '../Package'
import type Project from '../Project'
import type Bundler from '../Bundler'
import Module from './Module'

import {compileBundle} from './compileBundle'
import {loadCompiler} from '../compilers'
import {getPlugins} from '../plugins'
import {huey} from '../logger'
import {uhoh} from '../utils'

export {default as Module} from './Module'

// Temporary directory for cached bundles.
const CACHE_DIR = path.join(os.tmpdir(), 'cara', 'bundles')

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
  +type: string
  +project: Project
  +platform: Platform
  _map: Map<File, Module>
  _main: File
  _path: string
  _dirty: boolean
  _events: EventEmitter
  _buildTag: number
  _building: ?Promise
  _compiler: Compiler
  _modules: Module[]
*/
  constructor(config: BundleConfig) {
    this.dev = config.dev
    this.type = getBundleType(config.main)
    this.project = config.project
    this.platform = config.platform

    this._main = config.main
    this._path = getBundlePath(this._main, this.dev)
    this._events = new EventEmitter()
    this._buildTag = 0

    this.reset()
  }

  get main(): Module {
    const main = this.getModule(this._main)
    if (!main) throw Error('Missing main module')
    return main
  }

  get bundler(): Bundler {
    return this._main.package.bundler
  }

  get isCached(): boolean {
    return !this._dirty
  }

  reset(): void {
    this._map = new Map()
    this._dirty = true
    this._building = null
    this._compiler = loadCompiler(this)
    this._modules = []
    this.addModule(this._main)
  }

  async read(config: ReadConfig): Promise<string> {
    if (this._dirty) {
      this._dirty = false
    }
    else if (this._building) {
      await this._building
      try {
        // Try reading the bundle from disk.
        return fs.readFile(this._path)
      } catch(e) {}
    }

    // Build the bundle from scratch.
    const buildTag = ++this._buildTag
    const building = compileBundle(this, config)

    // Save the bundle to disk unless another build begins.
    this._building = building.then(payload => {
      if (this._buildTag == buildTag) {
        fs.writeFile(this._path, payload)
      }
    })
    return building
  }

  relative(filePath: string): string {
    return path.relative(this.main.package.path, filePath)
  }

  hasModule(file: File): boolean {
    return this._map.has(file)
  }

  getModule(file: File): ?Module {
    const mod = this._map.get(file)
    if (mod) return mod
  }

  addModule(file: File): Module {
    let mod = this._map.get(file)
    if (mod) {
      uhoh(`Module already exists: '${file.path}'`, 'MODULE_EXISTS')
    } else {
      mod = this._compiler.createModule(file)
      this._map.set(file, mod)
    }
    return mod
  }

  // Add the module to the dirty queue.
  reloadModule(file: File): boolean {
    const mod = this._map.get(file)
    if (mod) {
      this._dirty = true
      mod._body = null
      return true
    }
    return false
  }

  // Add the module to the removal queue.
  deleteModule(file: File): boolean {
    const mod = this._map.get(file)
    if (mod) {
      this._dirty = true
      this._deleteModule(mod)
      return true
    }
    return false
  }

  on(event: string, listener: Function): void {
    this._events.on(event, listener)
  }

  off(event: string, listener: ?Function): void {
    if (listener) {
      this._events.removeListener(event, listener)
    } else {
      this._events.removeAllListeners(event)
    }
  }

  _deleteModule(mod: Module): void {
    this._map.delete(mod.file)
    this._compiler.deleteModule(mod)

    // Unlink parents from this module.
    if (mod.parents.size) {
      mod.parents.forEach(parent => parent._unlink(mod))
    }

    // Remove this module as a parent of any dependencies.
    if (mod.imports) {
      mod.imports.forEach(dep => {
        dep.parents.delete(mod)
        if (!dep.parents.size) {
          this._deleteModule(dep)
        }
      })
    }
  }
}

function sha256(input: string): string {
  return crypto.createHash('sha256')
    .update(input).digest('hex')
}

function getBundlePath(main: File, dev: boolean): string {
  let filename = sha256(main.path).slice(0, 7)
  if (dev) filename += '.dev'
  return path.join(CACHE_DIR, filename) + main.type
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
