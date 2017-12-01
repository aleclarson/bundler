#!/usr/bin/env node

const ignoreRE = /\/__tests__\//
require('babel-register')({
  ignore: (file) => !file.startsWith(__dirname) || ignoreRE.test(file),
})

const {findTests} = require('testpass')

findTests(__dirname + '/src', '**/__tests__/*.js')
