import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";

export default {
  gasReporter: {
    currency: 'USD',
    gasPrice: 21
  },
  solidity: {
    version: '0.8.7',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    }
  },
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL,
    },
  },
  etherscan: {
    apiKey: process.env.RINKEBY_API,
  }
};
