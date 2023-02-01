const WETH9 = require('@thenextblock/hardhat-weth');
const { ethers } = require('hardhat');
const C = require('./constants');

async function deployOTC() {
    const [seller, buyer, buyerB] = await ethers.getSigners();
    const weth = await WETH9.deployWeth(seller);
    const FuturesNFT = await ethers.getContractFactory('Hedgeys');
    const futuresNFT = await FuturesNFT.deploy(weth.address, '');
    const OTC = await ethers.getContractFactory('MultiLockOTC');
    const otc = await OTC.deploy(weth.address, futuresNFT.address);

    const Token = await ethers.getContractFactory('Token');
    const token = await Token.deploy(C.E18_10000, 'token', 'tk');
    const usdc = await Token.connect(buyer).deploy(C.E18_10000, 'USDC', 'USDC');
    const wlToken = await Token.deploy(C.E18_10, 'White_List_Token', 'WLT');

    await token.approve(otc.address, C.E18_10000);
    await usdc.connect(buyer).approve(otc.address, C.E18_10000);
    await usdc.connect(buyer).transfer(buyerB.address, C.E18_100);
    await usdc.connect(buyerB).approve(otc.address, C.E18_100);

    return {
        seller,
        buyer,
        buyerB,
        weth,
        futuresNFT,
        otc,
        token,
        usdc,
        wlToken,
    }
}

module.exports = {
    deployOTC,
}