// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IArcaFeeManagerV1 {
  function BASIS_POINTS (  ) external view returns ( uint256 );
  function getDepositFee (  ) external view returns ( uint256 );
  function getFeeRecipient (  ) external view returns ( address );
  function getPerformanceFee (  ) external view returns ( uint256 );
  function getWithdrawFee (  ) external view returns ( uint256 );
  function setFeeRecipient ( address _feeRecipient ) external;
  function setFees ( uint256 _depositFee, uint256 _withdrawFee, uint256 _performanceFee ) external;
}
