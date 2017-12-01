// @flow

import fs from 'fsx'

import type ModuleMap, {Module} from '../ModuleMap'
import type Bundle from '../Bundle'

import readModule from './readModule'

export default function patchBundle(bundle: Bundle): Promise<string> {
  const promise = bundle.readPromise
  if (promise == null) {
    throw Error('Must call `generateBundle` before `patchBundle`')
  }
  return promise.then(code => {
    const {project, modules} = bundle
    const {order, changed, deleted} = modules

    // Work in lines, rather than characters.
    let lines = code.split('\n')

    // New dependencies in changed modules.
    const added: Module[] = []

    // Module refs that could not be resolved.
    const unresolved = new Map

    function onChange(event, mod) {
      switch (event) {
        case 'add':
          added.push(mod)
          break
        case 'resolve':
          const dep: Module = arguments[3]
          deleted.delete(dep)
          break
        case 'missing':
          const ref: string = arguments[2]
          let refs = unresolved.get(mod)
          if (!refs) unresolved.set(mod, refs = new Set)
          refs.add(ref)
          break
        case 'delete':
          changed.delete(mod)
          deleted.add(mod)
          break
      }
    }

    if (changed.size) {
      changed.forEach(mod => {
        const code = readModule(mod, modules, onChange).split('\n')

        // Overwrite the module code in the bundle.
        const linesAfter = lines.slice(mod.line + mod.length)
        lines = lines.slice(0, mod.line).concat(code, linesAfter)

        // Update the module's length.
        const prevLength = mod.length
        mod.length = code.length

        // Update module positions after this module.
        const index = order.indexOf(mod)
        shiftModules(order, mod.length - prevLength, index + 1)
      })
      changed.clear()
    }

    if (deleted.size) {
      deleted.forEach(mod => {

        // Update the bundle position of modules after this one.
        const index = order.indexOf(mod)
        shiftModules(order, 0 - mod.length, index + 1)

        // Remove the module from the bundle.
        lines.splice(mod.line, mod.length)
        order.splice(index, 1)

        // Update modules that this one depends on.
        if (mod.file.imports) {
          for (const ref in mod.imports) {
            const dep = mod.imports[ref]
            dep.consumers.delete(mod)
            if (!dep.consumers.size) {
              modules.delete(dep.file)
            }
          }
        }

        // Update modules that depend on this one.
        if (mod.consumers.size) {
          mod.consumers.forEach(dep => {
            for (const ref in dep.imports) {
              if (dep.imports[ref] == mod) {
                delete dep.imports[ref]
                break
              }
            }
          })
        }
      })
      deleted.clear()
    }

    if (added.size) {
      added.forEach(mod => {
        const code = readModule(mod, modules, onChange).split('\n')
        mod.length = code.length
        lines = lines.concat(code)
      })
    }

    if (unresolved.size) {
      bundle.emit('missing', unresolved)
    }

    return lines.join('\n')
  })
}

// Shift each module's line number by a specific amount.
function shiftModules(modules: Module[], amount: number, startIndex: number): void {
  for (let i = startIndex; i < modules.length; i++) {
    const mod = modules[i]
    mod.line += amount
  }
}

// reloadModule = ->
//   if path.isAbsolute filePath
//     filePath = path.relative @_root, filePath
//   return false unless file = @_files[filePath]
//
//   file.code = @_readFile filePath
//   requires = @_parseRequires file.code
//
//   mod = @_modules.get file.moduleId
//   mod.requires?.forEach (dependency) =>
//     unless requires.has dependency
//       @_modules.invalidate dependency, filePath
//
//   mod.requires = requires
//   return true
//
//   return unless resolved = @resolutions[depender]
//   return unless resolvedId = resolved[dependency]
//   delete resolved[dependency]
//   if dependers = @dependencies[resolvedId]
//     dependers.delete depender
//     unless dependers.size
//       delete @dependencies[resolvedId]
//       @remove resolvedId
//       return
