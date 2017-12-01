// @flow

const {fgroup, test, beforeAll, header} = require('testpass')

const Project = require('../../Project').default

header('patchBundle()')

const project = new Project({
  root: 'example',
  meta: {},
})

fgroup(() => {
  test('2 changes', (t) => {
    
  })
  test('1 change, 1 delete', (t) => {
  })
})
