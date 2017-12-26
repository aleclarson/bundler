
# Project

For most users of the bundler, you won't be calling the `Project` constructor directly. But if you are, its options and methods are detailed below!

## new Project(config: {})

- `root: string` The root directory path
- `meta: Object` An object of miscellaneous metadata
- `types?: string[]` File extensions that can be bundled
- `resolve?: Function` Custom module resolver

### Notes

- The project's `package.json` can be passed via the `meta` option.
- The `types` option defaults to `['js']`. Remember: no leading periods.

## bundle(config: {}): Bundle

Create a bundle, or retrieve an existing one.

- `dev: boolean`
- `platform: string` The target platform (eg: ios, android, web)

## hasFile(path: string): boolean

Returns `true` if a file path exists in the project.

## addFile(path: string): Project

Add a file to the project.

An error is thrown if the file already exists in the project.

## reloadFile(path: string):
