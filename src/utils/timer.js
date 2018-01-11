
import huey from 'huey'

const loadTime = nano() - process.uptime() * 1e9

export function createTimer(inline = false) {
  const start = now()
  function timer(id, inlineId) {
    let start = now(), event
    timer.pending.push(event = {id, start})
    event.done = function() {
      const length = now() - event.start
      if (inline) {
        console.log(huey.yellow(length.toFixed(2) + 'ms ')
          + id + (inlineId ? ': ' + huey.gray(inlineId) : ''))
      }
      done(timer, this, length)
    }
    return event
  }
  timer.startTime = start
  timer.pending = []
  timer.results = {}
  timer.done = allDone
  return timer
}

function done(timer, event, length) {
  const {pending, results} = timer
  const idx = pending.indexOf(event)
  if (idx > -1) {
    pending.splice(idx, 1)
    if (results.hasOwnProperty(event.id)) {
      results[event.id] += length
    } else {
      results[event.id] = length
    }
  } else {
    throw Error('Event not active')
  }
}

function allDone() {
  this.endTime = now()
  this.sort = sort
  this.elapsed = getElapsed
  this.toString = toString
  return this
}

function sort() {
  const pairs = []
  for (let id in this.results) {
    pairs.push([id, this.results[id]])
  }
  return pairs.sort((a, b) => b[1] > a[1] ? 1 : -1)
}

function getElapsed() {
  return (this.endTime - this.startTime).toFixed(2) + 'ms'
}

function toString(indent = '') {
  const total = 'total: ' + huey.yellow(this.elapsed() + '\n')
  const events = this.sort().map(pair =>
    indent + pair[0] + ': ' + huey.yellow(pair[1].toFixed(2) + 'ms'))
  return indent + total + events.join('\n')
}

function now() {
  return (nano() - loadTime) / 1e6
}

function nano() {
  const hr = process.hrtime()
  return hr[0] * 1e9 + hr[1]
}
