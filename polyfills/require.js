
var __moduleFactories = Object.create(null);
var __moduleInstances = Object.create(null);

function __d(name, factory) {
  __moduleFactories[name] = factory;
}

function require(name) {
  var module = __moduleInstances[name];
  if (module) return module.exports;

  var factory = __moduleFactories[name];
  if (factory) {
    var exports = {};
    factory(module = {exports}, exports);
    __moduleInstances[name] = module;
    return module.exports;
  }

  throw Error('Cannot find module: ' + name);
}

if (__DEV__) {
  window.require = require;
}
