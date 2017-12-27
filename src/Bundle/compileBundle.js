// @flow

// TODO: Group modules in the same package together.
// TODO: Use a worker farm for loading modules?

import AsyncTaskGroup from 'AsyncTaskGroup'
import noop from 'noop'

import type Bundle, {Module} from '../Bundle'

import {resolveImports} from './resolveImports'
import {loadModule} from './loadModule'

type CompilerConfig = {
  onStop: Function,
}

// Generate a bundle from scratch.
export async function compileBundle(
  bundle: Bundle,
  config: CompilerConfig,
): Promise<string> {
  const main = bundle.getModule(bundle.main)
  if (!main) throw Error('Missing main module')

  let stopped = false
  config.onStop(function() {
    stopped = true
  })

  // The build tag prevents duplicate modules.
  const buildTag = ++bundle._buildTag

  // The ordered list of resolved modules.
  const modules: Module[] = [main]

  // Module refs that cannot be resolved.
  const missing = new Map()

  // Load one module at a time.
  const loading = new AsyncTaskGroup(1)

  // Start with the main module.
  await loadModule(main, bundle, onResolve, onUnlink)

  // Wait for all modules to load...
  await loading.push(noop).promise

  function addModule(mod: Module): void {
    mod._buildTag = buildTag
    modules.push(mod)
    loading.push(async () => {
      if (stopped) return
      if (mod._body == null) {
        await loadModule(mod, bundle, onResolve, onUnlink)
      }
      else if (mod._unresolved) {
        resolveImports(mod, bundle, onResolve)
      }
      else if (mod.imports) {
        mod.imports.forEach((dep, ref) => {
          onResolve(mod, ref, dep)
        })
      }
    })
  }

  // Add resolved dependencies to the bundle.
  function onResolve(parent: Module, ref: string, dep: ?Module) {
    if (stopped) return
    if (dep) {
      const mod = dep
      if (mod._buildTag != buildTag) {
        addModule(mod)
      }
    } else {
      let refs = missing.get(parent)
      if (!refs) missing.set(parent, refs = new Set)
      refs.add(ref)
    }
  }

  // Remove unused modules from the bundle.
  function onUnlink(mod: Module, parent: Module) {
    if (!mod.parents.size) {
      bundle._deleteModule(mod)
    }
  }

  // TODO: Salvage any work that was done?
  if (stopped) {
    bundle.reset()
    return ''
  }

  // Emit any unresolved refs.
  if (missing.size) {
    bundle._events.emit('missing', missing)
  }

  // Emit resolved modules for testing purposes.
  bundle._events.emit('modules', modules)

  // The compiler handles the rest.
  return bundle._compiler.joinModules(modules, config)
}
