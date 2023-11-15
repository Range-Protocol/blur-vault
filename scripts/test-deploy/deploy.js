// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, upgrades } = require("hardhat");
const getInitData = ({ manager, blurPool, blend, name, symbol }) => {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "address", "string", "string"],
    [manager, blurPool, blend, name, symbol]
  );
};

const BLUR_POOL = "0x0000000000A39bb272e79075ade125fd351887Ac";
const BLEND = "0x29469395eAf6f95920E59F858042f0e28D98a20B";
const HELPERS_LIB_ADDRESS = "0x5c55cd67a6bD0D4C315B50CB6CD589bfB080017E";
const MANAGER = "0x5c55cd67a6bD0D4C315B50CB6CD589bfB080017E"; // to be updated
const VAULT_NAME = "asdasd"; // to be updated
const VAULT_SYMBOL = "asdasd"; // to be updated

async function main() {
  const RangeProtocolBlurVault = await ethers.getContractFactory(
    "RangeProtocolBlurVault",
    {
      libraries: {
        Helpers: HELPERS_LIB_ADDRESS,
      },
    }
  );
  const vaultImpl = await RangeProtocolBlurVault.deploy();
  const initData = getInitData({
    manager: MANAGER,
    blurPool: BLUR_POOL,
    blend: BLEND,
    name: VAULT_NAME,
    symbol: VAULT_SYMBOL,
  });
  const calldata = vaultImpl.interface.encodeFunctionData("initialize", [
    initData,
  ]);
  const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
  const proxy = await ERC1967Proxy.deploy(vaultImpl.address, calldata);
  const vault = await ethers.getContractAt("RangeProtocolBlurVault", proxy.address);
  
  console.log("Implementation: ", vaultImpl.address);
  console.log("Proxy: ", vault.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
