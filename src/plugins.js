// @flow

import type File from './File'
import Plugin from './Plugin'

import {traverse} from './utils'

type PluginRegistry = {
  [string]: Plugin[]
}

// List of plugins per file type
const registry: PluginRegistry = {}

export function addPlugin(plugin: mixed): void {
  if (typeof plugin == 'function') {
    plugin = new plugin()
  }
  if (!(plugin instanceof Plugin)) {
    throw TypeError('All plugins must inherit from the `Plugin` class')
  }
  let fileTypes: string[]
  if (Array.isArray(plugin.fileTypes)) {
    fileTypes = plugin.fileTypes
  } else {
    fileTypes = Object.keys(plugin.fileTypes)
  }
  for (let i = 0; i < fileTypes.length; i++) {
    const fileType = fileTypes[i]
    const plugins = registry[fileType]
    if (plugins) {
      let index = 0
      while (plugin.priority <= plugins[index].priority) {
        if (++index == plugins.length) break
      }
      plugins.splice(index, 0, plugin)
    } else {
      registry[fileType] = [plugin]
    }
  }
}

export function getPlugins(fileType: string): Plugin[] {
  return registry[fileType] || []
}
