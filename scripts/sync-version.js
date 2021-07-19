// Syncs the version of the metadata file with the version set in the
// package.json file.
//
// This script is executed just before comitting the changes
// done by the "npm version" command.

'use strict'

const fs = require('fs')

const packageJson = require('../package.json')
const metadata = require('../src/vesper-metadata.json')

metadata.version = packageJson.version
fs.writeFileSync('src/vesper-metadata.json', JSON.stringify(metadata, null, 2))
