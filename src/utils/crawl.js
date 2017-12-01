// @flow

import globRegex from 'glob-regex'
import path from 'path'
import fs from 'fsx'

import type {Module} from '../ModuleMap'
import type Package from '../Package'
import type Bundle from '../Bundle'

import resolveImport from './resolveImport'
import parseImports from './parseImports'

const matchAll = /.*/
const nodeModulesRE = /\/node_modules$/

// By default, ignore these files for each package.
const defaultBlacklist = ['**/.git']

export type CrawlOptions = {
  types?: string[],
  exclude?: string[],
  blacklist?: string[],
  onStop: Function,
}

// TODO: Support packages not inside the `node_modules` directory?
export default function crawl(
  pkg: Package,
  config: CrawlOptions,
): Promise<void> {
  const {bundler} = pkg

  let stopped = false
  config.onStop(function() {
    stopped = true
  })

  const excludeRE = config.exclude ? globRegex(config.exclude.sort()) : matchAll
  const blacklistRE = globRegex((config.blacklist || defaultBlacklist).sort())

  const suffix = ['', excludeRE.source, blacklistRE.source].join(':')
  return (function deeper(root: string, alias: ?string): Promise<void> {
    let hash = path.relative(pkg.path, root)
    if (hash[0] == '.')
    hash += suffix
    if (pkg.crawling[hash]) {
      return pkg.crawling[hash]
    }
    if (pkg.crawled.has(hash)) {
      return Promise.resolve()
    }
    return pkg.crawling[hash] = Promise.resolve().then(() => {
      if (stopped) return
      delete pkg.crawling[hash]
      pkg.crawled.add(hash)

      const names: string[] = fs.readDir(root)
      const isNodeModules = nodeModulesRE.test(alias || root)

      const dirs: Promise<void>[] = []
      for (let i = 0; i < names.length; i++) {
        const name = names[i]
        if (!blacklistRE.test(name) && !excludeRE.test(name)) {
          const filePath = path.join(alias || root, name)
          const destPath = resolveLinks(filePath, (destPath) => {
            return !destPath.startsWith(filePath)
          })
          if (fs.isDir(destPath)) {
            if (isNodeModules) {
              try {
                bundler.package(filePath, pkg)
              } catch(error) {
                if (error.code != 'PJSON_NOT_FOUND') {
                  throw error
                }
                continue
              }
            } else {
              dirs.push(deeper(destPath, filePath))
            }
          } else if (filePath != destPath) {
            bundler.file(destPath)
          } else {
            bundler.file(filePath, pkg)
          }
        }
      }

      if (dirs.length) {
        return (Promise.all(dirs): any)
      }
    })
  })(pkg.path)
}

function resolveLinks(
  linkPath: string,
  stopAt: (destPath: string) => boolean
): string {
  while (true) {
    const destPath = path.resolve(path.dirname(linkPath), fs.readLink(linkPath))
    if (destPath == linkPath) break
    if (stopAt(destPath)) break
    linkPath = destPath
  }
  return linkPath
}

// crawl = (moduleId, depender) =>
//   return if modules[moduleId]
//   modules[moduleId] = true
//
//   unless mod = @_modules.get moduleId
//     throw Error "Module does not exist: '#{moduleId}'" unless depender
//     throw Error "'#{depender}' required a missing module: '#{moduleId}'"
//
//   unless file = @_files[mod.path]
//     file = {moduleId, code: @_readFile mod.path}
//     @_files[mod.path] = file
//
//   mod.requires ?= @_parseRequires file.code
//   @_resolveRequires mod
//   .then (resolved) ->
//     code = file.code
//
//     promises = []
//     for dependency, resolvedId of resolved
//       @debug and log.debug "Resolved '#{dependency}' into '#{resolvedId}' for '#{moduleId}'"
//       regex = new RegExp "require\\(['\"]#{dependency}['\"]\\)", "g"
//       code = code.replace regex, "require('#{resolvedId}')"
//       promises.push crawl resolvedId, moduleId
//
//     modules[moduleId] = code
//     return Promise.all promises
