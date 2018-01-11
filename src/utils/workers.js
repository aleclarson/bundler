
import Farm from 'node-worker-farm/lib/farm'
import huey from 'huey'

const {slice} = Array.prototype

exports.call = function(method) {
  if (plugins.has(method)) {
    return call(method, slice.call(arguments, 1))
  }
  throw Error('Unknown worker method: ' + method)
}

exports.batch = function(method) {
  let batch = batches[method]
  if (arguments.length > 1) {
    if (!batch) {
      batches[method] = batch = []
      batch.promise = new Promise((resolve, reject) => {
        batch.resolve = resolve
        batch.reject = reject
      })
    }
    console.log(`Batching '${method}' call...`)
    const idx = batch.push(slice.call(arguments, 1)) - 1
    return batch.promise.then(results => results[idx])
  }
  return batch || []
}

exports.flush = function(method) {
  const batch = batches[method]
  if (batch && batch.length) {
    delete batches[method]
    console.log(`Flushing '${method}' with ${batch.length} calls...`)
    return call('batch', [method, batch])
      .then(batch.resolve, batch.reject)
  }
}

exports.flushAll = function() {
  const promises = Object.keys(batches).map(this.flush)
  return Promise.all(promises)
}

exports.plugin = function(method, code) {
  if (reserved.indexOf(method) > -1) {
    throw Error(`Cannot override the '${method}' method`)
  }
  if (plugins.has(method)) {
    throw Error(`Plugin named '${method}' already exists`)
  }
  plugins.add(method)
  if (typeof code == 'function') {
    code = code.toString()
  } else {
    code = `function(){${code}}`
  }
  let err
  every('plugin', [method, code], (res) => {
    if (!err && res instanceof Error) {
      console.error(err = res)
      plugins.delete(method)
    }
  })
}

exports.require = function(deps) {
  if (!Array.isArray(deps)) {
    deps = arguments
  }
  console.log('workers.require: ' + require('util').inspect(deps))
  let err
  every('require', deps, (res) => {
    if (!err && res instanceof Error) {
      console.error(err = res)
    }
  })
}

//
// Internal
//

const batches = {}
const plugins = new Set()
const reserved = ['plugin', 'require']

const farm = new Farm({
  autoStart: true,
  maxConcurrentWorkers: getNumWorkers(),
}, require.resolve('./worker'))
farm.setup()

exports.count = farm.activeChildren

// Call a method of any one worker.
function call(method, args) {
  return new Promise((resolve, reject) => {
    farm.addCall({
      method,
      args,
      retries: 0,
      callback(res) {
        if (res instanceof Error) {
          reject(res)
        } else {
          resolve(res)
        }
      }
    })
  })
}

// Send a message to every worker.
function every(method, args, callback) {
  if (!Array.isArray(args)) {
    args = slice.call(args)
  }
  const config = {method, args, retries: 0, callback}
  for (let childId in farm.children) {
    farm.send(childId, config)
  }
}

function getNumWorkers() {
  let cores
  try {
    cores = require('physical-cpu-count')
  } catch (err) {
    cores = os.cpus().length
  }
  return cores || 1
}
