// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ImmutableClone} from "@arca/joe-v2/libraries/ImmutableClone.sol";
import {
    IERC20Upgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {
    IERC20MetadataUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {ILBPair} from "@arca/joe-v2/interfaces/ILBPair.sol";
import {
    Ownable2StepUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {
    StringsUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {IStrategyCommon} from "./interfaces/IStrategyCommon.sol";
import {IMetropolisStrategy} from "./interfaces/IMetropolisStrategy.sol";
import {
    IShadowStrategy
} from "../../contracts-shadow/src/interfaces/IShadowStrategy.sol";
import {IMinimalVault} from "./interfaces/IMinimalVault.sol";
import {IBaseVault} from "./interfaces/IBaseVault.sol";
import {
    IOracleRewardShadowVault
} from "../../contracts-shadow/src/interfaces/IOracleRewardShadowVault.sol";
import {
    IRamsesV3Pool
} from "../../contracts-shadow/CL/core/interfaces/IRamsesV3Pool.sol";
import {IOracleVault} from "./interfaces/IOracleVault.sol";
import {IOracleHelper} from "./interfaces/IOracleHelper.sol";
import {IOracleRewardVault} from "./interfaces/IOracleRewardVault.sol";
import {IVaultFactory} from "./interfaces/IVaultFactory.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IPriceLens} from "./interfaces/IPriceLens.sol";
import {IOracleHelperFactory} from "./interfaces/IOracleHelperFactory.sol";
import {OracleLensAggregator} from "./utils/OracleLensAggregator.sol";
import {IERC20, TokenHelper} from "./libraries/TokenHelper.sol";

/**
 * @title Liquidity Book Vault Factory contract
 * @author Trader Joe
 * @notice This contract is used to deploy new vaults. It is made to be used with the transparent proxy pattern.
 * The vaults are deployed using the ImmutableClone library that allows to deploy a clone of a contract
 * and initialize it with immutable data.
 * Two vaults are available:
 * - SimpleVault: This vault is used to interact with pairs where one of the tokens has no oracle. Deposits need to be
 *                made in the same ratio as the vault's current balance.
 * - OracleVault: This vault is used to interact with pairs where both tokens have an oracle. Deposits don't need to
 *                be made in the same ratio as the vault's current balance.
 * Only one strategy is available:
 * - Strategy: This strategy allows the operator to rebalance and withdraw with no real limitation.
 */
contract VaultFactory is IVaultFactory, Ownable2StepUpgradeable {
    using StringsUpgradeable for uint256;

    uint256 private constant MAX_AUM_FEE = 0.3e4; // 30% fee

    address private immutable _wnative;
    mapping(VaultType => address[]) private _vaults;
    mapping(StrategyType => address[]) private _strategies;

    mapping(address => VaultType) private _vaultType;
    mapping(address => StrategyType) private _strategyType;

    mapping(VaultType => address) private _vaultImplementation;
    mapping(StrategyType => address) private _strategyImplementation;

    address private _feeRecipient;
    address private _defaultOperator;

    address private _priceLens;

    uint256 private _creationFee;

    /// @dev account => vaults
    mapping(address => address[]) private _vaultsByMarketMaker;

    /// @dev vault => marketMaker
    mapping(address => address) private _marketMakerByVaults;

    /// @dev vault => rebalance settings
    mapping(address => RebalanceSetting) private _vaultSettings;

    /// @dev all maker vaultes
    address[] private _makerVaults;

    /// @dev default market maker aum fee
    uint16 private _defaultMMAumFee;

    /// @dev list of addresses that are ignored when transferring tokens
    /// This is used to prevent payout rewards on transfer to sender/receiver in this list
    address[] private _transferIgnoreList;

    /// @dev default sequencer uptime feed e.g. for L2 chains with Sequencer (e.g. Arbitrum)
    IAggregatorV3 private _defaultSequencerUptimeFeed;

    /// @dev whitelisted pairs for creating market maker vaults
    mapping(address => bool) private _pairWhitelist;

    /// @dev cooldown time between deposit and withdrawal
    uint16 private _depositToWithdrawCooldown;

    /// @dev Shadow protocol addresses
    address private _shadowNonfungiblePositionManager;
    address private _shadowVoter;

    /// @dev Oracle Helper Factory, to create oracle helpers for Oracle Vaults
    address private _oracleHelperFactory;

    /**
     * @dev Modifier to check if the type id is valid.
     * @param typeId The type id to check.
     */
    modifier isValidType(uint8 typeId) {
        if (typeId == 0) revert VaultFactory__InvalidType();

        _;
    }

    /**
     * @dev Constructor of the contract.
     * @param wnative The address of the wrapped native token.
     */
    constructor(address wnative, address oracleHelperFactory) {
        _disableInitializers();

        // safety check
        IERC20Upgradeable(wnative).balanceOf(address(this));

        _wnative = wnative;
        _oracleHelperFactory = oracleHelperFactory;
    }

    /// @custom:oz-upgrades-validate-as-initializer
    function initialize4(
        address owner,
        uint256 creationFee
    ) public reinitializer(6) {
        if (owner == address(0)) revert VaultFactory__InvalidOwner();

        __Ownable2Step_init();
        _transferOwnership(owner);

        _setDefaultOperator(owner);
        _setFeeRecipient(owner);

        _creationFee = creationFee;
        _defaultMMAumFee = 0.1e4; // 10% fee

        _depositToWithdrawCooldown = 10 minutes;
    }

    /**
     * @notice Returns the address of the wrapped native token.
     * @return The address of the wrapped native token.
     */
    function getWNative() external view override returns (address) {
        return _wnative;
    }

    /**
     * @notice Returns the address of the vault at the given index.
     * @param vType The type of the vault. (0: SimpleVault, 1: OracleVault)
     * @param index The index of the vault.
     * @return The address of the vault.
     */
    function getVaultAt(
        VaultType vType,
        uint256 index
    ) external view override returns (address) {
        return _vaults[vType][index];
    }

    /**
     * @notice Returns the type of the vault at the given address.
     * @dev Returns 0 (VaultType.None) if the vault doesn't exist.
     * @param vault The address of the vault.
     * @return The type of the vault.
     */
    function getVaultType(
        address vault
    ) external view override returns (VaultType) {
        return _vaultType[vault];
    }

    /**
     * @notice Returns the address of the strategy at the given index.
     * @param sType The type of the strategy. (0: DefaultStrategy)
     * @param index The index of the strategy.
     * @return The address of the strategy.
     */
    function getStrategyAt(
        StrategyType sType,
        uint256 index
    ) external view override returns (address) {
        return _strategies[sType][index];
    }

    /**
     * @notice Returns the type of the strategy at the given address.
     * @dev Returns 0 (StrategyType.None) if the strategy doesn't exist.
     * @param strategy The address of the strategy.
     * @return The type of the strategy.
     */
    function getStrategyType(
        address strategy
    ) external view override returns (StrategyType) {
        return _strategyType[strategy];
    }

    /**
     * @notice Returns the number of vaults of the given type.
     * @param vType The type of the vault. (0: SimpleVault, 1: OracleVault)
     * @return The number of vaults of the given type.
     */
    function getNumberOfVaults(
        VaultType vType
    ) external view override returns (uint256) {
        return _vaults[vType].length;
    }

    /**
     * @notice Returns the number of strategies of the given type.
     * @param sType The type of the strategy. (0: DefaultStrategy)
     * @return The number of strategies of the given type.
     */
    function getNumberOfStrategies(
        StrategyType sType
    ) external view override returns (uint256) {
        return _strategies[sType].length;
    }

    /**
     * @notice Returns the address of the default operator.
     * @return The address of the default operator.
     */
    function getDefaultOperator() external view override returns (address) {
        return _defaultOperator;
    }

    /**
     * @notice Returns the address of the default fee recipient.
     * @return The address of the fee recipient.
     */
    function getFeeRecipient() external view override returns (address) {
        return _feeRecipient;
    }

    /**
     * @notice Returns the address of the fee recipient of the given vault.
     * Fee Recipient is the market maker if the vault is created by market maker otherwise
     * its the default fee recipient
     * @param vault The address of the vault.
     * @return The address of the fee recipient.
     */
    function getFeeRecipientByVault(
        address vault
    ) external view returns (address) {
        address marketMaker = _marketMakerByVaults[vault];
        if (marketMaker != address(0)) return marketMaker;
        return _feeRecipient;
    }

    /**
     * @notice Returns the whitelist state of the given pair.
     * @param pair The address of the pair.
     * @return The whitelist state.
     */
    function isPairWhitelisted(
        address pair
    ) external view override returns (bool) {
        return _pairWhitelist[pair];
    }

    /**
     * @notice Returns the address of the vault implementation of the given type.
     * @param vType The type of the vault. (0: SimpleVault, 1: OracleVault)
     * @return The address of the vault implementation.
     */
    function getVaultImplementation(
        VaultType vType
    ) external view override returns (address) {
        return _vaultImplementation[vType];
    }

    /**
     * @notice Returns the address of the strategy implementation of the given type.
     * @param sType The type of the strategy. (0: DefaultStrategy)
     * @return The address of the strategy implementation.
     */
    function getStrategyImplementation(
        StrategyType sType
    ) external view override returns (address) {
        return _strategyImplementation[sType];
    }

    /**
     * @notice Returns the cooldown time between deposit and withdrawal.
     * @return The cooldown time in seconds.
     */
    function getDepositToWithdrawCooldown()
        external
        view
        override
        returns (uint256)
    {
        return _depositToWithdrawCooldown;
    }

    /**
     * @notice Returns the address of the Shadow Nonfungible Position Manager.
     * @return The address of the Shadow NPM.
     */
    function getShadowNonfungiblePositionManager()
        external
        view
        override
        returns (address)
    {
        return _shadowNonfungiblePositionManager;
    }

    /**
     * @notice Returns the address of the Shadow Voter.
     * @return The address of the Shadow Voter.
     */
    function getShadowVoter() external view override returns (address) {
        return _shadowVoter;
    }

    /**
     * Check if address is ingored for rewards (e.g strategy, or other addresses)
     * @param _address address
     */
    function isTransferIgnored(address _address) external view returns (bool) {
        address[] memory addresses = _transferIgnoreList;
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == _address) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Sets the address of the vault implementation of the given type.
     * @param vType The type of the vault. (0: SimpleVault, 1: OracleVault)
     * @param vaultImplementation The address of the vault implementation.
     */
    function setVaultImplementation(
        VaultType vType,
        address vaultImplementation
    ) external override onlyOwner {
        _setVaultImplementation(vType, vaultImplementation);
    }

    /**
     * @notice Sets the address of the strategy implementation of the given type.
     * @param sType The type of the strategy. (0: DefaultStrategy)
     * @param strategyImplementation The address of the strategy implementation.
     */
    function setStrategyImplementation(
        StrategyType sType,
        address strategyImplementation
    ) external override onlyOwner {
        _setStrategyImplementation(sType, strategyImplementation);
    }

    /**
     * @notice Sets the address of the default operator.
     * @param defaultOperator The address of the default operator.
     */
    function setDefaultOperator(
        address defaultOperator
    ) external override onlyOwner {
        _setDefaultOperator(defaultOperator);
    }

    /**
     * @notice Sets the address of the operator of the given strategy. Moves the vaults to the new operator if the old operator is a market maker.
     * @param strategy The address of the strategy.
     * @param operator The address of the operator.
     */
    function setOperator(
        IStrategyCommon strategy,
        address operator
    ) external override onlyOwner {
        address oldOperator = strategy.getOperator();

        address vault = strategy.getVault();

        // check if old operator is a market maker
        if (_marketMakerByVaults[vault] == oldOperator) {
            // remove vault from old market maker
            address[] storage vaults = _vaultsByMarketMaker[oldOperator];
            for (uint256 i = 0; i < vaults.length; i++) {
                if (vaults[i] == vault) {
                    vaults[i] = vaults[vaults.length - 1];
                    vaults.pop();
                    break;
                }
            }

            // set operator of the vault
            _marketMakerByVaults[vault] = operator;

            // add vault to new market maker
            _vaultsByMarketMaker[operator].push(vault);
        }

        strategy.setOperator(operator);
    }

    function getOracleHelperFactory() external view returns (address) {
        return _oracleHelperFactory;
    }

    function setOracleHelperFactory(
        address oracleHelperFactory
    ) external onlyOwner {
        _oracleHelperFactory = oracleHelperFactory;
    }

    /**
     * @notice Sets the pending AUM annual fee of the given vault's strategy.
     * @param vault The address of the vault.
     * @param pendingAumAnnualFee The pending AUM annual fee.
     */
    function setPendingAumAnnualFee(
        IMinimalVault vault,
        uint16 pendingAumAnnualFee
    ) external override onlyOwner {
        vault.getStrategy().setPendingAumAnnualFee(pendingAumAnnualFee);
    }

    /**
     * @notice Resets the pending AUM annual fee of the given vault's strategy.
     * @param vault The address of the vault.
     */
    function resetPendingAumAnnualFee(
        IMinimalVault vault
    ) external override onlyOwner {
        vault.getStrategy().resetPendingAumAnnualFee();
    }

    /**
     * @notice Sets the address of the fee recipient.
     * @param feeRecipient The address of the fee recipient.
     */
    function setFeeRecipient(address feeRecipient) external override onlyOwner {
        _setFeeRecipient(feeRecipient);
    }

    /**
     * @notice Sets the whitelist state of the given pairs. whitelisted pairs will be used for creating market maker vaults
     * @param pairs The addresses of the pairs.
     * @param isWhitelisted The whitelist state.
     */
    function setPairWhitelist(
        address[] calldata pairs,
        bool isWhitelisted
    ) external override onlyOwner {
        for (uint256 i = 0; i < pairs.length; i++) {
            _pairWhitelist[pairs[i]] = isWhitelisted;
        }
        emit PairWhitelistSet(pairs, isWhitelisted);
    }

    function setTransferIgnoreList(
        address[] calldata addresses
    ) external override onlyOwner {
        // remove all addresses from the list
        _transferIgnoreList = addresses;

        emit TransferIgnoreListSet(addresses);
    }

    /**
     * @notice Creates a new Shadow oracle reward vault and strategy for market makers.
     * @dev Pool must be whitelisted. Uses pool-based TWAP oracle.
     * @param pool The address of the Ramses V3 Pool.
     * @param aumFee The AUM annual fee.
     * @param twapInterval The TWAP interval (0 for spot price, >0 for TWAP).
     * @return vault The address of the new vault.
     * @return strategy The address of the new strategy.
     */
    function createMarketMakerShadowOracleRewardVault(
        address pool,
        uint16 aumFee,
        uint32 twapInterval
    ) external payable onlyOwner returns (address vault, address strategy) {
        if (!_pairWhitelist[pool]) revert VaultFactory__VaultNotWhitelisted();
        // charge creation fee
        if (msg.value != _creationFee)
            revert VaultFactory__InvalidCreationFee();
        if (aumFee > MAX_AUM_FEE) revert VaultFactory__InvalidAumFee();

        // Get tokens from the pool
        IRamsesV3Pool ramsesPool = IRamsesV3Pool(pool);
        address tokenX = ramsesPool.token0();
        address tokenY = ramsesPool.token1();

        // Validate pool has sufficient observation cardinality for TWAP
        if (twapInterval > 0) {
            (, , uint16 observationCardinality, , , , ) = ramsesPool.slot0();

            // Require at least 10 observation slots for TWAP
            if (observationCardinality < 10)
                revert VaultFactory__TwapInvalidOracleSize();
        }

        // Create vault and strategy
        vault = _createShadowOracleRewardVault(pool, tokenX, tokenY);
        strategy = _createShadowStrategy(vault, pool, tokenX, tokenY);

        _linkVaultToStrategy(IMinimalVault(vault), strategy);

        // Set operator
        IStrategyCommon(strategy).setOperator(msg.sender);

        // Set TWAP interval
        IOracleRewardShadowVault(vault).setTwapInterval(twapInterval);

        // Set pending aum fee
        IStrategyCommon(strategy).setPendingAumAnnualFee(aumFee);

        _vaultsByMarketMaker[msg.sender].push(vault);
        _marketMakerByVaults[vault] = msg.sender;

        _makerVaults.push(vault);

        TokenHelper.safeTransfer(
            IERC20(address(0)),
            payable(_feeRecipient),
            msg.value
        );
    }

    /**
     * @notice Creates a new oracle vault and a default strategy for the given LBPair.
     * @dev LBPair must be whitelisted.
     * @param lbPair The address of the LBPair.
     * @param aumFee The AUM annual fee.
     * @return vault The address of the new vault.
     * @return strategy The address of the new strategy.
     */
    function createMarketMakerOracleVault(
        ILBPair lbPair,
        uint16 aumFee
    ) external payable onlyOwner returns (address vault, address strategy) {
        if (!_pairWhitelist[address(lbPair)])
            revert VaultFactory__VaultNotWhitelisted();
        // charge creation fee
        if (msg.value != _creationFee)
            revert VaultFactory__InvalidCreationFee();
        if (aumFee > MAX_AUM_FEE) revert VaultFactory__InvalidAumFee();

        address tokenX = address(lbPair.getTokenX());
        address tokenY = address(lbPair.getTokenY());

        // create data feeds
        OracleLensAggregator dataFeedX = new OracleLensAggregator(
            _priceLens,
            tokenX
        );
        OracleLensAggregator dataFeedY = new OracleLensAggregator(
            _priceLens,
            tokenY
        );

        // sanity check
        if (dataFeedX.decimals() != dataFeedY.decimals())
            revert VaultFactory__InvalidDecimals();

        // create oracle vault, we use 24 hours as default
        // as we do not use the standard chainlink heartbeat mechanism here
        vault = _createOracleVault(
            lbPair,
            tokenX,
            tokenY,
            dataFeedX,
            dataFeedY,
            24 hours,
            24 hours
        );
        strategy = _createDefaultStrategy(vault, lbPair, tokenX, tokenY);

        _linkVaultToStrategy(IMinimalVault(vault), strategy);

        // set operator
        IStrategyCommon(strategy).setOperator(msg.sender);

        // set twap interval to 120 seconds and deviation threshold to 5%
        IOracleVault(vault).getOracleHelper().setTwapParams(true, 120, 5);

        // sanity check for twap price
        (, uint16 size, , , ) = ILBPair(lbPair).getOracleParameters();
        if (size == 0) revert VaultFactory__TwapInvalidOracleSize();

        // set pending aum fee
        IOracleVault(vault).getStrategy().setPendingAumAnnualFee(aumFee);

        _vaultsByMarketMaker[msg.sender].push(address(vault));
        _marketMakerByVaults[address(vault)] = msg.sender;

        _makerVaults.push(address(vault));

        TokenHelper.safeTransfer(
            IERC20(address(0)),
            payable(_feeRecipient),
            msg.value
        );
    }

    function getCreationFee() external view returns (uint256) {
        return _creationFee;
    }

    function getPriceLens() external view returns (address) {
        return _priceLens;
    }

    function getVaultsByMarketMaker(
        address marketMaker
    ) external view returns (address[] memory) {
        return _vaultsByMarketMaker[marketMaker];
    }

    function getDefaultMarketMakerAumFee() external view returns (uint16) {
        return _defaultMMAumFee;
    }

    function getTransferIgnoreList()
        external
        view
        override
        returns (address[] memory)
    {
        return _transferIgnoreList;
    }

    /**
     * Set price lens which will be use for any new oracle datafee
     * @param lens lens
     */
    function setPriceLens(IPriceLens lens) external onlyOwner {
        // sanity check
        uint256 price = lens.getTokenPriceNative(_wnative);
        require(price > 0, "Lens: invalid price");

        _priceLens = address(lens);
    }

    /**
     * @notice Links the given vault to the given strategy.
     * @param vault The address of the vault.
     * @param strategy The address of the strategy.
     */
    function linkVaultToStrategy(
        IMinimalVault vault,
        address strategy
    ) external override onlyOwner {
        if (_strategyType[strategy] == StrategyType.None)
            revert VaultFactory__InvalidStrategy();

        _linkVaultToStrategy(vault, strategy);
    }

    /**
     * @notice Sets the default sequencer uptime feed
     * The sequencer update time feed is for L2 chains like arbitrum see also https://docs.chain.link/data-feeds/l2-sequencer-feeds
     * @param defaultSequencerUptimeFeed The address of the default sequencer uptime feed.
     */
    function setDefaultSequencerUptimeFeed(
        IAggregatorV3 defaultSequencerUptimeFeed
    ) external override onlyOwner {
        _defaultSequencerUptimeFeed = defaultSequencerUptimeFeed;
    }

    function setSequencerUptimeFeed(
        address oracleVault,
        IAggregatorV3 sequencerUptimeFeed
    ) external override onlyOwner {
        IOracleVault(oracleVault).getOracleHelper().setSequencerUptimeFeed(
            sequencerUptimeFeed
        );
    }

    /**
     * @notice Sets the oracle parameters for the given oracle vault.
     * @param oracleVault The address of the oracle vault.
     * @param parameters The parameters to set.
     */
    function setOracleParameters(
        address oracleVault,
        IOracleHelper.OracleParameters calldata parameters
    ) external override onlyOwner {
        IOracleVault(oracleVault).getOracleHelper().setOracleParameters(
            parameters
        );
    }

    /**
     * @notice Sets the vault to emergency mode.
     * @param vault The address of the vault.
     */
    function setEmergencyMode(IMinimalVault vault) external override onlyOwner {
        vault.setEmergencyMode();
    }

    /**
     * @notice Cancels the shutdown of the given vault.
     * @param vault The address of the vault.
     */
    function cancelShutdown(address vault) external override onlyOwner {
        IOracleRewardVault(vault).cancelShutdown();
    }

    /**
     * @notice Sets the rebalance cool down for the given vault.
     * @param strategy The address of the strategy.
     * @param coolDown The rebalance cool down in seconds.
     */
    function setRebalanceCoolDown(
        address strategy,
        uint256 coolDown
    ) external override onlyOwner {
        IStrategyCommon(strategy).setRebalanceCoolDown(coolDown);
    }

    /**
     * @notice Recover ERC20 tokens from the given vault.
     * @param vault The address of the vault.
     * @param token The address of the token.
     * @param recipient The address of the recipient.
     * @param amount The amount of tokens to recover.
     */
    function recoverERC20(
        IMinimalVault vault,
        IERC20Upgradeable token,
        address recipient,
        uint256 amount
    ) external override onlyOwner {
        vault.recoverERC20(token, recipient, amount);
    }

    /**
     * @notice Sets the creation fee.
     * @param creationFee The creation fee.
     */
    function setCreationFee(uint256 creationFee) external onlyOwner {
        _creationFee = creationFee;
        emit CreationFeeSet(msg.sender, creationFee);
    }

    /** @notice Sets the cooldown time between deposit and withdrawal.
     * @param cooldown The cooldown time in seconds.
     */
    function setDepositToWithdrawCooldown(uint16 cooldown) external onlyOwner {
        _depositToWithdrawCooldown = cooldown;

        emit DepositToWithdrawCooldownSet(cooldown);
    }

    /**
     * @notice Sets the Shadow Nonfungible Position Manager address.
     * @param nonfungiblePositionManager The address of the Shadow NPM.
     */
    function setShadowNonfungiblePositionManager(
        address nonfungiblePositionManager
    ) external override onlyOwner {
        _shadowNonfungiblePositionManager = nonfungiblePositionManager;
    }

    /**
     * @notice Sets the Shadow Voter address.
     * @param voter The address of the Shadow Voter.
     */
    function setShadowVoter(address voter) external override onlyOwner {
        _shadowVoter = voter;
    }

    /**
     * @dev Sets the vault implementation of the given type.
     * @param vType The type of the vault.
     * @param vaultImplementation The address of the vault implementation.
     */
    function _setVaultImplementation(
        VaultType vType,
        address vaultImplementation
    ) internal {
        _vaultImplementation[vType] = vaultImplementation;

        emit VaultImplementationSet(vType, vaultImplementation);
    }

    /**
     * @dev Sets the strategy implementation of the given type.
     * @param sType The type of the strategy.
     * @param strategyImplementation The address of the strategy implementation.
     */
    function _setStrategyImplementation(
        StrategyType sType,
        address strategyImplementation
    ) internal {
        _strategyImplementation[sType] = strategyImplementation;

        emit StrategyImplementationSet(sType, strategyImplementation);
    }

    /**
     * @dev Returns the name of the vault of the given type and id.
     * @param vType The type of the vault.
     * @param vaultId The id of the vault.
     * @return vName The name of the vault.
     */
    function _getName(
        VaultType vType,
        uint256 vaultId
    ) internal pure returns (string memory) {
        string memory vName;

        if (vType == VaultType.Simple) vName = "Simple";
        else if (vType == VaultType.Oracle) vName = "Oracle";
        else if (vType == VaultType.ShadowOracleReward)
            vName = "Shadow Oracle Reward";
        else revert VaultFactory__InvalidType();

        return
            string(
                abi.encodePacked(
                    "Maker Vault Token - ",
                    vName,
                    " Vault #",
                    vaultId.toString()
                )
            );
    }

    /**
     * @dev Internal function to create a new oracle vault.
     * @param lbPair The address of the LBPair.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     * @param dataFeedX The address of the data feed for token X.
     * @param dataFeedY The address of the data feed for token Y.
     */
    function _createOracleVault(
        ILBPair lbPair,
        address tokenX,
        address tokenY,
        IAggregatorV3 dataFeedX,
        IAggregatorV3 dataFeedY,
        uint24 heartbeatX,
        uint24 heartbeatY
    ) internal returns (address vault) {
        uint8 decimalsX = IERC20MetadataUpgradeable(tokenX).decimals();
        uint8 decimalsY = IERC20MetadataUpgradeable(tokenY).decimals();

        // Create the helper first
        IOracleHelper helper = IOracleHelperFactory(_oracleHelperFactory)
            .createOracleHelper(
                address(this),
                lbPair,
                dataFeedX,
                dataFeedY,
                decimalsX,
                decimalsY
            );

        bytes memory vaultImmutableData = abi.encodePacked(
            lbPair,
            tokenX,
            tokenY,
            decimalsX,
            decimalsY,
            dataFeedX,
            dataFeedY,
            address(helper)
        );

        vault = _createMetropolisVault(
            VaultType.Oracle,
            lbPair,
            tokenX,
            tokenY,
            vaultImmutableData
        );

        // Initialize the helper with the vault address
        helper.initialize(
            vault,
            heartbeatX,
            heartbeatY,
            0,
            type(uint256).max,
            _defaultSequencerUptimeFeed
        );

        // Safety check to ensure the oracles are set correctly
        if (IOracleVault(vault).getPrice() == 0)
            revert VaultFactory__InvalidOraclePrice();
    }

    /**
     * @dev Internal function to create a new Metropolis vault of the given type.
     * @param vType The type of the vault (must be a Metropolis vault type).
     * @param lbPair The address of the LBPair.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     * @param vaultImmutableData The immutable data to pass to the vault.
     */
    function _createMetropolisVault(
        VaultType vType,
        ILBPair lbPair,
        address tokenX,
        address tokenY,
        bytes memory vaultImmutableData
    ) private isValidType(uint8(vType)) returns (address vault) {
        // Ensure this is only used for Metropolis vaults
        if (
            vType != VaultType.Simple &&
            vType != VaultType.Oracle &&
            vType != VaultType.OracleReward
        ) {
            revert VaultFactory__InvalidType();
        }

        address vaultImplementation = _vaultImplementation[vType];
        if (vaultImplementation == address(0))
            revert VaultFactory__VaultImplementationNotSet(vType);

        uint256 vaultId = _vaults[vType].length;

        bytes32 salt = keccak256(abi.encodePacked(vType, vaultId));
        vault = ImmutableClone.cloneDeterministic(
            vaultImplementation,
            vaultImmutableData,
            salt
        );

        _vaults[vType].push(vault);
        _vaultType[vault] = vType;

        // Metropolis vaults use name and symbol parameters
        IBaseVault(vault).initialize(_getName(vType, vaultId), "MVT");

        emit VaultCreated(vType, vault, lbPair, vaultId, tokenX, tokenY);
    }

    /**
     * @dev Internal function to create a new Shadow oracle reward vault.
     * @param pool The address of the Ramses V3 Pool.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     */
    function _createShadowOracleRewardVault(
        address pool,
        address tokenX,
        address tokenY
    ) internal returns (address vault) {
        VaultType vType = VaultType.ShadowOracleReward;

        address vaultImplementation = _vaultImplementation[vType];
        if (vaultImplementation == address(0))
            revert VaultFactory__VaultImplementationNotSet(vType);

        uint256 vaultId = _vaults[vType].length;

        // Shadow vault immutable data layout (simplified - no external oracles):
        // - 0x00: 20 bytes: The address of the Shadow pool
        // - 0x14: 20 bytes: The address of token 0
        // - 0x28: 20 bytes: The address of token 1
        // - 0x3C: 1 byte: The decimals of token 0
        // - 0x3D: 1 byte: The decimals of token 1
        bytes memory vaultImmutableData = abi.encodePacked(
            pool,
            tokenX,
            tokenY,
            IERC20MetadataUpgradeable(tokenX).decimals(),
            IERC20MetadataUpgradeable(tokenY).decimals()
        );

        vault = ImmutableClone.cloneDeterministic(
            vaultImplementation,
            vaultImmutableData,
            keccak256(abi.encodePacked(vType, vaultId))
        );

        _vaults[vType].push(vault);
        _vaultType[vault] = vType;

        // Shadow vaults use different initialization
        IOracleRewardShadowVault(vault).initialize(
            _getName(vType, vaultId),
            "MVT"
        );

        // Note: For event consistency, we pass address(0) for lbPair since Shadow vaults don't use LBPairs
        emit VaultCreated(
            vType,
            vault,
            ILBPair(address(0)),
            vaultId,
            tokenX,
            tokenY
        );
    }

    /**
     * @dev Internal function to create a new default strategy for the given vault.
     * @param vault The address of the vault.
     * @param lbPair The address of the LBPair.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     */
    function _createDefaultStrategy(
        address vault,
        ILBPair lbPair,
        address tokenX,
        address tokenY
    ) internal returns (address strategy) {
        bytes memory strategyImmutableData = abi.encodePacked(
            vault,
            lbPair,
            tokenX,
            tokenY
        );

        return
            _createStrategy(
                StrategyType.Default,
                address(vault),
                lbPair,
                strategyImmutableData
            );
    }

    /**
     * @dev Internal function to create a new Shadow strategy for the given vault.
     * @param vault The address of the vault.
     * @param pool The address of the Ramses V3 Pool.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     */
    function _createShadowStrategy(
        address vault,
        address pool,
        address tokenX,
        address tokenY
    ) internal returns (address strategy) {
        // Shadow strategy immutable data layout:
        // - 0x00: 20 bytes: The address of the Vault
        // - 0x14: 20 bytes: The address of the Ramses V3 Pool
        // - 0x28: 20 bytes: The address of token X
        // - 0x3C: 20 bytes: The address of token Y
        bytes memory strategyImmutableData = abi.encodePacked(
            vault,
            pool,
            tokenX,
            tokenY
        );

        // Note: Shadow strategies don't use LBPair, so we pass address(0)

        return
            _createStrategy(
                StrategyType.Shadow,
                address(vault),
                ILBPair(address(0)),
                strategyImmutableData
            );
    }

    /**
     * @dev Internal function to create a new strategy of the given type.
     * @param sType The type of the strategy.
     * @param vault The address of the vault.
     * @param lbPair The address of the LBPair.
     * @param strategyImmutableData The immutable data to pass to the strategy.
     */
    function _createStrategy(
        StrategyType sType,
        address vault,
        ILBPair lbPair,
        bytes memory strategyImmutableData
    ) internal isValidType(uint8(sType)) returns (address strategy) {
        address strategyImplementation = _strategyImplementation[sType];
        if (strategyImplementation == address(0))
            revert VaultFactory__StrategyImplementationNotSet(sType);

        uint256 strategyId = _strategies[sType].length;

        bytes32 salt = keccak256(abi.encodePacked(sType, strategyId));
        strategy = ImmutableClone.cloneDeterministic(
            strategyImplementation,
            strategyImmutableData,
            salt
        );

        _strategies[sType].push(strategy);
        _strategyType[strategy] = sType;

        IStrategyCommon(strategy).initialize();

        emit StrategyCreated(sType, strategy, vault, lbPair, strategyId);
    }

    /**
     * @dev Internal function to set the default operator.
     * @param defaultOperator The address of the default operator.
     */
    function _setDefaultOperator(address defaultOperator) internal {
        _defaultOperator = defaultOperator;

        emit DefaultOperatorSet(msg.sender, defaultOperator);
    }

    /**
     * @dev Internal function to set the fee recipient.
     * @param feeRecipient The address of the fee recipient.
     */
    function _setFeeRecipient(address feeRecipient) internal {
        if (feeRecipient == address(0))
            revert VaultFactory__InvalidFeeRecipient();

        _feeRecipient = feeRecipient;

        emit FeeRecipientSet(msg.sender, feeRecipient);
    }

    /**
     * @dev Internal function to link the given vault to the given strategy.
     * @param minimalVault The address of the vault.
     * @param strategy The address of the strategy.
     */
    function _linkVaultToStrategy(
        IMinimalVault minimalVault,
        address strategy
    ) internal {
        // First cast to IStrategyCommon to get the strategy type
        IStrategyCommon strategyCommon = IStrategyCommon(strategy);
        StrategyType strategyType = strategyCommon.getStrategyType();

        // Cast vault to IMinimalVault to get vault type
        VaultType vaultType = minimalVault.getVaultType();

        // Based on vault and strategy types, perform appropriate linking
        if (
            vaultType == VaultType.Oracle || vaultType == VaultType.OracleReward
        ) {
            // Metropolis vaults expect IMetropolisStrategy
            if (strategyType == StrategyType.Default) {
                IBaseVault(address(minimalVault)).setStrategy(
                    IMetropolisStrategy(strategy)
                );
            } else {
                revert("Cannot link Shadow strategy to Metropolis vault");
            }
        } else if (vaultType == VaultType.ShadowOracleReward) {
            // Shadow vaults need different handling
            if (strategyType == StrategyType.Shadow) {
                IOracleRewardShadowVault(address(minimalVault)).setStrategy(
                    IShadowStrategy(strategy)
                );
            } else {
                revert("Cannot link Metropolis strategy to Shadow vault");
            }
        } else {
            revert("Unknown or unsupported vault type");
        }
    }

    /**
     * @dev This is a gap filler to allow us to add new variables in the future without breaking
     *      the storage layout of the contract.
     */
    uint256[34] private __gap;
}
