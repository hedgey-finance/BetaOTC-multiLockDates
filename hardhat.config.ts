
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
const keys = require('./scripts/keys');

export default {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    }
  },
  networks: {
    goerli: {
      url: keys.goerliURL,
    },
    mainnet: {
      url: keys.mainnetURL,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: keys.etherscanAPI,
      goerli: keys.etherscanAPI,
    },
  },
};
