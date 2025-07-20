
// Vault Strategy Contract Configuration
// This contract manages liquidity in Liquidity Book pools with automated strategies

export const VAULT_STRATEGY_ABI = [
  {
    "inputs": [
      {
        "internalType": "contract IVaultFactory",
        "name": "factory",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "maxRange",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "Strategy__ActiveIdSlippage",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__InvalidFee",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__InvalidLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__InvalidRange",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__OnlyDefaultOperator",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__OnlyFactory",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__OnlyOperators",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__OnlyTrusted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__OnlyVault",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__RangeAlreadySet",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__RangeTooWide",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__RebalanceCoolDown",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "Strategy__ZeroAmounts",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "fee",
        "type": "uint256"
      }
    ],
    "name": "AumAnnualFeeSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalBalanceX",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalBalanceY",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "feeX",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "feeY",
        "type": "uint256"
      }
    ],
    "name": "AumFeeCollected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "name": "OperatorSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [],
    "name": "PendingAumAnnualFeeReset",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "fee",
        "type": "uint256"
      }
    ],
    "name": "PendingAumAnnualFeeSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "low",
        "type": "uint24"
      },
      {
        "indexed": false,
        "internalType": "uint24",
        "name": "upper",
        "type": "uint24"
      }
    ],
    "name": "RangeSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "coolDown",
        "type": "uint256"
      }
    ],
    "name": "RebalanceCoolDownSet",
    "type": "event"
  },
  {
    "stateMutability": "payable",
    "type": "fallback"
  },
  {
    "inputs": [],
    "name": "getAumAnnualFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "aumAnnualFee",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getBalances",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "amountX",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amountY",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getExtraRewardToken",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "rewardToken",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getFactory",
    "outputs": [
      {
        "internalType": "contract IVaultFactory",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getIdleBalances",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "amountX",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amountY",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLastRebalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "lastRebalance",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMaxRange",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getOperator",
    "outputs": [
      {
        "internalType": "address",
        "name": "operator",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPair",
    "outputs": [
      {
        "internalType": "contract ILBPair",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPendingAumAnnualFee",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isSet",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "pendingAumAnnualFee",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRange",
    "outputs": [
      {
        "internalType": "uint24",
        "name": "lower",
        "type": "uint24"
      },
      {
        "internalType": "uint24",
        "name": "upper",
        "type": "uint24"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRewardToken",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTokenX",
    "outputs": [
      {
        "internalType": "contract IERC20Upgradeable",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTokenY",
    "outputs": [
      {
        "internalType": "contract IERC20Upgradeable",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVault",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "harvestRewards",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "hasExtraRewards",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "hasRewards",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
] as const;

// Complete Vault ABI for user operations (deposit/withdraw)
export const VAULT_ABI = [{"inputs":[{"internalType":"contract IVaultFactory","name":"factory","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"BaseVault_WithdrawLocked","type":"error"},{"inputs":[],"name":"BaseVault__AlreadyFlaggedForShutdown","type":"error"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"BaseVault__AlreadyWhitelisted","type":"error"},{"inputs":[],"name":"BaseVault__BurnMinShares","type":"error"},{"inputs":[],"name":"BaseVault__DepositsPaused","type":"error"},{"inputs":[],"name":"BaseVault__InsufficientShares","type":"error"},{"inputs":[],"name":"BaseVault__InvalidNativeAmount","type":"error"},{"inputs":[],"name":"BaseVault__InvalidRecipient","type":"error"},{"inputs":[],"name":"BaseVault__InvalidRound","type":"error"},{"inputs":[],"name":"BaseVault__InvalidShares","type":"error"},{"inputs":[],"name":"BaseVault__InvalidStrategy","type":"error"},{"inputs":[],"name":"BaseVault__InvalidToken","type":"error"},{"inputs":[],"name":"BaseVault__MaxSharesExceeded","type":"error"},{"inputs":[],"name":"BaseVault__NativeTransferFailed","type":"error"},{"inputs":[],"name":"BaseVault__NoNativeToken","type":"error"},{"inputs":[],"name":"BaseVault__NoQueuedWithdrawal","type":"error"},{"inputs":[],"name":"BaseVault__NotInEmergencyMode","type":"error"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"BaseVault__NotWhitelisted","type":"error"},{"inputs":[],"name":"BaseVault__OnlyFactory","type":"error"},{"inputs":[],"name":"BaseVault__OnlyOperators","type":"error"},{"inputs":[],"name":"BaseVault__OnlyStrategy","type":"error"},{"inputs":[],"name":"BaseVault__OnlyWNative","type":"error"},{"inputs":[],"name":"BaseVault__SameStrategy","type":"error"},{"inputs":[],"name":"BaseVault__SameWhitelistState","type":"error"},{"inputs":[],"name":"BaseVault__Unauthorized","type":"error"},{"inputs":[],"name":"BaseVault__ZeroAmount","type":"error"},{"inputs":[],"name":"BaseVault__ZeroShares","type":"error"},{"inputs":[],"name":"OracleVault__GracePeriodNotOver","type":"error"},{"inputs":[],"name":"OracleVault__InvalidInterval","type":"error"},{"inputs":[],"name":"OracleVault__InvalidPrice","type":"error"},{"inputs":[],"name":"OracleVault__InvalidTimestamps","type":"error"},{"inputs":[],"name":"OracleVault__PriceDeviation","type":"error"},{"inputs":[],"name":"OracleVault__SequencerDown","type":"error"},{"inputs":[],"name":"OracleVault__StalePrice","type":"error"},{"inputs":[],"name":"TokenHelper__NativeTransferFailed","type":"error"},{"inputs":[],"name":"Uint256x256Math__MulDivOverflow","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amountX","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountY","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"}],"name":"Deposited","type":"event"},{"anonymous":false,"inputs":[],"name":"DepositsPaused","type":"event"},{"anonymous":false,"inputs":[],"name":"DepositsResumed","type":"event"},{"anonymous":false,"inputs":[],"name":"EmergencyMode","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountX","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountY","type":"uint256"}],"name":"EmergencyWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Harvested","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"timestamp","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"accRewardShare","type":"uint256"}],"name":"PoolUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Recovered","type":"event"},{"anonymous":false,"inputs":[],"name":"ShutdownCancelled","type":"event"},{"anonymous":false,"inputs":[],"name":"ShutdownSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract IStrategy","name":"strategy","type":"address"}],"name":"StrategySet","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"}],"name":"WithdrawalCancelled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalQueuedQhares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountX","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountY","type":"uint256"}],"name":"WithdrawalExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"}],"name":"WithdrawalQueued","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"shares","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountX","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amountY","type":"uint256"}],"name":"WithdrawalRedeemed","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"shares","type":"uint256"}],"name":"cancelQueuedWithdrawal","outputs":[{"internalType":"uint256","name":"round","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"cancelShutdown","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"checkPriceInDeviation","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"},{"internalType":"uint256","name":"minShares","type":"uint256"}],"name":"deposit","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"effectiveX","type":"uint256"},{"internalType":"uint256","name":"effectiveY","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"},{"internalType":"uint256","name":"minShares","type":"uint256"}],"name":"depositNative","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"effectiveX","type":"uint256"},{"internalType":"uint256","name":"effectiveY","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"executeQueuedWithdrawals","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getAumAnnualFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBalances","outputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentRound","outputs":[{"internalType":"uint256","name":"round","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentTotalQueuedWithdrawal","outputs":[{"internalType":"uint256","name":"totalQueuedShares","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getFactory","outputs":[{"internalType":"contract IVaultFactory","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOperators","outputs":[{"internalType":"address","name":"defaultOperator","type":"address"},{"internalType":"address","name":"operator","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOracleHelper","outputs":[{"internalType":"contract IOracleHelper","name":"","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getOracleParameters","outputs":[{"components":[{"internalType":"uint256","name":"minPrice","type":"uint256"},{"internalType":"uint256","name":"maxPrice","type":"uint256"},{"internalType":"uint24","name":"heartbeatX","type":"uint24"},{"internalType":"uint24","name":"heartbeatY","type":"uint24"},{"internalType":"uint256","name":"deviationThreshold","type":"uint256"},{"internalType":"bool","name":"twapPriceCheckEnabled","type":"bool"},{"internalType":"uint40","name":"twapInterval","type":"uint40"}],"internalType":"struct IOracleHelper.OracleParameters","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPair","outputs":[{"internalType":"contract ILBPair","name":"","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getPendingRewards","outputs":[{"components":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"pendingRewards","type":"uint256"}],"internalType":"struct IOracleRewardVault.UserReward[]","name":"rewards","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPrice","outputs":[{"internalType":"uint256","name":"price","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"round","type":"uint256"},{"internalType":"address","name":"user","type":"address"}],"name":"getQueuedWithdrawal","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRange","outputs":[{"internalType":"uint24","name":"low","type":"uint24"},{"internalType":"uint24","name":"upper","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"round","type":"uint256"},{"internalType":"address","name":"user","type":"address"}],"name":"getRedeemableAmounts","outputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getStrategy","outputs":[{"internalType":"contract IStrategy","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTokenX","outputs":[{"internalType":"contract IERC20Upgradeable","name":"","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getTokenY","outputs":[{"internalType":"contract IERC20Upgradeable","name":"","type":"address"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"uint256","name":"round","type":"uint256"}],"name":"getTotalQueuedWithdrawal","outputs":[{"internalType":"uint256","name":"totalQueuedShares","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserInfo","outputs":[{"components":[{"internalType":"uint256","name":"phantomAmount","type":"uint256"},{"components":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"rewardDebt","type":"uint256"}],"internalType":"struct IOracleRewardVault.RewardDebtInfo[]","name":"rewardDebtInfo","type":"tuple[]"}],"internalType":"struct IOracleRewardVault.UserInfo","name":"userInfo","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"isDepositsPaused","outputs":[{"internalType":"bool","name":"paused","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isFlaggedForShutdown","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"token","type":"address"}],"name":"notifyRewardToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"pauseDeposits","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"shares","type":"uint256"}],"name":"previewAmounts","outputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"}],"name":"previewShares","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"effectiveX","type":"uint256"},{"internalType":"uint256","name":"effectiveY","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"queueWithdrawal","outputs":[{"internalType":"uint256","name":"round","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20Upgradeable","name":"token","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"recoverERC20","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"round","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"redeemQueuedWithdrawal","outputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"round","type":"uint256"},{"internalType":"address","name":"recipient","type":"address"}],"name":"redeemQueuedWithdrawalNative","outputs":[{"internalType":"uint256","name":"amountX","type":"uint256"},{"internalType":"uint256","name":"amountY","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"resumeDeposits","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"setEmergencyMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IStrategy","name":"newStrategy","type":"address"}],"name":"setStrategy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"submitShutdown","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"updateAccRewardsPerShare","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"version","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"pure","type":"function"},{"stateMutability":"payable","type":"receive"}] as const;

// Contract addresses - Real strategy address for S-scUSD vault
export const CONTRACT_ADDRESSES = {
  // Vault addresses will be fetched from strategy contracts
  vaults: {
    'S/USDC': '0x9541962342A344569FEAD20F6f824856aAC8cad9', // Updated S-USDC vault
    'ETH/USDC': '', // Future vault
    'SOL/USDC': '', // Future vault
    'BTC/USDC': '', // Future vault
  },
  
  // Strategy contracts for each vault
  strategies: {
    'S/USDC': '0xe4b564f305f762363B526697f9fb682c8BA2605F', // Updated S-USDC strategy
    'ETH/USDC': '', // Future strategy
    'SOL/USDC': '', // Future strategy
    'BTC/USDC': '', // Future strategy
  }
} as const;

// LBP (Liquidity Book Pair) Contract ABI
export const LBP_ABI = [{"inputs":[{"internalType":"contract ILBFactory","name":"factory_","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"target","type":"address"}],"name":"AddressEmptyCode","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"AddressInsufficientBalance","type":"error"},{"inputs":[{"internalType":"uint24","name":"id","type":"uint24"}],"name":"BinHelper__CompositionFactorFlawed","type":"error"},{"inputs":[],"name":"BinHelper__LiquidityOverflow","type":"error"},{"inputs":[],"name":"BinHelper__MaxLiquidityPerBinExceeded","type":"error"},{"inputs":[],"name":"FailedInnerCall","type":"error"},{"inputs":[],"name":"FeeHelper__FeeTooLarge","type":"error"},{"inputs":[],"name":"Hooks__CallFailed","type":"error"},{"inputs":[],"name":"InvalidInitialization","type":"error"},{"inputs":[],"name":"LBPair__AddressZero","type":"error"},{"inputs":[],"name":"LBPair__EmptyMarketConfigs","type":"error"},{"inputs":[],"name":"LBPair__FlashLoanCallbackFailed","type":"error"},{"inputs":[],"name":"LBPair__FlashLoanInsufficientAmount","type":"error"},{"inputs":[],"name":"LBPair__InsufficientAmountIn","type":"error"},{"inputs":[],"name":"LBPair__InsufficientAmountOut","type":"error"},{"inputs":[],"name":"LBPair__InvalidHooks","type":"error"},{"inputs":[],"name":"LBPair__InvalidInput","type":"error"},{"inputs":[],"name":"LBPair__InvalidStaticFeeParameters","type":"error"},{"inputs":[],"name":"LBPair__MaxTotalFeeExceeded","type":"error"},{"inputs":[],"name":"LBPair__OnlyFactory","type":"error"},{"inputs":[],"name":"LBPair__OnlyProtocolFeeRecipient","type":"error"},{"inputs":[],"name":"LBPair__OutOfLiquidity","type":"error"},{"inputs":[],"name":"LBPair__TokenNotSupported","type":"error"},{"inputs":[{"internalType":"uint24","name":"id","type":"uint24"}],"name":"LBPair__ZeroAmount","type":"error"},{"inputs":[{"internalType":"uint24","name":"id","type":"uint24"}],"name":"LBPair__ZeroAmountsOut","type":"error"},{"inputs":[],"name":"LBPair__ZeroBorrowAmount","type":"error"},{"inputs":[{"internalType":"uint24","name":"id","type":"uint24"}],"name":"LBPair__ZeroShares","type":"error"},{"inputs":[],"name":"LBToken__AddressThisOrZero","type":"error"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LBToken__BurnExceedsBalance","type":"error"},{"inputs":[],"name":"LBToken__LengthMismatch","type":"error"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"}],"name":"LBToken__SelfApproval","type":"error"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LBToken__SpenderNotApproved","type":"error"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LBToken__TransferExceedsBalance","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"LBToken__TransferFromOrToAddress0","type":"error"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"LBToken__TransferToSelf","type":"error"},{"inputs":[],"name":"NotInitializing","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"PackedUint128Math__AddOverflow","type":"error"},{"inputs":[],"name":"PackedUint128Math__MultiplierTooLarge","type":"error"},{"inputs":[],"name":"PackedUint128Math__SubUnderflow","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"inputs":[],"name":"TreeMath__ErrorDepthSearch","type":"error"},{"inputs":[],"name":"Uint128x128Math__LogUnderflow","type":"error"},{"inputs":[],"name":"Uint128x128Math__PowUnderflow","type":"error"},{"inputs":[],"name":"Uint256x256Math__MulDivOverflow","type":"error"},{"inputs":[],"name":"Uint256x256Math__MulShiftOverflow","type":"error"},{"inputs":[],"name":"Uint24Library__AddOverflow","type":"error"},{"inputs":[],"name":"Uint24Library__SubUnderflow","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"bool","name":"approved","type":"bool"}],"name":"ApprovalForAll","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"indexed":false,"internalType":"bytes32[]","name":"amounts","type":"bytes32[]"}],"name":"DepositedToBins","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"feeRecipient","type":"address"},{"indexed":false,"internalType":"bytes32","name":"fees","type":"bytes32"}],"name":"FeesCollected","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint24","name":"id","type":"uint24"},{"indexed":false,"internalType":"bytes32","name":"amountsIn","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"amountsOut","type":"bytes32"},{"indexed":false,"internalType":"uint24","name":"volatilityAccumulator","type":"uint24"},{"indexed":false,"internalType":"bytes32","name":"totalFees","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"protocolFees","type":"bytes32"}],"name":"FlashLoan","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint24","name":"id","type":"uint24"},{"indexed":false,"internalType":"bytes32","name":"amountsIn","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"amountsOut","type":"bytes32"},{"indexed":false,"internalType":"uint24","name":"volatilityAccumulator","type":"uint24"},{"indexed":false,"internalType":"bytes32","name":"totalFees","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"protocolFees","type":"bytes32"}],"name":"Swap","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"indexed":false,"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"TransferBatch","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"indexed":false,"internalType":"bytes32[]","name":"amounts","type":"bytes32[]"}],"name":"WithdrawnFromBins","type":"event"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"accounts","type":"address[]"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"}],"name":"balanceOfBatch","outputs":[{"internalType":"uint256[]","name":"batchBalances","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"feeRecipient","type":"address"}],"name":"collectProtocolFees","outputs":[{"internalType":"bytes32","name":"collectedProtocolFees","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes32[]","name":"liquidityConfigs","type":"bytes32[]"},{"internalType":"address","name":"refundTo","type":"address"}],"name":"flashLoan","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getActiveId","outputs":[{"internalType":"uint24","name":"activeId","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBin","outputs":[{"internalType":"uint128","name":"binReserveX","type":"uint128"},{"internalType":"uint128","name":"binReserveY","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBinStep","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getFactory","outputs":[{"internalType":"contract ILBFactory","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getGlobalFees","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getLocalFees","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getNextNonEmptyBin","outputs":[{"internalType":"uint24","name":"nextId","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOracleParameters","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOracleSampleAt","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPriceFromId","outputs":[{"internalType":"uint256","name":"price","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getProtocolFees","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint128","name":"reserveX","type":"uint128"},{"internalType":"uint128","name":"reserveY","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getStaticFeeParameters","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint128","name":"amountIn","type":"uint128"},{"internalType":"bool","name":"swapForY","type":"bool"}],"name":"getSwapIn","outputs":[{"internalType":"uint128","name":"amountInLeft","type":"uint128"},{"internalType":"uint128","name":"amountOut","type":"uint128"},{"internalType":"uint128","name":"fee","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint128","name":"amountOut","type":"uint128"},{"internalType":"bool","name":"swapForY","type":"bool"}],"name":"getSwapOut","outputs":[{"internalType":"uint128","name":"amountIn","type":"uint128"},{"internalType":"uint128","name":"amountOutLeft","type":"uint128"},{"internalType":"uint128","name":"fee","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTokenX","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTokenY","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getVariableFeeParameters","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"tokenX","type":"address"},{"internalType":"contract IERC20","name":"tokenY","type":"address"},{"internalType":"uint16","name":"binStep","type":"uint16"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"isApprovedForAll","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes32[]","name":"liquidityConfigs","type":"bytes32[]"},{"internalType":"address","name":"refundTo","type":"address"}],"name":"mint","outputs":[{"internalType":"bytes32","name":"amountsReceived","type":"bytes32"},{"internalType":"bytes32","name":"amountsLeft","type":"bytes32"},{"internalType":"uint256[]","name":"liquidityMinted","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"safeBatchTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"safeTransferFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"bool","name":"approved","type":"bool"}],"name":"setApprovalForAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"baseFactor","type":"uint16"},{"internalType":"uint16","name":"filterPeriod","type":"uint16"},{"internalType":"uint16","name":"decayPeriod","type":"uint16"},{"internalType":"uint16","name":"reductionFactor","type":"uint16"},{"internalType":"uint24","name":"variableFeeControl","type":"uint24"},{"internalType":"uint16","name":"protocolShare","type":"uint16"},{"internalType":"uint24","name":"maxVolatilityAccumulator","type":"uint24"}],"name":"setStaticFeeParameters","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"swapForY","type":"bool"},{"internalType":"address","name":"to","type":"address"}],"name":"swap","outputs":[{"internalType":"bytes32","name":"amountsOut","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256[]","name":"ids","type":"uint256[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"withdrawFrom","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;

// Real token addresses for Sonic network
export const TOKEN_ADDRESSES = {
  // Native S token (wrapped)
  S: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38', // Wrapped Sonic (wS) on Sonic network
  // USDC on Sonic network  
  USDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', // USDC on Sonic network
  // Other tokens (if needed later)
  ETH: '0x4200000000000000000000000000000000000006', // WETH on Sonic
  SOL: '0x...', // SOL address if available
  BTC: '0x...', // WBTC address if available
} as const;

// ERC20 ABI for balanceOf, decimals, approve, and allowance functions
export const ERC20_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      }
    ],
    "name": "allowance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// LBP Contract addresses
export const LBP_ADDRESSES = {
  'S/USDC': '0x32c0d87389e72e46b54bc4ea6310c1a0e921c4dc', // Real LBP contract for S-USDC vault
} as const;
