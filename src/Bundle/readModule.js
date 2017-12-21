// @flow

import noop from 'noop'
import fs from 'fsx'

import type Bundle, {Module} from '../Bundle'
import type {ResolveListener} from './resolveImports'

import {forEach} from '../utils'
import {parseImports} from './parseImports'
import {resolveImports} from './resolveImports'
import {getOutputType, transformFile} from '../plugins'

// Called when a module stops depending on another.
type UnlinkListener = (mod: Module, dep: Module) => void

export async function readModule(
  mod: Module,
  bundle: Bundle,
  onResolve: ResolveListener,
  onUnlink: UnlinkListener,
): Promise<string> {
  const {file} = mod

  // Read the module and apply any transforms.
  const code = await transformFile(fs.readFile(file.path), file)

  // Keep previous imports so we can unlink removed refs.
  const prevImports = file.imports

  // Parse its dependencies.
  const nextImports = parseImports(getOutputType(file.type), code)

  // Update the file object.
  file.imports = nextImports

  // Resolve dependencies, if any exist.
  if (nextImports && nextImports.size) {

    // Resolve new dependencies.
    resolveImports(mod, bundle, onResolve)

    // Remove old dependencies.
    if (prevImports && prevImports.size) {
      const resolved = mod.imports
      forEach(resolved, (dep, ref) => {
        if (!nextImports.has(ref)) {
          delete resolved[ref]
          unlink(mod, dep)
        }
      })
    }
  }

  // Remove old dependencies.
  else if (prevImports && prevImports.size) {
    forEach(mod.imports, (dep) => unlink(mod, dep))
    mod.imports = {}
  }

  // Unlink a module and an old dependency.
  function unlink(mod: Module, dep: Module) {
    dep.parents.delete(mod)
    onUnlink(mod, dep)
  }

  return code
}
