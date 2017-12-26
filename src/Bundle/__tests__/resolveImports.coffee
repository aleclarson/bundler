
path = require "path"
tp = require "testpass"

{resolveImports} = require "../resolveImports"

root = path.resolve __dirname, "../__fixtures__/project"
fs = require("fsx-mock").install root

tp.header "resolveImports()"

tp.xgroup "sibling", ->

  tp.xtest "ambiguous import", (t) ->
    # require('./foo') => ./foo.js

  tp.xtest "platform import", (t) ->
    # require('./btc') => ./btc.web.js

  tp.xtest "directory import", (t) ->
    # require('./dir') => ./dir/index.js

  tp.xtest "index import", (t) ->
    # require('.') => ./index.js

tp.xtest "uncle import", (t) ->
  # require('../foo') => ../foo.js

tp.xgroup "node_modules", (t) ->

  tp.xtest "ambiguous import", (t) ->
    # require('abc') => node_modules/abc/index.js

  tp.xtest "platform import", (t) ->
    # require('xyz') => node_modules/xyz/index.web.js

  tp.xtest "child import", (t) ->
    # require('eth/contract') => node_modules/eth/contract.js

  tp.xtest "directory import", (t) ->
    # require('eth/wallet') => node_modules/eth/wallet/index.js

tp.xtest "absolute import", (t) ->
  # require('/path/to/pkg') => Error('Absolute imports not allowed')
