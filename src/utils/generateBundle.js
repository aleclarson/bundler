// @flow

import path from 'path'
import fs from 'fsx'

import type {Module} from '../ModuleMap'
import type Bundle from '../Bundle'
import type File from '../File'

import readModule from './readModule'

const lineBreakRE = /\n/g
const trimLineBreakRE = /(^\n|\n$)/g

export type GenerateBundleConfig = {
  dev?: boolean,
  globals?: Object,
  onStop: Function,
}

export default function generateBundle(
  bundle: Bundle,
  config: GenerateBundleConfig,
): Promise<?string> {
  const code: string[] = [
    renderGlobals(config.globals, String(config.dev || false)),
    readPolyfill('require'),
  ]
  if (bundle.polyfills) {
    code.push.apply(code, bundle.polyfills.map(readPolyfill))
  }
  let stopped = false
  config.onStop(function() {
    stopped = true
  })
  const deps: Dependencies = new Map()
  return readModules(deps, bundle, config.onStop).then(main => {
    if (stopped) return
    deps.forEach((dep, file) => {
      code.push(wrapModule(dep.id, dep.code))
    })
    code.push(`\nrequire('${main.id}');`)
    return wrapBundle(code)
  })
}

type Dependency = {id: string, code: string}
type Dependencies = Map<File, Dependency>

// Find every module used in the bundle, and assign a unique name to each.
function readModules(
  deps: Dependencies,
  bundle: Bundle,
  onStop: Function,
): Promise<Dependency> {
  const {modules} = bundle

  let stopped = false
  onStop(function() {
    stopped = true
  })

  // Track reading of nested modules.
  let reading: Promise<any> = Promise.resolve()

  // Module refs that could not be resolved.
  const unresolved = new Map

  const main = modules.add(bundle.main)
  readModule(main, onChange, onStop)
  return reading.then(function() {
    if (!stopped && unresolved.size) {
      bundle.emit('missing', unresolved)
    }
    return (deps.get(bundle.main): any)
  })

  function onChange(event: string, mod: Module) {
    if (stopped) return
    switch (event) {
      case 'read':
        modules.order.push(mod)
        deps.set(mod.file, {
          id: path.relative(bundle.main.package.path, mod.file.path),
          code: arguments[2],
        })
        break
      case 'add':
        reading = reading.then(() =>
          stopped || readModule(mod, onChange, onStop))
        break
      case 'missing':
        const ref: string = arguments[2]
        let refs = unresolved.get(mod)
        if (!refs) unresolved.set(mod, refs = new Set)
        refs.add(ref)
        break
    }
  }
}

function renderGlobals(globals: ?Object, dev: string): string {
  const code = [`  const __DEV__ = ${dev};`]
  if (globals) {
    for (let key in globals) {
      let value = globals[key]
      if (typeof value == 'function') {
        value = value(dev)
      }
      value = JSON.stringify(value)
      code.push(`  const ${key} = ${value};`)
    }
  }
  return code.join('\n')
}

function readPolyfill(file: string): string {
  if (!path.isAbsolute(file)) {
    file = require.resolve('../../polyfills/' + file)
  }
  return fs.readFile(file)
}

function wrapModule(id: string, code: string): string {
  return [`__d('${id}'), function(module, exports) {`, indentLines(code), `})()`].join('\n')
}

function wrapBundle(bundle: string[]): string {
  return [`(function() {`, indentLines(bundle.join('\n')), `})()`].join('\n')
}

function indentLines(code: string): string {
  return code.replace(trimLineBreakRE, '').replace(lineBreakRE, '\n  ')
}
