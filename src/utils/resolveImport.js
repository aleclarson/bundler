// @flow

// TODO: Support namespaced deps (eg: @aleclarson/fsx)

import emptyFunction from 'emptyFunction'
import path from 'path'

import type {Module} from '../ModuleMap'
import type Package from '../Package'
import type Bundler from '../Bundler'
import type Bundle from '../Bundle'
import crawl from './crawl'
import File from '../File'

export default async function resolveImport(
  ref: string,
  src: File,
  bundle: Bundle,
): Promise<?File> {
  const {project} = bundle
  const {bundler} = project.root
  if (ref[0] == '.') {
    const pkg = src.package
    const dir = path.dirname(src.path)
    const filePath = path.resolve(dir, ref)
    if (filePath.startsWith(pkg.path)) {
      return bundler.getFile(filePath, bundle.project.types)
    }
  } else if (path.isAbsolute(ref)) {
    throw Error('Absolute imports are not supported')
  } else {
    const sep = ref.indexOf('/')
    const name = sep >= 0 ? ref.slice(0, sep) : null
    const pkg = findDependency(name || ref, src, bundler)
    if (pkg) {
      if (!name) {
        return pkg.resolveMain(bundle.platform)
      }
      return crawl(pkg, {
        onStop: emptyFunction,
      }).then(() => {
        ref = ref.slice(ref.indexOf(pkg.name + '/') + pkg.name.length)
        return resolveImport('.' + ref, new File(pkg.path, pkg), bundle)
      })
    }
  }
  return null
}

function findDependency(name: string, src: File, bundler: Bundler): ?Package {
  for (let pkg = src.package; pkg != null; pkg = pkg.parent) {
    if (pkg.meta.dependencies.hasOwnProperty(name)) {
      const root = path.join(pkg.path, 'node_modules', name)
      return bundler.package(root, pkg)
    }
  }
}

// unless resolved = @resolutions[depender]
//   @resolutions[depender] = resolved = Object.create null
//
// if moduleId = resolved[dependency]
//   return Promise.resolve moduleId
//
// Promise.try ->
//
//   if dependency[0] is "."
//     dir = "/" + path.dirname depender
//     return path.resolve(dir, dependency).slice 1
//
//   throw Error "Absolute paths are not supported."
//
// .then (moduleId) =>
//
//   unless dependers = @dependencies[moduleId]
//     @dependencies[moduleId] = dependers = new Set
//
//   dependers.add depender
//   resolved[dependency] = moduleId
//   return moduleId
