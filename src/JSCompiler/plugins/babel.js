// @flow

// TODO: Prefer a global installation of `babel-core`
// TODO: Otherwise, install `babel-core` lazily
// TODO: Load specific version of `babel-core` for each package
// TODO: Watch .babelrc or package.json for configuration changes

import path from 'path'
import huey from 'huey'
import fs from 'fsx'

import type Package from '../../Package'
import type Module from '../../Bundle/Module'

// import {lazyInstall} from '../../utils/lazyInstall'
import {lazyRequire} from '../../utils/lazyInstall'
import {forEach} from '../../utils'
import workers from '../../utils/workers'
import Plugin from '../../Plugin'

const defaultConfig = {
  ast: false,
  comments: false,
  retainLines: false,
}

let babel: any

class BabelPlugin extends Plugin {
  static fileTypes = ['.js']

  async load() {
    babel = await lazyRequire('babel-core')
    // const babel = await lazyInstall('babel-core')
    // workers.plugin('babel', `
    //   const babel = require('${babel}')
    //   return (code, options) =>
    //     babel.transform(code, options).code
    // `)
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
    const timer = global.bundleTimer('babel', path.relative(process.cwd(), mod.path))
    try {
      mod._body = babel.transform(mod._body, pkg.meta.babel).code
      timer.done()
    } catch(e) {
      console.warn('Failed to transform: ' + huey.gray(mod.path) + ' => ' + huey.red(e.message))
    }
  }

  // async transform(mod: Module, pkg: Package) {
  //   const timer = global.bundleTimer('babel', path.relative(process.cwd(), mod.path))
  //   try {
  //     mod._body = await workers.call('babel', mod._body, pkg.meta.babel)
  //     timer.done()
  //   } catch(e) {
  //     console.warn('Failed to transform: ' + huey.gray(mod.path) + ' => ' + huey.red(e.message))
  //   }
  // }
}

BabelPlugin.prototype.name = 'babel'

module.exports = BabelPlugin

function readConfig(pkg: Package): ?Object {
  const configPath = path.join(pkg.path, '.babelrc')
  try {
    const config = JSON.parse(fs.readFile(configPath))
    pkg.meta.babel = config
    return config
  } catch(e) {}
}
