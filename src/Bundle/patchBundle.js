// @flow

// TODO: Allow `patchBundle` to be stopped when it's loading new modules?
// TODO: Insert new modules under their highest consumer?
// TODO: Group modules by package?

import AsyncTaskGroup from 'AsyncTaskGroup'
import path from 'path'
import noop from 'noop'

import type Bundle, {Module, Patcher} from '../Bundle'

import {forEach, traverse} from '../utils'
import {resolveImports} from './resolveImports'
import {loadModule} from './loadModule'

export async function patchBundle(
  bundle: Bundle,
  config: Object,
): Promise<string> {
  const patcher = bundle._compiler.createPatcher(config)
  const patch = await createPatch(bundle, patcher)
  return applyPatch(patch, bundle, patcher)
}

//
// Internal
//

type Patch = {
  splices: Module[],
  inserts: Module[],
  appends: Module[],
}

async function createPatch(
  bundle: Bundle,
  patcher: Patcher,
): Promise<Patch> {
  const compiler = bundle._compiler

  const patch: Patch = {
    splices: [],
    inserts: [],
    appends: [],
  }

  // Module refs that cannot be resolved.
  const missing: Map<Module, Set<string>> = new Map()

  let changes = bundle._changes
  while (changes.size) {

    // Load one module at a time.
    var loading = new AsyncTaskGroup(1)

    bundle._changes = new Set()
    await traverse(changes, async (mod) => {
      const status = mod._status
      if (status == 404) {
        await resolveImports(mod, bundle, onResolve)
      } else {
        const index = patcher.indexOf(mod)
        patch.splices[index] = mod
        if (status > 0) {
          await loadModule(mod, bundle, onResolve, onUnlink)
        } else {
          deleteModule(mod)
        }
      }
    })

    // Wait for new modules to load...
    await loading.push(noop).promise

    // Process any further changes (like a renamed package).
    changes = bundle._changes
  }

  // Emit any unresolved refs.
  if (missing.size) {
    bundle.events.emit('missing', missing)
  }

  // The patch is ready to go!
  return patch

  function deleteModule(mod: Module) {
    compiler.deleteModule(mod)

    // Reconstruct this module if ever used again.
    bundle._map.delete(mod.file)

    // Unlink parents from this module.
    mod.parents.forEach(parent => parent._unlink(mod))

    // Remove this module as a parent of any dependencies.
    if (mod.imports) {
      mod.imports.forEach(dep => {
        dep.parents.delete(mod)
        onUnlink(mod, dep)
      })
    }
  }

  // One module stopped using another.
  function onUnlink(mod: Module, dep: Module) {
    if (!dep.parents.size) {
      bundle._deleteModule(dep)
    }
  }

  // Some module's import ref has been resolved into a module.
  function onResolve(parent: Module, ref: string, dep: ?Module) {
    if (dep) {
      const mod = dep
      if (mod._status > 0) {
        // Module already in the bundle.
        if (mod._status != 201) return
        mod._status = 200
      } else {
        // In case a changed module was unlinked before being patched,
        // we must reload modules that are unlinked and then added back
        // in the same patch.
        mod._status = 1
      }
      loading.push(async () => {
        await loadModule(mod, bundle, onResolve)
        if (mod._index < 0) {
          patch.appends.push(mod)
        } else {
          patch.inserts.push(mod)
        }
      })
    } else {
      let refs = missing.get(parent)
      if (!refs) {
        parent._status = 404
        missing.set(parent, refs = new Set)
      }
      refs.add(ref)
    }
  }
}

// Transform the input string using the changes array.
async function applyPatch(
  patch: Patch,
  bundle: Bundle,
  patcher: Patcher,
): Promise<string> {
  const compiler = bundle._compiler
  const {splices, inserts, appends} = patch

  // The patcher can decide which payload needs patching.
  const input = await compiler.loadInput()

  // The bundle is rebuilt with slices of new and old code.
  const output = []

  // Remember where the final module ends (before the patch).
  const endIndex = bundle._final._endIndex

  // The character index of `input` that hasn't been spliced.
  let inputIndex = 0

  // The array of inserted modules is processed in tandem
  // with the array of changed/deleted modules.
  let insertIndex = 0

  // The input is spliced for replacing, deleting, and inserting modules.
  if (splices.length) {
    for (const i in (splices: any)) {
      const index = Number(i)

      // Insert any modules before the next splice.
      await insertModules(index)

      // Salvage any unchanged input.
      if (inputIndex < index) {
        output.push(input.slice(inputIndex, index))
      }

      // Perform the next splice.
      const mod = splices[index]
      if (mod._status < 0) {
        deleteModule(mod, index)
      } else {
        await replaceModule(mod, index)
      }
    }
  }

  // Perform any remaining insertions.
  await insertModules(Infinity)

  if (appends.length) {
    // Salvage any unchanged input between
    // the last splice and the first append.
    if (inputIndex < endIndex) {
      output.push(input.slice(inputIndex, endIndex))
      inputIndex = endIndex
    }

    // To append a module, we need to know where the
    // final module ends within the patched bundle.
    let appendIndex = bundle._final._endIndex

    for (let i = 0; i < appends.length; i++) {
      const mod = appends[i]

      let body = mod.consume()
      const wrapped = await compiler.wrapModule(body, mod)
      if (wrapped) body = wrapped
      output.push(body)

      mod._index = appendIndex
      appendIndex += mod._length = body.length
    }
  }

  // Salvage any unchanged input.
  if (inputIndex < input.length) {
    output.push(input.slice(inputIndex))
  }

  // Return the patched bundle.
  return output.join('')

  // Perform insertions until `beforeIndex` is reached.
  async function insertModules(beforeIndex: number) {
    let mod = inserts[insertIndex]
    let prevIndex = -1
    while (mod && mod._index <= beforeIndex) {
      const index = mod._index

      // Salvage any unchanged input.
      if (inputIndex < index) {
        output.push(input.slice(inputIndex, index))
      }

      // When multiple modules are inserted at the same index,
      // we need to ensure module boundaries are correct.
      if (index == prevIndex) {
        var prev = inserts[insertIndex - 1]
        mod._index = prev._endIndex
      }

      // Insert the module into the linked list.
      patcher.insertModule(mod, prev)

      // Push the module code onto the output array.
      await replaceModule(mod, index)
      prevIndex = index

      // Continue until all insertions before
      // the given `index` have been performed
      mod = inserts[insertIndex += 1]
    }
  }

  // This also works for inserting a module.
  async function replaceModule(mod: Module, index: number) {
    let body = mod.consume()
    const wrapped = await compiler.wrapModule(body, mod)
    if (wrapped) body = wrapped
    output.push(body)

    const prevLength = mod._length
    mod._length = body.length

    // Tell the patcher to update module boundaries.
    patcher.shiftModules(mod, mod._length - prevLength)

    // Exclude the module's old code.
    inputIndex = index + prevLength
  }

  function deleteModule(mod: Module, index: number) {
    const length = mod._length

    // Tell the patcher to update module boundaries.
    patcher.shiftModules(mod, 0 - length)

    // Tell the patcher to unlink this module.
    patcher.deleteModule(mod)

    // Tell the splicer to ignore this module.
    inputIndex = index + length
  }
}
