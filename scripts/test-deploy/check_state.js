// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const fs = require("fs");
const path = require("path");
const {ethers, upgrades} = require("hardhat");
const getInitData = ({manager, blurPool, blend, name, symbol}) => {
	return ethers.utils.defaultAbiCoder.encode(
		["address", "address", "address", "string", "string"],
		[manager, blurPool, blend, name, symbol]
	);
};

const BLUR_POOL = "0x0000000000A39bb272e79075ade125fd351887Ac";
const BLEND = "0x29469395eAf6f95920E59F858042f0e28D98a20B";
const HELPERS_LIB_ADDRESS = "0x5c55cd67a6bD0D4C315B50CB6CD589bfB080017E";
const MANAGER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // to be updated
const VAULT_NAME = "Blur Vault"; // to be updated
const VAULT_SYMBOL = "BV"; // to be updated

async function main() {
	const vault = await ethers.getContractAt("RangeProtocolBlurVault", "0xeD72A71161258FC3Dc31e57650E2b464c69f4dC1");
	const lienCount = await vault.liensCount();
	const liens = await vault.getLiensByIndex(0, lienCount);
	liens.forEach(lien => {
		const lienObj = {};
		Object.keys(lien.lien).forEach(key => {
			if (isNaN(parseInt(key))) {
				lienObj[key] = lien.lien[key].toString();
			}
		});
		fs.writeFileSync(path.join(__dirname, `${lien.lienId}.json`), JSON.stringify(lienObj));
	});
	
	// for (let i = 0; i < 9000; i++) await ethers.provider.send("evm_mine");
	// const owner = await ethers.provider.call({
	// 	to: "0xD3D9ddd0CF0A5F0BFB8f7fcEAe075DF687eAEBaB",
	// 	data: (new ethers.utils.Interface([
	// 		"function ownerOf(uint256) external view returns (address)"
	// 	])).encodeFunctionData("ownerOf", [2826])
	// })
	// console.log(owner)
	// console.log(await vault.manager())
	// await signer.sendTransaction({
	// 	to: vault.address,
	// 	data: (new ethers.utils.Interface(["function mint(uint256 amount) external"])).encodeFunctionData("mint", [ethers.utils.parseEther("100")]),
	// 	value: ethers.utils.parseEther("100")
	// })
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
