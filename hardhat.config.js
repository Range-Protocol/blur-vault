require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("@nomicfoundation/hardhat-chai-matchers");
require('@openzeppelin/hardhat-upgrades');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  etherscan: {
    apiKey: "DNRBUQ9BW2YU2777ZAF4767QS2B6AHQIGS"
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://1rpc.io/eth",
        // blockNumber: 18568795
      }
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  }
};
