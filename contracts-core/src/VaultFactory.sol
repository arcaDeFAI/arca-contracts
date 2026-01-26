// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ImmutableClone} from "@arca/joe-v2/libraries/ImmutableClone.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import {IStrategyCommon} from "./interfaces/IStrategyCommon.sol";
import {IDragonswapStrategy} from "../../contracts-dragonswap/src/interfaces/IDragonswapStrategy.sol";
import {IMinimalVault} from "./interfaces/IMinimalVault.sol";
import {IBaseVault} from "./interfaces/IBaseVault.sol";
import {IOracleRewardDragonswapVault} from "../../contracts-dragonswap/src/interfaces/IOracleRewardDragonswapVault.sol";
import {IDragonswapV2Pool} from "../../contracts-dragonswap/v2-core/interfaces/IDragonswapV2Pool.sol";
import {IVaultFactory} from "./interfaces/IVaultFactory.sol";
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

    uint256 private constant MAX_AUM_FEE = 0.3e4; // 30% is the maximum AUM fee

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

    /// @dev Dragonswap protocol addresses
    address private _dragonswapNonfungiblePositionManager;
    address private _dragonswapVoter;

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
    constructor(address wnative) {
        _disableInitializers();

        // safety check
        IERC20Upgradeable(wnative).balanceOf(address(this));

        _wnative = wnative;
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
     * @notice Returns the address of the Dragonswap Nonfungible Position Manager.
     * @return The address of the Dragonswap NPM.
     */
    function getDragonswapNonfungiblePositionManager()
        external
        view
        override
        returns (address)
    {
        return _dragonswapNonfungiblePositionManager;
    }

    /**
     * @notice Returns the address of the Dragonswap Voter.
     * @return The address of the Dragonswap Voter.
     */
    function getDragonswapVoter() external view override returns (address) {
        return _dragonswapVoter;
    }

    /**
     * Check if address is ignored for rewards (e.g strategy, or other addresses)
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
     * @notice Creates a new Dragonswap oracle reward vault and strategy for market makers.
     * @dev Pool must be whitelisted. Uses pool-based TWAP oracle.
     * @param pool The address of the Ramses V3 Pool.
     * @param aumFee The AUM annual fee.
     * @param twapInterval The TWAP interval (0 for spot price, >0 for TWAP).
     * @return vault The address of the new vault.
     * @return strategy The address of the new strategy.
     */
    function createMarketMakerDragonswapOracleRewardVault(
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
        IDragonswapV2Pool dragonswapPool = IDragonswapV2Pool(pool);
        address tokenX = dragonswapPool.token0();
        address tokenY = dragonswapPool.token1();

        // Validate pool has sufficient observation cardinality for TWAP
        if (twapInterval > 0) {
            (, , ,uint16 observationCardinality, , , ) = dragonswapPool.slot0();

            // Require at least 10 observation slots for TWAP
            if (observationCardinality < 10)
                revert VaultFactory__TwapInvalidOracleSize();
        }

        // Create vault and strategy
        vault = _createDragonswapOracleRewardVault(pool, tokenX, tokenY);
        strategy = _createDragonswapStrategy(vault, pool, tokenX, tokenY);

        _linkVaultToStrategy(IMinimalVault(vault), strategy);

        // Set operator
        IStrategyCommon(strategy).setOperator(msg.sender);

        // Set TWAP interval
        IOracleRewardDragonswapVault(vault).setTwapInterval(twapInterval);

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

    /// @notice Creates and links a new Dragonswap Strategy to an existing vault.
    /// @dev Deploys strategy, links it to vault, and sets operator.
    /// @param vault The address of the vault to link.
    /// @param pool The address of the liquidity pool.
    /// @param tokenX The address of token X.
    /// @param tokenY The address of token Y.
    /// @return strategy The address of the deployed Dragonswap Strategy.
    function createAndLinkDragonswapStrategy(
        address vault,
        address pool,
        address tokenX,
        address tokenY
    ) external onlyOwner returns (address strategy) {
        // Deploy Dragonswap Strategy
        strategy = _createDragonswapStrategy(vault, pool, tokenX, tokenY);

        // Link the vault and strategy
        _linkVaultToStrategy(IMinimalVault(vault), strategy);

        // Set the strategy operator to the caller
        IStrategyCommon(strategy).setOperator(msg.sender);

        // Emit event for transparency
        emit DragonswapStrategyCreatedAndLinked(vault, strategy, msg.sender);
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
     * @notice Sets the Dragonswap Nonfungible Position Manager address.
     * @param nonfungiblePositionManager The address of the Dragonswap NPM.
     */
    function setDragonswapNonfungiblePositionManager(
        address nonfungiblePositionManager
    ) external override onlyOwner {
        _dragonswapNonfungiblePositionManager = nonfungiblePositionManager;
    }

    /**
     * @notice Sets the Dragonswap Voter address.
     * @param voter The address of the Dragonswap Voter.
     */
    function setDragonswapVoter(address voter) external override onlyOwner {
        _dragonswapVoter = voter;
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

        if (vType == VaultType.DragonswapOracleReward)
            vName = "Dragonswap Oracle Reward";
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
     * @dev Internal function to create a new Dragonswap oracle reward vault.
     * @param pool The address of the Ramses V3 Pool.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     */
    function _createDragonswapOracleRewardVault(
        address pool,
        address tokenX,
        address tokenY
    ) internal returns (address vault) {
        VaultType vType = VaultType.DragonswapOracleReward;

        address vaultImplementation = _vaultImplementation[vType];
        if (vaultImplementation == address(0))
            revert VaultFactory__VaultImplementationNotSet(vType);

        uint256 vaultId = _vaults[vType].length;

        // Dragonswap vault immutable data layout (simplified - no external oracles):
        // - 0x00: 20 bytes: The address of the Dragonswap pool
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

        // Dragonswap vaults use different initialization
        IOracleRewardDragonswapVault(vault).initialize(
            _getName(vType, vaultId),
            "MVT"
        );

        emit VaultCreated(
            vType,
            vault,
            vaultId,
            tokenX,
            tokenY
        );
    }

    /**
     * @dev Internal function to create a new Dragonswap strategy for the given vault.
     * @param vault The address of the vault.
     * @param pool The address of the Ramses V3 Pool.
     * @param tokenX The address of token X.
     * @param tokenY The address of token Y.
     */
    function _createDragonswapStrategy(
        address vault,
        address pool,
        address tokenX,
        address tokenY
    ) internal returns (address strategy) {
        // Dragonswap strategy immutable data layout:
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

        return
            _createStrategy(
                StrategyType.Dragonswap,
                address(vault),
                strategyImmutableData
            );
    }

    /**
     * @dev Internal function to create a new strategy of the given type.
     * @param sType The type of the strategy.
     * @param vault The address of the vault.
     * @param strategyImmutableData The immutable data to pass to the strategy.
     */
    function _createStrategy(
        StrategyType sType,
        address vault,
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

        emit StrategyCreated(sType, strategy, vault, strategyId);
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
                revert("Cannot link Dragonswap strategy to Metropolis vault");
            }
        } else if (vaultType == VaultType.DragonswapOracleReward) {
            // Dragonswap vaults need different handling
            if (strategyType == StrategyType.Dragonswap) {
                IOracleRewardDragonswapVault(address(minimalVault)).setStrategy(
                    IDragonswapStrategy(strategy)
                );
            } else {
                revert("Cannot link Metropolis strategy to Dragonswap vault");
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
