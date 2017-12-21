// @flow

const isOpenComment = require('is-open-comment')
const matchAny = require('match-any')

const parsers: ImportParser[] = []

export type ImportParser = {
  fileType?: string,
  fileTypeRE?: RegExp,
  parse: (code: string) => any[],
}

export type Import = {
  line: number,
  index: number,
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
  parsers.push(parser)
}

const jsImportRE = /\bimport\s+(?:.+\s+from\s+)?(['"])([^(\1)\n]+)\1/g
const jsRequireRE = /\brequire\((['"])([^(\1)\n]+)\1\)/g
addImportParser({
  fileTypeRE: /\.(js|ts)$/,
  parse(code: string) {
    return matchAny(code, jsImportRE, jsRequireRE)
      .filter(match => !isOpenComment(code.slice(0, match.index)))
  }
})

const cssImportRE = /@import\s+(['"])([^(\1)\n]+)\1;/g
addImportParser({
  fileTypeRE: /\.s?css$/,
  parse(code: string) {
    return matchAny(code, cssImportRE)
      .filter(match => !isOpenComment(code.slice(0, match.index)))
  }
})

const sassImportRE = /@import\s+['"]?([^'"]+)/g
addImportParser({
  fileType: '.sass',
  parse(code: string) {
    return matchAny(code, sassImportRE)
      .filter(match => !isOpenComment(code.slice(0, match.index)))
  }
})

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
