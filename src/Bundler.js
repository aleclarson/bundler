
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
import {uhoh} from './utils'

const homedir = require('os').homedir()

export default class Bundler extends EventEmitter { /*::
  files: { [filePath: string]: File };
  packages: { [root: string]: Package };
  versions: { [id: string]: Package };
*/
  constructor() {
    this.files = {}
    this.packages = {}
    this.versions = {}
  }

  project(config: ProjectConfig): Project {
    return new Project(config, this)
  }

  package(root: string, parent?: Package): Package {
    if (!path.isAbsolute(root)) {
      throw Error(`Expected an absolute path: '${root}'`)
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

      // Cache the package even if its version is already cached.
      const version = pkg.name + '@' + pkg.version
      packages[root] = pkg

      const {versions} = this
      if (versions[version] != null) {
        return versions[version]
      }

      versions[version] = pkg
      return pkg
    }
  }

  file(filePath: string, pkg: ?Package): File {
    if (!path.isAbsolute(filePath)) {
      throw Error(`Expected an absolute path: '${filePath}'`)
    }
    const {files} = this
    if (files[filePath] == null) {
      files[filePath] = new File(filePath, pkg || this.findPackage(filePath))
    } else {
      return files[filePath]
    }
  }

  getFile(filePath: string, types: ?string[]): ?File {
    if (!path.isAbsolute(filePath)) {
      throw Error(`Expected an absolute path: '${filePath}'`)
    }
    const {files} = this
    let file = files[filePath]
    if (file) {
      return file
    } else if (types) {
      for (let i = 0; i < types.length; i++) {
        file = files[filePath + '.' + types[i]]
        if (file) return file
      }
    }
  }

  addFile(filePath: string, pkg: ?Package): void {
    const {files} = this
    if (files[filePath] == null) {
      files[filePath] = new File(filePath, pkg || this.findPackage(filePath))
    } else {
      throw uhoh(`File already exists: '${filePath}'`, 'FILE_EXISTS')
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
