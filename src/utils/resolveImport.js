// @flow

import path from 'path'

import type {Module} from '../ModuleMap'
import type Bundle from '../Bundle'
import type File from '../File'

const homedir = require('os').homedir()

export default
function resolveImport(ref: string, src: File, bundle: Bundle): ?File {
  const {project} = bundle
  ref = project.resolve(ref, src, bundle)
  if (ref[0] == '.') {
    const dir = path.dirname(src.path)
    return
  } else if (ref.startsWith(homedir)) {
    throw Error('')
  } else {

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
