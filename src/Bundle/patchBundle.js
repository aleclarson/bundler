// @flow

// TODO: Allow `patchBundle` to be stopped when it's reading new modules?

import AsyncTaskGroup from 'AsyncTaskGroup'
import path from 'path'
import noop from 'noop'

import type Bundle, {Module} from '.'

import {forEach, traverse} from '../utils'
import {resolveImports} from './resolveImports'
import {readModule} from './readModule'

export async function patchBundle(
 bundle: Bundle,
 config: Object,
): Promise<string> {
 if (!bundle.promise) {
   throw Error('Must call `compileBundle` before `patchBundle`')
 }
 const input = await bundle.promise
 if (input) {
   const patch = await createPatch(bundle)
   return applyPatch(input, patch, bundle)
 }
 return ''
}

type Patch = {
 added: Change[],
 changes: Change[],
}
type Change = {
 mod: Module,
 code: string,
 index: number,
}

// Create a bundle patch using the bundle's change/delete queue.
async function createPatch(bundle: Bundle): Promise<Patch> {
 const {compiler, order} = bundle

 // Prevent duplicate modules.
 const deps = new Set(order)

 // Modules added by the patch.
 const added: Change[] = []

 // Sparse array of changes (in order).
 const changes: Change[] = []

 // Module refs that cannot be resolved.
 const missing: Map<Module, Set<string>> = new Map

 let reading
 if (bundle.missing.size) {
   reading = new AsyncTaskGroup(1)
   await traverse(bundle.missing, async (mod) => {
     resolveImports(mod, bundle, onResolve)
   })
   bundle.missing.clear()

   // Wait for new modules to be parsed.
   await reading.push(noop).promise
 }

 while (bundle.changed.size) {
   reading = new AsyncTaskGroup(1)
   await traverse(bundle.changed, async (mod) => {
     const code = await readModule(mod, bundle, onResolve, onUnlink)
     const modIndex = order.indexOf(mod)
     changes[modIndex] = {mod, code, index: mod.index}
   })
   bundle.changed.clear()

   // Wait for new modules to be parsed, which may rename a package.
   await reading.push(noop).promise
 }

 if (bundle.deleted.size) {
   bundle.deleted.forEach(deleteModule)
   bundle.deleted.clear()
 }

 // Emit any unresolved refs.
 if (missing.size) {
   bundle.events.emit('missing', missing)
 }

 return {
   added,
   changes: desparse(changes),
 }

 function deleteModule(mod: Module) {
   compiler.deleteModule(mod)

   const modIndex = order.indexOf(mod)
   changes[modIndex] = {mod, code: '', index: mod.index}

   // From here on out, this module must be recreated if ever used again.
   bundle.map.delete(mod.file)

   // Unlink parents from this module.
   mod.parents.forEach(parent => parent.unlink(mod))

   // Remove this module as a parent of any dependencies.
   if (mod.file.imports) {
     forEach(mod.imports, (dep) => {
       dep.parents.delete(mod)
       onUnlink(mod, dep)
     })
   }
 }

 // One module stopped using another.
 function onUnlink(mod: Module, dep: Module) {
   if (!dep.parents.size) {
     dep.isDeleted = true
     deleteModule(dep)
     deps.delete(dep)
   }
 }

 // Some module's import ref has been resolved into a module.
 function onResolve(parent: Module, ref: string, dep: ?Module) {
   if (dep) {
     const {size} = deps
     deps.add(dep)
     if (deps.size == size) {
       return // Module already in the bundle.
     }

     const mod = dep
     if (mod.isDeleted) {
       mod.isDeleted = undefined
     } else {
       compiler.addModule(mod)
     }
     reading.push(async () => {
       const code = await readModule(mod, bundle, onResolve, noop)
       added.push({mod, code, index: -1})
     })
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

function desparse<T>(sparse: T[]): T[] {
 const array = []
 sparse.forEach(value => array.push(value))
 return array
}

// Transform the input string using the changes array.
async function applyPatch(
 input: string,
 patch: Patch,
 bundle: Bundle,
): Promise<string> {
 const {added, changes} = patch
 const {compiler, order} = bundle

 // Our position in the input string.
 let inputIndex = 0

 // The bundle is rebuilt with slices of new and old code.
 const output = []

 const replaceModule = async (code: string, mod: Module, index: number) => {
   code = await compiler.compileModule(code, mod)

   const prevLength = mod.length
   mod.length = code.length

   const modIndex = order.indexOf(mod)
   shiftModules(order, mod.length - prevLength, modIndex + 1)

   output.push(input.slice(inputIndex, index), code)
   inputIndex = index + prevLength
 }

 const deleteModule = (mod: Module, index: number) => {
   const modIndex = order.indexOf(mod)
   shiftModules(order, 0 - mod.length, modIndex + 1)
   order.splice(modIndex, 1)

   output.push(input.slice(inputIndex, index))
   inputIndex = index + mod.length
 }

 // After adding modules to the bundle, the remaining input code is
 // appended to the output array. To do that, we need to know where
 // the last module ended before the patch was applied.
 let last = order[order.length - 1]
 let addIndex = last.index + last.length

 for (let i = 0; i < changes.length; i++) {
   const change = changes[i]
   if (change.mod.isDeleted) {
     deleteModule(change.mod, change.index)
   } else {
     await replaceModule(change.code, change.mod, change.index)
   }
 }

 if (added.length) {
   // Include any code between the last changed
   // (or deleted) module and the first new module.
   if (inputIndex < addIndex) {
     output.push(input.slice(inputIndex, addIndex))
     inputIndex = addIndex
   }

   // To ensure new modules have correct indexes, we need to
   // know where the last module ends in the patched bundle.
   last = order[order.length - 1]
   addIndex = last.index + last.length

   for (let i = 0; i < added.length; i++) {
     let {mod, code} = added[i]
     code = await compiler.compileModule(code, mod)

     mod.index = addIndex
     addIndex += mod.length = code.length

     output.push(code)
     order.push(mod)
   }
 }

 // Include any remaining code.
 output.push(input.slice(inputIndex))

 // Return the patched bundle.
 return output.join('')
}

// Shift each module's character index by a specific amount.
function shiftModules(
 modules: Module[],
 amount: number,
 startIndex: number,
): void {
 if (amount != 0) {
   for (let i = startIndex; i < modules.length; i++) {
     modules[i].index += amount
   }
 }
}
