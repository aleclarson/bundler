
mutate = require "mutate"
path = require "path"
noop = require "noop"
tp = require "testpass"
vm = require "vm"

huey = require "huey"
log = require "timber"

root = path.resolve __dirname, "../__fixtures__/example"
fs = require("fsx-mock").install root

Bundler = require "../../Bundler"
bundler = new Bundler()

project = bundler.project {root}
project.crawl()

main = "index.web.js"
bundle = null

tp.header "patchBundle()"

tp.beforeEach -> resetBundle()
tp.afterEach -> fs.reset()

# These tests use the same bundle.
tp.group ->

  tp.test "add a module (no deps)", (t) ->
    t.eq getModuleNames(), [main]
    writeModule main, "import a from './a'"
    writeModule "a.js"

    await runBundle()
    t.eq getModuleNames(), [main, "a.js"]

  tp.test "remove a module (no deps)", (t) ->
    writeModule main

    await runBundle()
    t.eq getModuleNames(), [main]

# These tests use the same bundle.
tp.group ->

  tp.test "add a module (with deps)", (t) ->
    writeModule main, "import a from './a'"
    writeModule "a.js", """
      import b from './b'
      import c from './c'
    """
    writeModule "b.js"
    writeModule "c.js"

    await runBundle()
    t.eq getModuleNames(), [main, "a.js", "b.js", "c.js"]

  tp.test "change 2 modules", (t) ->
    appendModule "a.js", "\nwindow.res = c"
    writeModule "c.js", "module.exports = 1"

    t.eq bundle.changed.size, 2
    {window} = await runBundle()
    t.eq bundle.changed.size, 0
    t.eq window.res, 1

  tp.test "remove a module (with deps)", (t) ->
    writeModule main

    await runBundle()
    t.eq getModuleNames(), [main]

  tp.test "remove all deps in a module", (t) ->
    writeModule main, "require('./a')"
    await readBundle()

    writeModule "a.js"
    await runBundle()
    t.eq getModuleNames(), [main, "a.js"]

# These tests use the same bundle.
tp.group ->

  tp.test "missing relative", (t) ->
    writeModule main, "import q from './q'"

    await readBundle()
    t.eq bundle.missing.size, 1
    t.eq getModuleNames(), [main]

  tp.test "add missing relative", (t) ->
    writeModule "q.js"

    await readBundle()
    t.eq bundle.missing.size, 0
    t.eq getModuleNames(), [main, "q.js"]

# These tests use the same bundle.
tp.group ->
  dep = "node_modules/x"

  tp.test "missing node_modules package", (t) ->
    fs.removeDir dep
    writeModule main, "import x from 'x'"

    await readBundle()
    t.eq bundle.missing.size, 1

  tp.test "add missing node_modules package", (t) ->
    fs.reset dep
    fs.writeFile depMain = "#{dep}/index.js"

    # We have to call this manually, because `watchPackage` does this.
    bundler.package path.join root, dep

    await readBundle()
    t.eq bundle.missing.size, 0
    t.eq getModuleNames(), [main, depMain]

# These tests use the same bundle.
tp.group ->

  tp.test "remove parent of module with 2 parents", (t) ->
    writeModule main, "require('./q')"
    writeModule "q.js", "require('./q2')\nrequire('./qq')"
    writeModule "q2.js", "require('./qq')"
    writeModule "qq.js"

    await readBundle()
    t.eq getModuleNames(), [main, "q.js", "q2.js", "qq.js"]

    # Remove q.js from bundle
    writeModule main, "require('./q2')"

    await readBundle()
    t.eq getModuleNames(), [main, "q2.js", "qq.js"]

  tp.test "remove parent of module, then add new parent", (t) ->
    writeModule main, "require('./q3')"
    writeModule "q3.js", "require('./qq')"

    await readBundle()
    t.eq getModuleNames(), [main, "q3.js", "qq.js"]

  tp.test "remove a module, then add it back", (t) ->
    writeModule main
    writeModule main, "require('./q3')"

    await readBundle()
    t.eq getModuleNames(), [main, "q3.js", "qq.js"]

# These tests use the same bundle.
tp.group ->

  tp.test "add package with same name as another package", (t) ->
    writeModule main, "require('x'); require('z')"
    fs.writeFile "node_modules/x/index.js", "require('z')"
    fs.writeFile "node_modules/z/index.js"

    await readBundle()
    t.eq getModuleIds(), ["example", "x", "z@1.0.0", "z@2.0.0"]

  # NOTE: This test does not currently pass.
  tp.xtest "change package version", (t) ->
    jsonPath = "node_modules/z/package.json"
    json = JSON.parse fs.readFile jsonPath
    json.version = "1.2.3"

    # The JSCompiler will listen to the bundler for "package.json" changes.
    writeModule jsonPath, JSON.stringify(json, null, 2)

    await runBundle()
    t.eq getModuleIds(), ["example", "x", "z@1.2.3", "z@2.0.0"]

  tp.test "remove package with same name as another package", (t) ->
    writeModule "node_modules/x/index.js"

    await runBundle()
    t.eq getModuleIds(), ["example", "x", "z"]

tp.test "add package with same name & version as another package", (t) ->
  writeModule main, "require('x'); require('z')"
  fs.writeFile "node_modules/x/index.js", "require('y')"
  fs.writeFile "node_modules/z/index.js", "require('y')"

  await readBundle()
  t.eq bundle.missing.size, 0
  t.eq getModuleIds(), ["example", "x", "z", "y"]

#
# Helpers
#

resetBundle = ->
  fs.reset()

  # Start with an empty main module.
  writeModule main, ""

  bundle = project.bundle
    dev: true
    platform: "web"

  await runBundle()
  if bundle.order.length isnt 1
    throw Error "Bundle was not reset properly"

readBundle = ->
  bundle.read {onStop: noop}

runBundle = (ctx = {}) ->

  Object.defineProperty ctx, "window",
    value: ctx
    writable: false
    configurable: false

  code = await readBundle()
  vm.runInNewContext code, ctx
  return ctx

getModuleName = (mod) ->
  bundle.relative mod.file.path

getModuleNames = ->
  bundle.order.map getModuleName

getModuleIds = ->
  {compiler} = bundle
  bundle.order.map (mod) ->
    compiler.moduleIds.get mod

getChangedNames = ->
  Array.from(bundle.changed).map getModuleName

writeModule = (name, code) ->
  file = path.resolve root, name
  fs.writeFile file, code
  unless bundler.reloadFile file
    bundler.addFile file, path.extname name
    return

appendModule = (name, code) ->
  file = path.resolve root, name
  fs.append file, code
  unless bundler.reloadFile file
    bundler.addFile file, path.extname name
    return
