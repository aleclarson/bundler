// @flow

import type Package from '../../Package'
import type Module from '../../Bundle/Module'
import Plugin from '../../Plugin'

import {lazyRequire} from '../../utils/lazyRequire'

let coffee: any

class CoffeePlugin extends Plugin {
  static fileTypes = {'.coffee': '.js'}

  async load() {
    coffee = await lazyRequire('coffeescript')
  }

  transform(mod: Module, pkg: Package) {
    mod._body = coffee.compile(mod._body, {
      bare: true,
    })
  }
}

module.exports = CoffeePlugin
