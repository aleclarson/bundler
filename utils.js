
const {lazyRequire} = require('./js/utils/lazyRequire')
const {addCompiler} = require('./js/compilers')
const {addPlugin} = require('./js/plugins')
const utils = require('./js/utils')

module.exports = {
  ...utils,
  lazyRequire,
  addCompiler,
  addPlugin,
}
