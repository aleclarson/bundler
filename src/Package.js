// @flow

// TODO: Remove unused packages.
// TODO: Remove plugins when no files need them.

import path from 'path'
import fs from 'fsx'

import type {CrawlOptions} from './utils/crawlPackage'
import type File, {Platform} from './File'
import type {Watcher} from './utils/watchPackage'
import type Bundler from './Bundler'
import type Plugin from './Plugin'

import {log} from './logger'
import {getPlugins} from './plugins'
import {uhoh, search} from './utils'
import {crawlPackage} from './utils/crawlPackage'
import {watchPackage} from './utils/watchPackage'

const loadModule = (require: any)

export type PackageConfig = {
  root: string,
  parent: ?Package,
  bundler: ?Bundler,
}

export default class Package { /*::
  path: string;
  meta: Object;
  dirs: Set<string>;
  parent: ?Package;
  bundler: Bundler;
  watcher: ?Watcher;
  crawled: Set<string>;
  fileTypes: Set<string>;
  plugins: { [fileType: string]: Plugin[] };
*/
  constructor(config: PackageConfig) {
    const {root, parent} = config
    this.path = root
    try {
      this._readMeta()
    } catch(error) {
      if (error.code == 'FILE_NOT_FOUND') {
        throw uhoh(`Package must contain a 'package.json' file: '${root}'`, 'PJSON_NOT_FOUND')
      } else {
        throw error
      }
    }
    this.dirs = new Set()
    if (parent) {
      this.parent = parent
      this.bundler = parent.bundler
    } else if (config.bundler) {
      this.parent = null
      this.bundler = config.bundler
    } else {
      throw Error('Must define `config.parent` or `config.bundler`')
    }
    this.crawled = new Set()
    this.fileTypes = new Set()
    this.plugins = {}
  }

  get name(): string {
    const {name} = this.meta
    if (!name) {
      throw Error(`Package has no name: '${this.path}'`)
    }
    // Cache the name now that it's been validated.
    setPropGet(this, 'name', getName)
    return name
  }

  get version(): string {
    const {version} = this.meta
    if (!version) {
      throw Error(`Package has no version: '${this.path}'`)
    }
    // Cache the version now that it's been validated.
    setPropGet(this, 'version', getVersion)
    return version
  }

  crawl(config?: CrawlOptions): void {
    crawlPackage(this, config)
  }

  watch(): void {
    if (!this.watcher) {
      this.watcher = watchPackage(this)
    }
  }

  // TODO: Add ability to watch specific file for changes.
  // watchFile(filePath: string): void {}

  // TODO: Support other file types?
  resolveMain(platform: Platform, preferredType: ?string): ?File {
    const main = this.meta.main || 'index'
    const file = this.getFile(main, platform, preferredType)
    if (file) return file
    log.warn('missing main module for package: ' + this.path)
  }

  hasFile(filePath: string): boolean {
    const {files} = this.bundler
    if (path.isAbsolute(filePath)) {
      if (filePath.startsWith(this.path)) {
        return files.hasOwnProperty(filePath)
      } else {
        return false
      }
    } else {
      return files.hasOwnProperty(path.join(this.path, filePath))
    }
  }

  getFile(filePath: string, platform: Platform, preferredType: ?string): ?File {
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(this.path, filePath)
    }
    const fileType = path.extname(filePath)
    if (fileType) {
      if (!this.fileTypes.has(fileType)) {
        log.warn('file has unknown type: ' + filePath)
        return null
      }
      const {files} = this.bundler
      const platformPath =
        filePath.slice(0, 1 - fileType.length) + platform + fileType
      return files[platformPath] || files[filePath]
    }
    const rel = filePath.slice(this.path.length + 1)
    if (this.dirs.has(rel)) {
      filePath = path.join(filePath, 'index')
    }
    return this._findFile(filePath, platform, preferredType) || null
  }

  hasDependency(name: string, dev?: boolean): boolean {
    const deps = dev ? this.meta.devDependencies : this.meta.dependencies
    return deps != null && deps[name] != null
  }

  findDependency(name: string, dev?: boolean): ?string {
    for (let pkg = this; pkg != null; pkg = pkg.parent) {
      if (pkg.hasDependency(name, dev)) {
        return path.join(pkg.path, 'node_modules', name)
      }
    }
  }

  _readMeta(): void {
    const metaPath = path.join(this.path, 'package.json')
    this.meta = JSON.parse(fs.readFile(metaPath))
  }

  _findFile(
    filePath: string,
    platform: Platform,
    preferredType: ?string,
  ): ?File {
    const {files} = this.bundler
    if (preferredType) {
      const platformPath = filePath + '.' + platform + preferredType
      const file = files[platformPath] || files[filePath + preferredType]
      if (file) return file
    }
    return search(this.fileTypes, (fileType) => {
      if (fileType != preferredType) {
        const platformPath = filePath + '.' + platform + fileType
        return files[platformPath] || files[filePath + fileType]
      }
    })
  }

  async _loadPlugins(fileType: string): Promise<void> {
    let loaded = this.plugins[fileType]
    if (!loaded) {
      const plugins = getPlugins(fileType)
      const outputTypes = new Set()

      this.plugins[fileType] = loaded = []
      for (let i = 0; i < plugins.length; i++) {
        const plugin = plugins[i]
        if (plugin.loadPackage(this)) {
          loaded.push(plugin)

          // Prepare the plugin.
          if (!plugin.loaded) {
            console.log('Loading plugin: ' + plugin.name)
            plugin.loaded = true
            await plugin.load()
            console.log('Loaded plugin: ' + plugin.name)
          }

          // Load plugins for output types.
          const {fileTypes} = plugin
          if (fileTypes && !Array.isArray(fileTypes)) {
            const outputType = fileTypes[fileType]
            if (outputType) {
              outputTypes.add(outputType)
            } else {
              throw Error(`Unsupported file type: '${fileType}'`)
            }
          }
        }
      }
      if (outputTypes.size) {
        outputTypes.forEach(fileType =>
          this._loadPlugins(fileType))
      }
    }
  }
}

function setPropGet<T>(obj: any, key: string, get: () => T): void {
  Object.defineProperty(obj, key, {get})
}

function getName(): string {
  return this.meta.name
}

function getVersion(): string {
  return this.meta.version
}

function setFileType(file: string, type: string): string {
  const ext = path.extname(file)
  if (!ext) return file + type
  if (ext == type) return file
  return path.basename(file, ext) + type
}
