// @flow

// TODO: Group modules in the same package together.

import AsyncTaskGroup from 'AsyncTaskGroup'
import noop from 'noop'
import path from 'path'
import fs from 'fsx'

import type Bundle, {Module} from '.'
import type File from '../File'

import {uhoh, forEach} from '../utils'
import {transformFile} from '../plugins'
import {readModule} from '../utils/readModule'

type CompilerConfig = {
  onStop: Function,
}

// Generate a bundle from scratch.
export async function compileBundle(
  bundle: Bundle,
  config: CompilerConfig,
): Promise<string> {
  const {compiler} = bundle

  let stopped = false
  config.onStop(function() {
    stopped = true
  })

  // Wait for plugins to initialize.
  await nextTick()

  // The code of every module goes here.
  const modules: string[] = []

  // Module refs that cannot be resolved.
  const missing = new Map()

  // Read one module at a time.
  const reading = new AsyncTaskGroup(1)

  // Prevent duplicate modules.
  const deps: Set<Module> = new Set()

  // Start with the `main` module.
  const main = bundle.getModule(bundle.main)
  if (main) {
    deps.add(main)
    onRead(await readModule(main, bundle, onResolve, noop), main)
  }

  // Wait on every module in the bundle...
  await reading.push(noop).promise

  if (stopped) {
    bundle.reset()
    return ''
  }

  // Emit any unresolved refs.
  if (missing.size) {
    bundle.events.emit('missing', missing)
  }

  if (!modules.length) {
    throw uhoh('Bundle has no modules', 'EMPTY_BUNDLE')
  }

  // Mark the compilation as completed.
  bundle.hasCompiled = true

  // Let the compiler take it from here.
  return compiler.compile(modules, config)

  function onRead(code: string, mod: Module) {
    if (stopped) return
    modules.push(code)
    bundle.order.push(mod)
    compiler.addModule(mod)
  }

  function onResolve(parent: Module, ref: string, dep: ?Module) {
    if (stopped) return
    if (dep) {
      const {size} = deps
      deps.add(dep)
      if (deps.size == size) {
        return // Module already in the bundle.
      }

      const mod = dep
      const {file} = mod
      if (file.imports) {
        reading.push(async () => {
          if (stopped) return
          const code = await transformFile(fs.readFile(file.path), file)
          forEach(mod.imports, (dep, ref) => onResolve(mod, ref, dep))
          onRead(code, mod)
        })
      } else {
        reading.push(async () => {
          if (stopped) return
          const code = await readModule(mod, bundle, onResolve, noop)
          onRead(code, mod)
        })
      }
    } else {
      let refs = missing.get(parent)
      if (!refs) {
        missing.set(parent, refs = new Set)
        bundle.missing.add(parent)
      }
      refs.add(ref)
    }
  }
}

function nextTick() {
  return new Promise(resolve => setImmediate(resolve))
}
