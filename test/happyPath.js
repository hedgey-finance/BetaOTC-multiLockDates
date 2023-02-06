const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { etheres, ethers } = require('hardhat');
const C = require('./constants');
const { deployOTC } = require('./fixtures');

module.exports = () => {
  let seller,
    buyer,
    buyerB,
    weth,
    futuresNFT,
    otc,
    token,
    usdc,
    wlToken,
    amount,
    min,
    price,
    maturity,
    unlockDates,
    onlyBuyOnce,
    remainder;
  it('Deploys OTC contract and setups an initial sale', async () => {
    const deployedOTC = await deployOTC();
    seller = deployedOTC.seller;
    buyer = deployedOTC.buyer;
    buyerB = deployedOTC.buyerB;
    weth = deployedOTC.weth;
    futuresNFT = deployedOTC.futuresNFT;
    otc = deployedOTC.otc;
    token = deployedOTC.token;
    usdc = deployedOTC.usdc;
    wlToken = deployedOTC.wlToken;
    amount = C.E18_100;
    remainder = amount;
    min = C.E18_1;
    price = C.E18_10;
    maturity = (await time.latest()) + 60;
    unlockDates = [maturity];
    onlyBuyOnce = true;
    expect(
      await otc.createNFTGatedDeal(
        token.address,
        usdc.address,
        amount,
        min,
        price,
        maturity,
        unlockDates,
        wlToken.address,
        onlyBuyOnce
      )
    )
      .to.emit('NewNFTGatedDeal')
      .withArgs(
        '0',
        seller.address,
        token.address,
        usdc.address,
        amount,
        min,
        price,
        maturity,
        unlockDates,
        wlToken.address,
        onlyBuyOnce
      );
    expect(await token.balanceOf(otc.address)).to.eq(amount);
  });
  it('Sends a single whitelist token to buyer', async () => {
    expect(await otc.canBuy('0', buyer.address)).to.eq(false);
    await wlToken.transfer(buyer.address, C.E18_1);
    expect(await wlToken.balanceOf(buyer.address)).to.eq(C.E18_1);
    expect(await otc.canBuy('0', buyer.address)).to.eq(true);
    expect(await otc.canBuy('0', buyerB.address)).to.eq(false);
  });
  it('Buyer now makes purchase from otc once', async () => {
    console.log(`contract current balance is: ${(await token.balanceOf(otc.address)) / 10 ** 18}`);
    console.log(`seller pre balance: ${await usdc.balanceOf(seller.address)}`);
    let dealId = '0';
    let buyAmt = C.E18_12;
    console.log(`buy amount: ${buyAmt}`);
    remainder = C.E18_100.sub(buyAmt);
    expect(await otc.connect(buyer).buy(dealId, buyAmt, buyer.address))
      .to.emit('TokensBought')
      .withArgs(dealId, buyAmt, remainder)
      .to.emit('FutureCreated')
      .withArgs(buyer.address, token.address, buyAmt, unlockDates[0]);
    expect(await usdc.balanceOf(seller.address)).to.eq(buyAmt.mul(price).div(C.E18_1));
    expect(await otc.canBuy('0', buyer.address)).to.eq(false);
  });
  it('Seller makes a second deal without a nft gate', async () => {
    price = C.E18_05;
    await otc.createNFTGatedDeal(
      token.address,
      weth.address,
      amount,
      min,
      price,
      maturity,
      unlockDates,
      C.ZERO_ADDRESS,
      onlyBuyOnce
    );
    expect(await otc.canBuy('1', buyer.address)).to.eq(true);
  });
  it('buys the deal with ETH', async () => {
    let buyAmt = C.E18_10;
    let dealId = '1';
    let sellerBal = await ethers.provider.getBalance(seller.address);
    console.log(`seller pre balance: ${sellerBal / 10 ** 18}`);
    let purchase = buyAmt.mul(price).div(C.E18_1);
    console.log(`purchase: ${purchase / 10 ** 18}`);
    remainder = C.E18_100.sub(buyAmt);
    expect(await otc.connect(buyer).buy(dealId, buyAmt, buyer.address, { value: purchase }))
      .to.emit('TokensBought')
      .withArgs(dealId, buyAmt, remainder)
      .to.emit('FutureCreated')
      .withArgs(buyer.address, token.address, buyAmt, unlockDates[0]);
    expect(await otc.canBuy('1', buyer.address)).to.eq(false);
    let sellerNewBal = await ethers.provider.getBalance(seller.address);
    console.log(`new seller balance: ${sellerNewBal / 10 ** 18}`);
  });
  it('creates a deal wtih ETH', async () => {
    expect(await weth.balanceOf(otc.address)).to.eq('0');
    await otc.createNFTGatedDeal(
      weth.address,
      usdc.address,
      amount,
      min,
      price,
      maturity,
      unlockDates,
      C.ZERO_ADDRESS,
      onlyBuyOnce,
      { value: amount }
    );
    expect(await weth.balanceOf(otc.address)).to.eq(amount);
  });
};
