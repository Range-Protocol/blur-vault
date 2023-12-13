// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers, network } = require("hardhat");
const HELPERS_LIB_ADDRESS = "0x5c55cd67a6bD0D4C315B50CB6CD589bfB080017E";

async function main() {
	const manager = "0xc8D04aDBB5029EcC97Caa3e6065DAC8b1008a881";
	await network.provider.request({
		method: "hardhat_impersonateAccount",
		params: [manager],
	});
	const signer = await ethers.getSigner(manager);
	const RangeProtocolBlendVault = await ethers.getContractFactory("RangeProtocolBlendVault", {
		libraries: {
			Helpers: HELPERS_LIB_ADDRESS
		}
	});
	const impl = await RangeProtocolBlendVault.deploy(); // to be updated.
	const UPGRADE_INTERFACE = new ethers.utils.Interface([
		"function upgradeToAndCall(address newImplementation, bytes memory data) public"
	]);
	const data = UPGRADE_INTERFACE.encodeFunctionData("upgradeToAndCall", [
		impl.address,
		"0x"
	]);
	await signer.sendTransaction({
		to: "0xeD72A71161258FC3Dc31e57650E2b464c69f4dC1",
		data,
	});
	
	const newVault = await ethers.getContractAt("RangeProtocolBlendVault", "0xeD72A71161258FC3Dc31e57650E2b464c69f4dC1");
	console.log(await newVault.virtualBalance());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
