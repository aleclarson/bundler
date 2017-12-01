// @flow

import path from 'path'
import fs from 'fsx'

import type Bundle from '../Bundle'

const lineBreakRE = /\n/g
const trimLineBreakRE = /(^\n|\n$)/g

type Config = {
  dev?: boolean,
  globals?: Object,
}

export default function generateBundle(bundle: Bundle, config: Config): string {
  const code: string[] = [
    renderGlobals(config.globals, String(config.dev || false)),
    readPolyfill('require'),
  ]
  if (bundle.polyfills) {
    code.push.apply(code, bundle.polyfills.map(readPolyfill))
  }
  code.push(`\nrequire('${bundle.main.id}');`)
  return wrapBundle(code)
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
