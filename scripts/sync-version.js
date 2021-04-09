'use strict'

const fs = require('fs')

const packageJson = require('../package.json')
const metadata = require('../src/vesper-metadata.json')

metadata.version = packageJson.version
fs.writeFileSync('src/vesper-metadata.json', JSON.stringify(metadata, null, 2))
