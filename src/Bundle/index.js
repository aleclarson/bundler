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
import {createTimer} from '../utils/timer'
import {uhoh} from '../utils'

export {default as Module} from './Module'

// Temporary directory for cached bundles.
const CACHE_DIR = path.join(os.tmpdir(), 'cara', 'bundles')

export type BundleConfig = {
  dev: boolean,
  main: File,
  type: string,
  project: Project,
  platform: Platform,
}

interface ReadConfig {
  minify?: boolean,
  onStop: Function,
}

export default class Bundle { /*::
  +dev: boolean
  +project: Project
  +platform: Platform
  _map: Map<File, Module>
  _main: File
  _type: string
  _path: string
  _dirty: boolean
  _events: EventEmitter
  _buildTag: number
  _building: ?Promise<void>
  _compiler: Compiler
  _modules: Module[]
*/
  constructor(config: BundleConfig) {
    this.dev = config.dev
    this.project = config.project
    this.platform = config.platform

    this._main = config.main
    this._type = config.type
    this._path = getBundlePath(this)
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

  match(name: string): boolean {
    return this._main.match(name)
  }

  reset(): void {
    this._map = new Map()
    this._dirty = true
    this._building = null
    this._modules = []
    this._compiler = loadCompiler(this)
    this.addModule(this._main)
  }

  async read(config: ReadConfig): Promise<string> {
    if (this._dirty) {
      // After `read` is called, any new changes will dirty the bundle.
      this._dirty = false
    }
    else if (this._building) {
      await this._building
      try {
        // Try reading the bundle from disk.
        return fs.readFile(this._path)
      } catch(e) {}
    }

    if (!global.bundleTimer) {
      global.bundleTimer = createTimer()
    }

    // Build the bundle from scratch.
    const buildTag = ++this._buildTag
    const building = compileBundle(this, config)

    // Save the bundle to disk unless another build begins.
    this._building = building.then(payload => {
      const bundleTime = global.bundleTimer.done()
      console.log('\n' + bundleTime.toString('  ') + '\n')
      global.bundleTimer = null

      if (this._buildTag == buildTag) {
        const timer = createTimer()
        fs.writeDir(path.dirname(this._path))
        fs.writeFile(this._path, payload)
        console.log('saveBundle: ' + timer.done().elapsed())
      }
    }).catch(error => {
      this._events.emit('error', error)
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

function getBundlePath(bundle: Bundle): string {
  let filename = sha256(bundle._main.path).slice(0, 7)
  if (bundle.dev) filename += '.dev'
  return path.join(CACHE_DIR, filename) + bundle._type
}
