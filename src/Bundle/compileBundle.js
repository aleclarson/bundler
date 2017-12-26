// @flow

// TODO: Group modules in the same package together.

import AsyncTaskGroup from 'AsyncTaskGroup'
import noop from 'noop'

import type Bundle, {Module} from '../Bundle'

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

  // Track which module was last added.
  let prev = main

  // Module refs that cannot be resolved.
  const missing = new Map()

  // Load one module at a time.
  const loading = new AsyncTaskGroup(1)

  // Add resolved dependencies to the bundle.
  function onResolve(parent: Module, ref: string, dep: ?Module) {
    if (stopped) return
    if (dep) {
      const mod = dep
      if (mod._status == 201) {
        mod._status = 200
        prev = prev._next = mod
        loading.push(async () => {
          if (stopped) return
          await loadModule(mod, bundle, onResolve)
        })
      }
    }
    else if (parent._status == 404) {
      // $FlowFixMe
      missing.get(parent).add(ref)
    }
    else {
      parent._status = 404
      bundle._changes.add(parent)
      missing.set(parent, new Set([ref]))
    }
  }

  // Start with the main module.
  await loadModule(main, bundle, onResolve)

  // Wait for all modules to load...
  await loading.push(noop).promise

  // TODO: Salvage any work that was done?
  if (stopped) {
    bundle.reset()
    return ''
  }

  // Emit any unresolved refs.
  if (missing.size) {
    bundle.events.emit('missing', missing)
  }

  // Cache the final module.
  bundle._final = prev

  // The bundle is now considered patchable.
  bundle._canPatch = true

  // The compiler handles the rest.
  return bundle._compiler.joinModules(config)
}
