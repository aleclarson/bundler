// @flow

// TODO: Install `postcss` lazily
// TODO: Source map support

import type Package from '../../Package'
import type File from '../../File'
import Plugin from '../../Plugin'

import {lazyRequire} from '../../utils/lazyInstall'
import {log} from '../../logger'

let postcss: any

class PostCssPlugin extends Plugin {
  static fileTypes = ['.css']

  async load(): Promise<void> {
    postcss = await lazyRequire('postcss')
  }

  loadPackage(pkg: Package) {
    const plugins = pkg.meta.postcss
    if (Array.isArray(plugins)) {
      pkg.meta.postcss = plugins.map(plugin => {
        let config: Object
        if (Array.isArray(plugin)) {
          config = plugin[1]
          plugin = plugin[0]
        } else if (typeof plugin != 'string') {
          throw TypeError(`Invalid "postcss" configuration in package: '${pkg.path}'`)
        }
        const dep = pkg.findDependency(plugin, true)
        if (dep) {
          try {
            return (require: any)(dep)(config)
          } catch(error) {
            throw Error(`An error occurred when loading '${plugin}'` +
              ` for package: '${pkg.path}'\n  ${error.message}`)
          }
        }
        throw Error(`Cannot find '${plugin}' used by package: '${pkg.path}'`)
      })
      return true
    }
    return false
  }

  async transform(data: string, pkg: Package): Promise<string> {
    const result = await postcss(pkg.meta.postcss).process(data)
    result.warnings().forEach(warning => {
      log.warn(warning.toString())
    })
    return result.css
  }
}

module.exports = PostCssPlugin
