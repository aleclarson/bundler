// @flow

import path from 'path'
import fs from 'fsx'

import type {CrawlOptions} from './utils/crawl'
import type File, {Platform} from './File'
import type Bundler from './Bundler'
import {uhoh} from './utils'
import crawl from './utils/crawl'

const {loadPlugins} = require('./plugins')

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
  plugins: string[];
  crawled: Set<string>;
  crawling: { [hash: string]: Promise<void> };
*/
  constructor(config: PackageConfig) {
    const {root, parent} = config
    this.path = root
    try {
      this.meta = loadModule(root + '/package.json')
    } catch(error) {
      if (error.code == 'MODULE_NOT_FOUND') {
        throw uhoh(`Package must contain a 'package.json' file: '${root}'`, 'PJSON_NOT_FOUND')
      } else {
        throw error
      }
    }
    if (parent) {
      this.parent = parent
      this.bundler = parent.bundler
    } else {
      this.parent = null
      this.bundler = config.bundler
    }
    this.plugins = loadPlugins(this)
    this.crawled = new Set()
    this.crawling = {}
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

  crawl(config: CrawlOptions): Promise<void> {
    return crawl(this, config)
  }

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
