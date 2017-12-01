
const {test, group, header} = require('testpass')

const parseImports = require('../parseImports').default

header('parseImports()')

group('.js', () => {
  test('require only', (t) => {
    const code = `
      const a = require('a')
      const b = require("b")
    `
    const imports = parseImports('js', code)
    const expected = ['a', 'b']
    t.eq(imports, new Set(expected))
  })
  test('import only', (t) => {
    const code = `
      import a from 'a'
      import b from "b"
    `
    const imports = parseImports('js', code)
    const expected = ['a', 'b']
    t.eq(imports, new Set(expected))
  })
  test('mixed', (t) => {
    const code = `
      import a from 'a'
      const b = require('b')
      import c as cee from 'c'
      const {x, y} = require('d')
      import * from 'e'
    `
    const imports = parseImports('js', code)
    const expected = 'abcde'.split('')
    t.eq(imports, new Set(expected))
  })
  test('comments', (t) => {
    const code = `
      require('a1') // require('a2')
      require('a3')
      /* require('a4')
         require('a5') */
      /* require('a6') */ require('a7')
    `
    const imports = parseImports('js', code)
    const expected = ['a1', 'a3', 'a7']
    t.eq(imports, new Set(expected))
  })
  test('unbalanced quotes', (t) => {
    const code = `import a from 'a"; require('b")`
    const imports = parseImports('js', code)
    t.eq(imports.size, 0)
  })
  test('no whitespace', (t) => {
    const code = 'const a=require("a")'
    const imports = parseImports('js', code)
    const expected = ['a']
    t.eq(imports, new Set(expected))
  })
})

group('.css', () => {
  test(t => {
    t.fail('not yet implemented')
  })
})
