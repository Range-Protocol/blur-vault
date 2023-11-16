const { expect } = require("chai");
const { ethers } = require("hardhat");

const bn = (value) => ethers.BigNumber.from(value);
const getInitData = ({ manager, blurPool, blend, name, symbol }) => {
  return ethers.utils.defaultAbiCoder.encode(
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
  id: 1016898,
  lienId: 16084,
  block: 18581124,
  time: "2023-11-16 01:20:11.000 UTC",
  collection: "0xd3d9ddd0cf0a5f0bfb8f7fceae075df687eaebab",
  borrower: "0x5e5c817e9264b46cbbb980198684ad9d14f3e0b4",
  lender: "0x51fee9bf45c5dab188b57048658696edab9d72cf",
  tokenId: 3693,
  amount: "240153470052526694",
  rate: 0,
  auctionDuration: 9000,
  startTime: 1699995311,
  auctionStartBlock: 18581124,
});

async function mineNBlocks(n) {
  for (let index = 0; index < n; index++) {
    await ethers.provider.send("evm_mine");
  }
}

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
let debt;

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
    const vaultImpl = await RangeProtocolBlurVault.deploy();
    const initData = getInitData({
      manager: manager.address,
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
    vault = await ethers.getContractAt("RangeProtocolBlurVault", proxy.address);
    vaultAddress = vault.address;
    console.log((await ethers.provider.getBlock("latest")).number);
    console.log(vaultAddress);

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
      const amount = ethers.utils.parseEther("2");
      await expect(
        vault
          .connect(user)
          .mint(amount, { value: ethers.utils.parseEther("1") })
      ).to.be.revertedWithCustomError(vault, "InvalidETHAmount");
    });

    it("should mint vault shares", async () => {
      const amount = ethers.utils.parseEther("100");
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
      txData.logs.forEach((log) => {
        try {
          const parsedLog = blurPool.interface.parseLog(log);
          if (!!parsedLog && parsedLog.name === "Transfer")
            debt = bn(parsedLog.args[2]);
        } catch (e) {}
      });

      expect(vaultBalanceAfter).to.be.equal(vaultBalanceBefore.sub(debt));
      const timestamp = (await ethers.provider.getBlock(txData.blockNumber))
        .timestamp;
      const hash = ethers.utils.defaultAbiCoder.encode(
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

      expect(await blend.liens(lienId)).to.be.equal(
        ethers.utils.keccak256(hash)
      );
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
      await mineNBlocks(lien.auctionDuration);
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
        amount: debt.add(ethers.utils.parseEther("1")),
        recipient: user.address,
        nonce: await vault.nonces(user.address),
        deadline: new Date().getTime() + 10_000,
      };

      signature = await manager._signTypedData(domain, types, liquidateOrder);
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
              value: liquidateOrder.amount.div(2),
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
            ethers.constants.AddressZero,
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
            ethers.constants.AddressZero,
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
        ethers.utils.verifyTypedData(domain, types, liquidateOrder, signature)
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
        vaultBalanceBefore.add(liquidateOrder.amount)
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

  describe("Manager Fee", () => {
    it("should not set manager fee by non-manager", async () => {
      await expect(vault.connect(user).setManagerFee(500)).to.be.revertedWith(
        "Ownable: caller is not the manager"
      );
    });

    it("should not set manager fee by non-manager", async () => {
      const INVALID_MANAGER_FEE = 1001;
      await expect(
        vault.setManagerFee(INVALID_MANAGER_FEE)
      ).to.be.revertedWithCustomError(vault, "InvalidManagerFee");
    });

    it("should set manager fee my manager", async () => {
      await expect(vault.setManagerFee(500))
        .to.emit(vault, "ManagerFeeSet")
        .withArgs(500);

      expect(await vault.managerFee()).to.be.equal(500);
    });
  });

  describe("Burn", () => {
    it("should not burn 0 shares", async () => {
      await expect(vault.connect(user).burn(0)).to.be.revertedWithCustomError(
        vault,
        "ZeroBurnAmount"
      );
    });

    it("should not burn more shares than owned", async () => {
      await expect(vault.burn(12324)).to.be.revertedWithCustomError(
        vault,
        "InsufficientUserBalance"
      );
    });

    it("should burn shares by the user", async () => {
      const underlyingBalance = await vault.getUnderlyingBalance();
      const userETHBalanceBefore = await ethers.provider.getBalance(
        user.address
      );
      const userVaultBalance = await vault.balanceOf(user.address);
      expect(userVaultBalance).to.be.equal(await vault.totalSupply());

      const managerFee = 500;
      const fee = underlyingBalance.mul(managerFee).div(10_000);
      const withdrawAmount = underlyingBalance.sub(fee);
      await expect(vault.connect(user).burn(userVaultBalance))
        .to.emit(vault, "Burned")
        .withArgs(user.address, userVaultBalance, withdrawAmount);

      expect(await ethers.provider.getBalance(user.address)).to.be.gt(
        userETHBalanceBefore
      );
      expect(await vault.totalSupply()).to.be.equal(0);
      expect(await vault.balanceOf(user.address)).to.be.equal(0);
      expect(await ethers.provider.getBalance(vaultAddress)).to.be.equal(fee);
    });
  });

  describe("ManagerFee", () => {
    it("should not collect manager fee by non-manager", async () => {
      await expect(vault.connect(user).collectManagerFee()).to.be.revertedWith(
        "Ownable: caller is not the manager"
      );
    });

    it("should not collect manager fee by non-manager", async () => {
      expect(await ethers.provider.getBalance(vaultAddress)).to.not.be.equal(0);
      await vault.collectManagerFee();
      expect(await ethers.provider.getBalance(vaultAddress)).to.be.equal(0);
    });
  });

  describe("Upgradeability", () => {
    let vaultImpl;
    const upgradeInterface = new ethers.utils.Interface([
      "function upgradeToAndCall(address newImplementation, bytes memory data) public",
    ]);

    before(async () => {
      const RangeProtocolBlurVault = await ethers.getContractFactory(
        "MockVault",
        {
          libraries: {
            Helpers: HELPERS_LIB_ADDRESS,
          },
        }
      );

      vaultImpl = await RangeProtocolBlurVault.deploy();
    });

    it("non-manager should not upgrade proxy", async () => {
      await expect(
        user.sendTransaction({
          to: vaultAddress,
          data: upgradeInterface.encodeFunctionData("upgradeToAndCall", [
            vaultImpl.address,
            "0x",
          ]),
        })
      ).to.be.revertedWith("Ownable: caller is not the manager");
    });

    it("manager should upgrade proxy", async () => {
      await manager.sendTransaction({
        to: vaultAddress,
        data: upgradeInterface.encodeFunctionData("upgradeToAndCall", [
          vaultImpl.address,
          "0x",
        ]),
      });
    });
  });
});
