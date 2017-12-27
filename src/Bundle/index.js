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
  +main: File
  +type: string
  +project: Project
  +platform: Platform
  _map: Map<File, Module>
  _path: string
  _dirty: boolean
  _events: EventEmitter
  _buildTag: number
  _compiler: Compiler
*/
  constructor(config: BundleConfig) {
    this.dev = config.dev
    this.main = config.main
    this.type = getBundleType(this.main)
    this.project = config.project
    this.platform = config.platform
    this._path = getBundlePath(this.main, this.dev)
    this._events = new EventEmitter()
    this._buildTag = 0
    this.reset()

    this.addModule(this.main)
    this.bundler.events
      .on('file:reload', this.reloadModule.bind(this))
      .on('file:delete', this.deleteModule.bind(this))
  }

  get bundler(): Bundler {
    return this.main.package.bundler
  }

  get isCached(): boolean {
    return !this._dirty
  }

  reset(): void {
    this._map = new Map()
    this._dirty = true
    this._compiler = loadCompiler(this)
  }

  async read(config: ReadConfig): Promise<string> {
    if (!this._dirty) {
      try {
        return fs.readFile(this._path)
      } catch(e) {}
    }
    const payload = compileBundle(this, config)
    fs.writeFile(this._path, payload)
    return payload
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
      mod._body = null
      return true
    }
    return false
  }

  // Add the module to the removal queue.
  deleteModule(file: File): boolean {
    const mod = this._map.get(file)
    if (mod) {
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
  const filename = sha256(main.path) + (dev ? '.dev' : '')
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
