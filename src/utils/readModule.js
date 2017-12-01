
import type ModuleMap, {Module} from '../ModuleMap'

import transformFile from './transformFile'
import resolveImport from './resolveImport'
import parseImports from './parseImports'
import {forEach} from '.'

type ChangeEvent = 'add' | 'resolve' | 'missing' | 'delete'
type ChangeFn = (event: ChangeEvent, mod: Module, ...data: any[]) => void

export default function readModule(
  mod: Module,
  modules: ModuleMap,
  onChange: ?ChangeFn,
): string {
  const {file} = mod
  const code = fs.readFile(file.path)
  if (onChange) onChange('read', mod, code)

  // Parse any dependencies.
  const imports = parseImports(file.type, code)
  if (imports) {
    // Remove old dependencies.
    if (file.imports) {
      forEach(mod.imports, (dep, ref) => {
        if (!imports.has(ref)) {
          delete mod.imports[ref]
          removeDependency(dep, mod, onChange)
        }
      })
    }
    // Resolve new dependencies.
    imports.forEach(ref => {
      if (!mod.imports[ref]) {
        const depFile = resolveImport(ref, file, bundle)
        if (depFile) {
          let dep = modules.get(depFile)
          if (!dep) {
            dep = modules.add(depFile)
            if (onChange) onChange('add', dep)
          }
          if (onChange) {
            onChange('resolve', mod, ref, dep)
          }
          mod.imports[ref] = dep
        } else if (onChange) {
          onChange('missing', mod, ref)
        }
      }
    })
  } else if (file.imports) {
    // Remove all old dependencies.
    forEach(mod.imports, (dep) => removeDependency(dep, mod, onChange))
    mod.imports = {}
  }

  file.imports = imports
  return transformFile(code, file)
}

function removeDependency(dep: Module, mod: Module, onChange: ChangeFn): void {
  dep.consumers.delete(mod)
  if (!dep.consumers.size) {
    onChange('delete', dep)
  }
}
