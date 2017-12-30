// @flow

// TODO: Prefer a global installation of `typescript`
// TODO: Otherwise, install `typescript` lazily
// TODO: Load specific version of `typescript` for each package

import path from 'path'
import fs from 'fsx'

import type Package from '../../Package'
import type Module from '../../Bundle/Module'

import {lazyRequire} from '../../utils/lazyRequire'
import Plugin from '../../Plugin'

let ts: any

class TypeScriptPlugin extends Plugin {
  static fileTypes = {'.ts': '.js'}

  async load() {
    ts = await lazyRequire('typescript')
  }

  loadPackage(pkg: Package) {
    const config = readConfig(pkg)
    if (config) {
      pkg.meta._tsconfig = config
      return true
    }
    return false
  }

  transform(mod: Module, pkg: Package) {
    mod._body = ts.transpileModule(mod._body, pkg.meta._tsconfig)
    mod.type = '.js'
  }
}

module.exports = TypeScriptPlugin

function readConfig(pkg: Package): ?Object {
  const configPath = path.join(pkg.path, 'tsconfig.json')
  try {
    return JSON.parse(fs.readFile(configPath))
  } catch(e) {}
}
