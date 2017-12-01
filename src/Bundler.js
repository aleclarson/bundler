
/*

Bundler wants to know:
  - when a package should be crawled
  - when a package can be cleared
  - when a module can be cleared
  - when a module should be updated
*/

// TODO: Remove a package when unused by all bundles.

import EventEmitter from 'events'

import type {ProjectConfig} from './Project'

import Project from './Project'
import Package from './Package'

const homedir = require('os').homedir()

export default class Bundler extends EventEmitter { /*::
  files: { [filePath: string]: File };
  packages: { [root: string]: Package };
  versions: { [id: string]: Package };
  crawled: { [dir: string]: Set<string> };
*/
  constructor() {
    this.files = {}
    this.packages = {}
    this.versions = {}
    this.crawled = {}
  }

  project(config: ProjectConfig): Project {
    return new Project(config, this)
  }

  package(root: string, parent?: Package): Package {
    if (!path.isAbsolute(root)) {
      throw Error(`Package root must be an absolute path: '${root}'`)
    }
    const {packages} = this
    if (packages[root] != null) {
      return packages[root]
    } else {
      const pkg = new Package({
        root,
        parent,
        bundler: this,
      })
      const version = pkg.name + '@' + pkg.version

      const {versions} = this
      if (versions[version] != null) {
        return versions[version]
      }

      packages[root] = pkg
      versions[version] = pkg
      return pkg
    }
  }

  file(filePath: string): File {
    if (!path.isAbsolute(filePath)) {
      throw Error(`Expected an absolute path: '${filePath}'`)
    }
    const {files} = this
    if (files[filePath] == null) {
      files[filePath] = new File(filePath, this.findPackage(filePath))
    } else {
      return files[filePath]
    }
  }

  getFile(filePath: string): File {
    if (!path.isAbsolute(filePath)) {
      throw Error(`Expected an absolute path: '${filePath}'`)
    }
    const {files} = this
    if (files[filePath] == null) {
      return files[filePath]
    } else {
      const e = Error(`File not found: '${filePath}'`)
      e.code = 'FILE_NOT_FOUND'
      throw e
    }
  }

  addFile(filePath: string): void {
    const {files} = this
    if (files[filePath] == null) {
      files[filePath] = new File(filePath, this.findPackage(filePath))
    } else {
      const e = Error(`File already exists: '${filePath}'`)
      e.code 'FILE_EXISTS'
      throw Error(e)
    }
  }

  reloadFile(filePath: string): void {
    const file = this.files[filePath]
    if (file) {
      this.emit('file:reload', filePath)
    }
  }

  deleteFile(filePath: string): boolean {
    const file = this.files[filePath]
    if (file) {
      delete this.files[filePath]
      this.emit('file:delete', filePath)
      return true
    }
    return false
  }

  findPackage(file: string, packages: Object): Package {
    let dir = file
    while ((dir = path.dirname(dir)) != homedir) {
      const pkg = packages[dir]
      if (pkg) return pkg
    }
    throw Error(`Failed to find package for file: '${file}'`)
  }
}

function crawlDir() {

}
