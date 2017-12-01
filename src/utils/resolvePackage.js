// @flow

import path from 'path'
import fs from 'fsx'

const homedir = require('os').homedir()

export function resolvePackage(file: string): string {
  if (!path.isAbsolute(file)) {
    throw Error(`Must provide an absolute path: '${file}'`)
  }
  let dir = file
  while ((dir = path.dirname(dir)) != homedir) {
    const pkgJson = path.join(dir, 'package.json')
    if (fs.isFile(pkgJson)) return dir
  }
  throw Error(`Failed to resolve package for file: '${file}'`)
}
