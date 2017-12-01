
//
// path = require "path"
//
// Bundle = require "./Bundle"
//
// bundle = Bundle
//   main: path.resolve "../web/src/index"
//
// bundle.globals =
//   API_URL: (dev) -> if dev then "/v1/" else "https://api.lecksicon.com/v1/"
//   ASSETS_URL: (dev) -> if dev then "/assets/" else "https://assets.lecksicon.com/"
//
// # The cached bundle
// bundleAsset = null
//
// exports.readBundle = (dev) ->
//   if !bundleAsset or dev isnt bundleAsset.dev
//     bundleAsset = bundle.read(dev).then transformBundle
//     bundleAsset.dev = dev
//   return bundleAsset
//
// exports.updateBundle = (assetId, event) ->
//
//   if event is "change"
//     success = bundle.invalidate assetId
//
//   else if event is "unlink"
//     success = bundle.remove assetId
//
//   bundleAsset = null if success
//   return 204
//
// #
// # Helpers
// #
//
// transformBundle = do ->
//   babel = require "babel-core"
//   babelrc =
//     ast: false
//     presets: ["flow", "es2015"]
//     retainLines: true
//
//   return (code) ->
//     babel.transform(code, babelrc).code
