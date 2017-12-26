// @flow

import type Bundle from '../Bundle'

interface Plugin {
  convert(fileType: string): string,
  transform(input: string): string,
}

// Currently, only the plugins for the bundle's root package are
// applied to the given payload. Eventually, plugin support for
// dependencies will be added.
export async function applyPlugins(
  payload: string,
  bundle: Bundle,
): Promise<string> {
  const pkg = bundle.main.package
  if (Object.keys(pkg.plugins).length) {
    const main = bundle.getModule(bundle.main)
    if (!main) throw Error('Missing main module')

    while (true) {
      const {type} = main
      const plugins = pkg.plugins[type]
      if (plugins) {
        for (let i = 0; i < plugins.length; i++) {
          const plugin: Plugin = (plugins[i]: any)
          if (typeof plugin.transform == 'function') {
            payload = await plugin.transform(payload)
            main.type = plugin.convert(type)
            if (main.type != type) break
          }
        }
        if (main.type == type) {
          break
        }
      } else {
        break
      }
    }
  }
  return payload
}
