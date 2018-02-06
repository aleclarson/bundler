// @flow

// Determine a file's format, taking into account any plugins.
export async function resolveFileType(file: File): Promise<string> {
  const pkg = file.package
  await pkg._loadPlugins(file.type)

  let fileType = file.type
  while (true) {
    const plugins = pkg.plugins[fileType]
    if (!plugins) {
      return fileType
    }

    let outputType
    for (let i = 0; i < plugins.length; i++) {
      const {fileTypes} = plugins[i]
      if (!fileTypes || Array.isArray(fileTypes)) {
        continue
      }
      if (fileTypes.hasOwnProperty(fileType)) {
        outputType = fileTypes[fileType]
        break
      }
      throw Error(`Unsupported file type: '${fileType}'`)
    }
    if (outputType) {
      fileType = outputType
    } else {
      return fileType
    }
  }
  return ''
}
