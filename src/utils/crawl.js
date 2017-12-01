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
const nodeModulesRE = /\/node_modules(\/?|$)/

// By default, ignore these files for each package.
const defaultBlacklist = ['**/.git']

export type CrawlOptions = {
  types?: string[],
  exclude?: string[],
  blacklist?: string[],
}

export default function crawl(config: CrawlOptions = {}, pkg: Package): void {
  const {bundler} = pkg
  const excludeRE = config.exclude ? globRegex(config.exclude.sort()) : matchAll
  const blacklistRE = globRegex((config.blacklist || defaultBlacklist).sort())
  const crawlId = ['', excludeRE.source, blacklistRE.source].join(':')
  ;(function deeper(root: string) {
    const rootId = root + crawlId
    let crawled = bundler.crawled[rootId]
    if (crawled) {
      if (crawled.has(rootId)) return
    } else {
      bundler.crawled[rootId] = (crawled = new Set)
    }
    crawled.add(rootId)
    const names: string[] = fs.readDir(root)
    const isNodeModules = nodeModulesRE.test(root)
    for (let i = 0; i < names.length; i++) {
      const name = names[i]
      if (!blacklistRE.test(name) && !excludeRE.test(name)) {
        const filePath = path.join(root, name)
        if (fs.isDir(filePath)) {
          // Avoid crawling every package in 'node_modules'
          if (isNodeModules) {
            bundler.package(filePath, pkg)
          } else {
            deeper(filePath)
          }
        } else {
          bundler.file(filePath)
        }
      }
    }
  })(pkg.path)
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
