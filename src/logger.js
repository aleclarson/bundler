
const timber = require('timber')
const huey = require('huey')

timber.enable('tags', {
  warn: huey.yellow('warn: ')
})

exports.log = timber.create(process.env.LOG_LEVEL)
exports.huey = huey
