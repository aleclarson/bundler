// @flow

import path from 'path'
import noop from 'noop'

import type {Platform} from '../File'
import type Project from '../Project'

import {log, huey} from '../logger'
import * as utils from './utils'

export type ReadConfig = {
  main?: string;
  onRead?: (code: string) => mixed;
  onStop?: (listener: Function) => void;
}

type Result = {status: number, code?: string, error?: string}

export async function readBundle(
  req: Object,
  config: ReadConfig,
  project: Project,
): Promise<Result> {
  const platform: Platform = req.query.platform
  if (!platform) {
    const error = `Expected \`query.platform\` to exist`
    return {status: 400, error}
  }

  if (config.main) {
    var main = path.join(project.root.path, config.main)
  }

  const dev = utils.parseBool(req.query.dev, false)
  try {
    var bundle = project.bundle({dev, main, platform})
  } catch(error) {
    if (error.code == 'NO_MAIN_MODULE') {
      return {status: 400, error: error.message}
    } else {
      throw error
    }
  }

  const cached = bundle._promise != null
  if (!cached && bundle._canPatch) {
    utils.clearTerminal()
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
    missing.forEach((refs, mod) => {
      const {imports} = mod.file
      const name = path.relative(root, mod.path)
      refs.forEach(ref => {
        const line = huey.gray(`:${1 + imports[ref].line}`)
        log(`  ~/${name}${line} ` + huey.red('➤ ' + ref))
      })
    })
    log('')
  })

  if (!config.onStop) {
    config.onStop = noop
  }

  const started = Date.now()
  try {
    let code = await bundle.read((config: Object))
    if (missed) {
      code = `throw Error('Bundle failed. Please check your terminal.')`
    } else if (code && !cached) {
      const elapsed = huey.cyan(utils.getElapsed(started))
      const name = huey.green('~/' + bundle.main.name)
      log(`📦 Bundled ${name} in ${elapsed}`)
    }
    return {status: 200, code}
  } finally {
    bundle.off('missing')
  }
}
