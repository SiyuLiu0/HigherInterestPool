import { expect } from "./chai-setup";
import {setupUsers, setupUser} from './utils';
import {ethers, deployments, getNamedAccounts, getUnnamedAccounts} from 'hardhat';

async function setup () {
  // it first ensures the deployment is executed and reset (use of evm_snapshot for faster tests)
  await deployments.fixture(["EECE571G2022W2"]);

  // we get an instantiated contract in the form of a ethers.js Contract instance:
  const contracts = {
    Token: (await ethers.getContract('PoolWithHigherInterest')),
  };

  // we get the tokenOwner
  const {tokenOwner} = await getNamedAccounts();

  // Get the unnammedAccounts (which are basically all accounts not named in the config,
  // This is useful for tests as you can be sure they have noy been given tokens for example)
  // We then use the utilities function to generate user objects
  // These object allow you to write things like `users[0].Token.transfer(....)`
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  // finally we return the whole object (including the tokenOwner setup as a User object)
  return {
    ...contracts,
    users,
    tokenOwner: await setupUser(tokenOwner, contracts)
  };
}

console.log("start Pool.test.ts");
describe("PoolWithHigherInterest contract", function () {
  it("Register should register a user with a name", async function () {
    const {Token, users, tokenOwner} = await setup();
    await tokenOwner.Token.register("Alice");
    const user1Details = await tokenOwner.Token.users(tokenOwner.address);
    expect(user1Details.name).to.equal("Alice");
  });

  it("should allow a user to deposit funds and update their balance", async function () {
    const {Token, users, tokenOwner} = await setup();
    await tokenOwner.Token.register("Alice");
    await tokenOwner.Token.deposit({ value: ethers.utils.parseEther("3") });
    const user1Details = await tokenOwner.Token.users(tokenOwner.address);
    console.log("user1Details.balance: ", user1Details.balance);
    expect(user1Details.balance).to.equal(ethers.utils.parseEther("3"));
    await expect(tokenOwner.Token.getFunds()).to.be.revertedWith(
      "can only be called by the owner"
    );
  });

  it("should not allow a user to deposit less than the lowest deposit amount", async function () {
    const {Token, users, tokenOwner} = await setup();
    await tokenOwner.Token.register("Alice");
    await expect(tokenOwner.Token.deposit({ value: 0 })).to.be.revertedWith(
      "Deposit amount can not be less than lowestDepositAmount"
    );
  });

  it("should allow a user to withdraw funds and update their balance", async function () {
    const {Token, users, tokenOwner} = await setup();
    await tokenOwner.Token.register("Alice");
    await Token.changeLowestDepositAmount(10);
    await tokenOwner.Token.deposit({ value: 100 });
    await tokenOwner.Token.withdraw(50);
    const user1Details = await tokenOwner.Token.users(tokenOwner.address);
    expect(user1Details.balance).to.equal(50);
  });

  it("should not allow a user to withdraw more than their balance", async function () {
    const {Token, users, tokenOwner} = await setup();
    await tokenOwner.Token.register("Alice");
    await tokenOwner.Token.deposit({ value: ethers.utils.parseEther("4") });
    await expect(tokenOwner.Token.withdraw(ethers.utils.parseEther("5"))).to.be.revertedWith(
      "Insufficient balance"
    );
  });

  it("should only allow the owner to change the interest rate", async function () {
    const {Token, users, tokenOwner} = await setup();
    await Token.changeRate(5);
    expect(await Token.getInterestRate()).to.equal(5);
    await expect(users[0].Token.changeRate(5)).to.be.revertedWith("can only be called by the owner");
  });

  it("should only allow the owner to change the lowest deposit amount", async function () {
    const {Token, users, tokenOwner} = await setup();
    await Token.changeLowestDepositAmount(5);
    expect(await Token.getLowestDepositAmount()).to.equal(5);
    await expect(users[0].Token.changeLowestDepositAmount(5)).to.be.revertedWith("can only be called by the owner");
  }); 

  it("should update user balance and total interest correctly", async function () {
    const {Token, users, tokenOwner} = await setup();
    // register user
    await tokenOwner.Token.register("Alice");

    // deposit some ether into the pool
    const depositAmount = ethers.utils.parseEther("4");
    await tokenOwner.Token.deposit({ value: depositAmount });

    // wait for some time to pass
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 3]); // increase time by 1 day
    await ethers.provider.send("evm_mine", []); // mine a new block to update the timestamp

    // check that the user's balance has increased by the expected amount
    const expectedInterest = depositAmount.mul(4 * 3).div(36500); // 4% annual interest
    const expectedBalance = depositAmount.add(expectedInterest);
    const balance = await tokenOwner.Token.getBalance();
    expect(balance).to.equal(expectedBalance);
  });
});