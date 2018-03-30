// @flow

// TODO: Append '/index' to directory imports
// TODO: Support namespaced deps (eg: @aleclarson/fsx)

import globRegex from 'glob-regex'
import path from 'path'

import type Bundle, {Module} from '../Bundle'
import type Bundler from '../Bundler'
import type Package from '../Package'
import type File from '../File'

type MaybeAsync<T> = T | Promise<T>

export type ResolveListener =
  (parent: Module, ref: string, dep: ?Module) => MaybeAsync<void>

export function resolveImports(
  mod: Module,
  bundle: Bundle,
  onResolve: ResolveListener,
): void {
  const {file} = mod
  const resolved = mod.imports
  if (file.imports && resolved) {
    const refs = file.imports.keys()
    for (const ref of refs) {
      let dep = resolved.get(ref)
      if (!dep) {
        const depFile = resolveImport(ref, file, bundle)
        if (depFile) {
          dep = bundle.getModule(depFile) || bundle.addModule(depFile)
          dep.parents.add(mod)
          resolved.set(ref, dep)
        }
      }
      onResolve(mod, ref, dep)
    }
  }
}

function resolveImport(
  ref: string,
  src: File,
  bundle: Bundle,
): ?File {
  if (ref[0] == '.') {
    ref = path.resolve(path.dirname(src.path), ref)
    return src.package.getFile(ref, bundle.platform, src.type)
  } else if (path.isAbsolute(ref)) {
    throw Error([
      `Absolute imports are not supported:`,
      `    file = '${src.path}'`,
      `    ref  = '${ref}'`,
    ].join('\n'))
  } else {
    const sep = ref.indexOf('/')
    const name = sep >= 0 ? ref.slice(0, sep) : ref
    const pkg = findDependency(name, src, bundle.bundler)
    if (pkg) {
      const {project} = bundle
      pkg.crawl({
        fileTypes: globRegex(project.fileTypes),
        exclude: project.excludeRE,
      })
      if (sep >= 0) {
        return pkg.getFile(ref.slice(sep + 1), bundle.platform, src.type)
      } else {
        return pkg.resolveMain(bundle.platform, src.type)
      }
    }
  }
}

function findDependency(name: string, src: File, bundler: Bundler): ?Package {
  for (let pkg = src.package; pkg != null; pkg = pkg.parent) {
    const deps = pkg.meta.dependencies
    if (deps && deps.hasOwnProperty(name)) {
      const root = path.join(pkg.path, 'node_modules', name)
      try {
        return bundler.package(root, pkg)
      } catch(error) {
        if (error.code == 'PJSON_NOT_FOUND') {
          bundler.emit('error', error)
        } else {
          throw error
        }
      }
    }
  }
}
