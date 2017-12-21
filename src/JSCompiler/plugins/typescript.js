// @flow

// TODO: Prefer a global installation of `typescript`
// TODO: Otherwise, install `typescript` lazily
// TODO: Load specific version of `typescript` for each package

import path from 'path'
import fs from 'fsx'

import type Package from '../../Package'
import type File from '../../File'
import Plugin from '../../Plugin'

const loadModule = (require: any)

let ts: any

class TypeScriptPlugin extends Plugin {
  static fileTypes = ['.ts']

  getOutputType(fileType: string) {
    return '.js'
  }

  load() {
    ts = loadModule('typescript')
  }

  loadPackage(pkg: Package) {
    const config = readConfig(pkg)
    if (config) {
      pkg.meta._tsconfig = config
      return true
    }
    return false
  }

  transform(code: string, file: File): string {
    const config = file.package.meta._tsconfig
    return ts.transpileModule(code, config)
  }
}

module.exports = TypeScriptPlugin

function readConfig(pkg: Package): ?Object {
  const configPath = path.join(pkg.path, 'tsconfig.json')
  try {
    return JSON.parse(fs.readFile(configPath))
  } catch(e) {}
}
