#!/usr/bin/env node

require('coffeescript/register')

const sourceRoot = __dirname + '/src'
const testGlob = '**/__tests__/*.(js|coffee)'

const Module = require('module')
const globRegex = require('glob-regex')

const testPathRE = globRegex(testGlob)
const buildRoot = __dirname + '/js'

// TODO: Add this functionality to `testpass`
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, parent, isMain) {
  const filename = resolve(request, parent, isMain)
  if (testPathRE.test(parent.filename) && filename.startsWith(sourceRoot)) {
    return filename.replace(sourceRoot, buildRoot)
  }
  return filename
}

const {findTests} = require('testpass')
findTests(sourceRoot, testGlob)
