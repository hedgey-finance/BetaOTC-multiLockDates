import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";
import "hardhat-gas-reporter";

export default {
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21
  },
  solidity: {
    version: '0.8.7',
    settings: {
      optimizer: {
        enabled: true,
        runs: 10,
      },
    }
  }, 
};
