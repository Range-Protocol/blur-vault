const {
	time,
	loadFixture,
	mine
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {anyValue} = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const {expect} = require("chai");
const {ethers, upgrades} = require("hardhat");

const getInitData = ({
											 manager, blurPool, blend, name, symbol
										 }) => {
	return ethers.AbiCoder.defaultAbiCoder().encode([
		"address",
		"address",
		"address",
		"string",
		"string"
	], [
		manager,
		blurPool,
		blend,
		name,
		symbol
	]);
}

const createLienFromData = (data) => {
	const {
		lender,
		borrower,
		collection,
		tokenId,
		amount,
		startTime,
		rate,
		auctionStartBlock,
		auctionDuration
	} = data;
	const lien = {
		lender,
		borrower,
		collection,
		tokenId,
		amount,
		startTime,
		rate,
		auctionStartBlock,
		auctionDuration
	};
	const lienId = data.lienId;
	return {lien, lienId}
}

let {lien, lienId} = createLienFromData(        {
	"id": 1013643,
	"lienId": 112833,
	"block": 18574050,
	"time": "2023-11-15 01:34:35.000 UTC",
	"collection": "0x60e4d786628fea6478f785a6d7e704777c86a7c6",
	"borrower": "0xfe42a5266ce7a21d2d0daffc2a1ab1677b1009fb",
	"lender": "0xf4fb9fa23edb32215e5284cf7dbfdb5607d51a5b",
	"tokenId": 28490,
	"amount": "5025306122850299158",
	"rate": 6480,
	"auctionDuration": 9000,
	"startTime": 1699835387,
	"auctionStartBlock": 18574050
});


const BLUR_POOL = "0x0000000000A39bb272e79075ade125fd351887Ac";
const BLEND = "0x29469395eAf6f95920E59F858042f0e28D98a20B";
const HELPERS_LIB_ADDRESS = "0x5c55cd67a6bD0D4C315B50CB6CD589bfB080017E";
const VAULT_NAME = "Range Blur Vault";
const VAULT_SYMBOL = "RBV";

let vault;
let vaultAddress;
let manager;
let user;
let blend;
let blurPool;

describe("Blur Vault", () => {
	before(async () => {
		blurPool = await ethers.getContractAt("IERC20", BLUR_POOL);
		blend = await ethers.getContractAt("IBlend", BLEND);
	});
	
	it("Should deploy Blur Vault", async () => {
		([manager, user] = await ethers.getSigners());
		const RangeProtocolBlurVault = await ethers.getContractFactory("RangeProtocolBlurVault", {
			libraries: {
				Helpers: HELPERS_LIB_ADDRESS
			}
		});
		vault = await upgrades.deployProxy(RangeProtocolBlurVault, [getInitData({
			manager: manager.address,
			blurPool: BLUR_POOL,
			blend: BLEND,
			name: VAULT_NAME,
			symbol: VAULT_SYMBOL
		})], {
			unsafeAllowLinkedLibraries: true
		});
		await vault.waitForDeployment();
		vaultAddress = await vault.getAddress();
		
		expect(await vault.blurPool()).to.be.equal(BLUR_POOL);
		expect(await vault.blend()).to.be.equal(BLEND);
		expect(await vault.name()).to.be.equal(VAULT_NAME);
		expect(await vault.symbol()).to.be.equal(VAULT_SYMBOL);
	});
	
	describe("Mint", () => {
		it("should not mint vault shares with zero deposit amount", async () => {
			const amount = 0;
			await expect(vault.connect(user)
				.mint(amount, {value: amount}))
				.to.be.revertedWithCustomError(vault, "InvalidETHAmount");
		});
		
		it("should not mint vault shares when deposit amount param is different from actual sent amount", async () => {
			const amount = ethers.parseEther("2");
			await expect(vault.connect(user)
				.mint(amount, {value: ethers.parseEther("1")}))
				.to.be.revertedWithCustomError(vault, "InvalidETHAmount");
		});
		
		it("should mint vault shares", async () => {
			const amount = ethers.parseEther("100");
			expect(await blurPool.balanceOf(vaultAddress)).to.be.equal(0);
			await expect(vault.connect(user)
				.mint(amount, {value: amount}))
				.to.emit(vault, "Minted")
				.withArgs(
					user.address,
					amount,
					amount
				);
			expect(await blurPool.balanceOf(vaultAddress)).to.be.equal(amount);
			expect(await vault.balanceOf(user.address)).to.be.equal(amount);
		});
	});
	
	describe("Auction", async () => {
		it("should refinance auction", async () => {
			// {
			//   "id": 1011683,
			//   "lienId": 71766,
			//   "block": 18569017,
			//   "time": "2023-11-14 08:42:11.000 UTC",
			//   "collection": "0x8821bee2ba0df28761afff119d66390d594cd280",
			//   "borrower": "0x7a21ab3efff3ea1faadfc1afbfbf563ef2d97bf3",
			//   "lender": "0xcbb0fe555f61d23427740984325b4583a4a34c82",
			//   "tokenId": 5953,
			//   "amount": "2322537230708318086",
			//   "rate": 370,
			//   "auctionDuration": 9000,
			//   "startTime": 1699863035,
			//   "auctionStartBlock": 18569017
			// },
			//
			// address lender;
			// address borrower;
			// ERC721 collection;
			// uint256 tokenId;
			// uint256 amount;
			// uint256 startTime;
			// uint256 rate;
			// uint256 auctionStartBlock;
			// uint256 auctionDuration;
			// const lien = {
			// 	lender: "0xcbb0fe555f61d23427740984325b4583a4a34c82",
			// 	borrower: "0x7a21ab3efff3ea1faadfc1afbfbf563ef2d97bf3",
			// 	collection: "0x8821bee2ba0df28761afff119d66390d594cd280",
			// 	tokenId: 5953,
			// 	amount: "2322537230708318086",
			// 	startTime: 1699863035,
			// 	rate: 370,
			// 	auctionStartBlock: 18569017,
			// 	auctionDuration: 9000
			// }
			
			
			const vaultBalanceBefore = await blurPool.balanceOf(vaultAddress);
			const newRate = 500;
			const txData = await (await vault.refinanceAuction(lien, lienId, newRate)).wait();
			const vaultBalanceAfter = await blurPool.balanceOf(vaultAddress);
			
			let debt;
			txData.logs.forEach(log => {
				const parsedLog = blurPool.interface.parseLog(log);
				if (!!parsedLog && parsedLog.name === "Transfer") debt = parsedLog.args[2];
			});
			expect(vaultBalanceAfter).to.be.equal(vaultBalanceBefore - debt);
			const timestamp = (await ethers.provider.getBlock(txData.blockNumber)).timestamp;
			const hash = ethers.AbiCoder.defaultAbiCoder().encode([
				"tuple(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256)"
				// "address",
				// "address",
				// "address",
				// "uint256",
				// "uint256",
				// "uint256",
				// "uint256",
				// "uint256",
				// "uint256",
			], [
				[vaultAddress,
					lien.borrower,
					lien.collection,
					lien.tokenId,
					debt,
					timestamp,
					newRate,
					0,
					lien.auctionDuration]
			]);
			
			expect(await blend.liens(lienId)).to.be.equal(ethers.keccak256(hash));
			const vaultUnderlyingBalanceBeforeTimelapse = await vault.getUnderlyingBalance();
			expect(await blurPool.balanceOf(vaultAddress)).lt(vaultUnderlyingBalanceBeforeTimelapse);
			
			await ethers.provider.send("evm_increaseTime", [50 * 24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			expect(await vault.getUnderlyingBalance()).gt(vaultUnderlyingBalanceBeforeTimelapse);
			
			const liensCount = await vault.liensCount();
			expect(liensCount).to.be.equal(1);
			const lienData = (await vault.getLiensByIndex(0, liensCount))[0];
			expect(lienData.lien.rate).to.be.equal(newRate);
			expect(lienData.lienId).to.be.equal(lienId);
			[
				lien.lender,
				lien.borrower,
				lien.collection,
				lien.tokenId,
				lien.amount,
				lien.startTime,
				lien.rate,
				lien.auctionStartBlock,
				lien.auctionDuration
			] = lienData.lien;
			lienId = lienData.lienId;
		});
		
		it("cleaning up liens array should have no impact", async () => {
			expect(await vault.liensCount()).to.not.be.equal(0);
			await vault.cleanUpLiensArray();
			expect(await vault.liensCount()).to.not.be.equal(0);
			console.log(await blurPool.balanceOf(vaultAddress));
			console.log(await vault.getCurrentlyOwnedDebt());
			console.log(await vault.getUnderlyingBalance());
		});
		
		it("should start auction", async () => {
			const txData = await (await vault.startAuction(lien, lienId)).wait();
			expect((await vault.getLiensByIndex(0, 1))[0].lien.auctionStartBlock)
				.to.be.equal(txData.blockNumber);
			
			lien.auctionStartBlock = txData.blockNumber;
			await mine(lien.auctionDuration);
		});
		
		it("should seize NFT", async () => {
			await vault.seize([[lien, lienId]]);
			const collection = await ethers.getContractAt("IERC721", lien.collection);
			expect(await collection.ownerOf(lien.tokenId)).to.be.equal(vaultAddress);
		});
		
		it("cleanup liens array", async () => {
			expect(await vault.liensCount()).to.not.be.equal(0);
			await vault.cleanUpLiensArray();
			expect(await vault.liensCount()).to.be.equal(0);
		});
		
		it("liquidate seized NFT", async () => {
			// const EIP712Domain = [
			// 	{ name: 'name', type: 'string' },
			// 	{ name: 'version', type: 'string' },
			// 	{ name: 'chainId', type: 'uint256' },
			// 	{ name: 'verifyingContract', type: 'address' },
			// ];
			
			const types = {
				LiquidateOrder: [
					{name: "collection", type: "address"},
					{name: "tokenId", type: "uint256"},
					{name: "amount", type: "uint256"},
					{name: "recipient", type: "address"},
					{name: "nonce", type: "uint256"},
					{name: "deadline", type: "uint256"}
				]
			};
			
			const {name, version, chainId, verifyingContract, salt} = await vault.eip712Domain();
			const domain = {
				name,
				version,
				chainId,
				verifyingContract,
			};
			const liquidateOrder = {
				collection: lien.collection,
				tokenId: lien.tokenId,
				amount: ethers.parseEther("1.2"),
				recipient: user.address,
				nonce: await vault.nonces(user.address),
				deadline: new Date().getTime() + 10_000
			}
			
			// const messageHash = ethers.TypedDataEncoder.hash(domain, types, liquidateOrder);
			const signature = await manager.signTypedData(domain, types, liquidateOrder);
			expect(ethers.verifyTypedData(domain, types, liquidateOrder, signature))
				.to.be.equal(manager.address);
			
			const collection = await ethers.getContractAt("IERC721", lien.collection);
			expect(await collection.ownerOf(liquidateOrder.tokenId)).to.be.equal(vaultAddress);
			const vaultBalanceBefore = await blurPool.balanceOf(vaultAddress);
			// address collection,
			// uint256 tokenId,
			// uint256 amount,
			// address recipient,
			// uint256 deadline,
			// bytes calldata signature
			await vault.connect(user).liquidateNFT(
				liquidateOrder.collection,
				liquidateOrder.tokenId,
				liquidateOrder.amount,
				liquidateOrder.recipient,
				liquidateOrder.deadline,
				signature,
				{
					value: liquidateOrder.amount
				}
			);
			
			const vaultBalanceAfter = await blurPool.balanceOf(vaultAddress);
			expect(vaultBalanceAfter).to.be.equal(vaultBalanceBefore + liquidateOrder.amount);
			
			expect(await collection.ownerOf(liquidateOrder.tokenId)).to.not.be.equal(vaultAddress);
			expect(await collection.ownerOf(liquidateOrder.tokenId)).to.be.equal(user.address);
		});
	});
});

