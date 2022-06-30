import { ethers } from 'hardhat';
import { Contract, Signer } from 'ethers';
import moment from 'moment';
import { expect } from 'chai';

describe('BetaOTC contract deals', function () {
  const one = ethers.utils.parseEther('1');
  const ten = ethers.utils.parseEther('10');
  const tomorrow = moment().add(1, 'day').unix().toString();
  const oneWeek = moment().add(1, 'week').unix().toString();
  const twoWeeks = moment().add(2, 'week').unix().toString();

  let accounts: Signer[];
  let betaOtc: Contract;
  let weth: Contract;
  let audi: Contract;
  let bmw: Contract;
  let account: Signer;
  let address: string;
  let nft: Contract;
  let hedgeys: Contract;

  before(async () => {
    accounts = await ethers.getSigners();
    account = accounts[0];
    address = await account.getAddress();

    const initialSupply = ethers.utils.parseEther('1000');

    const Weth = await ethers.getContractFactory('WETH9');
    weth = await Weth.deploy();

    const Hedgeys = await ethers.getContractFactory('Hedgeys');
    hedgeys = await Hedgeys.deploy(weth.address, '');

    const BetaOTC = await ethers.getContractFactory('BetaOTC');
    betaOtc = await BetaOTC.deploy(weth.address, hedgeys.address);

    const Audi = await ethers.getContractFactory('Token');
    audi = await Audi.deploy(initialSupply, 'Audi', 'AUD');

    const Bmw = await ethers.getContractFactory('Token');
    bmw = await Bmw.deploy(initialSupply, 'BMW', 'BMW');

    const NFT = await ethers.getContractFactory('NFT');
    nft = await NFT.deploy();
  });

  it('should create a gated deal to sell 10 audi for 1 bmw', async () => {
    // Arrange
    await audi.approve(betaOtc.address, ten);
    const unlockDates: string[] = [oneWeek, twoWeeks];
    const nfts: string[] = [nft.address];

    // Act
    const dealTransaction = await betaOtc.createNFTGatedDeal(
      audi.address,
      bmw.address,
      one,
      one,
      ten,
      tomorrow,
      unlockDates,
      nfts
    );
    const receipt = await dealTransaction.wait();
    const event = receipt.events.find((event: any) => event.event === 'NewNFTGatedDeal');
    const dealId = event.args['_d'];

    // Assert
    await expect(dealTransaction)
      .to.emit(betaOtc, 'NewNFTGatedDeal')
      .withArgs(dealId, address, audi.address, bmw.address, one, one, ten, tomorrow, unlockDates, nfts);
  });

  it('should close a deal', async () => {
    // Arrange
    await audi.approve(betaOtc.address, ten);
    const unlockDates: string[] = [oneWeek, twoWeeks];
    const nfts: string[] = [nft.address];

    // Act
    const balBefore = await audi.balanceOf(address);
    const createTransaction = await betaOtc.createNFTGatedDeal(
      audi.address,
      bmw.address,
      one,
      one,
      ten,
      tomorrow,
      unlockDates,
      nfts
    );
    const balAfterCreate = await audi.balanceOf(address);

    const receipt = await createTransaction.wait();
    const event = receipt.events.find((event: any) => event.event === 'NewNFTGatedDeal');
    const dealId = event.args['_d'];
    const closeTransaction = await betaOtc.close(dealId);

    const balAfter = await audi.balanceOf(address);

    // Assert
    await expect(closeTransaction).to.emit(betaOtc, 'DealClosed').withArgs(dealId);
    expect(balBefore).to.be.eq(balAfter);
    expect(balBefore).to.be.eq(balAfterCreate.add(one));
  });

  it('should be able to buy a deal when buyer is the owner of the NFT', async () => {
    // Arrange
    const buyer = accounts[1];
    const buyerAddress = await buyer.getAddress();

    await Promise.all([
      bmw.transfer(buyerAddress, ten),
      audi.approve(betaOtc.address, one),
      bmw.approve(betaOtc.address, ten.mul('10')),
      bmw.connect(buyer).approve(betaOtc.address, ten),
    ]);
    const unlockDates: string[] = [oneWeek, twoWeeks];
    const nfts: string[] = [nft.address];

    await nft.mintOne(buyerAddress);

    // Act
    const createTransaction = await betaOtc.createNFTGatedDeal(
      audi.address,
      bmw.address,
      one,
      one,
      ten,
      tomorrow,
      unlockDates,
      nfts
    );
    const createTransactionReceipt = await createTransaction.wait();
    const newDealEvent = createTransactionReceipt.events.find((event: any) => event.event === 'NewNFTGatedDeal');
    const dealId = newDealEvent.args['_d'];

    const buyTransaction = await betaOtc.connect(buyer).buy(dealId, one);

    // Assert
    await expect(buyTransaction).to.emit(betaOtc, 'TokensBought').withArgs(dealId, one, '0');
    await expect(buyTransaction)
      .to.emit(betaOtc, 'FutureCreated')
      .withArgs(buyerAddress, audi.address, one.div(unlockDates.length), unlockDates[0]);

    await expect(buyTransaction)
      .to.emit(betaOtc, 'FutureCreated')
      .withArgs(buyerAddress, audi.address, one.div(unlockDates.length), unlockDates[1]);

    const deal = await betaOtc.deals(dealId);

    // Deal should have no seller, which indicates it has been deleted
    expect(deal['seller']).to.eq(ethers.constants.AddressZero);

    // Buyer should have a number of NFTs which depends on the number of unlock dates
    const nftBalance = await hedgeys.balanceOf(buyerAddress);
    expect(nftBalance.eq(unlockDates.length)).to.be.true;
  });

  it('should be able to buy a deal when buyer is the owner of an ERC20 token', async () => {
    // Arrange
    const buyer = accounts[1];
    const buyerAddress = await buyer.getAddress();

    await Promise.all([
      bmw.transfer(buyerAddress, ten),
      audi.approve(betaOtc.address, one),
      bmw.approve(betaOtc.address, ten.mul('10')),
      bmw.connect(buyer).approve(betaOtc.address, ten),
    ]);
    const unlockDates: string[] = [oneWeek, twoWeeks];

    // The buyer has a number of BMW tokens, so they should be able to buy the deal
    const nfts: string[] = [bmw.address];

    // Act
    const createTransaction = await betaOtc.createNFTGatedDeal(
      audi.address,
      bmw.address,
      one,
      one,
      ten,
      tomorrow,
      unlockDates,
      nfts
    );
    const createTransactionReceipt = await createTransaction.wait();
    const newDealEvent = createTransactionReceipt.events.find((event: any) => event.event === 'NewNFTGatedDeal');
    const dealId = newDealEvent.args['_d'];

    const beforeNftBalance = await hedgeys.balanceOf(buyerAddress);

    const buyTransaction = await betaOtc.connect(buyer).buy(dealId, one);

    // Assert
    await expect(buyTransaction).to.emit(betaOtc, 'TokensBought').withArgs(dealId, one, '0');
    await expect(buyTransaction)
      .to.emit(betaOtc, 'FutureCreated')
      .withArgs(buyerAddress, audi.address, one.div(unlockDates.length), unlockDates[0]);

    const deal = await betaOtc.deals(dealId);

    // Deal should have no seller, which indicates it has been deleted
    expect(deal['seller']).to.eq(ethers.constants.AddressZero);

    // Buyer should have a number of NFTs which depends on the number of unlock dates
    const nftBalance = await hedgeys.balanceOf(buyerAddress);
    const difference = nftBalance - beforeNftBalance;
    expect(difference === unlockDates.length).to.be.true;
  });

  it('should not be able to buy a deal when not an owner of the NFT', async () => {
    // Arrange
    await audi.approve(betaOtc.address, one);
    await bmw.approve(betaOtc.address, ten.mul('10'));
    const unlockDates: string[] = [oneWeek, twoWeeks];
    const nfts: string[] = [nft.address];
    const buyer = accounts[1];

    // Act
    const createTransaction = await betaOtc.createNFTGatedDeal(
      audi.address,
      bmw.address,
      one,
      one,
      ten,
      tomorrow,
      unlockDates,
      nfts
    );
    const createTransactionReceipt = await createTransaction.wait();
    const newDealEvent = createTransactionReceipt.events.find((event: any) => event.event === 'NewNFTGatedDeal');
    const dealId = newDealEvent.args['_d'];

    // Assert
    expect(betaOtc.connect(buyer).buy(dealId, one)).to.be.revertedWith('OTC08');
  });

  it('seller should not be able to buy a deal', async () => {
    // Arrange
    await audi.approve(betaOtc.address, one);
    await bmw.approve(betaOtc.address, ten.mul('10'));
    const unlockDates: string[] = [oneWeek, twoWeeks];
    const nfts: string[] = [nft.address];

    // Act
    const createTransaction = await betaOtc.createNFTGatedDeal(
      audi.address,
      bmw.address,
      one,
      one,
      ten,
      tomorrow,
      unlockDates,
      nfts
    );
    const createTransactionReceipt = await createTransaction.wait();
    const newDealEvent = createTransactionReceipt.events.find((event: any) => event.event === 'NewNFTGatedDeal');
    const dealId = newDealEvent.args['_d'];

    // Assert
    expect(betaOtc.buy(dealId, one)).to.be.revertedWith('OTC06');
  });
});
