// @flow

// TODO: Auto-upgrade package if duplicate has higher minor/patch version.

import type Bundle, {Module} from '../Bundle'
import type File, {Platform} from '../File'
import type Package from '../Package'

import path from 'path'

type PackageCache = {
  [name: string]: ?Map<string, Package>
}

export default class PackageMap { /*::
  platform: Platform;
  packages: PackageCache;
  modules: Map<Package, Module[]>;
  mains: Map<Package, File>;
*/
  constructor(platform: Platform) {
    this.platform = platform
    this.packages = {}
    this.modules = new Map()
    this.mains = new Map()
  }

  getPackage(name: string, version: string): ?Package {
    const packages = this.packages[name]
    if (packages) return packages.get(version)
  }

  getMain(pkg: Package): File {
    const main = this.mains.get(pkg)
    if (main) return main
    throw Error(`Package not in bundle: '${pkg.path}'`)
  }

  // For the given package, return its modules being used.
  getModules(pkg: Package): Module[] {
    return this.modules.get(pkg) || []
  }

  // For the given package name, return all versions being used.
  getVersions(name: string): ?Map<string, Package> {
    return this.packages[name]
  }

  addPackage(pkg: Package): void {
    const main = pkg.resolveMain(this.platform)
    if (!main) {
      throw Error(
        `Missing main module:\n` +
        `  package = '${pkg.path}'\n` +
        `  platform = '${this.platform}'`
      )
    }
    const versions = this.packages[pkg.name]
    if (versions) {
      versions.set(pkg.version, pkg)
    } else {
      this.packages[pkg.name] = new Map([
        [pkg.version, pkg]
      ])
    }
    pkg.hold()
    this.mains.set(pkg, main)
    this.modules.set(pkg, [])
  }

  deletePackage(pkg: Package): void {
    const versions = this.packages[pkg.name]
    if (versions) {
      pkg.drop()
      if (versions.size == 1) {
        delete this.packages[pkg.name]
      } else {
        versions.delete(pkg.version)
      }
      this.mains.delete(pkg)
      this.modules.delete(pkg)
    } else {
      throw Error(`Package not in bundle: '${pkg.path}'`)
    }
  }

  addModule(mod: Module): void {
    const mods = this.modules.get(mod.package)
    if (mods) mods.push(mod)
  }
}
