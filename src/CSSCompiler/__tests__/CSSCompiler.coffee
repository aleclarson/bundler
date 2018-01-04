
path = require "path"
noop = require "noop"
huey = require "huey"
tp = require "testpass"

Bundler = require "../../Bundler"
bundler = new Bundler()

main = "styles/index.css"
root = path.resolve __dirname, "../__fixtures__/project"
fileTypes = [".css", ".scss"]

project = bundler.project {root, fileTypes}
project.crawl()

tp.header "class CSSCompiler"

fs = null
tp.beforeAll ->
  fs = require("fsx-mock").install root

bundle = null
tp.beforeEach ->
  writeModule main, ""
  bundle = project.bundle
    dev: true
    main: main
    platform: "web"
    force: true
  await readBundle()

tp.afterEach -> fs.reset()

tp.group ->

  tp.test "one import", (t) ->
    writeModule "styles/a.css", "body {}"
    writeModule main, "@import './a';\nh1 {}"

    await readBundle()
    t.eq getModuleNames(), ["styles/a.css", main]

  tp.test "two imports", (t) ->
    writeModule main, "@import './a';\nh1 {}\n@import './b';"
    writeModule "styles/b.css", "html {}"

    await readBundle()
    t.eq getModuleNames(), ["styles/a.css", "styles/b.css", main]

  tp.test "two modules with same import", (t) ->
    writeModule "styles/a.css", "@import './b';\nbody {}"

    await readBundle()
    t.eq getModuleNames(), ["styles/b.css", "styles/a.css", main]

  # TODO: Support reloading plugins after configuration is changed.
  # tp.xtest "postcss plugin", (t) ->
  #   bundle.main.package.meta.postcss = ["autoprefixer"]

#
# Helpers
#

readBundle = ->
  bundle.read {onStop: noop}

writeModule = (name, code) ->
  file = path.resolve root, name
  fs.writeFile file, code
  unless bundler.reloadFile file
    bundler.addFile file, path.extname name
    return

hasMissing = (filePath) ->
  getModule(filePath)._unresolved

getModule = (filePath) ->
  unless path.isAbsolute filePath
    filePath = path.join root, filePath
  file = bundler.getFile filePath
  return bundle.getModule file

getModuleName = (mod) ->
  bundle.relative mod.path

getModuleNames = ->
  bundle._modules.map getModuleName

printModuleNames = ->
  console.log "modules = " + huey.green JSON.stringify getModuleNames()
