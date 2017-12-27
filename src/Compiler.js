// @flow

import noop from 'noop'

import type Plugin from './Plugin'
import type Bundle from './Bundle'
import type File from './File'

import Module from './Bundle/Module'
import {parseImports} from './Bundle/parseImports'

type MaybeAsync<T> = T | Promise<T>

export default class Compiler { /*::
  bundle: Bundle
*/
  constructor(bundle: Bundle) {
    this.bundle = bundle
  }

  // Returns true if the bundle is compatible.
  static match: (bundle: Bundle) => boolean = noop.true

  // Compilers can specify built-in plugins.
  static plugins: Class<Plugin>[] = []

  //
  // Lifecycle methods
  //

  createModule(file: File): Module {
    return new Module(file)
  }

  deleteModule(mod: Module): void {}

  loadModule(mod: Module): MaybeAsync<?string> {}

  // By default, simply concatenate all modules in order.
  joinModules(modules: Module[], config: Object): MaybeAsync<string> {
    return modules.map(mod => mod.read()).join('\n')
  }

  //
  // Utility methods
  //

  parseImports(mod: Module): void {
    if (!mod._body) {
      throw Error('Cannot parse module until its code is loaded')
    }
    mod.file.imports = parseImports(mod.type, mod._body)
  }

  async transform(mod: Module): Promise<void> {
    if (!mod._body) {
      throw Error('Cannot transform module until its code is loaded')
    }
    const pkg = mod.package
    while (true) {
      const {type} = mod
      const plugins = pkg.plugins[type]
      if (plugins) {
        for (let i = 0; i < plugins.length; i++) {
          const plugin: any = plugins[i]
          if (typeof plugin.transform == 'function') {
            await plugin.transform(mod, pkg)
            if (mod.type != type) break
          }
        }
        if (mod.type == type) {
          break
        }
      } else {
        break
      }
    }
  }
}
