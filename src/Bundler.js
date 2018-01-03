// @flow

// TODO: Remove a package when unused by all bundles.

import EventEmitter from 'events'
import path from 'path'
import fs from 'fsx'

import type {ProjectConfig} from './Project'

import {uhoh, search} from './utils'
import Project from './Project'
import Package from './Package'
import File from './File'

const homedir = require('os').homedir()

// Initialize compilers for tests.
require('./compilers')

export default class Bundler { /*::
  files: { [filePath: string]: File };
  packages: { [root: string]: Package };
  versions: { [id: string]: Package };
  events: EventEmitter;
*/
  constructor() {
    this.files = {}
    this.packages = {}
    this.versions = {}
    this.events = new EventEmitter()
  }

  project(config: ProjectConfig): Project {
    return new Project(config, this)
  }

  package(root: string, parent?: Package): Package {
    if (!path.isAbsolute(root)) {
      throw Error(`Expected an absolute path: '${root}'`)
    }
    const {packages} = this
    if (!packages.hasOwnProperty(root)) {
      let pkg = new Package({
        root,
        parent,
        bundler: this,
      })

      const version = pkg.name + '@' + pkg.version
      const {versions} = this
      if (versions.hasOwnProperty(version)) {
        pkg = versions[version]
      }

      packages[root] = pkg
      versions[version] = pkg
      return pkg
    }
    return packages[root]
  }

  // TODO: Support a preferred file type (in case two files share a name).
  getFile(filePath: string, fileTypes?: Set<string>): ?File {
    if (!path.isAbsolute(filePath)) {
      throw Error(`Expected an absolute path: '${filePath}'`)
    }
    let file = this.files[filePath]
    if (!file && fileTypes) {
      file = search(fileTypes, (fileType) => {
        return this.files[filePath + fileType]
      })
      if (!file && fs.isDir(filePath)) {
        file = this.getFile(path.join(filePath, 'index'), fileTypes)
      }
    }
    return file
  }

  addFile(filePath: string, fileType: string, pkg: ?Package): void {
    if (!path.isAbsolute(filePath)) {
      throw Error(`Expected an absolute path: '${filePath}'`)
    }
    const {files} = this
    if (files[filePath] == null) {
      if (!pkg) pkg = this.findPackage(filePath)
      files[filePath] = new File(filePath, fileType, pkg)
      if (fileType) pkg.fileTypes.add(fileType)
    } else {
      throw uhoh(`File already exists: '${filePath}'`, 'FILE_EXISTS')
    }
  }

  reloadFile(filePath: string): boolean {
    const file = this.files[filePath]
    if (file) {
      this.events.emit('file:reload', file)
      return true
    }
    return false
  }

  deleteFile(filePath: string): boolean {
    const file = this.files[filePath]
    if (file) {
      delete this.files[filePath]
      this.events.emit('file:delete', file)
      return true
    }
    return false
  }

  findPackage(filePath: string): Package {
    let dir = filePath
    while ((dir = path.dirname(dir)) != homedir) {
      const pkg = this.packages[dir]
      if (pkg) return pkg
    }
    throw Error(`Failed to find package for file: '${filePath}'`)
  }
}
