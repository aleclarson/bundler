// @flow

// TODO: Group modules in the same package together.
// TODO: Use a worker farm for loading modules?

import AsyncTaskGroup from 'AsyncTaskGroup'
import noop from 'noop'

import type Bundle, {Module} from '../Bundle'

import {resolveImports} from './resolveImports'
import {loadModule} from './loadModule'
import workers from '../utils/workers'

type CompilerConfig = {
  onStop: Function,
}

// Generate a bundle from scratch.
export async function compileBundle(
  bundle: Bundle,
  config: CompilerConfig,
): Promise<string> {
  let stopped = false
  config.onStop(function() {
    stopped = true
  })

  // The build tag prevents duplicate modules.
  const buildTag = bundle._buildTag

  // The ordered list of resolved modules.
  const modules: Module[] = []

  // Module refs that cannot be resolved.
  const missing = new Map()

  // Limit the number of modules loading at once.
  const loading = new AsyncTaskGroup(1)

  // Start with the main module.
  addModule(bundle.main)

  process.nextTick(() => workers.flushAll())

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
      process.nextTick(() => workers.flushAll())
    })
    console.log('numConcurrent = ' + loading.numConcurrent)
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
    bundle._dirty = true
    bundle._events.emit('missing', missing)
  }

  // Keep the module list for debugging purposes.
  bundle._modules = modules

  const timer = global.bundleTimer('joinModules')

  // The compiler handles the rest.
  const res = bundle._compiler.joinModules(modules, config)

  timer.done()
  return res
}
