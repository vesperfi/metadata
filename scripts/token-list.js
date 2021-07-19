// Creates a new JSON file that is compatible with Uniswap's token list spec.
// See https://uniswap.org/blog/token-lists/ for details.
//
// This script is called just before publishing so the created file is updated
// and included in the published package.

'use strict'

const fs = require('fs')

const packageJson = require('../package.json')
const metadata = require('../src/vesper-metadata.json')

const tokenList = {
  name: 'Vesper Tokens',
  timestamp: new Date().toISOString(),
  version: {
    major: Number.parseInt(packageJson.version.split('.')[0]),
    minor: Number.parseInt(packageJson.version.split('.')[1]),
    patch: Number.parseInt(packageJson.version.split('.')[2])
  },
  tokens: []
    .concat(metadata.pools, metadata.tokens)
    .map(function (item) {
      const {
        address,
        chainId,
        decimals,
        logoURI,
        name,
        poolName,
        stage,
        symbol,
        type
      } = item
      const tags = []
      if (type) {
        tags.push('pool', type)
      }
      if (stage === 'retired') {
        tags.push('retired')
      }
      return {
        address,
        chainId,
        decimals,
        logoURI,
        name: poolName || name,
        symbol,
        tags: tags.length ? tags : undefined
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
  logoURI: metadata.tokens.find(token => token.symbol === 'VSP').logoURI
}
fs.writeFileSync(
  'src/vesper.tokenlist.json',
  JSON.stringify(tokenList, null, 2)
)
