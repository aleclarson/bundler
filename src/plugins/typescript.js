// @flow

import path from 'path'
import fs from 'fsx'

import Package from '../Package'
import File from '../File'

const loadModule = (require: any)

exports.isLoaded = false

exports.loadPlugin = function() {
  const ts = loadModule('typescript')
  this.transform = function(code: string, meta: Object): string {
    return ts.transpileModule(code, meta.tsconfig)
  }
}

exports.loadPackage = function(pkg: Package): ?boolean {
  const configPath = path.join(pkg.path, 'tsconfig.json')
  if (fs.isFile(configPath)) {
    pkg.meta.tsconfig = loadModule(configPath)
    return true
  }
}

exports.transformFile = function(file: File): string {
  const code = fs.readFile(file.path)
  return this.transform(code, file.package.meta)
}
