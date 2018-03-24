
# cara v0.1.0 ![experimental](https://img.shields.io/badge/stability-experimental-EC5315.svg?style=flat)

```js
const {Bundler} = require('cara')

const bundler = new Bundler()
const project = bundler.project({
  root: '/path/to/cwd',
  types: ['js'],
})

const bundle = project.bundle({
  dev: true,
  platform: 'ios',
})

project.crawl({
  exclude: ['*.test.js'],
})

const code = await bundle.read()
```

Ready to dive deeper? [Read this in-depth guide]() or view the [API documentation]().
