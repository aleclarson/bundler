// @flow

// TODO: Support interoperability between SASS, Stylus, LESS, etc
// TODO: Group modules by package when appending 2+ packages

import type CSSPackage from './Package'
import type Module from '../Bundle/Module'
import Patcher from '../Bundle/Patcher'

import {applyPlugins} from './applyPlugins'

class CSSPatcher extends Patcher {

  indexOf(mod: Module): number {
    // TODO: Find module's package
    return mod._index
  }

  shiftModules(after: Module, amount: number): void {

  }

  // TODO: Transform each package individually (start with zero-dep packages)
  didPatch(payload: string): Promise<string> {
    return applyPlugins(payload, this.bundle)
  }
}
