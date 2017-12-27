// @flow

import type Package from './Package'
import type Module from './Bundle/Module'
import type File from './File'

type FileTypes = string[] | {[string]: string}

export default class Plugin {
/*::
  // Equals true if `load` method has been called.
  loaded: boolean

  // Plugins with higher priority are used first.
  priority: number

  // Some plugins configure file types per instance.
  fileTypes: ?FileTypes
*/
  constructor() {
    this.loaded = false
    this.priority = 0
    this.fileTypes = this.constructor.fileTypes
  }

  static fileTypes: ?FileTypes

  convert(fileType: string): string {
    const {fileTypes} = this
    if (fileTypes && !Array.isArray(fileTypes)) {
      return fileTypes[fileType] || fileType
    }
    return fileType
  }

  // This method is called when the first compatible package is found.
  load(): ?Promise<void> {}

  // Most plugins inspect each file to determine compatibility.
  loadFile(file: File): boolean {
    const {fileTypes} = this
    if (!fileTypes) {
      return true
    } else if (Array.isArray(fileTypes)) {
      return fileTypes.includes(file.type)
    } else {
      return fileTypes.hasOwnProperty(file.type)
    }
  }

  // Some plugins inspect each package to determine compatibility.
  loadPackage(pkg: Package): boolean {
    return true
  }
}
