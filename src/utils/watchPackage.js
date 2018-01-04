// @flow

// TODO: Update `package.dirs` accordingly

import globRegex from 'glob-regex'
import path from 'path'
import fs from 'fsx'
import os from 'os'

import type Package from '../Package'

import {forEach} from '.'

const ignoredExts = ['swp', 'swx'].join('|')
const ignoredDirs = ['.git', 'node_modules'].join('|')
const ignoredRE = globRegex(`(**.(${ignoredExts})|(${ignoredDirs})(/**)?)`)

const watching: Set<string> = new Set()

export type Watcher = {
  close: () => void,
}

export function watchPackage(pkg: Package): Watcher {
  const root: string = fs.readLinks(pkg.path)
  if (watching.has(root)) {
    throw Error(`Already watching the given package: '${pkg.path}'`)
  }
  watching.add(root)

  const deps = watchDependencies(pkg)
  const opts = {recursive: true, persistent: false}
  const self = fs.watch(root, opts, (event, name) => {
    if (!ignoredRE.test(name)) {
      if (name == 'package.json') {
        // TODO: Should any module resolutions be cleared?
        pkg._readMeta()
      } else {
        const fileType = path.extname(name)
        if (pkg.fileTypes.has(fileType)) {
          const filePath = path.join(pkg.path, name)
          if (event != 'rename') {
            pkg.bundler.reloadFile(filePath)
          } else if (fs.exists(filePath)) {
            // `fs.watch` sometimes emits 'rename' for changed files.
            if (!pkg.bundler.reloadFile(filePath)) {
              pkg.bundler.addFile(filePath, fileType, pkg)
            }
          } else {
            pkg.bundler.deleteFile(filePath)
          }
        }
      }
    }
  })
  return {
    close() {
      self.close()
      deps.close()
    }
  }
}

// TODO: Support namespaced deps (eg: @aleclarson/fsx)
function watchDependencies(pkg: Package): Watcher {
  const {packages} = pkg.bundler

  const root = path.join(pkg.path, 'node_modules')
  const deps = {}
  fs.readDir(root).forEach(name => {
    const filePath = path.join(root, name)
    if (fs.isLink(filePath)) {
      // FIXME: This doesn't account for symlinks to packages within the project.
      const dep = packages[filePath]
      if (dep) deps[name] = watchPackage(dep)
    }
  })

  const opts = {persistent: false}
  const self = fs.watch(root, opts, (event, name) => {
    if (event == 'rename') {
      const filePath = path.join(root, name)
      if (packages[filePath] && !fs.exists(filePath)) {
        // TODO: Invalidate module resolutions for bundles that use this package.
        delete packages[filePath]
      }
    }
  })

  return {
    close() {
      self.close()
      forEach(deps, (watcher) => watcher.close())
    }
  }
}
