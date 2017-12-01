// @flow

import path from 'path'
import fs from 'fsx'

import type {CrawlOptions} from './utils/crawl'
import type {Platform} from './File'
import type Bundler from './Bundler'

import {forEach, uhoh} from './utils'
import Package from './Package'
import Bundle from './Bundle'
import File from './File'

const defaultTypes = ['js']

type ResolveFn = (ref: string, src: File, bundle: Bundle) => ?string
type BundleConfig = {
  platform: Platform,
  polyfills?: string[],
}

export type ProjectConfig = {
  root: string,
  types?: string[],
}

export default class Project { /*::
  +root: Package;
  +types: string[];
  +bundles: { [platform: string]: Bundle };
  +env: { [name: string]: Package };
*/
  constructor(config: ProjectConfig, bundler: Bundler) {
    const root = path.resolve(config.root)
    if (!fs.isDir(root)) {
      throw Error('Project root must be a directory')
    }
    this.root = bundler.package(root)
    this.types = config.types || defaultTypes
    this.bundles = {}
    this.env = {}
  }

  crawl(config: CrawlOptions): Promise<void> {
    if (!config.types) {
      config.types = this.types
    }
    return this.root.crawl(config)
  }

  bundle(config: BundleConfig): Bundle {
    let bundle = this.bundles[config.platform]
    if (bundle) {
      Object.assign(bundle, config)
      bundle.invalidate()
    } else {
      const main = this.resolveMain(config.platform)
      if (!main) {
        throw uhoh(`Missing main module for platform: '${config.platform}'`, 'NO_MAIN_MODULE')
      }
      this.bundles[config.platform] =
        bundle = new Bundle({
          main,
          project: this,
          ...config
        })
    }
    return bundle
  }

  resolveMain(platform: ?Platform): ?File {
    return this.root.resolveMain(platform)
  }
}
