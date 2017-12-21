// @flow

// TODO: Rename package@x.x.x if its conflicting package is removed.
// TODO: Support for @module in libraries
// TODO: Support changing package version

import path from 'path'
import fs from 'fsx'

import type Bundle, {Module} from '../Bundle'
import type Package from '../Package'
import type File from '../File'

import {forEach} from '../utils'

import PackageMap from './PackageMap'

const lineBreakRE = /\n/g
const trimLineBreakRE = /(^\n|\n$)/g

export function match(bundle: Bundle) {
  return bundle.type == '.js'
}

export function create(bundle: Bundle) {
  return new JSCompiler(bundle)
}

class JSCompiler { /*::
  bundle: Bundle;
  moduleIds: Map<Module, any>;
  packageIds: Map<Package, string>;
  getModuleId: (mod: Module) => any;
  packages: ?PackageMap;
*/
  constructor(bundle: Bundle) {
    this.bundle = bundle
    this.moduleIds = new Map()
    this.packageIds = new Map()
    if (bundle.dev) {
      this.getModuleId = this._devModuleId
      this.packages = new PackageMap(bundle.platform)
    } else {
      this.getModuleId = this._prodModuleId
    }
  }

  async compile(modules: string[], config: Object): Promise<string> {
    const {bundle} = this
    const prelude: string[] = [
      '(function() {',
      renderGlobals(config.globals, bundle.dev),
      readPolyfill('require'),
    ]

    // Append each polyfill.
    if (config.polyfills) {
      prelude.push.apply(prelude, config.polyfills.map(readPolyfill))
      prelude.push('')
    }

    // Only the prelude is joined with line breaks.
    // Doing so with modules would mess up their `index` properties.
    const output = [prelude.join('\n')]

    // Compute character index where modules begin.
    let outputIndex = output[0].length

    for (let i = 0; i < modules.length; i++) {
      const mod = bundle.order[i]
      const code = await this.compileModule(modules[i], mod)
      output.push(code)

      // Track character index where each module begins.
      mod.index = outputIndex
      mod.length = code.length

      // Increment the bundle length.
      outputIndex += mod.length
    }

    // Kickstart the program.
    const main = bundle.order[0]
    const mainId = JSON.stringify(this.moduleIds.get(main))
    output.push(`\n  require(${mainId});\n})()`)

    // All done!
    return output.join('')
  }

  addModule(mod: Module): void {
    this.moduleIds.set(mod, this.getModuleId(mod))
    if (this.packages) this.packages.addModule(mod)
  }

  // The resulting code is indented with 2 spaces.
  async compileModule(code: string, mod: Module): Promise<string> {
    let id: any = this.moduleIds.get(mod)
    if (typeof id == 'string') id = `'${id}'`

    // Replace import paths with module IDs.
    code = replaceImportPaths(mod, code, this.moduleIds)

    // Define the module for the `require` polyfill.
    return [
      '',
      '  __d(' + id + ', function(module, exports) {',
           indentLines(code, 2),
      '  })',
      '',
    ].join('\n')
  }

  deleteModule(mod: Module): void {
    if (this.moduleIds.delete(mod)) {
      const map = this.packages
      if (map) {
        const pkg = mod.file.package
        const mods = map.getModules(pkg)
        if (mods && mods.length > 1) {
          mods.splice(mods.indexOf(mod), 1)
        } else {
          this._deletePackage(pkg)
        }
      }
    } else {
      throw Error(`Module not in bundle: '${mod.file.path}'`)
    }
  }

  // Simple number IDs in production.
  _prodModuleId(mod: Module) {
    return this.bundle.order.length
  }

  // String IDs for easier debugging.
  _devModuleId(mod: Module) {
    const map: PackageMap = (this.packages: any)
    const pkg = mod.file.package
    const pkgId = this._getPackageId(pkg, map)

    let moduleId = pkgId
    if (mod.file != map.getMain(pkg)) {
      const fileId = path.relative(pkg.path, mod.file.path)
      if (fileId.endsWith('/index.js')) {
        moduleId += '/' + path.dirname(fileId)
      } else {
        moduleId += '/' + fileId
      }
    }
    return moduleId
  }

  _getPackageId(pkg: Package, map: PackageMap): string {
    let id: ?string
    if (id = this.packageIds.get(pkg)) {
      return id
    } else {
      const versions = map.getVersions(pkg.name)
      if (versions) {
        if (versions.size == 1) {
          versions.forEach((pkg, version) =>
            this._renamePackage(pkg, pkg.name + '@' + version))
        }
        id = pkg.name + '@' + pkg.version
      } else {
        id = pkg.name
      }
      map.addPackage(pkg)
      this.packageIds.set(pkg, id)
      return id
    }
  }

  _renamePackage(pkg: Package, nextId: string): void {
    const map: PackageMap = (this.packages: any)
    const prevId = this.packageIds.get(pkg)
    if (nextId != prevId) {
      const {bundle} = this
      this.packageIds.set(pkg, nextId)
      map.getModules(pkg).forEach(mod => {
        this.moduleIds.set(mod, this.getModuleId(mod))
        if (bundle.hasCompiled && !mod.isDeleted) {
          bundle.missing.delete(mod)
          bundle.changed.add(mod)

          // Force parents to resolve this module again.
          mod.parents.forEach(parent => {
            bundle.changed.add(parent)
            parent.unlink(mod)
          })
        }
      })
    } else {
      throw Error(`Package not in bundle: '${pkg.path}'`)
    }
  }

  _deletePackage(pkg: Package): void {
    const map = this.packages
    if (map) {
      map.deletePackage(pkg)
      this.packageIds.delete(pkg)
      const versions = map.getVersions(pkg.name)
      if (versions && versions.size == 1) {
        versions.forEach(pkg =>
          this._renamePackage(pkg, pkg.name))
      }
    }
  }
}

//
// Internal
//

function renderGlobals(globals: ?Object, dev: boolean): string {
  const output = [`  var __DEV__ = ${(dev: any)};`]
  if (globals) {
    for (let key in globals) {
      let value = globals[key]
      if (typeof value == 'function') {
        value = value(dev)
      }
      value = JSON.stringify(value)
      output.push(`  var ${key} = ${value};`)
    }
  }
  output.push('')
  return output.join('\n')
}

function readPolyfill(file: string): string {
  if (!path.isAbsolute(file)) {
    file = require.resolve('../../../polyfills/' + file)
  }
  return indentLines(fs.readFile(file), 1) + '\n'
}

function replaceImportPaths(
  mod: Module,
  input: string,
  moduleIds: Map<Module, string>
): string {
  const {imports} = mod.file
  if (imports) {
    // The `mod.imports` object isn't sorted because refs are resolved
    // asynchronously. We can avoid unnecessary string operations if
    // we sort the imports using a sparse array.
    const sorted = []
    forEach(mod.imports, (dep, ref) => {
      const match: any = imports.get(ref)
      sorted[match.index] = {ref, mod: dep}
    })

    const output = []
    let inputIndex = 0
    sorted.forEach((dep, index) => {
      const depId = moduleIds.get(dep.mod)
      if (dep.ref != depId) {
        output.push(input.slice(inputIndex, index), depId)
        inputIndex = index + dep.ref.length
      }
    })
    output.push(input.slice(inputIndex))
    return output.join('')
  }
  return input
}

// Insert space before each line.
function indentLines(code: string, depth: number): string {
  code = code.replace(trimLineBreakRE, '')
  if (depth <= 0) {
    return code
  } else {
    let indent = '  '
    if (depth > 1) {
      indent = new Array(depth).fill(indent).join('')
    }
    if (indent != code.slice(0, indent.length)) {
      code = indent + code
    }
    return code.replace(lineBreakRE, '\n' + indent)
  }
}
