// @flow

import huey from 'huey'
import path from 'path'
import os from 'os'

import {installPackage} from './installPackage'

// Packages are stored in `~/.cara/packages`
const PACKAGE_DIR = path.join(os.homedir(), '.cara/packages')

export async function lazyRequire(name: string): Promise<any> {
  const dep = path.join(PACKAGE_DIR, name)
  try {
    require.resolve(dep)
  } catch(e) {
    console.log(huey.red(e.message))
    console.log('Installing package: ' + huey.yellow(name))
    await installPackage(name, PACKAGE_DIR)
  }
  return require(dep)
}
