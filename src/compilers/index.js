// @flow

import type Bundle, {Module} from '../Bundle'
import type Package from '../Package'

export interface Compiler {
  bundle: Bundle;
  compile(modules: string[], config: Object): string | Promise<string>;
  addModule(mod: Module): void;
  compileModule(code: string, mod: Module): string | Promise<string>;
  deleteModule(mod: Module): void;
}

export interface CompilerType {
  match(bundle: Bundle): boolean;
  create(bundle: Bundle): Object;
}

const compilers: CompilerType[] = [
  require('./JSCompiler'),
]

// Create an object where the compiler is the prototype.
// Use this object to compile the associated bundle.
export function loadCompiler(bundle: Bundle): Compiler {
  for (let i = 0; i < compilers.length; i++) {
    const compiler = compilers[i]
    if (compiler.match(bundle)) {
      return compiler.create(bundle)
    }
  }
  throw Error(`No compiler for bundle: '${bundle.main.path}'`)
}

export function addCompiler(compiler: CompilerType): void {
  compilers.push(compiler)
}
