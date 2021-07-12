'use strict'

require('dotenv').config()

const fs = require('fs')
const Web3 = require('web3')
const erc20Abi = require('erc-20-abi')

require('chai').use(require('chai-as-promised')).should()

const metadata = require('../src/vesper-metadata.json')

const poolAbi = require('./abi/pool.json')

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
          .that.match(/^(alpha|beta|prod|retired)$/)
        pool.should.have.a.property('symbol').that.is.a('string')
        pool.should.have.a.property('decimals').that.is.a('number')
        pool.should.have.a.property('logoURI').that.is.a('string')
        pool.should.have.a
          .property('type')
          .that.is.a('string')
          .that.match(/^(grow|earn)$/)

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
    })
  })
})
