// @flow

import type Bundle, {Module} from './Bundle'
import type Compiler from './Compiler'
import type Package from './Package'

import {addPlugin} from './plugins'

const compilers: Class<Compiler>[] = []

// Built-in compilers
import {JSCompiler} from './JSCompiler'
import {CSSCompiler} from './CSSCompiler'

addCompiler(JSCompiler)
addCompiler(CSSCompiler)

export function addCompiler(compiler: Class<Compiler>): void {
  if (compiler.plugins) {
    compiler.plugins.forEach(addPlugin)
  }
  compilers.push(compiler)
}

export function loadCompiler(bundle: Bundle): Compiler {
  let index = compilers.length
  while (--index >= 0) {
    const compiler = compilers[index]
    if (compiler.match(bundle)) {
      return new compiler(bundle)
    }
  }
  throw Error(`No compiler for bundle: '${bundle._main.path}'`)
}
