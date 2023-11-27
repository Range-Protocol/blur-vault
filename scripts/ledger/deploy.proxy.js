// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const { LedgerSigner } = require("@anders-t/ethers-ledger");

const getInitData = ({ manager, blurPool, blend, name, symbol }) => {
	return ethers.utils.defaultAbiCoder.encode(
		["address", "address", "address", "string", "string"],
		[manager, blurPool, blend, name, symbol]
	);
};

const BLUR_POOL = "0x0000000000A39bb272e79075ade125fd351887Ac";
const BLEND = "0x29469395eAf6f95920E59F858042f0e28D98a20B";
const MANAGER = "0xc8D04aDBB5029EcC97Caa3e6065DAC8b1008a881"; // to be updated
const VAULT_NAME = ""; // to be updated
const VAULT_SYMBOL = ""; // to be updated
const IMPLEMENTATION = ""; // to be updated

async function main() {
	const provider = ethers.getDefaultProvider("");
	const ledger = await new LedgerSigner(provider, "");
	const initData = getInitData({
		manager: MANAGER,
		blurPool: BLUR_POOL,
		blend: BLEND,
		name: VAULT_NAME,
		symbol: VAULT_SYMBOL,
	});
	const RangeProtocolBlurVault = await ethers.getContractAt("RangeProtocolBlurVault", IMPLEMENTATION);
	const calldata = RangeProtocolBlurVault.interface.encodeFunctionData("initialize", [
		initData,
	]);
	const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
	const proxy = await ERC1967Proxy.deploy(IMPLEMENTATION, calldata);
	const vault = await ethers.getContractAt("RangeProtocolBlurVault", proxy.address);
	console.log("Proxy: ", vault.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
