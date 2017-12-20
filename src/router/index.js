// @flow

import path from 'path'
import noop from 'noop'

import type Project from '../Project'
import type Bundle from '../Bundle'

import {updateBundles} from './updateBundles'
import {readBundle} from './readBundle'
import {getElapsed} from './utils'
import {log, huey} from '../logger'

const unlinkRE = /^(unlink|delete)$/

export type MatchFn = (req: Object) => boolean
export type RouterFn = (req: Object, res: Object) => Promise<mixed>

// TODO: Support multiple projects.
export function createRouter(
  project: Project,
  match: MatchFn = noop.true,
): RouterFn {
  crawlProject(project)
  return async (req: Object, res: Object) => {
    const config: Object = {}
    if (!match.call(config, req)) {
      return req.next()
    }

    if (req.method == 'GET') {
      const {status, code, error} =
        await readBundle(req, config, project)

      res.statusCode = status
      if (error) {
        res.write(error)
        res.end()
      } else {
        if (config.onRead) {
          await config.onRead(code, res)
          if (res.headersSent) return
        }
        res.write(code)
        res.end()
      }
    }

    else if (req.method == 'PATCH') {
      const {status, error} =
        await updateBundles(req, config.main || req.path, project)

      res.statusCode = status
      error && res.write(error)
      res.end()
    }

    else {
      res.statusCode = 404
      res.end()
    }
  }
}

function crawlProject(project: Project): void {
  const started = Date.now()
  project.crawl()

  const elapsed = huey.cyan(getElapsed(started))
  const name = huey.green(project.root.name)
  log(`✨ Crawled ${name} in ${elapsed}`)
}
