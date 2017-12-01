// @flow

import path from 'path'
import fs from 'fsx'

import type Package from './Package'

import transformFile from './utils/transformFile'

const platformRE = /\.(android|ios|web)$/

export type Platform = 'android' | 'ios' | 'web'

export default class File { /*::
  path: string;
  type: string;
  package: Package;
  platform: ?Platform;
  imports: ?Set<string>;
*/
  constructor(file: string, pkg: Package) {
    const type = path.extname(file)
    const name = path.basename(file, type)
    const platform: any = path.extname(name)

    this.path = file
    this.type = type.slice(1)
    if (platformRE.test(platform)) {
      this.platform = platform.slice(1)
    }
    this.package = pkg
  }

  get name(): string {
    return path.relative(this.package.path, this.path)
  }

  read(): string {
    return transformFile(fs.readFile(this.path), this)
  }
}
