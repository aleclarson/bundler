// @flow

// TODO: Group modules by their package
// TODO: Non *.css files must be recompiled when an dependency is changed.
// TODO: A package can only use one preprocessor, but not all packages
//       are forced to use the same preprocessor.
// TODO: Convert url(*.png) into base64 data URI
// TODO: Source map support

import type Package from '../Package'
import type Plugin from '../Plugin'
import type Bundle from '../Bundle'
import type File from '../File'

import Module from '../Bundle/Module'
import Compiler from '../Compiler'
import CSSPackage from './Package'

export class CSSCompiler extends Compiler {
  static match = (bundle: Bundle) => {
    return bundle._type == '.css'
  }

  static plugins = [
    require('./plugins/postcss'),
    require('./plugins/sass')
  ]

  loadModule(mod: Module): void {
    this.parseImports(mod)
  }

  // TODO: Update `mod.index` relative to parent module
  async joinModules(modules: Module[], config: Object): Promise<string> {
    const {bundle} = this

    // The module code accumulator.
    const output: string[] = []

    // The order in which modules will appear in the bundle.
    const sorted: Module[] = []

    // Start with the main module.
    const main = modules[0]

    ;(function addModule(mod: Module): void {
      // Put imports above importers.
      if (mod.imports) {
        mod.imports.forEach(dep => {
          if (sorted.indexOf(dep) == -1) {
            addModule(dep)
          }
        })
      }
      output.push(stripImports(mod))
      sorted.push(mod)
    })(main)

    // Update the bundle's module list.
    bundle._modules = sorted

    // Apply the plugins of the main package.
    return applyPlugins(output.join('\n\n'), main)
  }
}

function stripImports(mod: Module): string {
  const {imports} = mod.file
  if (imports) {
    const input = mod.read().trim()
    const output: string[] = []

    let inputIndex = 0
    const maxIndex = input.length

    imports.forEach(match => {
      const startIndex = 1 + input.lastIndexOf('\n', match.index)
      if (inputIndex < startIndex) {
        output.push(input.slice(inputIndex, startIndex).trim())
      }
      const endIndex = input.indexOf('\n', match.index)
      inputIndex = endIndex == -1 ? maxIndex : 1 + endIndex
    })

    if (inputIndex != maxIndex) {
      output.push(input.slice(inputIndex))
    }

    return output.join('\n')
  }
  return mod.read()
}

// Currently, only the plugins for the bundle's root package are
// applied to the given payload. Eventually, plugin support for
// dependencies will be added.
async function applyPlugins(
  payload: string,
  main: Module,
): Promise<string> {
  const pkg = main.package
  main.type = main.file.type
  while (true) {
    const {type} = main
    const plugins = pkg.plugins[type]
    if (plugins) {
      for (let i = 0; i < plugins.length; i++) {
        const plugin: Plugin = (plugins[i]: any)
        if (typeof plugin.transform == 'function') {
          payload = await plugin.transform(payload, pkg)
          main.type = plugin.convert(type)
          if (main.type != type) break
        }
      }
      if (main.type == type) {
        break
      }
    } else {
      break
    }
  }
  return payload
}
