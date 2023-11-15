const {
  time,
  loadFixture,
  mine,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");

const getInitData = ({ manager, blurPool, blend, name, symbol }) => {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "string", "string"],
    [manager, blurPool, blend, name, symbol]
  );
};

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
    auctionDuration,
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
    auctionDuration,
  };
  const lienId = data.lienId;
  return { lien, lienId };
};

let { lien, lienId } = createLienFromData({
  id: 1014374,
  lienId: 10762,
  block: 18575427,
  time: "2023-11-15 06:11:47.000 UTC",
  collection: "0x8821bee2ba0df28761afff119d66390d594cd280",
  borrower: "0x3dfb265c05e7bf4b3f3e5d477947318ca48d5917",
  lender: "0xcbb0fe555f61d23427740984325b4583a4a34c82",
  tokenId: 6017,
  amount: "2639289189796039053",
  rate: 880,
  auctionDuration: 9000,
  startTime: 1699940399,
  auctionStartBlock: 18575427,
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
    [manager, user] = await ethers.getSigners();
    const RangeProtocolBlurVault = await ethers.getContractFactory(
      "RangeProtocolBlurVault",
      {
        libraries: {
          Helpers: HELPERS_LIB_ADDRESS,
        },
      }
    );
    vault = await upgrades.deployProxy(
      RangeProtocolBlurVault,
      [
        getInitData({
          manager: manager.address,
          blurPool: BLUR_POOL,
          blend: BLEND,
          name: VAULT_NAME,
          symbol: VAULT_SYMBOL,
        }),
      ],
      {
        unsafeAllowLinkedLibraries: true,
      }
    );
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
      await expect(
        vault.connect(user).mint(amount, { value: amount })
      ).to.be.revertedWithCustomError(vault, "InvalidETHAmount");
    });

    it("should not mint vault shares when deposit amount param is different from actual sent amount", async () => {
      const amount = ethers.parseEther("2");
      await expect(
        vault.connect(user).mint(amount, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(vault, "InvalidETHAmount");
    });

    it("should mint vault shares", async () => {
      const amount = ethers.parseEther("100");
      expect(await blurPool.balanceOf(vaultAddress)).to.be.equal(0);
      await expect(vault.connect(user).mint(amount, { value: amount }))
        .to.emit(vault, "Minted")
        .withArgs(user.address, amount, amount);
      expect(await blurPool.balanceOf(vaultAddress)).to.be.equal(amount);
      expect(await vault.balanceOf(user.address)).to.be.equal(amount);
    });
  });

  describe("Refinance", async () => {
    it("should not refinance auction by non-manager", async () => {
      await expect(
        vault.connect(user).refinanceAuction(lien, lienId, 500)
      ).to.be.revertedWith("Ownable: caller is not the manager");
    });

    it("should refinance auction", async () => {
      const vaultBalanceBefore = await blurPool.balanceOf(vaultAddress);
      const newRate = 20;
      const txData = await (
        await vault.refinanceAuction(lien, lienId, newRate)
      ).wait();
      const vaultBalanceAfter = await blurPool.balanceOf(vaultAddress);

      let debt;
      txData.logs.forEach((log) => {
        const parsedLog = blurPool.interface.parseLog(log);
        if (!!parsedLog && parsedLog.name === "Transfer")
          debt = parsedLog.args[2];
      });
      expect(vaultBalanceAfter).to.be.equal(vaultBalanceBefore - debt);
      const timestamp = (await ethers.provider.getBlock(txData.blockNumber))
        .timestamp;
      const hash = ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "tuple(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256)",
          // "address",
          // "address",
          // "address",
          // "uint256",
          // "uint256",
          // "uint256",
          // "uint256",
          // "uint256",
          // "uint256",
        ],
        [
          [
            vaultAddress,
            lien.borrower,
            lien.collection,
            lien.tokenId,
            debt,
            timestamp,
            newRate,
            0,
            lien.auctionDuration,
          ],
        ]
      );

      expect(await blend.liens(lienId)).to.be.equal(ethers.keccak256(hash));
      const vaultUnderlyingBalanceBeforeTimelapse =
        await vault.getUnderlyingBalance();
      expect(await blurPool.balanceOf(vaultAddress)).lt(
        vaultUnderlyingBalanceBeforeTimelapse
      );

      await ethers.provider.send("evm_increaseTime", [50 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      expect(await vault.getUnderlyingBalance()).gt(
        vaultUnderlyingBalanceBeforeTimelapse
      );

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
        lien.auctionDuration,
      ] = lienData.lien;
      lienId = lienData.lienId;
    });

    it("cleaning up liens array should have no impact", async () => {
      expect(await vault.liensCount()).to.not.be.equal(0);
      await vault.cleanUpLiensArray();
      expect(await vault.liensCount()).to.not.be.equal(0);
    });
  });

  describe("Auction", async () => {
    it("non-manager should not start auction", async () => {
      await expect(
        vault.connect(user).startAuction(lien, lienId)
      ).to.be.revertedWith("Ownable: caller is not the manager");
    });

    it("should not start auction for invalid lien", async () => {
      await expect(vault.startAuction(lien, 1111)).to.be.reverted;
    });

    it("should start auction", async () => {
      const txData = await (await vault.startAuction(lien, lienId)).wait();
      expect(
        (await vault.getLiensByIndex(0, 1))[0].lien.auctionStartBlock
      ).to.be.equal(txData.blockNumber);
      lien.auctionStartBlock = txData.blockNumber;
    });
  });

  describe("Seize NFT", () => {
    before(async () => {
      await mine(lien.auctionDuration);
    });

    it("should not seize NFT by non-manager", async () => {
      await expect(
        vault.connect(user).seize([[lien, lienId]])
      ).to.be.revertedWith("Ownable: caller is not the manager");
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
  });

  describe("Liquidate NFT", () => {
    let types;
    let domain;
    let liquidateOrder;
    let signature;

    before(async () => {
      // const EIP712Domain = [
      // 	{ name: 'name', type: 'string' },
      // 	{ name: 'version', type: 'string' },
      // 	{ name: 'chainId', type: 'uint256' },
      // 	{ name: 'verifyingContract', type: 'address' },
      // ];

      types = {
        LiquidateOrder: [
          { name: "collection", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const { name, version, chainId, verifyingContract, salt } =
        await vault.eip712Domain();
      domain = {
        name,
        version,
        chainId,
        verifyingContract,
      };

      liquidateOrder = {
        collection: lien.collection,
        tokenId: lien.tokenId,
        amount: ethers.parseEther("1.2"),
        recipient: user.address,
        nonce: await vault.nonces(user.address),
        deadline: new Date().getTime() + 10_000,
      };

      signature = await manager.signTypedData(domain, types, liquidateOrder);
    });

    it("should not liquidate seized NFT with zero amount", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            liquidateOrder.deadline,
            signature,
            {
              value: 0,
            }
          )
      ).to.be.revertedWithCustomError(vault, "InvalidETHAmount");
    });

    it("should not liquidate seized NFT with less value sent than amount", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            liquidateOrder.deadline,
            signature,
            {
              value: liquidateOrder.amount / BigInt(2),
            }
          )
      ).to.be.revertedWithCustomError(vault, "InvalidETHAmount");
    });

    it("should not liquidate seized NFT with invalid recipient", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            ethers.ZeroAddress,
            liquidateOrder.deadline,
            signature,
            {
              value: liquidateOrder.amount,
            }
          )
      ).to.be.revertedWithCustomError(vault, "InvalidRecipient");
    });

    it("should not liquidate seized NFT with outdated order", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            0,
            signature,
            {
              value: liquidateOrder.amount,
            }
          )
      ).to.be.revertedWithCustomError(vault, "OutdatedOrder");
    });

    it("should not liquidate seized NFT with wrong collection", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            ethers.ZeroAddress,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            liquidateOrder.deadline,
            signature,
            {
              value: liquidateOrder.amount,
            }
          )
      ).to.be.revertedWithCustomError(vault, "InvalidSignature");
    });

    it("should not liquidate seized NFT with wrong tokenId", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            0,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            liquidateOrder.deadline,
            signature,
            {
              value: liquidateOrder.amount,
            }
          )
      ).to.be.revertedWithCustomError(vault, "InvalidSignature");
    });

    it("liquidate seized NFT", async () => {
      expect(
        ethers.verifyTypedData(domain, types, liquidateOrder, signature)
      ).to.be.equal(manager.address);

      const collection = await ethers.getContractAt("IERC721", lien.collection);
      expect(await collection.ownerOf(liquidateOrder.tokenId)).to.be.equal(
        vaultAddress
      );
      const vaultBalanceBefore = await blurPool.balanceOf(vaultAddress);
      expect(await vault.nonces(user.address)).to.be.equal(0);
      // address collection,
      // uint256 tokenId,
      // uint256 amount,
      // address recipient,
      // uint256 deadline,
      // bytes calldata signature
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            liquidateOrder.deadline,
            signature,
            {
              value: liquidateOrder.amount,
            }
          )
      )
        .to.emit(vault, "NFTLiquidated")
        .withArgs(
          liquidateOrder.collection,
          liquidateOrder.tokenId,
          liquidateOrder.amount,
          liquidateOrder.recipient
        );

      const vaultBalanceAfter = await blurPool.balanceOf(vaultAddress);
      expect(vaultBalanceAfter).to.be.equal(
        vaultBalanceBefore + liquidateOrder.amount
      );

      expect(await collection.ownerOf(liquidateOrder.tokenId)).to.not.be.equal(
        vaultAddress
      );
      expect(await collection.ownerOf(liquidateOrder.tokenId)).to.be.equal(
        user.address
      );
      expect(await vault.nonces(user.address)).to.be.equal(1);
    });

    it("should fail replaying the liquidate NFT order", async () => {
      await expect(
        vault
          .connect(user)
          .liquidateNFT(
            liquidateOrder.collection,
            liquidateOrder.tokenId,
            liquidateOrder.amount,
            liquidateOrder.recipient,
            liquidateOrder.deadline,
            signature,
            {
              value: liquidateOrder.amount,
            }
          )
      ).to.be.revertedWithCustomError(vault, "InvalidSignature");
    });
  });

  describe("Upgradeability", () => {
    it("non-manager should not upgrade proxy", async () => {
      const RangeProtocolBlurVault = await ethers.getContractFactory(
        "MockVault",
        {
          libraries: {
            Helpers: HELPERS_LIB_ADDRESS,
          },
        }
      );
      await vault.transferOwnership(user.address);
      await expect(
        upgrades.upgradeProxy(vaultAddress, RangeProtocolBlurVault, {
          unsafeAllowLinkedLibraries: true,
        })
      ).to.be.revertedWith("Ownable: caller is not the manager");
      await vault.connect(user).transferOwnership(manager.address);
    });

    it("manager should upgrade proxy", async () => {
      const RangeProtocolBlurVault = await ethers.getContractFactory(
        "MockVault",
        {
          libraries: {
            Helpers: HELPERS_LIB_ADDRESS,
          },
        }
      );
      const oldImpl = await getImplementationAddress(
        ethers.provider,
        vaultAddress
      );
      await (
        await upgrades.upgradeProxy(vaultAddress, RangeProtocolBlurVault, {
          unsafeAllowLinkedLibraries: true,
        })
      ).waitForDeployment();
      const newImpl = await getImplementationAddress(
        ethers.provider,
        vaultAddress
      );
      expect(newImpl).to.not.be.equal(oldImpl);
    });
  });
});
