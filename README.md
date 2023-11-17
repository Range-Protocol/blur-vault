# Range Protocol's vault for Blur


# Scritps
## Run tests
```
npx hardhat test
```
## deploy vault implementation
```
npx hardhat run scripts/ledger/deploy.impl.js
```

## deploy vault proxy
```
npx hardhat run scripts/ledger/deploy.proxy.js
```


# Documentation

## The flow:
1. A user calls `mint` function to deposit ETH into the vault. (The vault swaps it into BlurPool tokens).
2. The manager calls `refinanceAuction` function to take an auction by paying of the owed debt to the auctioned lien and start a new lien where the vault acts as lender.
3. The manager calls `startAuction` to start an auction for the lien it owns. If someone takes up the auction, the vault's owned debt is paid by the taker is becomes part of the vault's passive balance.
4. The manager calls `seize` function to seize an NFT whose auction has expired. This will transfer the NFT from Blend contract to the vault.
5. Any user can call `liquidateNFT` function to purchase the NFT from the vault by paying the amount of ETH specified as `amount` in the order. The order and its content is signed off-chain by the vault manager and is verified on-chain.
6. A minter or vault shareholder can call `burn` function to burn their vault shares and redeem the underlying ETH amount.
7. A service would periodically call `cleanUpLiensArray` function to reduce the liens tracking array size which would result in reduce gas costs for the mint and burn functions.

- **initialize(bytes memory data)**\
  This function initializes the vaults state. It is called as delegate call from within the proxy contract. It accepts
  an arbitrary length bytes array that is decoded to retrieve the initialization data. Currently, it contains the following data.
  ```
  address _manager,
  address _blurPool,
  address _blend,
  string memory _name,
  string memory _symbol
  ```

- **mint(uint256 amount)**\
  This function allows users to provide Ether to the vault and in returns receive vault shares. The vault shares represent
  ownership of the user in the vault.

- **burn(uint256 shares)**\
  This function burns shares for the user and return them the corresponding underlying ETH amount to them. If the vault does
  not have enough asset amount to respond to user request, the transaction is reverted.

- **refinanceAuction(Lien calldata lien, uint256 lienId, uint256 rate)**\
  This function is called by the manager to take up an auction. It pays of the debt owed to the old lender of the lien and
  makes vault the lender of new lien. 

- **startAuction(Lien calldata lien, uint256 lienId)**\
  This function is called by the manager to start an auction for the lien.

- **seize(LienPointer[] calldata lienPointers)**\
  This function is called by the manager to seize an NFT from a lien for which the auction has expired.

- **cleanUpLiensArray()**\
  This function is publicly callable to clean up in-active liens from the array of all liens owned by the vault. This effectively
  reduces the length of liens array and results in has savings when the liens array is looped over to calculate underlying
  asset amount of the vault.

- **liquidateNFT(
  address collection,
  uint256 tokenId,
  uint256 amount,
  address recipient,
  uint256 deadline,
  bytes calldata signature
  )**\
  This function liquidates/sells off the NFT owned by the vault after it has been seized. The function can be called by anyone
  with the right order signed by the vault manager. The caller must be the `recipient` in the function parameter. The `signature`
  parameter passed to the function must evaluate to have to been signed the vault `manager`. The amount is taken from the user
  in the form of Ether and the NFT is transferred to the user.

- **getUnderlyingBalance()**\
  This function returns the underlying balance of the Blur vault. The underlying balance comprises the passive BlurPool balance and
  the sum of all debts owned by the vault for all of its liens.

- **getCurrentlyOwnedDebt**\
  This function returns the sum of all debt currently owned by the vault across all of its lien.

# Note:
Some parameters of a Lien change when it is refinanced by the Blur vault. Similarly, the parameters of a Lien change again when it is put up for an auction, so retrieve latest parameters of a lien, the function `getLiensByIndex` should be called to retrieve the latest parameters of a Lien.
  
