// @flow

// First build:
//   - Group modules into packages
//   - Cache pristine bundle (before plugins)

// Patching:
//   - Added/deleted modules
//   - Added/deleted packages

// TODO: Inline imports instead of hoisting to above the module?
// TODO: Non *.css files must be recompiled when an dependency is changed.
// TODO: A package can only use one preprocessor, but not all packages
//       are forced to use the same preprocessor.
// TODO: Convert url(*.png) into base64 data URI
// TODO: Source map support

import type Package from '../Package'
import type Plugin from '../Plugin'
import type Bundle from '../Bundle'
import type File from '../File'

import {applyPlugins} from './applyPlugins'
import {huey} from '../logger'
import Module from '../Bundle/Module'
import Compiler from '../Compiler'
import CSSPackage from './Package'

export class CSSCompiler extends Compiler { /*::
  tree: Map<Package, CSSPackage>
  preplug: string
*/
  constructor(bundle: Bundle) {
    super(bundle)
    this.tree = new Map()
    this.preplug = ''
  }

  static match = (bundle: Bundle) => {
    return bundle.type == '.css'
  }

  static plugins = [
    require('./plugins/postcss'),
    require('./plugins/sass')
  ]

  get root(): Package {
    return this.bundle.main.package
  }

  createModule(file: File) {
    console.log(huey.cyan('add: ') + '~/' + this.bundle.relative(file.path))

    let pkg = this.tree.get(file.package)
    if (!pkg) this.tree.set(file.package, pkg = new CSSPackage())
    if (pkg.plain && file.type != '.css') {
      pkg.plain = false
    }

    const mod = new Module(file)
    pkg.modules.push(mod)
    return mod
  }

  loadModule(mod: Module): void {
    const pkg = this.tree.get(mod.package)
    // TODO: 
    this.parseImports(mod)
  }

  async wrapModule(body: string, mod: Module): Promise<void> {
    // TODO: Determine if imports should be nested within this module.
  }

  deleteModule(mod: Module): void {
    // TODO: Find new location of imports (if still used).
    console.log(huey.red('delete: ') + '~/' + this.bundle.relative(mod.path))
    if (mod.imports) {
      mod.imports.forEach(dep => {

      })
    }
  }

  // TODO: Update `mod.index` relative to parent module
  async joinModules(config: Object): Promise<string> {
    const {bundle} = this

    const output: string[] = []

    let outputIndex = 0

    // 1. Group modules by package
    // 2. Transform independent packages first
    // 3. Inline dependencies, remove superfluous imports

    // TODO: Set `_index` and `_length` of each module

    // for (let i = 0; i < modules.length; i++) {
    //   const mod = modules[i]
    //   const body = mod._body || ''
    //
    //   // This includes length of nested modules.
    //   mod.index = outputIndex
    //   mod.length = body.length
    //
    //   output.push(body)
    //   outputIndex += mod.length
    // }

    // Cache the bundle before plugins are applied.
    this.preplug = output.join('')

    return applyPlugins(this.preplug, bundle)
  }

  // async wrapPackage(pkg: Package): Promise<string> {
  //
  // }
}
