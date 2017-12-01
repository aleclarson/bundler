// @flow

import EventEmitter from 'events'
import crypto from 'crypto'
import path from 'path'

import type File, {Platform} from './File'
import type Package from './Package'
import type Project from './Project'
import ModuleMap from './ModuleMap'

import generateBundle from './utils/generateBundle'
import patchBundle from './utils/patchBundle'

export type BundleConfig = {
  main: File,
  project: Project,
  platform: Platform,
  polyfills?: string[],
}

// TODO: Add `minify` option
type ReadConfig = {
  dev?: boolean,
  globals?: Object,
}

// TODO: Listen to bundler for file events.
export default class Bundle extends EventEmitter { /*::
  main: File;
  project: Project;
  platform: Platform;
  polyfills: ?string[];
  modules: ModuleMap;
  packages: { [name: string]: Package };
  readPromise: ?Promise<string>;
  readHash: ?string;
*/
  constructor(config: BundleConfig) {
    super()
    this.main = config.main
    this.project = config.project
    this.platform = config.platform
    this.polyfills = config.polyfills
    this.reset()
  }

  reset(): void {
    this.modules = new ModuleMap()
    this.packages = {}
  }

  read(config: ReadConfig = {}): Promise<string> {
    const hash = computeHash(config, this.platform, this.project)

    let promise = this.readPromise
    if (promise) {
      if (hash == this.readHash) {
        if (!this.modules.hasChanges) {
          return promise
        }
      } else {
        // TODO: Patch globals instead of generating from scratch.
        promise = null
      }
    }

    this.readHash = hash
    return this.readPromise = promise ? patchBundle(this) :
      this.project.root.crawl().then(() => generateBundle(this, config))
  }

  invalidate() {
    throw Error('Unimplemented')
  }
}

function computeHash(config: ReadConfig, platform: Platform, project: Project) {
  return crypto.createHash('sha256').update([
    platform,
    project.root,
    config.dev || false,
    JSON.stringify(config.globals),
  ].join(':')).digest('hex').slice(0, 16)
}
