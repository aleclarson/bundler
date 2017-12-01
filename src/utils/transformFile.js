
import {getPlugin} from '../plugins'
import File from '../File'

// TODO: Support multiple transformers in a package.
export default function transformFile(code: string, file: File): string {
  const plugin = findTransformer(file.package.plugins)
  if (plugin) {
    return plugin.transform(code, file.package.meta)
  } else {
    return code
  }
}

function findTransformer(pluginIds: string[]): ?Object {
  for (let i = 0; i < pluginIds.length; i++) {
    const plugin = getPlugin(pluginIds[i])
    if (typeof plugin.transform == 'function') {
      return plugin
    }
  }
}
