
const {slice} = Array.prototype

exports.plugin = function(name, code, done) {
  const fn = eval(`(${code})()`)
  if (typeof fn == 'function') {
    exports['_' + name] = innerFn
    exports[name] = function() {
      const args = slice.call(arguments), done = args.pop()
      return innerFn(args).then(done, done)
    }
    function innerFn(args) {
      return new Promise((resolve, reject) => {
        const res = fn.apply(null, args)
        if (res && typeof res.then == 'function') {
          res.then(resolve, reject)
        } else {
          resolve(res)
        }
      })
    }
    done()
  } else {
    const type = fn == null ? fn : (typeof fn).replace(/^\w/, article)
    done(Error(`Plugin named '${name}' returned ${type}, expected a function`))
  }
}

exports.require = function() {
  const args = slice.call(arguments)
  const done = args.pop()
  try {
    args.forEach(dep => require(dep))
    done()
  } catch(err) {
    done(err)
  }
}

exports.batch = function(method, batch, done) {
  const fn = exports['_' + method]
  try {
    const promises = batch.map(args => fn(args))
    return Promise.all(promises).then(done, done)
  } catch(err) {
    done(err)
  }
}

function article(char) {
  return /^[aeiou].*/.test(char) ? 'an ' + char : 'a ' + char
}
