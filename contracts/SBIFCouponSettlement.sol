// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IComplianceRegistry {
    function isCompliant(address user) external view returns (bool);
}

contract SBIFCouponSettlement {
    uint256 public constant TOKEN_PRICE = 0.015 ether;
    uint256 public constant SUPPLIER_RELEASE = 0.005 ether;
    uint256 public constant COURIER_RELEASE = 0.002 ether;
    uint256 public constant PLATFORM_FEE_BPS = 300;
    uint256 public constant EXPIRY_DURATION = 365 days;

    address public immutable merchant;
    address public immutable supplier;
    address public immutable courier;
    address public immutable platformTreasury;
    address public immutable complianceRegistry;

    uint256 public couponCount;
    uint256 public totalCouponsRedeemed;
    uint256 public totalCouponsExpired;
    uint256 public totalPlatformFeesCollected;
    uint256 public totalMerchantReleased;
    uint256 public totalSupplierReleased;
    uint256 public totalCourierReleased;

    struct Coupon {
        uint256 id;
        address owner;
        string buyerName;
        bool redeemed;
        bool expiredProcessed;
        uint256 issuedAt;
        uint256 expiresAt;
    }

    mapping(uint256 => Coupon) public coupons;

    event CouponPurchased(
        uint256 indexed couponId,
        address indexed buyer,
        string buyerName,
        uint256 value,
        uint256 expiresAt
    );
    event CouponRedeemed(
        uint256 indexed couponId,
        address indexed buyer,
        uint256 supplierAmount,
        uint256 courierAmount,
        uint256 platformFee,
        uint256 merchantAmount
    );
    event CouponExpiredProcessed(
        uint256 indexed couponId,
        uint256 platformFee,
        uint256 merchantAmount
    );

    modifier onlyMerchant() {
        require(msg.sender == merchant, "Only merchant can call this function.");
        _;
    }

    modifier onlyCompliantBuyer() {
        require(
            IComplianceRegistry(complianceRegistry).isCompliant(msg.sender),
            "Buyer wallet is not AML-approved."
        );
        _;
    }

    constructor(
        address _supplier,
        address _courier,
        address _platformTreasury,
        address _complianceRegistry
    ) {
        require(_supplier != address(0), "Invalid supplier.");
        require(_courier != address(0), "Invalid courier.");
        require(_platformTreasury != address(0), "Invalid platform.");
        require(_complianceRegistry != address(0), "Invalid compliance registry.");

        merchant = msg.sender;
        supplier = _supplier;
        courier = _courier;
        platformTreasury = _platformTreasury;
        complianceRegistry = _complianceRegistry;
    }

    function purchaseCoupon(uint256 quantity, string calldata buyerName) external payable onlyCompliantBuyer {
        require(quantity > 0, "Quantity must be greater than zero.");
        require(bytes(buyerName).length > 0, "Buyer name is required.");
        require(msg.value == TOKEN_PRICE * quantity, "Incorrect payment amount.");

        for (uint256 i = 0; i < quantity; i++) {
            couponCount += 1;
            uint256 expiresAt = block.timestamp + EXPIRY_DURATION;
            coupons[couponCount] = Coupon({
                id: couponCount,
                owner: msg.sender,
                buyerName: buyerName,
                redeemed: false,
                expiredProcessed: false,
                issuedAt: block.timestamp,
                expiresAt: expiresAt
            });

            emit CouponPurchased(couponCount, msg.sender, buyerName, TOKEN_PRICE, expiresAt);
        }
    }

    function redeemCoupon(uint256 couponId) external onlyCompliantBuyer {
        Coupon storage coupon = coupons[couponId];
        require(coupon.owner != address(0), "Coupon does not exist.");
        require(coupon.owner == msg.sender, "Only coupon owner can redeem.");
        require(!coupon.redeemed, "Coupon already redeemed.");
        require(!coupon.expiredProcessed, "Coupon already expired.");
        require(block.timestamp <= coupon.expiresAt, "Coupon is expired.");

        coupon.redeemed = true;

        uint256 platformFee = (TOKEN_PRICE * PLATFORM_FEE_BPS) / 10000;
        uint256 merchantAmount = TOKEN_PRICE - SUPPLIER_RELEASE - COURIER_RELEASE - platformFee;

        _safeTransfer(supplier, SUPPLIER_RELEASE);
        _safeTransfer(courier, COURIER_RELEASE);
        _safeTransfer(platformTreasury, platformFee);
        _safeTransfer(merchant, merchantAmount);

        totalCouponsRedeemed += 1;
        totalPlatformFeesCollected += platformFee;
        totalMerchantReleased += merchantAmount;
        totalSupplierReleased += SUPPLIER_RELEASE;
        totalCourierReleased += COURIER_RELEASE;

        emit CouponRedeemed(
            couponId,
            msg.sender,
            SUPPLIER_RELEASE,
            COURIER_RELEASE,
            platformFee,
            merchantAmount
        );
    }

    function processExpiredCoupons(uint256[] calldata couponIds) external onlyMerchant {
        uint256 platformFee = (TOKEN_PRICE * PLATFORM_FEE_BPS) / 10000;
        uint256 merchantAmount = TOKEN_PRICE - platformFee;

        for (uint256 i = 0; i < couponIds.length; i++) {
            Coupon storage coupon = coupons[couponIds[i]];
            require(coupon.owner != address(0), "Coupon does not exist.");
            require(!coupon.redeemed, "Coupon already redeemed.");
            require(!coupon.expiredProcessed, "Expiry already processed.");
            require(block.timestamp > coupon.expiresAt, "Coupon has not expired.");

            coupon.expiredProcessed = true;

            _safeTransfer(platformTreasury, platformFee);
            _safeTransfer(merchant, merchantAmount);

            totalCouponsExpired += 1;
            totalPlatformFeesCollected += platformFee;
            totalMerchantReleased += merchantAmount;

            emit CouponExpiredProcessed(coupon.id, platformFee, merchantAmount);
        }
    }

    function getCoupon(uint256 couponId) external view returns (Coupon memory) {
        return coupons[couponId];
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed.");
    }
}
