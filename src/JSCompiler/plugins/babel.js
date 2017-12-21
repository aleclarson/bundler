// @flow

// TODO: Prefer a global installation of `babel-core`
// TODO: Otherwise, install `babel-core` lazily
// TODO: Load specific version of `babel-core` for each package
// TODO: Watch .babelrc or package.json for configuration changes

import path from 'path'
import fs from 'fsx'

import type Package from '../../Package'
import type File from '../../File'
import Plugin from '../../Plugin'

import {forEach} from '../../utils'

const loadModule = (require: any)
const defaultConfig = {
  ast: false,
  comments: false,
}

let babel: any

class BabelPlugin extends Plugin {
  static fileTypes = ['.js']

  load() {
    babel = loadModule('babel-core')
  }

  loadPackage(pkg: Package) {
    const config = pkg.meta.babel || readConfig(pkg)
    if (config) {
      forEach(defaultConfig, (value, key) => {
        if (!config.hasOwnProperty(key)) {
          config[key] = value
        }
      })
      return true
    }
    return false
  }

  transform(code: string, file: File): string {
    const config = file.package.meta.babel
    return babel.transform(code, config).code
  }
}

module.exports = BabelPlugin

function readConfig(pkg: Package): ?Object {
  const configPath = path.join(pkg.path, '.babelrc')
  try {
    const config = JSON.parse(fs.readFile(configPath))
    pkg.meta.babel = config
    return config
  } catch(e) {}
}
