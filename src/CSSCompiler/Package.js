// @flow

import type Module from '../Bundle/Module'

export default class CSSPackage { /*::
  plain: boolean
  modules: Module[]
  parents: CSSPackage[]
*/
  constructor() {
    this.plain = true
    this.modules = []
    this.parents = []
  }

  // Check if package contains only *.css modules.
  // This is only called when a module is deleted.
  _isPlain() {
    const {modules} = this
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i]
      if (mod.type != '.css') {
        return false
      }
    }
    return true
  }

  // Check if the first parent of this package (and every ancestor)
  // contains only *.css modules.
  _hasPlainParents(): boolean {
    if (this.plain) {
      const parent = this.parents[0]
      if (parent) return parent._hasPlainParents()
    }
    return false
  }
}
