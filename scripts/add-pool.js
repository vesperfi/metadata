// This scripts adds a pool to the JSON by gathering most of the information
// from the contract and the blocks explorer.

'use strict'

require('dotenv').config()

const erc20Abi = require('erc-20-abi')
const fetch = require('node-fetch').default
const fs = require('fs')
const inquirer = require('inquirer')
const Web3 = require('web3')

const metadata = require('../src/vesper-metadata.json')

const poolAbi = require('./pool-abi.json')

const generalQuestions = [
  {
    type: 'rawlist',
    name: 'chainId',
    message: 'Select pool chain',
    choices: [
      {
        name: 'Ethereum',
        value: '1'
      },
      {
        name: 'Polygon',
        value: '137'
      },
      {
        name: 'Avalanche',
        value: '43114'
      },
      {
        name: 'BNB',
        value: '56'
      }
    ]
  },
  {
    name: 'address',
    message: 'Insert pool address'
  },
  {
    type: 'rawlist',
    name: 'collateralType',
    message: 'Select type of collateral',
    choices: [
      {
        name: 'Normal',
        value: 'normal'
      },
      {
        name: 'Rebasing',
        value: 'rebasing'
      },
      {
        name: 'Compounding',
        value: 'compounding'
      }
    ]
  }
]

const defiLlamaQuestion = {
  name: 'defiLlamaPoolId',
  message: 'Insert DefiLlama Pool ID'
}

inquirer
  .prompt(generalQuestions)
  .then(function (answers) {
    if (answers.collateralType !== 'normal') {
      return inquirer
        .prompt([defiLlamaQuestion])
        .then(({ defiLlamaPoolId }) => ({ ...answers, defiLlamaPoolId }))
    }
    return answers
  })
  .then(function ({
    chainId,
    address,
    collateralType,
    defiLlamaPoolId = null
  }) {
    function getNodeUrl() {
      switch (chainId) {
        case '1':
          return process.env.ETH_NODE_URL
        case '137':
          return process.env.POLYGON_NODE_URL
        case '43114':
          return process.env.AVALANCHE_NODE_URL
        case '56':
          return process.env.BNB_NODE_URL
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
        case '43114':
          return 'https://api.snowtrace.io/api'
        case '56':
          return 'https://api.bscscan.com/api'
        default:
          throw new Error(`Missing explorer URL for chain ${chainId}`)
      }
    }

    function getStartBlock() {
      return chainId === '43114' ? '9450000' : '11400000'
    }

    function getTokenDecimals(token) {
      return new web3.eth.Contract(erc20Abi, token).methods
        .decimals()
        .call()
        .then(Number.parseInt)
    }

    function getTokenSymbol(token) {
      return new web3.eth.Contract(erc20Abi, token).methods.symbol().call()
    }

    function getBirthBlock() {
      const search = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address,
        startblock: getStartBlock(),
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

    function handleAssetName(asset) {
      return unwrapped(asset) || asset
    }

    function unwrapped(asset) {
      return {
        'WAVAX:43114': 'AVAX',
        'WETH:1': 'ETH',
        'WMATIC:137': 'MATIC',
        'WBNB:56': 'BNB'
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
    const web3 = new Web3(getNodeUrl(chainId))
    const contract = new web3.eth.Contract(poolAbi, address)

    Promise.all([
      contract.methods.name().call(),
      contract.methods.token().call(),
      contract.methods.token().call().then(getTokenDecimals),
      contract.methods.token().call().then(getTokenSymbol),
      getBirthBlock(),
      contract.methods.VERSION().call().then(getMayorVersion),
      contract.methods.symbol().call(),
      contract.methods.decimals().call().then(Number.parseInt)
    ])
      .then(function ([
        poolName,
        token,
        collateralDecimals,
        asset,
        birthblock,
        version,
        symbol,
        decimals
      ]) {
        const name = poolName.split(' ')[0]
        const imageName = name.toLowerCase().split('.')[0]
        const pool = {
          name,
          poolName,
          address: web3.utils.toChecksumAddress(address),
          asset: handleAssetName(asset),
          birthblock,
          chainId: Number.parseInt(chainId),
          riskLevel:
            poolName.startsWith('va') ||
            poolName.startsWith('ve') ||
            chainId !== '1'
              ? 4
              : 3,
          stage: 'alpha',
          version,
          symbol,
          decimals,
          logoURI: `https://raw.githubusercontent.com/vesperfi/metadata/master/src/logos/${imageName}.svg`,
          type: poolName.startsWith('ve') ? 'earn' : 'grow',
          collateral: {
            address: token,
            decimals: collateralDecimals,
            symbol: asset,
            type: collateralType
          }
        }

        if (defiLlamaPoolId) {
          pool.collateral.defiLlamaPoolId = defiLlamaPoolId
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
  })
