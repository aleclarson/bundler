// @flow

import EventEmitter from 'events'
import crypto from 'crypto'
import path from 'path'

import type {GenerateBundleConfig} from './utils/generateBundle'
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

// TODO: Listen to bundler for file events.
export default class Bundle extends EventEmitter { /*::
  main: File;
  project: Project;
  platform: Platform;
  polyfills: ?string[];
  modules: ModuleMap;
  packages: { [name: string]: Package };
  readPromise: ?Promise<?string>;
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

  // TODO: Add `minify` option
  read(config: GenerateBundleConfig): Promise<?string> {
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

    let stopped = false
    config.onStop(function() {
      stopped = true
    })

    this.readHash = hash
    return this.readPromise =
      promise ? (patchBundle(this): any) :
      this.project.root.crawl({
        onStop: config.onStop,
      }).then(() => {
        if (!stopped) {
          return generateBundle(this, config)
        }
      })
  }

  invalidate() {
    throw Error('Unimplemented')
  }
}

function computeHash(
  config: GenerateBundleConfig,
  platform: Platform,
  project: Project,
): string {
  return crypto.createHash('sha256').update([
    platform,
    project.root,
    config.dev || false,
    JSON.stringify(config.globals),
  ].join(':')).digest('hex').slice(0, 16)
}
