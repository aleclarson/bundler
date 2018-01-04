
path = require "path"
noop = require "noop"
tp = require "testpass"
vm = require "vm"

Bundler = require "../../Bundler"
bundler = new Bundler()

root = path.resolve __dirname, "../__fixtures__/project"
main = "index.js"

project = bundler.project {root}
project.crawl()

tp.header "class JSCompiler"

fs = null
tp.beforeAll ->
  fs = require("fsx-mock").install root

bundle = null
tp.beforeEach ->
  writeModule main
  bundle = project.bundle
    dev: true
    main: main
    platform: "web"
    force: true

  await runBundle()
  if bundle._modules.length isnt 1
    throw Error "Bundle was not reset properly"

tp.afterEach ->
  fs.reset()

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

    {window} = await runBundle()
    t.eq window.res, 1

  tp.test "remove a module (with deps)", (t) ->
    writeModule main

    await runBundle()
    t.eq getModuleNames(), [main]

  tp.test "remove all deps in a module", (t) ->
    writeModule main, "require('./a')"
    await runBundle()

    writeModule "a.js"
    await runBundle()
    t.eq getModuleNames(), [main, "a.js"]

# These tests use the same bundle.
tp.group ->

  tp.test "missing relative", (t) ->
    writeModule main, "import q from './q'"

    await readBundle()
    t.eq getModuleNames(), [main]

  tp.test "add missing relative", (t) ->
    writeModule "q.js"

    await readBundle()
    t.eq getModuleNames(), [main, "q.js"]

# These tests use the same bundle.
tp.group ->
  dep = "node_modules/x"

  tp.test "missing node_modules package", (t) ->
    fs.removeDir dep
    writeModule main, "import x from 'x'"

    await readBundle()
    t.eq getModuleNames(), [main]

  tp.test "add missing node_modules package", (t) ->
    fs.reset dep
    fs.writeFile depMain = "#{dep}/index.js"

    # Since `watchPackage` is not used in tests, we call this manually.
    bundler.package path.join root, dep

    await readBundle()
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
    t.eq getModuleIds(), ["project", "x", "z@1.0.0", "z@2.0.0"]

  # The goal here is to ensure renamed packages are always reloaded,
  # even if they were reloaded earlier in the same patch.
  tp.xtest "add duplicate package after the other package was patched", (t) ->

  # NOTE: This test does not currently pass.
  tp.xtest "change package version", (t) ->
    jsonPath = "node_modules/z/package.json"
    json = JSON.parse fs.readFile jsonPath
    json.version = "1.2.3"

    # The JSCompiler will listen to the bundler for "package.json" changes.
    writeModule jsonPath, JSON.stringify(json, null, 2)

    await runBundle()
    t.eq getModuleIds(), ["project", "x", "z@1.2.3", "z@2.0.0"]

  tp.test "remove package with same name as another package", (t) ->
    writeModule "node_modules/x/index.js"

    await runBundle()
    t.eq getModuleIds(), ["project", "x", "z"]

tp.test "add package with same name & version as another package", (t) ->
  writeModule main, "require('x'); require('z')"
  fs.writeFile "node_modules/x/index.js", "require('y')"
  fs.writeFile "node_modules/z/index.js", "require('y')"

  await runBundle()
  t.eq getModuleIds(), ["project", "x", "z", "y"]

#
# Helpers
#

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

getModule = (filePath) ->
  unless path.isAbsolute filePath
    filePath = path.join root, filePath
  file = bundler.getFile filePath
  return bundle.getModule file

getModuleName = (mod) ->
  bundle.relative mod.path

getModuleNames = ->
  bundle._modules.map getModuleName

getModuleIds = ->
  compiler = bundle._compiler
  bundle._modules.map (mod) ->
    compiler.moduleIds.get mod

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
