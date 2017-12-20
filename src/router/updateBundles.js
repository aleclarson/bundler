
import readBody from 'read-body'
import path from 'path'

import type Project from '../Project'
import type File from '../File'

type Result = {status: number, error?: string}

export async function updateBundles(
  req: Object,
  main: string,
  project: Project,
): Promise<Result> {
  const bundles = project.findBundles(main)
  if (!bundles.length) {
    const error = `No bundles have an entry module of '${req.assetId}'`
    return {status: 404, error}
  }

  const buffer = await req.body || readBody(req, 1e8)
  try {
    var patch = JSON.parse(buffer.toString())
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
    const error = `No bundles use the given file: '${patch.file}'`
    return {status: 404, error}
  }

  if (patch.event == 'change') {
    bundles.forEach(bundle => {
      bundle.reloadModule(patch.file)
    })
  } else if (unlinkRE.test(patch.event)) {
    bundles.forEach(bundle => {
      bundle.deleteModule(patch.file)
    })
  } else {
    const error = 'Expected `body.event` to equal "change" or "delete"'
    return {status: 400, error}
  }

  return {status: 200}
}
