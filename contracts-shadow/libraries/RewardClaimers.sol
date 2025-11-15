// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {INonfungiblePositionManager} from "../CL/periphery/interfaces/INonfungiblePositionManager.sol";
import {IGauge} from "../interfaces/IGauge.sol";
import {IGaugeV3} from "../CL/gauge/interfaces/IGaugeV3.sol";
import {IVoteModule} from "../interfaces/IVoteModule.sol";
import {IFeeDistributor} from "../interfaces/IFeeDistributor.sol";

/// @title RewardClaimers
/// @notice Reward claimers logic for Voter
/// @dev Used to reduce Voter contract size by moving all reward claiming logic to a library
library RewardClaimers {
    error NOT_AUTHORIZED();

    /// @dev function for claiming CL rewards with multiple ownership/access checks
    function claimClGaugeRewards(
        address nfpManager,
        address[] calldata _gauges,
        address[][] calldata _tokens,
        uint256[][] calldata _nfpTokenIds
    ) external {
        for (uint256 i; i < _gauges.length; ++i) {
            for (uint256 j; j < _nfpTokenIds[i].length; ++j) {
                require(
                    msg.sender ==
                        INonfungiblePositionManager(nfpManager).ownerOf(
                            _nfpTokenIds[i][j]
                        ) ||
                        msg.sender ==
                        INonfungiblePositionManager(nfpManager).getApproved(
                            _nfpTokenIds[i][j]
                        ) ||
                        INonfungiblePositionManager(nfpManager)
                            .isApprovedForAll(
                                INonfungiblePositionManager(nfpManager).ownerOf(
                                    _nfpTokenIds[i][j]
                                ),
                                msg.sender
                            )
                );

                IGaugeV3(_gauges[i]).getRewardForOwner(
                    _nfpTokenIds[i][j],
                    _tokens[i]
                );
            }
        }
    }

    /// @dev claims voting incentives batched
    function claimIncentives(
        address voteModule,
        address owner,
        address[] calldata _feeDistributors,
        address[][] calldata _tokens
    ) external {
        IVoteModule(voteModule).isAdminFor(msg.sender, owner);

        for (uint256 i; i < _feeDistributors.length; ++i) {
            IFeeDistributor(_feeDistributors[i]).getRewardForOwner(
                owner,
                _tokens[i]
            );
        }
    }

    /// @dev for claiming a batch of legacy gauge rewards
    function claimRewards(
        address[] calldata _gauges,
        address[][] calldata _tokens
    ) external {
        for (uint256 i; i < _gauges.length; ++i) {
            IGauge(_gauges[i]).getReward(msg.sender, _tokens[i]);
        }
    }

    /// @dev for users to exit legacy rewarded xshadow into shadow directly
    function claimLegacyRewardsAndExit(
        address[] calldata _gauges,
        address[][] calldata _tokens
    ) external {
        for (uint256 i; i < _gauges.length; ++i) {
            IGauge(_gauges[i]).getRewardAndExit(msg.sender, _tokens[i]);
        }
    }
}
