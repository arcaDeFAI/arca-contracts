// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import "./interfaces/IPriceLens.sol";
import "./interfaces/IAggregatorV3.sol";
import {ILBPair} from "joe-v2/interfaces/ILBPair.sol";
import {Ownable} from "openzeppelin/access/Ownable.sol";
import {IERC20Metadata} from "openzeppelin/token/ERC20/extensions/IERC20Metadata.sol";
import {IRamsesV3Pool} from "../../contracts-shadow/CL/core/interfaces/IRamsesV3Pool.sol";
import {TickMath} from "../../contracts-shadow/CL/core/libraries/TickMath.sol";
import {FullMath} from "../../contracts-shadow/CL/core/libraries/FullMath.sol";

/**
 * @title HybridPriceLens
 * @notice Flexible price lens supporting external oracles with LB Pair fallback
 * @dev Prioritizes external oracles (Chainlink/Pyth) with automatic fallback to LB Pair routing
 */
contract HybridPriceLens is IPriceLens, Ownable {
    uint256 private constant PRICE_DECIMALS = 18;
    uint256 private constant LB_PRECISION = 128;
    uint256 private constant MIN_PRICE = 1e6; // 0.000001 in 18 decimals
    uint256 private constant MAX_PRICE = 1e36; // 1e18 in 18 decimals (allows up to 1 quintillion)
    
    address public immutable wnative;
    
    enum OracleType {
        None,
        Chainlink,
        Pyth
    }
    
    // Packed struct to save gas (fits in 2 storage slots)
    struct PriceFeed {
        address externalFeed;      // 20 bytes - Chainlink/Pyth address (if useExternal)
        address lbPair;            // 20 bytes - LB Pair address (if !useExternal)
        address referenceToken;    // 20 bytes - For routing (address(0) if direct wS pair)
        uint32 maxStaleness;       // 4 bytes - Max staleness in seconds
        OracleType oracleType;     // 1 byte - Type of external oracle
        bool useExternal;          // 1 byte - true = external oracle, false = LB routing
        bool isTokenX;             // 1 byte - Position in LB Pair
        // Total: 67 bytes = 2 slots (64 + 3)
    }
    
    // Token price feed configuration
    mapping(address => PriceFeed) public priceFeeds;
    
    // Reference tokens that have direct wS pairs
    mapping(address => bool) public isReferenceToken;
    
    // Default staleness threshold
    uint32 public defaultMaxStaleness = 3600; // 1 hour
    
    event PriceFeedConfigured(address indexed token, bool useExternal, address feed);
    event ReferenceTokenSet(address indexed token, bool isReference);
    event StalenessPeriodUpdated(uint32 newPeriod);
    
    error PriceLens__InvalidAddress();
    error PriceLens__NoPriceFeed();
    error PriceLens__InvalidOraclePrice();
    error PriceLens__StalePrice();
    error PriceLens__InvalidLBPair();
    error PriceLens__InvalidRoute();
    error PriceLens__PythNotImplemented();
    error PriceLens__PriceOutOfBounds();
    error PriceLens__ReferenceTokenNotConfigured();
    
    constructor(address _wnative) Ownable() {
        if (_wnative == address(0)) revert PriceLens__InvalidAddress();
        wnative = _wnative;
    }
    
    /**
     * @notice Returns the price of token in Native (wS), scaled to 18 decimals
     * @param _token The address of the token
     * @return price The price of the token in Native (wS), with 18 decimals
     */
    function getTokenPriceNative(address _token) external view override returns (uint256 price) {
        // Native token always equals 1
        if (_token == wnative) {
            return 10**PRICE_DECIMALS;
        }
        
        PriceFeed memory feed = priceFeeds[_token];
        if (feed.externalFeed == address(0) && feed.lbPair == address(0)) {
            revert PriceLens__NoPriceFeed();
        }
        
        if (feed.useExternal) {
            price = _getExternalPrice(feed);
        } else {
            price = _getLBPrice(_token, feed);
        }
        
        // Sanity check on price bounds
        if (price < MIN_PRICE || price > MAX_PRICE) {
            revert PriceLens__PriceOutOfBounds();
        }
    }
    
    /**
     * @notice Get price from external oracle
     */
    function _getExternalPrice(PriceFeed memory feed) internal view returns (uint256) {
        if (feed.oracleType == OracleType.Chainlink) {
            return _getChainlinkPrice(feed.externalFeed, feed.maxStaleness);
        } else if (feed.oracleType == OracleType.Pyth) {
            revert PriceLens__PythNotImplemented(); // TODO: Implement Pyth integration
        }
        revert PriceLens__InvalidOraclePrice();
    }
    
    /**
     * @notice Get price from Chainlink oracle
     */
    function _getChainlinkPrice(address feed, uint32 maxStaleness) internal view returns (uint256) {
        IAggregatorV3 oracle = IAggregatorV3(feed);
        
        (, int256 price, , uint256 updatedAt, ) = oracle.latestRoundData();
        
        // Check staleness
        if (block.timestamp > updatedAt + maxStaleness) {
            revert PriceLens__StalePrice();
        }
        
        // Check price validity
        if (price <= 0) revert PriceLens__InvalidOraclePrice();
        
        // Convert to 18 decimals safely
        uint8 oracleDecimals = oracle.decimals();
        uint256 uintPrice = uint256(price);
        
        if (oracleDecimals < PRICE_DECIMALS) {
            uint256 multiplier = 10**(PRICE_DECIMALS - oracleDecimals);
            // Check for overflow
            if (uintPrice > type(uint256).max / multiplier) {
                revert PriceLens__InvalidOraclePrice();
            }
            return uintPrice * multiplier;
        } else if (oracleDecimals > PRICE_DECIMALS) {
            return uintPrice / 10**(oracleDecimals - PRICE_DECIMALS);
        }
        return uintPrice;
    }
    
    /**
     * @notice Get price from LB Pair (direct or through reference token)
     */
    function _getLBPrice(address _token, PriceFeed memory feed) internal view returns (uint256) {
        if (feed.referenceToken == address(0)) {
            // Direct pair with native
            return _getDirectLBPrice(_token, feed.lbPair, feed.isTokenX);
        } else {
            // Route through reference token
            return _getRoutedLBPrice(_token, feed);
        }
    }
    
    /**
     * @notice Get price from direct LB Pair with native
     * @dev LB Pair prices account for token decimals - we need to normalize for consistent 18-decimal output
     */
    function _getDirectLBPrice(address _token, address pairAddress, bool isTokenX) internal view returns (uint256) {
        ILBPair pair = ILBPair(pairAddress);
        
        // Validate pair composition
        address tokenX = address(pair.getTokenX());
        address tokenY = address(pair.getTokenY());
        if (isTokenX && tokenX != _token) revert PriceLens__InvalidLBPair();
        if (!isTokenX && tokenY != _token) revert PriceLens__InvalidLBPair();
        
        // Get token decimals to handle LB pair's decimal normalization
        uint8 tokenDecimals = IERC20Metadata(_token).decimals();
        uint8 nativeDecimals = IERC20Metadata(wnative).decimals();
        
        uint24 activeId = pair.getActiveId();
        uint256 binPrice = pair.getPriceFromId(activeId);
        
        // LB pair getPriceFromId returns decimal-adjusted prices
        // We need to account for this in our calculation
        uint256 rawPrice;
        
        if (isTokenX) {
            // Token is X, native is Y
            // binPrice = X/Y = token/native (already decimal-adjusted)
            rawPrice = (binPrice * 10**PRICE_DECIMALS) >> LB_PRECISION;
            
            // Adjust for decimal differences since LB pair already normalized
            if (tokenDecimals != nativeDecimals) {
                if (tokenDecimals < nativeDecimals) {
                    // Token has fewer decimals, price needs scaling up
                    rawPrice = rawPrice * 10**(nativeDecimals - tokenDecimals);
                } else {
                    // Token has more decimals, price needs scaling down  
                    rawPrice = rawPrice / 10**(tokenDecimals - nativeDecimals);
                }
            }
        } else {
            // Token is Y, native is X
            // binPrice = X/Y = native/token (already decimal-adjusted)
            rawPrice = (10**PRICE_DECIMALS << LB_PRECISION) / binPrice;
            
            // Adjust for decimal differences since LB pair already normalized
            if (tokenDecimals != nativeDecimals) {
                if (tokenDecimals < nativeDecimals) {
                    // Token has fewer decimals, inverse price needs scaling down
                    rawPrice = rawPrice / 10**(nativeDecimals - tokenDecimals);
                } else {
                    // Token has more decimals, inverse price needs scaling up
                    rawPrice = rawPrice * 10**(tokenDecimals - nativeDecimals);
                }
            }
        }
        
        return rawPrice;
    }
    
    /**
     * @notice Get price through reference token routing
     */
    function _getRoutedLBPrice(address _token, PriceFeed memory feed) internal view returns (uint256) {
        // Validate reference token has a price feed
        if (!isReferenceToken[feed.referenceToken]) {
            revert PriceLens__ReferenceTokenNotConfigured();
        }
        
        // Get token price in reference token
        ILBPair pair = ILBPair(feed.lbPair);
        
        // Validate the pair contains our token
        address tokenX = address(pair.getTokenX());
        address tokenY = address(pair.getTokenY());
        if (feed.isTokenX && tokenX != _token) revert PriceLens__InvalidLBPair();
        if (!feed.isTokenX && tokenY != _token) revert PriceLens__InvalidLBPair();
        
        uint24 activeId = pair.getActiveId();
        uint256 binPrice = pair.getPriceFromId(activeId);
        
        uint256 priceInReference;
        if (feed.isTokenX) {
            // token/reference
            priceInReference = binPrice;
        } else {
            // reference/token, need to invert
            priceInReference = (uint256(1) << (LB_PRECISION * 2)) / binPrice;
        }
        
        // Get reference token price in native (internal call to avoid reentrancy)
        uint256 referencePriceInNative = _getTokenPriceNativeInternal(feed.referenceToken);
        
        // Calculate token price in native
        // (token/reference) * (reference/native) = token/native
        return (priceInReference * referencePriceInNative) >> LB_PRECISION;
    }
    
    /**
     * @notice Internal version of getTokenPriceNative to avoid external calls
     */
    function _getTokenPriceNativeInternal(address _token) internal view returns (uint256 price) {
        if (_token == wnative) {
            return 10**PRICE_DECIMALS;
        }
        
        PriceFeed memory feed = priceFeeds[_token];
        if (feed.externalFeed == address(0) && feed.lbPair == address(0)) {
            revert PriceLens__NoPriceFeed();
        }
        
        if (feed.useExternal) {
            price = _getExternalPrice(feed);
        } else {
            // Reference tokens should have direct pairs with native
            if (feed.referenceToken != address(0)) {
                revert PriceLens__InvalidRoute();
            }
            price = _getDirectLBPrice(_token, feed.lbPair, feed.isTokenX);
        }
        
        if (price < MIN_PRICE || price > MAX_PRICE) {
            revert PriceLens__PriceOutOfBounds();
        }
    }
    
    // ========== Admin Functions ==========
    
    /**
     * @notice Configure external oracle for a token
     */
    function setExternalOracle(
        address token,
        address oracleFeed,
        OracleType oracleType,
        uint32 maxStaleness
    ) external onlyOwner {
        if (token == address(0) || oracleFeed == address(0)) revert PriceLens__InvalidAddress();
        
        priceFeeds[token] = PriceFeed({
            useExternal: true,
            oracleType: oracleType,
            externalFeed: oracleFeed,
            lbPair: address(0),
            referenceToken: address(0),
            isTokenX: false,
            maxStaleness: maxStaleness > 0 ? maxStaleness : defaultMaxStaleness
        });
        
        emit PriceFeedConfigured(token, true, oracleFeed);
    }
    
    /**
     * @notice Configure LB Pair route for a token
     */
    function setLBPairRoute(
        address token,
        address lbPair,
        address referenceToken,
        bool isTokenX
    ) external onlyOwner {
        if (token == address(0) || lbPair == address(0)) revert PriceLens__InvalidAddress();
        
        // Validate pair contains the token
        ILBPair pair = ILBPair(lbPair);
        address tokenX = address(pair.getTokenX());
        address tokenY = address(pair.getTokenY());
        
        bool validPair = false;
        if (referenceToken == address(0)) {
            // Direct pair with native
            validPair = (isTokenX && token == tokenX && wnative == tokenY) ||
                       (!isTokenX && token == tokenY && wnative == tokenX);
        } else {
            // Pair with reference token
            if (!isReferenceToken[referenceToken]) revert PriceLens__InvalidRoute();
            validPair = (isTokenX && token == tokenX && referenceToken == tokenY) ||
                       (!isTokenX && token == tokenY && referenceToken == tokenX);
        }
        
        if (!validPair) revert PriceLens__InvalidLBPair();
        
        priceFeeds[token] = PriceFeed({
            useExternal: false,
            oracleType: OracleType.None,
            externalFeed: address(0),
            lbPair: lbPair,
            referenceToken: referenceToken,
            isTokenX: isTokenX,
            maxStaleness: 0
        });
        
        emit PriceFeedConfigured(token, false, lbPair);
    }
    
    /**
     * @notice Add or remove reference token
     */
    function setReferenceToken(address token, bool isReference) external onlyOwner {
        if (token == address(0)) revert PriceLens__InvalidAddress();
        isReferenceToken[token] = isReference;
        emit ReferenceTokenSet(token, isReference);
    }
    
    /**
     * @notice Update default staleness period
     */
    function setDefaultMaxStaleness(uint32 newPeriod) external onlyOwner {
        defaultMaxStaleness = newPeriod;
        emit StalenessPeriodUpdated(newPeriod);
    }
    
    /**
     * @notice Remove price feed for a token
     */
    function removePriceFeed(address token) external onlyOwner {
        delete priceFeeds[token];
        emit PriceFeedConfigured(token, false, address(0));
    }
    
    /**
     * @notice Get price feed configuration for a token
     */
    function getPriceFeed(address token) external view returns (PriceFeed memory) {
        return priceFeeds[token];
    }
}