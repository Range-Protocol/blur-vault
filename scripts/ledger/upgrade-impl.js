// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const { LedgerSigner } = require("@anders-t/ethers-ledger");

async function main() {
	const provider = ethers.getDefaultProvider("");
	const ledger = await new LedgerSigner(provider, "");
	const impl = ""; // to be updated.
	
	const UPGRADE_INTERFACE = new ethers.utils.Interface([
		"function upgradeToAndCall(address newImplementation, bytes memory data) public"
	]);	const data = UPGRADE_INTERFACE.encodeFunctionData("upgradeToAndCall", [
		impl,
		"0x"
	]);
	
	await ledger.sendTransaction({
		to: "0xeD72A71161258FC3Dc31e57650E2b464c69f4dC1",
		data
	});
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
