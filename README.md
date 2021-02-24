# Vesper Metadata

This module contains deployment addresses and relevant information about all the [Vesper](https://vesper.finance) pool contracts and the [ERC-20](https://eips.ethereum.org/EIPS/eip-20) [Vesper token (VSP)](https://etherscan.io/token/0x1b40183EFB4Dd766f11bDa7A7c3AD8982e998421).

Information in this repo is based on the [contracts list at the `vesperfi/doc` repo](https://github.com/vesperfi/doc/blob/main/v2/contracts.json).

## Installation

It is also available as a [NPM](https://www.npmjs.com/) module:

```sh
npm install vesper-metadata
```

## Usage

```js
const metadata = require('vesper-metadata')

metadata.pools
  .filter(pool => pool.stage === 'prod')
  .forEach(function (pool) {
    // Do stuff with each pool...
  })
```

## Metadata contents

Everything is contained in a single JSON file: [`src/vesper-metadata.json`](src/vesper-metadata.json).

It has 3 main sections: controllers, pools and tokens.
Each section contain information on the contracts, including:

- `name`: The common name of the contract.
- `address`: The deployment address in [EIP-55](https://eips.ethereum.org/EIPS/eip-55) checksum format.
- `chainId`: The deployment chain.

### Controllers

This section contains the main control contracts of the ecosystem: the Controller and the Collateral Manager.

### Pools

This section contains all the pool contracts, past and present.
On top of the basic contract information, each pool has the following properties:

- `asset`: The symbol of the collateral/deposit token.
- `birthblock`: The block at which the contract was created.
- `riskLevel`: The risk level of the contract in a scale from 1 (low) to 5 (high).
- `stage`: The pool's maturity stage: prod, beta, alpha, experimental.

### Tokens

This section contains information on the VSP token in a format compatible with [Uniswap's default token list](https://github.com/Uniswap/default-token-list).

## License

MIT
