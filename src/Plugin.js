// @flow

import type Package from './Package'
import type File from './File'

export default class Plugin {
/*::
  // Equals true if `load` method has been called.
  loaded: boolean;

  // Plugins with higher priority are used first.
  priority: number;

  // Some plugins configure file types per instance.
  fileTypes: ?string[];
*/
  constructor() {
    this.loaded = false
    this.priority = 0
  }

  // The file types compatible with this plugin.
  static fileTypes: string[] = []

  // Many plugins convert files into a new format.
  getOutputType(fileType: string): ?string {
    return null
  }

  // This method is called when the first compatible package is found.
  load(): void {}

  // Most plugins inspect each file to determine compatibility.
  loadFile(file: File): boolean {
    return this.constructor.fileTypes.includes(file.type)
  }

  // Some plugins inspect each package to determine compatibility.
  loadPackage(pkg: Package): boolean {
    return true
  }
}
