// @flow

import globRegex from 'glob-regex'
import path from 'path'
import fs from 'fsx'

import type {MatchFn, RouterFn} from './router'
import type {CrawlOptions} from './utils/crawlPackage'
import type {Platform} from './File'
import type {Watcher} from './utils/watchPackage'
import type Bundler from './Bundler'

import {forEach, uhoh} from './utils'
import {createRouter} from './router'
import Package from './Package'
import Bundle from './Bundle'
import File from './File'

const defaultTypes = ['.js']

type BundleConfig = {
  dev: boolean,
  main?: string,
  platform: Platform,
}

export type ProjectConfig = {
  root: string,
  fileTypes?: string[],
  exclude?: string[],
  watch?: boolean,
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

    if (config.watch) {
      this.root.watch()
    }
  }

  get bundler(): Bundler {
    return this.root.bundler
  }

  createRouter(match?: MatchFn): RouterFn {
    return createRouter(this, match)
  }

  resolveMain(platform: ?Platform): ?File {
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

  bundle(config: BundleConfig): Bundle {

    // Resolve the entry point.
    let main: ?File
    if (config.main) {
      main = this.root.getFile(config.main)
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
      if (!bundle) {
        // Ensure all plugins are loaded.
        pkg.fileTypes.forEach(fileType => pkg._loadPlugins(fileType))

        // Create a new bundle.
        this.bundles[hash] =
          bundle = new Bundle({
            dev: config.dev,
            main,
            project: this,
            platform: config.platform,
          })
      }
      return bundle
    }

    throw uhoh(`Missing main module for platform: '${config.platform}'`, 'NO_MAIN_MODULE')
  }

  findBundles(main: string): Bundle[] {
    const bundles = []
    for (const hash in this.bundles) {
      const bundle = this.bundles[hash]
      if (bundle.main.test(main)) {
        bundles.push(bundle)
      }
    }
    return bundles
  }
}
