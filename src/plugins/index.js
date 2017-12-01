// @flow

import type Package from '../Package'

type PluginCache = { [string]: Plugin }
type Plugin = {
  isLoaded: boolean,
  loadPlugin: () => void,
  loadPackage: (pkg: Package) => ?boolean,
}

const plugins: PluginCache = {
  babel: require('./babel'),
  typescript: require('./typescript'),
}

export function getPlugin(pluginId: string): Object {
  return plugins[pluginId]
}

export function loadPlugins(pkg: Package): string[] {
  const loaded = []
  for (const pluginId in plugins) {
    const plugin = plugins[pluginId]
    if (plugin.loadPackage(pkg)) {
      loaded.push(pluginId)
      if (!plugin.isLoaded) {
        plugin.loadPlugin()
        plugin.isLoaded = true
      }
    }
  }
  return loaded
}
