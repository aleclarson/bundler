// @flow

// TODO: Support scoped package names

import {exec} from 'child_process'

import getRegistryAuthToken from 'registry-auth-token'
import getRegistryUrl from 'registry-auth-token/registry-url'
import quest from 'quest'
import zlib from 'zlib'
import path from 'path'
import huey from 'huey'
import tar from 'tar-fs'
import fs from 'fsx'

// Download the latest version of the given package,
// then extract it into the given dest directory.
export async function installPackage(
  name: string,
  dest: string,
): Promise<void> {
  const auth = getRegistryAuthToken()
  const headers = {
    Authorization: `${auth.type} ${auth.token}`
  }

  // Fetch package information
  let url = getRegistryUrl() + name
  const pkg = await quest.json(url, headers)
  if (!pkg) {
    throw Error('Missing package info: ' + url)
  }

  // Install the latest version
  const version = pkg['dist-tags'].latest
  const filename = name + '-' + version

  // Ensure the parent directory exists
  fs.writeDir(dest)

  // Where the package is installed
  const pkgPath = path.join(dest, name)

  return new Promise((resolve, reject) => {
    url += `/-/${filename}.tgz`

    // The tarball's temporary directory
    const tmp = path.join(dest, filename)

    // Fetch the tarball
    quest.stream(url, headers)
    .on('error', onError)

    // Unzip the tarball
    .pipe(zlib.createGunzip())
    .on('error', onError)

    // Extract the tarball
    .pipe(tar.extract(tmp))
    .on('error', onError)
    .on('finish', () => {

      // Rename the 'package' subdirectory
      const cwd = process.cwd()
      process.chdir(dest)
      fs.rename(path.join(tmp, 'package'), pkgPath)
      fs.removeDir(tmp)
      process.chdir(cwd)

      // Install any dependencies
      installDependencies(pkgPath).then(resolve, reject)
    })

    function onError(error) {
      this.end()
      reject(error)
    }
  })
}

function installDependencies(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = 'npm install --silent --no-shrinkwrap'
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
