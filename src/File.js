// @flow

import path from 'path'

import type {Import} from './utils/parseImports'
import type Package from './Package'

const platformRE = /\.(android|ios|web)$/

export type Platform = 'android' | 'ios' | 'web'

export default class File { /*::
  path: string;
  type: string;
  package: Package;
  platform: ?Platform;
  imports: ?Map<string, Import>;
*/
  constructor(filePath: string, fileType: string, pkg: Package) {
    this.path = filePath
    this.type = fileType

    const platform = path.extname(filePath.slice(0, -fileType.length))
    if (platformRE.test(platform)) {
      this.platform = (platform: any).slice(1)
    }

    if (!pkg) throw Error('Must provide a package')
    this.package = pkg
  }

  get name(): string {
    return path.relative(this.package.path, this.path)
  }

  test(name: string): boolean {
    let filePath = this.path
    if (this.platform) {
      filePath = filePath.replace('.' + this.platform, '')
    }
    return filePath.endsWith(name)
  }
}
