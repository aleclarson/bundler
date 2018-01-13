// @flow

// TODO: Prefer a global installation of `babel-core`
// TODO: Otherwise, install `babel-core` lazily
// TODO: Load specific version of `babel-core` for each package
// TODO: Watch .babelrc or package.json for configuration changes

import path from 'path'
import fs from 'fsx'

import type Package from '../../Package'
import type Module from '../../Bundle/Module'
import Plugin from '../../Plugin'

import {lazyRequire} from '../../utils/lazyRequire'
import {forEach} from '../../utils'

const loadModule = (require: any)
const defaultConfig = {
  ast: false,
  comments: false,
}

let babel: any

class BabelPlugin extends Plugin {
  static fileTypes = ['.js']

  async load() {
    babel = await lazyRequire('babel-core')
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

  transform(mod: Module, pkg: Package) {
    mod._body = babel.transform(mod._body, pkg.meta.babel).code
  }
}

module.exports = BabelPlugin

function readConfig(pkg: Package): ?Object {
  const configPath = path.join(pkg.path, '.babelrc')
  try {
    const config = fs.readFile(configPath)
    return pkg.meta.babel = JSON.parse(config)
  } catch(err) {
    if (err.code != 'FILE_NOT_FOUND') {
      console.warn('Failed to parse JSON: ' + huey.gray(configPath) + ' => ' + huey.red(err.message))
    }
  }
}
