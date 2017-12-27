// @flow

import {exec} from 'child_process'

import path from 'path'

import {huey} from '../logger'

// Packages are loaded from the `cara` directory.
const cwd = path.resolve(__dirname, '../..')

// Require a package relative to the given directory.
// If the package is missing, install from NPM.
export async function lazyRequire(name: string): Promise<any> {
  const main = path.join(cwd, 'node_modules', name)
  try {
    require.resolve(main)
  } catch(e) {
    await installPackage(name, cwd)
  }
  return require(main)
}

function installPackage(name: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = 'npm install --silent --no-save ' + name
    exec(cmd, {cwd}, (error, stdout, stderr) => {
      if (typeof stderr == 'string') {
        stderr = stderr.trim()
        if (stderr.length) {
          const prefix = huey.red('stderr: ')
          console.error(prefix + stderr.replace(/\n/g, '\n' + prefix))
        }
      }
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
