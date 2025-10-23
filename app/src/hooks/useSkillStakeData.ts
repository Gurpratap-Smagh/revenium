import { useCallback, useEffect, useState } from 'react'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { useSetRecoilState } from 'recoil'
import {
  aprBpsState,
  faucetCapState,
  faucetClaimedState,
  oracleAuthorityState,
  oracleNonceState,
  pendingRewardsState,
  powDifficultyState,
  powRewardState,
  tokenBalanceState,
  totalStakedState,
} from '../state/atoms'
import { useSkillStakeProgram } from './useSkillStakeProgram'
import { useSkillStakeWallet } from './useSkillStakeWallet'
import { getMintPublicKey, getTokenDecimals } from '../config/appConfig'
import { useToast } from './useToast'
import { fromBaseUnits } from '../utils/token'
import { seed } from '../utils/seeds'

const STATE_SEED = seed('state')
const STAKE_SEED = seed('stake')

export const useSkillStakeData = () => {
  const program = useSkillStakeProgram()
  const { connection, publicKey } = useSkillStakeWallet()
  const { pushToast } = useToast()

  const setTokenBalance = useSetRecoilState(tokenBalanceState)
  const setTotalStaked = useSetRecoilState(totalStakedState)
  const setPendingRewards = useSetRecoilState(pendingRewardsState)
  const setAprBps = useSetRecoilState(aprBpsState)
  const setFaucetCap = useSetRecoilState(faucetCapState)
  const setPowDifficulty = useSetRecoilState(powDifficultyState)
  const setPowReward = useSetRecoilState(powRewardState)
  const setOracleAuthority = useSetRecoilState(oracleAuthorityState)
  const setOracleNonce = useSetRecoilState(oracleNonceState)
  const setFaucetClaimed = useSetRecoilState(faucetClaimedState)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const decimals = getTokenDecimals()
  const mint = getMintPublicKey()

  const refresh = useCallback(async () => {
    if (!program) {
      return
    }
    setIsRefreshing(true)
    try {
      const [statePda] = PublicKey.findProgramAddressSync([STATE_SEED], program.programId)
      const stateAccount = await (program.account as any).globalState.fetchNullable(statePda)

      if (stateAccount) {
        setTotalStaked(fromBaseUnits(BigInt(stateAccount.totalStaked.toString()), decimals))
        setAprBps(Number(stateAccount.aprBps ?? 0))
        setFaucetCap(fromBaseUnits(BigInt(stateAccount.faucetCap.toString()), decimals))
        setPowDifficulty(Number(stateAccount.powDifficulty ?? 0))
        setPowReward(fromBaseUnits(BigInt(stateAccount.powReward.toString()), decimals))
        setOracleAuthority(
          stateAccount.oracleAuthority ? new PublicKey(stateAccount.oracleAuthority).toBase58() : null,
        )
        setOracleNonce(Number(stateAccount.oracleNonce ?? 0))
      } else {
        setTotalStaked(0)
        setAprBps(0)
        setFaucetCap(0)
        setPowDifficulty(0)
        setPowReward(0)
        setOracleAuthority(null)
        setOracleNonce(0)
        setFaucetClaimed(0)
      }

      if (publicKey) {
        const associatedTokenAddress = getAssociatedTokenAddressSync(mint, publicKey)
        const tokenBalance = await connection.getTokenAccountBalance(associatedTokenAddress).catch(() => null)
        const uiBalance = tokenBalance?.value?.uiAmountString
        setTokenBalance(uiBalance ? Number(uiBalance) : 0)

        const [stakePda] = PublicKey.findProgramAddressSync([STAKE_SEED, publicKey.toBuffer()], program.programId)
        const stakeAccount = await (program.account as any).stakeAccount.fetchNullable(stakePda)
        if (stakeAccount) {
          const staked = BigInt(stakeAccount.amountStaked.toString())
          const pending = BigInt(stakeAccount.pendingRewards.toString())
          setPendingRewards(fromBaseUnits(pending, decimals))
          setFaucetClaimed(fromBaseUnits(BigInt(stakeAccount.faucetClaimed.toString()), decimals))

          if (!uiBalance && staked > 0n) {
            pushToast({
              title: 'Missing associated token account',
              description: 'Create the associated token account to access your rewards.',
              variant: 'info',
            })
          }
        } else {
          setPendingRewards(0)
          setFaucetClaimed(0)
        }
      } else {
        setTokenBalance(0)
        setPendingRewards(0)
        setFaucetClaimed(0)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      pushToast({
        title: 'Failed to refresh data',
        description: message,
        variant: 'error',
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [
    program,
    publicKey,
    connection,
    mint,
    decimals,
    pushToast,
    setTokenBalance,
    setTotalStaked,
    setPendingRewards,
    setAprBps,
    setFaucetCap,
    setPowDifficulty,
    setPowReward,
    setOracleAuthority,
    setOracleNonce,
    setFaucetClaimed,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { refresh, isRefreshing }
}
