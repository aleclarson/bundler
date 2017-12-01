// @flow

const isOpenComment = require('is-open-comment')
const matchAny = require('match-any')

const types = {}

export default function parseImports(type: string, code: string): ?Set<string> {
  if (types.hasOwnProperty(type)) {
    return types[type](code)
  }
}

const jsImportRE = /\bimport\s+(?:.+\s+from\s+)?(['"])([^(\1)]+)\1/g
const jsRequireRE = /\brequire\((['"])([^(\1)]+)\1\)/g
types.js = function(code: string): Set<string> {
  const imports = new Set
  matchAny(code, jsImportRE, jsRequireRE).forEach(match => {
    const before = code.slice(0, match.index)
    if (!isOpenComment(before)) {
      imports.add(match[2])
    }
  })
  return imports
}

types.css = function(code: string): Set<string> {
  return new Set
  // regex = /@import '([^']+)';/g
  // imports = []
  // while match = regex.exec code
  //   imports.push match[1]
  // return imports
}
