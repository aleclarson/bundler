// @flow

import path from 'path'
import noop from 'noop'

import type {Platform} from '../File'
import type {Module} from '../Bundle'
import type Project from '../Project'

import {createTimer} from '../utils/timer'
import {log, huey} from '../logger'
import * as utils from './utils'

export type ReadConfig = {
  dev?: boolean;
  main?: string;
  platform?: Platform;
  onRead?: (code: string) => mixed;
  onStop?: (listener: Function) => void;
}

type Result = {status: number, code?: string, error?: string}

export async function readBundle(
  req: Object,
  config: ReadConfig,
  project: Project,
): Promise<Result> {
  const platform: Platform = config.platform || req.query.platform
  if (!platform) {
    const error = `Expected \`query.platform\` to exist`
    return {status: 400, error}
  }

  if (config.main) {
    var main = path.join(project.root.path, config.main)
  }

  const dev = config.dev != null ?
    config.dev : utils.parseBool(req.query.dev, false)

  try {
    var bundle = await project.bundle({dev, main, platform})
  } catch(error) {
    if (error.code == 'NO_MAIN_MODULE') {
      return {status: 400, error: error.message}
    } else {
      return {status: 500, error: error.stack}
    }
  }

  let missed = false
  bundle.on('missing', (missing) => {
    missed = true
    const root = bundle.main.package.path
    log('')
    log('💀 Bundle failed.')
    log('')
    log('These imports cannot be found:')
    log('')
    missing.forEach((refs: Set<string>, mod: Module) => {
      const {imports} = mod.file
      const name = path.relative(root, mod.path)
      refs.forEach(ref => {
        const line = huey.gray(`:${1 + (imports: any).get(ref).line}`)
        log(`  ~/${name}${line} ` + huey.red('➤ ' + ref))
      })
    })
    log('')
  })

  if (!config.onStop) {
    config.onStop = noop
  }

  const cached = bundle.isCached
  const started = Date.now()
  try {
    let timer = createTimer()
    let code = await bundle.read((config: Object))
    console.log('readBundle: ' + (timer.done().endTime - timer.startTime).toFixed(2))
    if (missed) {
      code = `throw Error('Bundle failed. Please check your terminal.')`
    } else if (code && !cached) {
      const elapsed = huey.cyan(utils.getElapsed(started))
      const name = huey.green('~/' + bundle._main.name)
      log(`📦 Bundled ${name} in ${elapsed}`)
    }
    return {status: 200, code}
  } finally {
    bundle.off('missing')
  }
}
