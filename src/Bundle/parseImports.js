// @flow

import isOpenComment from 'is-open-comment'
import matchAny from 'match-any'

import type {Import} from '../File'

const parsers: ImportParser[] = []

//
// Built-in parsers
//

addImportParser({
  fileTypeRE: /\.js$/,
  importRE: [
    /\brequire\((['"])([^(\1)\n]+)\1\)/g,
    /\bimport\s+(?:.+\s+from\s+)?(['"])([^(\1)\n]+)\1/g,
  ]
})

addImportParser({
  fileTypeRE: /\.s?css$/,
  importRE: /@import\s+(['"])([^(\1)\n]+)\1;/g,
})

addImportParser({
  fileType: '.sass',
  importRE: /@import\s+['"]?([^'"]+)/g,
})

//
// Implementation
//

export type ImportParser = {
  fileType?: string,
  fileTypeRE?: RegExp,
  importRE?: RegExp | RegExp[],
  parse?: (code: string) => any[],
}

export function parseImports(
  type: string,
  code: string,
): ?Map<string, Import> {
  for (let i = 0; i < parsers.length; i++) {
    const parser = parsers[i]
    if (canParse(type, parser)) {
      const imports = new Map()
      const lineBreaks = parseLineBreaks(code)
      if (typeof parser.parse != 'function') {
        throw Error('Import parser must have a `parse` function')
      }
      parser.parse(code).forEach(match => {
        const lineBreak = code.lastIndexOf('\n', match.index)
        const ref = match[2]
        imports.set(ref, {
          line: lineBreaks.indexOf(lineBreak),
          index: match.index + match[0].indexOf(ref),
        })
      })
      return imports
    }
  }
}

export function addImportParser(parser: ImportParser): void {
  if (!parser.fileType && !parser.fileTypeRE) {
    throw Error('Must define `fileType` or `fileTypeRE`')
  }
  if (typeof parser.parse != 'function') {
    if (parser.importRE) {
      parser.parse = createParseFn(parser.importRE)
    } else {
      throw Error('Must define `parse` or `importRE`')
    }
  }
  parsers.push(parser)
}

// TODO: Support custom comment tags (for other languages).
function createParseFn(importRE: RegExp | RegExp[]): Function {
  const patterns: RegExp[] = Array.isArray(importRE) ? importRE : [importRE]
  return (code: string) => matchAny(code, ...patterns)
    .filter(match => !isOpenComment(code.slice(0, match.index)))
}

//
// Helpers
//

function canParse(fileType: string, parser: ImportParser): boolean {
  return parser.fileType ?
    parser.fileType == fileType :
    (parser.fileTypeRE: any).test(fileType)
}

const lineBreakRE = /\n/g
function parseLineBreaks(code: string): number[] {
  let match
  const breaks = [-1]
  while (match = lineBreakRE.exec(code)) {
    breaks.push(match.index)
  }
  lineBreakRE.lastIndex = 0
  return breaks
}
