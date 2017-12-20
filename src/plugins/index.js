// @flow

import type File from '../File'
import Plugin from '../Plugin'

import {traverse} from '../utils'

// List of plugins per file type
const registry: { [string]: Plugin[] } = {}

// Default plugins
addPlugin(require('./babel'))
addPlugin(require('./postcss'))
addPlugin(require('./sass'))
addPlugin(require('./typescript'))

export function addPlugin(plugin: mixed): void {
  if (typeof plugin == 'function') {
    plugin = new plugin()
  }
  if (!(plugin instanceof Plugin)) {
    throw TypeError('All plugins must inherit from the `Plugin` class')
  }
  const fileTypes: string[] = plugin.fileTypes || plugin.constructor.fileTypes
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

export function getOutputType(fileType: string): string {
  while (true) {
    const plugins = getPlugins(fileType)
    let outputType: ?string
    for (let i = 0; i < plugins.length; i++) {
      if (outputType = plugins[i].getOutputType(fileType)) {
        fileType = outputType
        break
      }
    }
    if (!outputType) {
      break
    }
  }
  return fileType
}

export async function transformFile(code: string, file: File): Promise<string> {
  const plugins = file.package.plugins[file.type]
  if (plugins) {
    await traverse(plugins, async (plugin) => {
      if (typeof plugin.transform == 'function') {
        code = await plugin.transform(code, file)
      }
    })
  }
  return code
}
