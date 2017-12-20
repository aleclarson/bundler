
const tp = require('testpass')

const {parseImports} = require('../parseImports')

tp.header('parseImports()')

const tests = {
  '.js': [{
    name: 'require only',
    paths: ['a', 'b'],
    code: `
      const a = require('a')
      const b = require("b")
    `
  }, {
    name: 'import only',
    paths: ['a', 'b'],
    code: `
      import a from 'a'
      import b from "b"
    `
  }, {
    name: 'mixed require/import',
    paths: ['a', 'b', 'c', 'd', 'e'],
    code: `
      import a from 'a'
      const b = require('b')
      import c as cee from 'c'
      const {x, y} = require('d')
      import * from 'e'
    `
  }, {
    name: 'comments',
    paths: ['a1', 'a3', 'a7'],
    code: `
      require('a1') // require('a2')
      require('a3')
      /* require('a4')
         require('a5') */
      /* require('a6') */ require('a7')
    `
  }, {
    name: 'no whitespace',
    paths: ['a'],
    code: `const a=require("a")`
  }],
  '.css': [{
    name: 'single quotes',
    paths: ['a', 'b'],
    code: `
      @import 'a';
      @import 'b';
    `
  }, {
    name: 'double quotes',
    paths: ['a', 'b'],
    code: `
      @import "a";
      @import "b";
    `
  }, {
    name: 'comments',
    paths: [],
    code: `
      // @import 'a';
      /* @import 'b';
         @import 'c'; */
    `
  }]
}

for (const ext in tests) {
  tp.group(ext, () => {
    tests[ext].forEach(test => {
      const {paths, code} = test
      tp.test(test.name, (t) => {
        const imports = parseImports(ext, code)
        paths.forEach(path => {
          const {index} = imports.get(path)
          t.eq(code.slice(index, index + path.length), path)
        })
      })
    })
  })
}
