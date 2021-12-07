// This scripts adds a pool to the JSON by gathering most of the information
// from the contract and the blocks explorer.

'use strict'

require('dotenv').config()

const erc20Abi = require('erc-20-abi')
const fetch = require('node-fetch').default
const fs = require('fs')
const Web3 = require('web3')

const metadata = require('../src/vesper-metadata.json')

const poolAbi = require('./pool-abi.json')

const [address, chainId = '1'] = process.argv.slice(2)

function getNodeUrl() {
  switch (chainId) {
    case '1':
      return process.env.ETH_NODE_URL
    case '137':
      return process.env.POLYGON_NODE_URL
    default:
      throw new Error(`Missing node URL for chain ${chainId}`)
  }
}

function getExplorerUrl() {
  switch (chainId) {
    case '1':
      return 'https://api.etherscan.io/api'
    case '137':
      return 'https://api.polygonscan.com/api'
    default:
      throw new Error(`Missing explorer URL for chain ${chainId}`)
  }
}

function getTokenSymbol(token) {
  return new web3.eth.Contract(erc20Abi, token).methods.symbol().call()
}

function getBirthBlock() {
  const search = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address,
    startblock: '11400000',
    page: '1',
    offset: '1',
    sort: 'asc'
  }).toString()
  return fetch(`${getExplorerUrl()}?${search}`)
    .then(function (res) {
      if (!res.ok) {
        throw new Error(`Response error ${res.status}: ${res.statusText}`)
      }
      return res.json()
    })
    .then(function (/** @type {object} */ response) {
      const tx = response.result[0]
      if (tx.contractAddress.toLowerCase() !== address.toLowerCase()) {
        return 0
      }
      return Number.parseInt(tx.blockNumber)
    })
}

function getMayorVersion(version) {
  return Number.parseInt(version.split('.')[0])
}

function unwrapped(asset) {
  return {
    'WETH:1': 'ETH',
    'WMATIC:137': 'MATIC'
  }[`${asset}:${chainId}`]
}

if (
  metadata.pools.find(
    pool =>
      pool.address.toLowerCase() === address.toLowerCase() &&
      pool.chainId === Number.parseInt(chainId)
  )
) {
  console.log('Pool already added')
  process.exit(0)
}

// @ts-ignore ts(2351)
const web3 = new Web3(getNodeUrl())
const contract = new web3.eth.Contract(poolAbi, address)
Promise.all([
  contract.methods.name().call(),
  contract.methods.token().call().then(getTokenSymbol),
  getBirthBlock(),
  contract.methods.VERSION().call().then(getMayorVersion),
  contract.methods.symbol().call(),
  contract.methods.decimals().call().then(Number.parseInt)
])
  .then(function ([poolName, asset, birthblock, version, symbol, decimals]) {
    const name = poolName.split(' ')[0]
    const pool = {
      name,
      poolName,
      address: web3.utils.toChecksumAddress(address),
      asset: unwrapped(asset) || asset,
      birthblock,
      chainId: Number.parseInt(chainId),
      riskLevel:
        poolName.startsWith('va') ||
        poolName.startsWith('ve') ||
        chainId === '137'
          ? 4
          : 3,
      stage: 'alpha',
      version,
      symbol,
      decimals,
      logoURI: `https://raw.githubusercontent.com/vesperfi/metadata/master/src/logos/${name.toLowerCase()}.svg`,
      type: poolName.startsWith('ve') ? 'earn' : 'grow'
    }

    metadata.pools.push(pool)
    metadata.pools
      .sort((a, b) => b.birthblock - a.birthblock)
      .sort((a, b) => a.chainId - b.chainId)
    fs.writeFileSync(
      'src/vesper-metadata.json',
      JSON.stringify(metadata, null, 2)
    )

    console.log(`${name} added!`)
  })
  .catch(function (err) {
    console.error(`Failed adding pool: ${err.message}`)
  })