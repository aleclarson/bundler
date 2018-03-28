// @flow

import globRegex from 'glob-regex'
import path from 'path'
import fs from 'fsx'

import type {CrawlOptions} from './utils/crawlPackage'
import type {Platform} from './File'
import type Bundler from './Bundler'

import {resolveFileType} from './utils/resolveFileType'
import {forEach, uhoh} from './utils'
import Package from './Package'
import Bundle from './Bundle'
import File from './File'

const defaultTypes = ['.js']

type BundleConfig = {
  dev: boolean,
  main?: string,
  platform: Platform,
  force?: boolean,
}

export type ProjectConfig = {
  root: string,
  fileTypes?: string[],
  exclude?: string[],
}

export default class Project { /*::
  +root: Package;
  +fileTypes: string[];
  +excludeRE: ?RegExp;
  +bundles: { [hash: string]: Bundle };
*/
  constructor(config: ProjectConfig, bundler: Bundler) {
    const root = path.resolve(config.root)
    if (!fs.isDir(root)) {
      throw Error('Project root must be a directory')
    }
    this.root = bundler.package(root)

    // Sort file types for hashing purposes.
    this.fileTypes = config.fileTypes ?
      config.fileTypes.sort() : defaultTypes

    // Sort exclude patterns for hashing, too.
    this.excludeRE = config.exclude ?
      globRegex(config.exclude.sort()) : null

    // Cache bundles using a hash.
    this.bundles = {}

    this.bundler.events
      .on('file:reload', this._reloadFile.bind(this))
      .on('file:delete', this._deleteFile.bind(this))
  }

  get bundler(): Bundler {
    return this.root.bundler
  }

  resolveMain(platform: Platform): ?File {
    return this.root.resolveMain(platform)
  }

  crawl(config: CrawlOptions = {}): void {
    if (!config.fileTypes) {
      config.fileTypes = globRegex(this.fileTypes)
    }
    if (!config.exclude && this.excludeRE) {
      config.exclude = this.excludeRE
    }
    this.root.crawl(config)
  }

  async bundle(config: BundleConfig): Promise<Bundle> {

    // Resolve the entry point.
    let main: ?File
    if (config.main) {
      main = this.root.getFile(config.main, config.platform)
    } else {
      main = this.resolveMain(config.platform)
    }

    if (main) {
      const pkg = this.root
      const hash = [
        path.relative(pkg.path, main.path),
        config.platform || '',
        config.dev ? 'dev' : '',
      ].join(':')

      let bundle = this.bundles[hash]
      if (!bundle || config.force) {
        this.bundles[hash] =
          bundle = new Bundle({
            dev: config.dev,
            main,
            type: await resolveFileType(main),
            project: this,
            platform: config.platform,
          })
      }
      return bundle
    }

    throw uhoh(`Missing main module for platform: '${config.platform}'`, 'NO_MAIN_MODULE')
  }

  filterBundles(filter: (bundle: Bundle) => boolean): Bundle[] {
    const bundles = []
    for (const hash in this.bundles) {
      const bundle = this.bundles[hash]
      if (filter(bundle)) {
        bundles.push(bundle)
      }
    }
    return bundles
  }

  _reloadFile(file: File): void {
    const {bundles} = this
    for (const hash in bundles) {
      bundles[hash].reloadModule(file)
    }
  }

  _deleteFile(file: File): void {
    const {bundles} = this
    for (const hash in bundles) {
      bundles[hash].deleteModule(file)
    }
  }
}
