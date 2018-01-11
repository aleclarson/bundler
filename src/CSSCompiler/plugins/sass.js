// @flow

// TODO: Source map support
// TODO: Load `node-sass` version specified by each package?

import type Package from '../../Package'
import type Module from '../../Bundle/Module'

import {lazyRequire} from '../../utils/lazyInstall'
import Plugin from '../../Plugin'

let sass: any

class SassPlugin extends Plugin {
  static fileTypes = {
    '.scss': '.css',
    '.sass': '.css',
  }

  async load() {
    sass = await lazyRequire('node-sass')
  }

  transform(input: string, pkg: Package): Promise<string> {
    const config = pkg.meta.sass || {}
    return new Promise((resolve, reject) => {
      sass.render({
        data: input,
        linefeed: config.linefeed,
        indentType: config.indentType,
        indentWidth: config.indentWidth,
        outputStyle: config.outputStyle,
      }, (error: ?Error, result: {css: string}) => {
        if (error) return reject(error)
        resolve(result.css.toString().trim())
      })
    })
  }
}

module.exports = SassPlugin
