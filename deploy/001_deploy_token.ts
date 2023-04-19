import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, tokenOwner} = await getNamedAccounts();

  const higherPool = await deploy('PoolWithHigherInterest', {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(higherPool.address);
  await deploy('Pool', {
    from: deployer,
    args: [higherPool.address],
    log: true
  });

};


export default func;
func.tags = ['EECE571G2022W2'];
