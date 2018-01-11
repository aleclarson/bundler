// @flow

import path from 'path'
import os from 'os'

import {installPackage} from './installPackage'
import {huey} from '../logger'

// Packages are stored in `~/.cara/packages`
const PACKAGE_DIR = path.join(os.homedir(), '.cara/packages')

// Avoid `flow` restriction.
const loadModule: any = require

export async function lazyInstall(name: string): Promise<string> {
  const dep = path.join(PACKAGE_DIR, name)
  try {
    require.resolve(dep)
  } catch(e) {
    console.log(huey.red(e.message))
    console.log('Installing package: ' + huey.yellow(name))
    await installPackage(name, PACKAGE_DIR).catch(error => {
      console.log('url = ' + error.url)
    })
  }
  return dep
}

export async function lazyRequire(name: string): Promise<any> {
  return loadModule(await lazyInstall(name))
}
