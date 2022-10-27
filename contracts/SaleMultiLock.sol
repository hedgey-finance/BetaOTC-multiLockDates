// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import './libraries/TransferHelper.sol';
import './libraries/NFTHelper.sol';

/**
 * @title SaleMultiLock is an over the counter peer to peer trading contract
 * @notice This contract allows for a seller to generate a unique over the counter sale, which can be private or public
 * @notice The public sales allow anyone to participate and purchase tokens from the seller, whereas a private sale allows only a single whitelisted address to participate
 * @notice The Seller decides how much tokens to sell and at what price
 * @notice The Seller also decides if the tokens being sold must be time locked - which means that there is a vesting period before the buyers can access those tokens
 */
contract SaleMultiLock is ReentrancyGuard {
  using SafeERC20 for IERC20;

  /// @dev we set the WETH address so that we can wrap and unwrap ETH sending to and from the smart contract
  /// @dev the smart contract always stores WETH, but receives and delivers ETH to and from users
  address payable public weth;
  address public futureContract;
  /// @dev saleId is a basic counter, used for indexing all of the sales - and sales are mapped to each index saleId
  uint256 public saleId = 0;

  /// @dev events for each function
  event NewSale(
    uint256 id,
    address seller,
    address token,
    address paymentCurrency,
    uint256 amount,
    uint256 cost,
    uint256[] unlockDates,
    address buyer
  );
  event TokensBought(uint256 id, uint256 amount);
  event SaleClosed(uint256 id);
  event FutureCreated(address _owner, address _token, uint256 _amount, uint256 _unlockDate);

  /**
   * @notice Sale is the struct that defines a single sale, created by a seller
   * @dev  Sale struct contains the following parameter definitions:
   * @dev 1) seller: This is the creator and seller of the sale
   * @dev 2) token: This is the token that the seller is selling! Must be a standard ERC20 token, parameter is the contract address of the ERC20
   * @dev 3) paymentCurrency: This is also an ERC20 which the seller will get paid in during the act of a buyer buying tokens - also the ERC20 contract address
   * @dev 4) amount: this is the amount to be sold in the single transaction
   * @dev 6) cost: the total cost denominated in the payment currency to purchase the total amount of tokens
   * @dev 8) unlockDates: set of unlock dates if the tokens are going to be locked in the future
   * @dev 9) buyer: this is a whitelist address for the buyer. It can either be the Zero address - which indicates that Anyone can purchase
   * @dev ... or it is a single address that only that owner of the address can participate in purchasing the tokens
   */
  struct Sale {
    address seller;
    address token;
    address paymentCurrency;
    uint256 amount;
    uint256 cost;
    uint256[] unlockDates;
    address buyer;
  }

  /// @dev the Sales are all mapped via the indexer saleId to sales mapping
  mapping(uint256 => Sale) public sales;

  constructor(address payable _weth, address fc) {
    weth = _weth;
    futureContract = fc;
  }

  receive() external payable {}

  /**
   * @notice This function is what the seller uses to create a new OTC offering
   * @notice Once this function has been completed - buyers can purchase tokens from the seller based on the price and parameters set
   * @dev this function will pull in tokens from the seller, create a new sale struct and mapped to the current index d
   * @dev this function does not allow for taxed / deflationary tokens - as the amount that is pulled into the contract must match with what is being sent
   * @dev this function requires that the _token has a decimals() public function on its ERC20 contract to be called
   * @param token is the ERC20 contract address that the seller is going to create the over the counter offering for
   * @param paymentCurrency is the ERC20 contract address of the opposite ERC20 that the seller wants to get paid in when selling the token (use WETH for ETH)
   * ... this can also be used for a token SWAP - where the ERC20 address of the token being swapped to is input as the paymentCurrency
   * @param amount is the amount of tokens that you as the seller want to sell
   * @param cost is the total cost to buy the total amount
   * @param unlockDates is the set of vesting dates the tokens will unlock - the amount is split evenly between each date
   * @param buyer is a special option to make this a private sale - where only a specific buyer's address can participate and make the purchase. If this is set to the
   * ... Zero address - then it is publicly available and anyone can purchase ALL tokens from this sale
   */
  function create(
    address token,
    address paymentCurrency,
    uint256 amount,
    uint256 cost,
    uint256[] memory unlockDates,
    address payable buyer
  ) external payable nonReentrant {
    require(amount > 0, 'amount cannot be 0');
    require(token != address(0) && paymentCurrency != address(0), 'token zero address');
    TransferHelper.transferPayment(weth, token, payable(msg.sender), payable(address(this)), amount);
    emit NewSale(saleId, msg.sender, token, paymentCurrency, amount, cost, unlockDates, buyer);
    sales[saleId++] = Sale(msg.sender, token, paymentCurrency, amount, cost, unlockDates, buyer);
  }

  /**
   * @notice This function lets a seller cancel their existing sale
   * @param _saleId is the saleID that is mapped to the Struct sale
   */
  function close(uint256 _saleId) external nonReentrant {
    Sale memory sale = sales[_saleId];
    require(msg.sender == sale.seller, 'not seller');
    delete sales[_saleId];
    TransferHelper.withdrawPayment(weth, sale.token, payable(msg.sender), sale.amount);
    emit SaleClosed(_saleId);
  }

  /**
   * @notice This function is what buyers use to make purchases from the sellers
   * @param _saleId is the index of the sale that a buyer wants to participate in and make a purchase
   * @param _beneficiary is a field the buyer can use if they wish to purchase tokens from a hot wallet and have the
   * tokens locked and stored in a different cold wallet. To use the current wallet input msg.sender or the address(0)
   */
  function buy(uint256 _saleId, address _beneficiary) external payable nonReentrant {
    Sale memory sale = sales[_saleId];
    require(msg.sender == sale.buyer || sale.buyer == address(0x0), 'Not whitelisted');
    address beneficiary = _beneficiary == address(0) ? msg.sender : _beneficiary;
    TransferHelper.transferPayment(weth, sale.paymentCurrency, msg.sender, payable(sale.seller), sale.cost);
    emit TokensBought(saleId, sale.amount);
    delete sales[_saleId];
    if (sale.unlockDates.length > 0) {
      uint256 proRataLockAmount = sale.amount / sale.unlockDates.length;
      uint256 remainder = proRataLockAmount % sale.amount;
      uint256 amountCheck;
      for (uint256 i; i < sale.unlockDates.length - 1; i++) {
        NFTHelper.lockTokens(futureContract, beneficiary, sale.token, proRataLockAmount, sale.unlockDates[i]);
        emit FutureCreated(beneficiary, sale.token, proRataLockAmount, sale.unlockDates[i]);
        amountCheck += proRataLockAmount;
      }
      amountCheck += proRataLockAmount + remainder;
      require(amountCheck == sale.amount, 'amount total mismatch');
      NFTHelper.lockTokens(
        futureContract,
        beneficiary,
        sale.token,
        proRataLockAmount + remainder,
        sale.unlockDates[sale.unlockDates.length - 1]
      );
      emit FutureCreated(beneficiary, sale.token, proRataLockAmount + 1, sale.unlockDates[sale.unlockDates.length - 1]);
    } else {
      TransferHelper.withdrawPayment(weth, sale.token, payable(beneficiary), sale.amount);
    }
  }
}
