import { expect } from "./chai-setup";
import {setupUsers, setupUser} from './utils';
import {ethers, deployments, getNamedAccounts, getUnnamedAccounts} from 'hardhat';

async function setup () {
  // it first ensures the deployment is executed and reset (use of evm_snapshot for faster tests)
  await deployments.fixture(["EECE571G2022W2"]);

  // we get an instantiated contract in the form of a ethers.js Contract instance:
  const firstPool = (await ethers.getContract('PoolWithHigherInterest'));
  const contracts = {
    PoolWithHigherInterest: firstPool,
    Pool: (await ethers.getContract('Pool'))
  };

  const {tokenOwner} = await getNamedAccounts();

  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  
  return {
    ...contracts,
    users,
    tokenOwner: await setupUser(tokenOwner, contracts)
  };
}

console.log("start Pool.test.ts");
describe("Pool contract", function () {
  it("Register should register a user with a name", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await tokenOwner.Pool.register("Alice");
    const user1Details = await tokenOwner.Pool.users(tokenOwner.address);
    expect(user1Details.name).to.equal("Alice");
  });

  it("should allow users to see their own interestRate", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    const rate = await users[0].Pool.getUserInterestRate(users[0].address);

    expect(rate).to.equal(2);
    expect(users[0].Pool.getUserInterestRate(users[1].address)).to.be.revertedWith(
        "You can not get other people's inerestRate."
      );
  });

  it("should allow users to see their balance", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    const balance = await users[0].Pool.getBalance();
    expect(balance).to.equal(0);
  });

  it("should allow the owner to see current funds", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    const funds = await Pool.getFunds()
    expect(funds).to.equal(0);
    expect(users[0].Pool.getFunds()).to.be.revertedWith(
        "can only be called by the owner"
      );
  });

  it("should allow the owner to get investedAmount", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    expect(await Pool.getInvestedAmount()).to.equal(0);
    await users[0].Pool.deposit({ value: ethers.utils.parseEther("4")});
    expect(await Pool.getInvestedAmount()).to.not.equal(0);
  });

  it("cannot manually invest if there is no enough funds", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    await users[0].Pool.deposit({ value: ethers.utils.parseEther("4")});
    expect(Pool.manuallyInvest(ethers.utils.parseEther("4"))).to.be.revertedWith(
        "Deposit amount can not be less than lowestDepositAmount"
      );
  });

  it("cannot manually withdraw if there is enough deposit", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    await users[0].Pool.deposit({ value: ethers.utils.parseEther("2")});
    expect(Pool.manuallyWithdraw(ethers.utils.parseEther("7"))).to.be.revertedWith(
        "Don't have enough amount to withdraw"
      );
  });

  

  it("should allow a user to deposit funds and update their balance", async function () {
    const {PoolWithHigherInterest, Pool, users, tokenOwner} = await setup();
    await tokenOwner.Pool.register("Alice");
    await tokenOwner.Pool.deposit({ value: 100 });
    const user1Details = await tokenOwner.Pool.users(tokenOwner.address);
    console.log("user1Details.balance: ", user1Details.balance);
    expect(user1Details.balance).to.equal(100);
  });

  it("should not allow a user to deposit zero amount", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await tokenOwner.Pool.register("Alice");
    await expect(tokenOwner.Pool.deposit({ value: 0 })).to.be.revertedWith(
      "Deposit amount can not be zero."
    );
  });

  it("should allow a user to withdraw funds and update their balance", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await users[0].Pool.register("Alice");
    await users[0].Pool.deposit({ value: 100 });
    await users[0].Pool.withdraw(50);
    const user1Details = await users[0].Pool.users(users[0].address);
    expect(user1Details.balance).to.equal(50);
  });

  it("should not allow a user to withdraw more than their balance", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await tokenOwner.Pool.register("Alice");
    await tokenOwner.Pool.deposit({ value: 1 });
    await expect(tokenOwner.Pool.withdraw(200)).to.be.revertedWith(
      "Insufficient balance"
    );
  });

  it("should only allow the owner to change the interest rate", async function () {
    const {Pool, users, tokenOwner} = await setup();
    await Pool.changeRate(5);
    expect(await Pool.getInterestRate()).to.equal(5);
    await expect(users[0].Pool.changeRate(5)).to.be.revertedWith("can only be called by the owner");
  });

  it("should update user balance and total interest correctly", async function () {
    const {Pool, users, tokenOwner} = await setup();
    // register user
    await tokenOwner.Pool.register("Alice");

    // deposit some ether into the pool
    const depositAmount = ethers.utils.parseEther("1");
    await tokenOwner.Pool.deposit({ value: depositAmount });

    // wait for some time to pass
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 5]); // increase time by 5 days
    await ethers.provider.send("evm_mine", []); // mine a new block to update the timestamp

    // check that the user's balance has increased by the expected amount
    const expectedInterest = depositAmount.mul(2 * 5).div(36500); // 4% annual interest
    const expectedBalance = depositAmount.add(expectedInterest);
    const balance = await tokenOwner.Pool.getBalance();
    expect(balance).to.equal(expectedBalance);
  });
});