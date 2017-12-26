// @flow

// TODO: Source map support

import type Package from '../../Package'
import type Module from '../../Bundle/Module'

import {lazyRequire} from '../../utils/lazyRequire'
import Plugin from '../../Plugin'

let sass: any

class SassPlugin extends Plugin {
  static fileTypes = {
    '.scss': '.css',
    '.sass': '.css',
  }

  async load() {
    // TODO: Load `node-sass` version specified by each package?
    sass = await lazyRequire('node-sass')
  }

  // async transform(mod: Module, pkg: Package): Promise<void> {
  //   const imports = mod.imports || new Map()
  //   const config = pkg.meta.sass || {}
  //   const input = mod._code || ''
  //   const output = await this.render(input, {
  //     file: mod.path,
  //     linefeed: config.linefeed,
  //     indentType: config.indentType,
  //     indentWidth: config.indentWidth,
  //     outputStyle: config.outputStyle,
  //     importer(ref: string, from: string) {
  //       imports.get(ref)
  //     }
  //   })
  // }

  transform(input: string, config: Object): Promise<string> {
    return new Promise((resolve, reject) => {
      config = {...config, data: input}
      sass.render(config, (error: ?Error, result: {css: string}) => {
        if (error) return reject(error)
        // mod._body = result.css.toString().trim()
        // mod.type = '.css'
        // resolve()
      })
    })
  }
}

module.exports = SassPlugin
