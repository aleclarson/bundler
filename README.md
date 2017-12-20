
# cara v0.0.1 ![experimental](https://img.shields.io/badge/stability-experimental-EC5315.svg?style=flat)

```js
const Bundler = require('bundler')

const bundler = new Bundler()
const project = bundler.project({
  root: 'example', // Relative to process.cwd() unless `root` is absolute
  types: ['js'], // The default value
})

const bundle = project.bundle({
  platform: 'ios', // Required target platform
  polyfills: ['require'], // The default value
})

project.crawl({
  exclude: ['*.test.js'],
}).then(() => {
  bundle.read({
    dev: true, // Defaults to false
    globals: { // Variables accessible by every module
      foo: 1,
    }
  }).then(code => {
    console.log(code)
  })
})
```
