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

import {uhoh} from './utils'
import {getPlugins} from './plugins'
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
  // watchFile(file: string): void {}

  // TODO: Support other file types?
  resolveMain(platform: ?Platform): ?File {
    const {files} = this.bundler
    const main = setFileType(this.meta.main || 'index', '.js')

    let file
    if (platform) {
      file = path.resolve(this.path, setPlatform(main, platform))
      if (files.hasOwnProperty(file)) {
        return files[file]
      }
    }

    file = path.resolve(this.path, main)
    if (files.hasOwnProperty(file)) {
      return files[file]
    }
  }

  hasFile(file: string): boolean {
    const {files} = this.bundler
    if (path.isAbsolute(file)) {
      if (file.startsWith(this.path)) {
        return files.hasOwnProperty(file)
      } else {
        return false
      }
    } else {
      return files.hasOwnProperty(path.join(this.path, file))
    }
  }

  getFile(file: string): ?File {
    if (!path.isAbsolute(file)) {
      file = path.join(this.path, file)
    }
    return this.bundler.getFile(file, this.fileTypes)
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
            plugin.loaded = true
            await plugin.load()
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

function setPlatform(file: string, platform: string): string {
  const parts = file.split('.')
  if (parts.length > 1) {
    parts.splice(parts.length - 1, 0, platform)
  } else {
    parts.push(platform)
  }
  return parts.join('.')
}
