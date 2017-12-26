
path = require "path"
noop = require "noop"
tp = require "testpass"

Bundler = require "../../Bundler"
bundler = new Bundler()

fileTypes = [".css", ".scss"]
root = path.resolve __dirname, "../__fixtures__/project"
fs = null

project = bundler.project {root, fileTypes}
project.crawl()

main = "styles/index.css"
bundle = null

tp.header "class CSSCompiler"
# tp.focus()

tp.beforeAll ->
  fs = require("fsx-mock").install root

tp.beforeEach ->

  bundle = project.bundle
    dev: true
    main: main
    platform: "web"

  await readBundle()

tp.afterEach ->
  fs.reset()

tp.group ".css imports", ->

  tp.test ".css", (t) ->

  tp.test ".scss", (t) ->

tp.group ".scss imports", ->

  tp.test ".css", (t) ->

  tp.test ".scss", (t) ->

#
# Helpers
#

readBundle = ->
  bundle.read {onStop: noop}

getModuleName = (mod) ->
  bundle.relative mod.path

getModuleNames = ->
  bundle.order.map getModuleName

writeModule = (name, code) ->
  file = path.resolve root, name
  fs.writeFile file, code
  unless bundler.reloadFile file
    bundler.addFile file, path.extname name
    return
