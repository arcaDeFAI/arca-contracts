// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.28;

import { ILBRouter } from "../../lib/joe-v2/src/interfaces/ILBRouter.sol";

interface IArcaRewardClaimerV1 {
  function claimAndCompoundRewards (  ) external;
  function claimRewards ( uint256[] calldata binIds, address receiver ) external returns ( uint256 claimedAmount );
  function getExpectedSwapOutput ( uint256 metroAmount, address targetToken ) external view returns ( uint256 expectedOutput, uint256 minimumExpectedOutput );
  function getVaultBinIds (  ) external view returns ( uint256[] memory );
  function idSlippage (  ) external view returns ( uint256 );
  function minSwapAmount (  ) external view returns ( uint256 );
  function nativeToken (  ) external view returns ( address );
  function setMinSwapAmount ( uint256 _minSwapAmount ) external;
  function setRewarder ( address rewarder ) external;
  function setSwapPaths ( ILBRouter.Path calldata _metroToTokenXPath, ILBRouter.Path calldata _metroToTokenYPath, ILBRouter.Path calldata _metroToNativePath ) external;
}
