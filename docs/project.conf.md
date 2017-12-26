
# project.js

The bundler looks for a `project.js` file in the root directory of your project. You can also use [coffee-script](https://github.com/jashkenas/coffeescript) by having a `project.coffee` file!

Inside that file, you have access to the `project` object! Use its methods to configure the bundler. Read about its methods below.

## include(paths: ...string[]): void

Tell the bundler to crawl specific directories.

```js
// You can also pass an array of strings!
project.include('src', 'node_modules/foo')
```

## exclude(paths: ...string[]): void

Tell the bundler to ignore specific file paths.

```js
// You can also pass an array of strings!
project.exclude('node_modules')
```

- An **included** file takes precedence over its **excluded** parent directory.
- An **excluded** file takes precedence over its **included** parent directory.

## resolve((ref: string, file: File, bundle: Bundle) => string | false): void

Resolve a dependency path before the bundler tries.

Return `false` to skip custom resolution.

```js
// The default implementation.
project.resolve((ref, file, bundle) => false)
```

Alternatively, you can pass a mapping object.

```js
project.resolve({
  foo: 'node_modules/bar',
})
```

## resolveConflict((pkg1: Package, pkg2: Package) => ?boolean): void

Deduplicate packages with the same name.

Return `true` if `pkg1` should be used, otherwise `false`.

Return `null` to force manual resolution.

Don't call this method if you want all package versions to be included.

```js
project.resolveConflict((pkg1, pkg2) => {
  // Naïve version comparison, don't do this!
  return pkg1.meta.version >= pkg2.meta.version
})
```

## transform((file: File) => string | false): void

Although [`babel`](https://github.com/babel/babel) and [`typescript`](https://github.com/Microsoft/TypeScript) compilers are baked into the bundler, you may want to perform other transformations.

Return `false` to skip custom transformation.

```js
// The default implementation.
project.transform(file => false)
```

## loadPackage((pkg: Package) => void): void

Access every `Package` instance when each is created. This method is useful for custom logic involving package configuration.

```js
project.loadPackage(pkg => {
  // Do something for every package.
})
```
