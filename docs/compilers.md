
# Compilers

Compilers in `cara` concatenate many files into one file. The result is what's known as a bundle.

## Lifecycle methods

The following methods are called by the bundler. They provide a chance for the compiler to prepare itself or perform changes to each file (or the entire bundle).

Any of these methods can use the `async` keyword, but it's not required.

### createModule(File): Module

Called for every file which is new to the bundle.

Overriding this method is optional, but may be used to construct a `Module` subclass.
Or you can call `super.createModule(file)` and perform other logic here.

### deleteModule(Module): void

Called for every module that will be removed from the bundle. Perhaps
predictably, this method is never called during the first build.

A module may be deleted temporarily until a module further down in the bundle
that uses the deleted module can be found. This would result in `addModule`
being called after `deleteModule` in the same patch, and the deleted module
will be moved to the end of the bundle.

### loadModule(Module): string

This method can be used to transform modules and parse them for imports.
The `Module` object has a `code` property that always exists inside this method.

Remember that calls to `loadModule`, `createModule`, and `deleteModule` are often interweaved.

### wrapModule(Module): string

This method is only called when patching the bundle. You can manually call
this from within your `concatModules` method, or you can avoid using this
method at all. The `Module` object has a `code` property that always exists
inside this method.

While patching the bundle, this method is called when all modules have been
loaded and are in the process of being replaced or added.

### build(Module[], config: Object): string

This method is only called during the bundle's first build. It can combine
the array of modules any way it wants. Each `Module` object has a `code`
property that always exists inside this method.

### createPatcher(config: Object): Patcher

Your compiler may create a bundle that the default `Patcher` is not compatible
with. In that case, you'll need to design a `Patcher` subclass and return
an instance of it from this method.

Learn about the `Patcher` class [here]().
