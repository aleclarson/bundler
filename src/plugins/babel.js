// @flow

import path from 'path'
import fs from 'fsx'

import Package from '../Package'
import File from '../File'

const loadModule = (require: any)
const defaultConfig = {
  ast: false,
  retainLines: true,
}

exports.isLoaded = false

// TODO: Load specific version of babel-core for each package?
exports.loadPlugin = function() {
  const babel = loadModule('babel-core')
  this.transform = function(code: string, meta: Object): string {
    return babel.transform(code, meta.babelrc)
  }
}

exports.loadPackage = function(pkg: Package): ?boolean {
  const configPath = path.join(pkg.path, '.babelrc')
  if (fs.isFile(configPath)) {
    const config = loadModule(configPath)
    pkg.meta.babelrc = Object.assign(config, defaultConfig)
    return true
  }
}
