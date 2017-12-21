// @flow

// TODO: Install `postcss` lazily
// TODO: Source map support

import type Package from '../../Package'
import type File from '../../File'
import Plugin from '../../Plugin'

const loadModule = (require: any)

class PostCssPlugin extends Plugin {
  static fileTypes = ['.css']

  loadPackage(pkg: Package) {
    const plugins = pkg.meta.postcss
    if (Array.isArray(plugins)) {
      const postcss = loadModule('postcss')
      pkg.meta._postcss = postcss(plugins.map(plugin => {
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
            return loadModule(dep)(config)
          } catch(error) {
            throw Error(`An error occurred when loading '${plugin}'` +
              ` for package: '${pkg.path}'\n  ${error.message}`)
          }
        }
        throw Error(`Cannot find '${plugin}' used by package: '${pkg.path}'`)
      }))
      return true
    }
    return false
  }

  async transform(code: string, file: File): Promise<string> {
    const postcss = file.package.meta._postcss
    const config = {from: file.path}
    return (await postcss.process(code, config)).css
  }
}

module.exports = PostCssPlugin
