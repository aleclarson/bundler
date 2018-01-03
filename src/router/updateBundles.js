// @flow

import readBody from 'read-body'
import path from 'path'

import type Project from '../Project'
import type File from '../File'

type Result = {status: number, error?: string}

export async function updateBundles(
  req: Object,
  project: Project,
): Promise<Result> {
  const body = await readBody(req, 1e8)
  try {
    var patch = JSON.parse(body.toString())
  } catch(e) {
    const error = 'Expected `body` to be valid JSON'
    return {status: 400, error}
  }
  if (!path.isAbsolute(patch.file)) {
    const error = 'Expected `body.file` to be an absolute path'
    return {status: 400, error}
  }

  const file = project.bundler.getFile(patch.file)
  if (!file) {
    return {status: 404}
  }

  const bundles = project
    .filterBundles(bundle => bundle.hasModule(file))

  if (patch.event == 'change') {
    bundles.forEach(bundle => {
      bundle.reloadModule(patch.file)
    })
  } else if (patch.event == 'unlink') {
    bundles.forEach(bundle => {
      bundle.deleteModule(patch.file)
    })
  } else {
    const error = 'Expected `body.event` to equal "change" or "unlink"'
    return {status: 400, error}
  }

  return {status: 200}
}
