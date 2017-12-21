// @flow

// TODO: Install `node-sass` lazily
// TODO: Source map support

import type File from '../../File'
import Plugin from '../../Plugin'

const loadModule = (require: any)

let sass: any

class SassPlugin extends Plugin {
  static fileTypes = ['.scss', '.sass']

  getOutputType(fileType: string) {
    return '.css'
  }

  load() {
    sass = loadModule('node-sass')
  }

  transform(code: string, file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      sass.render({
        data: code,
        file: file.path,
      }, (error: Error, result: {css: string}) => {
        if (error) return reject(error)
        resolve(result.css.toString().trim())
      })
    })
  }
}

module.exports = SassPlugin
