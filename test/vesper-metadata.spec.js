'use strict'

require('dotenv').config()

const erc20Abi = require('erc-20-abi')
const fs = require('fs')
const sushiswapTokens = require('@sushiswap/default-token-list')
const uniswapTokens = require('@uniswap/default-token-list')
const Web3 = require('web3')

const should = require('chai').use(require('chai-as-promised')).should()

const metadata = require('../src/vesper-metadata.json')

const poolAbi = require('./abi/pool.json')

const allTokens = [].concat(uniswapTokens.tokens).concat(sushiswapTokens.tokens)

describe('Metadata', function () {
  metadata.pools.forEach(function (pool) {
    describe(`Pool ${pool.name} (${pool.address})`, function () {
      it('should have proper structure', function () {
        pool.should.have.a.property('name').that.is.a('string')
        Web3.utils.checkAddressChecksum(pool.address).should.be.true
        pool.should.have.a.property('asset').that.is.a('string')
        pool.should.have.a.property('birthblock').that.is.a('number')
        pool.should.have.a.property('chainId').that.is.a('number')
        pool.should.have.a
          .property('riskLevel')
          .that.is.a('number')
          .within(1, 5)
        pool.should.have.a
          .property('stage')
          .that.is.a('string')
          .that.match(/^(alpha|beta|orbit|prod|retired)$/)
        pool.should.have.a.property('symbol').that.is.a('string')
        pool.should.have.a.property('decimals').that.is.a('number')
        pool.should.have.a.property('logoURI').that.is.a('string')
        pool.should.have.a
          .property('type')
          .that.is.a('string')
          .that.match(/^(earn|governance|grow|vfr-c|vfr-s)$/)

        if (pool.version) {
          pool.version.should.be.a('number')
        }
        if (pool.supersededBy) {
          Web3.utils.checkAddressChecksum(pool.supersededBy).should.be.true
        }
      })

      it('should have good image URL and file', function () {
        if (pool.stage === 'retired') {
          this.skip()
          return
        }
        const filename = pool.symbol.toLowerCase().replace('beta', '')
        const repoUrl = 'https://raw.githubusercontent.com/vesperfi/metadata'
        pool.logoURI.should.equal(
          `${repoUrl}/master/src/logos/${filename}.svg`,
          `Invalid logo URL for pool ${pool.address}`
        )
        fs.accessSync(`src/logos/${filename}.svg`)
      })

      it('should match contract data', function () {
        this.timeout(5000)

        let url
        switch (pool.chainId) {
          case 1:
            url = process.env.ETH_NODE_URL
            break
          case 137:
            url = process.env.POLYGON_NODE_URL
            break
          default:
            this.skip()
            return
        }
        const web3 = new Web3(url)
        const contract = new web3.eth.Contract(poolAbi, pool.address)

        return Promise.all([
          contract.methods
            .name()
            .call()
            .should.eventually.equal(
              `${pool.name.replace(/-v[0-9]+$/, '')} ${
                pool.name.startsWith('ve') ? 'Earn ' : ''
              }${pool.name === 'vVSP' ? 'pool' : 'Pool'}`
            ),
          contract.methods.name().call().should.eventually.equal(pool.poolName),
          contract.methods
            .token()
            .call()
            .then(address =>
              new web3.eth.Contract(erc20Abi, address).methods.symbol().call()
            )
            .should.eventually.equal(
              pool.asset === 'ETH' ? 'WETH' : pool.asset
            ),
          contract.methods
            .VERSION()
            .call()
            .then(version => version.substring(0, version.indexOf('.')))
            .catch(function (err) {
              if (err.message.toLowerCase().includes('reverted')) {
                return '1'
              }
              throw err
            })
            .should.eventually.equal((pool.version || 1).toString()),
          contract.methods.symbol().call().should.eventually.equal(pool.symbol),
          contract.methods
            .decimals()
            .call()
            .should.eventually.equal(pool.decimals.toString())
        ])
      })

      it('should follow the naming convention', function () {
        if (
          [
            '0x777A7850251b7A301cfA1E7b1d8a9c4a9C49Cf85', // vUSDC-v3
            '0xB1C0d6EFD3bAb0FC3CA648a12C15d0827e3bcde5' // vUSDC-v2
          ].includes(pool.address)
        ) {
          this.skip()
          return
        }
        pool.name.should.equal(pool.symbol)
      })

      it('should follow the symbol convention', function () {
        if (
          [
            '0x1e86044468b92c310800d4B350E0F83387a7097F', // vBetaUSDC
            '0x2C361913e2dA663e1898162Ec01497C46eb87AbF', // vBetaETH
            '0x74Cc5BC20B0c396dF5680eE4aeB6169A6288a8aF', // vBetaWBTC
            '0x8b3C8626cbfaA71d44bd76C1304214f4858E3639', // vDAI aggressive
            '0xd773cA264b5363F25F7f96319076753849Af168B' // vBTC
          ].includes(pool.address)
        ) {
          this.skip()
          return
        }
        if (pool.type === 'grow' && pool.riskLevel >= 4) {
          pool.symbol.should.equal(`va${pool.asset}`)
        } else if (pool.type === 'grow') {
          pool.symbol.should.equal(`v${pool.asset}`)
        } else if (pool.type === 'earn') {
          pool.symbol.should.match(new RegExp(`^ve${pool.asset}-[A-Z]+$`))
        }
      })

      it('should have deposit asset support in token lists', function () {
        if (pool.asset === 'ETH') {
          this.skip()
          return
        }
        should.exist(
          allTokens.find(
            token =>
              token.symbol === pool.asset && token.chainId === pool.chainId
          )
        )
      })
    })
  })
})
