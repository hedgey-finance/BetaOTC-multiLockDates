# OTC-multiLockDates

Smart contracts and tests for the OTC and multi-date locking mechanism. This OTC smart contract is Token (either NFT or ERC20) gated,
 and when buyers purchase tokens from the specific deal, the tokens are then locked into NFTs based on the array of locking dates.
 The benefit is that a seller can lay out a string of 12months worth of vesting time-locked NFTs, and sell this as a single transaction.   
 
 Included is a whitelisted ERC20 token that can be used to batch airdrop single tokens to buyers on the whitelist. 
 This token allows for easy whitelist management, as the creator can both list (ie mint) a single token to select addresses, 
 and then delist those users, by burning the tokens. the tokens are non-transferrable as well - very easy whitelist management using a modified ERC20 contract,
 that works as the token gate for the OTC contract. 
 
## Testing
Clone repository

``` bash
npm install
npx hardhat compile
npx hardhat test
```

## Ethereum Mainnet Deployment
OTC multi-lock contract deployed: `0xf9e896b068cf9d71F3e7e4A710E72D6bA4531212`  
linked to the NFT Contract deployed at: `0x2AA5d15Eb36E5960d056e8FeA6E7BB3e2a06A351`  

## Testnet (Rinkeby) Deployments  
OTC contract deployed at `0x9037130073CcF59178253958C7cA5848dca1e74b`  
WhiteListToken (WLT) contract deployed at `0x0fa8408288C9e0C98143323c696fC7b6D9b4d04C`  

Other useful contracts for testing: 
Futures NFT contract deployed at `0x4Bc8Ea84bdC3EBB01D495e5D1605d4F082aEb5d7`  
Sample testing NFT contract deployed at `0xB6a7e89198A617030864E2689E09aDd75F47C63D`  
