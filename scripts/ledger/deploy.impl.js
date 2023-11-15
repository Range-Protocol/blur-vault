// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const { LedgerSigner } = require("@anders-t/ethers-ledger");

const HELPERS_LIB_ADDRESS = "0x5c55cd67a6bD0D4C315B50CB6CD589bfB080017E";

async function main() {
	const provider = ethers.getDefaultProvider("");
	const ledger = await new LedgerSigner(provider, "");
	let RangeProtocolBlurVault = await ethers.getContractFactory(
		"RangeProtocolBlurVault",
		{
			libraries: {
				Helpers: HELPERS_LIB_ADDRESS,
			},
		}
	);
	RangeProtocolBlurVault = RangeProtocolBlurVault.connect(ledger);
	const vaultImpl = await RangeProtocolBlurVault.deploy();
	
	console.log("Implementation: ", vaultImpl.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
