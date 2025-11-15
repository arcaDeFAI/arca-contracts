// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.26;

interface ILauncherPlugin {
    error NOT_AUTHORITY();
    error ALREADY_AUTHORITY();
    error NOT_OPERATOR();
    error ALREADY_OPERATOR();
    error NOT_ENABLED(address pool);
    error NO_FEEDIST();
    error ENABLED();
    error INVALID_TAKE();

    /// @dev struct that holds the configurations of each specific pool
    struct LauncherConfigs {
        uint256 launcherTake;
        address takeRecipient;
    }

    event NewOperator(address indexed _old, address indexed _new);

    event NewAuthority(address indexed _newAuthority);
    event RemovedAuthority(address indexed _previousAuthority);

    event EnabledPool(address indexed pool, string indexed _name);
    event DisabledPool(address indexed pool);
    event MigratedPool(address indexed oldPool, address indexed newPool);
    event Configured(
        address indexed pool,
        uint256 take,
        address indexed recipient
    );

    event Labeled(address indexed authority, string indexed label);

    /// @notice address of the accessHub
    function accessHub() external view returns (address _accessHub);
    /// @notice protocol operator address
    function operator() external view returns (address _operator);

    /// @notice the denominator constant
    function DENOM() external view returns (uint256 _denominator);

    /// @notice whether configs are enabled for a pool
    /// @param _pool address of the pool
    /// @return bool
    function launcherPluginEnabled(address _pool) external view returns (bool);

    /// @notice maps whether an address is an authority or not
    /// @param _who the address to check
    /// @return _is true or false
    function authorityMap(address _who) external view returns (bool _is);

    /// @notice allows migrating the parameters from one pool to the other
    /// @param _oldPool the current address of the pair
    /// @param _newPool the new pool's address
    function migratePool(address _oldPool, address _newPool) external;

    /// @notice fetch the launcher configs if any
    /// @param _pool address of the pool
    /// @return LauncherConfigs the configs
    function poolConfigs(
        address _pool
    ) external view returns (uint256, address);
    /// @notice view functionality to see who is an authority
    function nameOfAuthority(address) external view returns (string memory);

    /// @notice returns the pool address for a feeDist
    /// @param _feeDist address of the feeDist
    /// @return _pool the pool address from the mapping
    function feeDistToPool(
        address _feeDist
    ) external view returns (address _pool);

    /// @notice set launcher configurations for a pool
    /// @param _pool address of the pool
    /// @param _take the fee that goes to the designated recipient
    /// @param _recipient the address that receives the fees
    function setConfigs(
        address _pool,
        uint256 _take,
        address _recipient
    ) external;

    /// @notice enables the pool for LauncherConfigs
    /// @param _pool address of the pool
    function enablePool(address _pool) external;

    /// @notice disables the pool for LauncherConfigs
    /// @dev clears mappings
    /// @param _pool address of the pool
    function disablePool(address _pool) external;

    /// @notice sets a new operator address
    /// @param _newOperator new operator address
    function setOperator(address _newOperator) external;

    /// @notice gives authority to a new contract/address
    /// @param _newAuthority the suggested new authority
    function grantAuthority(address _newAuthority, string calldata) external;

    /// @notice removes authority from a contract/address
    /// @param _oldAuthority the to-be-removed authority
    function revokeAuthority(address _oldAuthority) external;

    /// @notice labels an authority
    function label(address, string calldata) external;

    /// @notice returns the values for the launcherConfig of the specific feeDist
    /// @param _feeDist the address of the feeDist
    /// @return _launcherTake fee amount taken
    /// @return _recipient address that receives the fees
    function values(
        address _feeDist
    ) external view returns (uint256 _launcherTake, address _recipient);
}
