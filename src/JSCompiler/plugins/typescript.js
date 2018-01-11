// @flow

// TODO: Load specific version of `typescript` for each package

import path from 'path'
import fs from 'fsx'

import type Package from '../../Package'
import type Module from '../../Bundle/Module'

// import {lazyInstall} from '../../utils/lazyInstall'
import {lazyRequire} from '../../utils/lazyInstall'
import workers from '../../utils/workers'
import Plugin from '../../Plugin'

let ts: any

class TypeScriptPlugin extends Plugin {
  static fileTypes = {'.ts': '.js'}

  async load() {
    ts = await lazyRequire('typescript')
    // const ts = await lazyInstall('typescript')
    // workers.plugin('typescript', `
    //   const ts = require('${ts}')
    //   return (code, options) =>
    //     ts.transpileModule(code, options).outputText
    // `)
  }

  loadPackage(pkg: Package) {
    const config = readConfig(pkg)
    if (config) {
      config.compilerOptions = {
        ...config.compilerOptions,
        sourceMap: false,
        inlineSourceMap: false,
      }
      pkg.meta._tsconfig = config
      return true
    }
    return false
  }

  transform(mod: Module, pkg: Package) {
    const timer = global.bundleTimer('typescript', path.relative(process.cwd(), mod.path))
    const res = ts.transpileModule(mod._body, pkg.meta._tsconfig)
    mod._body = res.outputText
    mod.type = '.js'
    timer.done()
  }

  // async transform(mod: Module, pkg: Package) {
  //   const timer = global.bundleTimer('typescript', path.relative(process.cwd(), mod.path))
  //   mod._body = await workers.call('typescript', mod._body, pkg.meta._tsconfig)
  //   mod.type = '.js'
  //   timer.done()
  // }
}

TypeScriptPlugin.prototype.name = 'typescript'

module.exports = TypeScriptPlugin

function readConfig(pkg: Package): ?Object {
  const configPath = path.join(pkg.path, 'tsconfig.json')
  try {
    return JSON.parse(fs.readFile(configPath))
  } catch(e) {}
}

function transform(code, options) {
  return workers.call('typescript', code, options)
}
