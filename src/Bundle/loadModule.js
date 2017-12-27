// @flow

import noop from 'noop'
import fs from 'fsx'

import type Bundle, {Module} from '../Bundle'
import type {ResolveListener} from './resolveImports'

import {huey} from '../logger'
import {resolveImports} from './resolveImports'

type UnlinkListener = (dep: Module, parent: Module) => void

export async function loadModule(
  mod: Module,
  bundle: Bundle,
  onResolve: ResolveListener = noop,
  onUnlink: UnlinkListener = noop,
): Promise<void> {
  const {file} = mod

  // Read the module into memory.
  mod._body = fs.readFile(file.path)

  // Reset the module type.
  mod.type = file.type

  // Keep previous imports so we can unlink old dependencies.
  const prevImports = file.imports

  // Let the compiler parse and transform the body.
  await bundle._compiler.loadModule(mod)

  const nextImports = file.imports
  if (nextImports != prevImports) {
    const resolved = mod.imports

    // Resolve new dependencies.
    if (nextImports) {
      if (!resolved) mod.imports = new Map()
      resolveImports(mod, bundle, onResolve)

      // Unlink old dependencies.
      if (prevImports && resolved) {
        resolved.forEach((dep: Module, ref: string) => {
          if (!nextImports.has(ref)) {
            resolved.delete(ref)
            dep.parents.delete(mod)
            onUnlink(dep, mod)
          }
        })
      }
    }

    // Unlink old dependencies.
    else if (prevImports && resolved) {
      mod.imports = null
      resolved.forEach(dep => {
        dep.parents.delete(mod)
        onUnlink(dep, mod)
      })
    }
  }
}
