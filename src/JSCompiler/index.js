// @flow

// TODO: Rename package@x.x.x if its conflicting package is removed.
// TODO: Support for @module in libraries
// TODO: Support changing package version

import path from 'path'
import fs from 'fsx'

import type Package from '../Package'
import type Bundle from '../Bundle'
import type File from '../File'
import Compiler from '../Compiler'

import {forEach} from '../utils'
import PackageMap from './PackageMap'
import Module from '../Bundle/Module'

const lineBreakRE = /\n/g
const trimLineBreakRE = /(^\n|\n$)/g

export class JSCompiler extends Compiler { /*::
  moduleIds: Map<Module, any>
  packageIds: Map<Package, string>
  getModuleId: (mod: Module) => any
  moduleCount: number
  packages: ?PackageMap
*/
  constructor(bundle: Bundle) {
    super(bundle)
    this.moduleIds = new Map()
    this.packageIds = new Map()
    if (bundle.dev) {
      this.getModuleId = this._devModuleId
      this.moduleCount = -1
      this.packages = new PackageMap(bundle.platform)
    } else {
      this.getModuleId = this._prodModuleId
      this.moduleCount = 0
    }
  }

  static match = (bundle: Bundle) => {
    return bundle.type == '.js'
  }

  static plugins = [
    require('./plugins/babel'),
    require('./plugins/typescript'),
  ]

  async joinModules(modules: Module[], config: Object): Promise<string> {
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

    const output = [
      prelude.join('\n')
    ]

    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i]
      const body = this.wrapModule(mod)
      output.push(body)
    }

    const mainId = this.moduleIds.get(modules[0])
    output.push('\n  require(' + formatId(mainId) + ')\n})()')

    return output.join('')
  }

  createModule(file: File): Module {
    const mod = new Module(file)
    this.moduleIds.set(mod, this.getModuleId(mod))
    if (this.packages) this.packages.addModule(mod)
    return mod
  }

  async loadModule(mod: Module): Promise<void> {
    await this.transform(mod)
    this.parseImports(mod)
  }

  // The resulting code is indented with 2 spaces.
  wrapModule(mod: Module): string {
    const id = this.moduleIds.get(mod)
    if (id == null) {
      throw Error('Module has no identifier: ~/' + this.bundle.relative(mod.path))
    }

    // Replace import paths with module IDs.
    const output = replaceImportPaths(mod, this.moduleIds)

    // Define the module for the `require` polyfill.
    return [
      '',
      '  __d(' + formatId(id) + ', function(module, exports) {',
           indentLines(output, 2),
      '  })',
      '',
    ].join('\n')
  }

  deleteModule(mod: Module): void {
    if (this.moduleIds.delete(mod)) {
      const map = this.packages
      if (map) {
        const pkg = mod.package
        const mods = map.getModules(pkg)
        if (mods && mods.length > 1) {
          mods.splice(mods.indexOf(mod), 1)
        } else {
          this._deletePackage(pkg)
        }
      }
    } else {
      throw Error(`Module not in bundle: '${mod.path}'`)
    }
  }

  // Simple number IDs in production.
  _prodModuleId(mod: Module) {
    return ++this.moduleCount
  }

  // String IDs for easier debugging.
  _devModuleId(mod: Module) {
    const map: PackageMap = (this.packages: any)
    const pkg = mod.package
    const pkgId = this._getPackageId(pkg, map)

    let moduleId = pkgId
    if (mod.file != map.getMain(pkg)) {
      const fileId = path.relative(pkg.path, mod.path)
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

function formatId(id: mixed): any {
  return typeof id == 'string' ? `'${id}'` : id
}

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
    file = require.resolve('../../polyfills/' + file)
  }
  return indentLines(fs.readFile(file), 1) + '\n'
}

function replaceImportPaths(
  mod: Module,
  moduleIds: Map<Module, string>
): string {
  const input = mod.read()
  const {imports} = mod.file
  if (mod.imports && imports) {
    // The `mod.imports` map isn't sorted by default, so we
    // sort it with a sparse array to improve efficiency.
    const sorted = []
    mod.imports.forEach((dep, ref) => {
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
