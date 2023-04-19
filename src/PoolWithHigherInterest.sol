// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.2 <0.9.0;

contract PoolWithHigherInterest {

    struct User {
	    uint balance;
        uint lastUpdateTime;
        string name;
} 

    event Refund(address customer);

    mapping (address => User) public users;
    address payable admin;
    uint public funds;
    uint public totalInterest;
    uint public lastUpdate;
    uint public interestRate;
    uint public investedAmount;
    uint public lowestDepositAmount;

    constructor() {
        admin = payable(msg.sender);
        funds = 0;
        totalInterest = 0;
        lastUpdate = block.timestamp;
        interestRate = 4;
        investedAmount = 0;
        lowestDepositAmount = 3*(10**18);
    }

    modifier onlyOwner{
        require(msg.sender == admin, "can only be called by the owner");
        _;
    }

    modifier isRegistered() {
        require(users[msg.sender].lastUpdateTime > 0, "This user is not registered");
        _;
    }

    function getBalance() public view isRegistered returns (uint) {
        return users[msg.sender].balance + calculateInterest(msg.sender);
    }

    function getLowestDepositAmount() public view returns (uint) {
        return lowestDepositAmount;
    }

    function getInterestRate() public view onlyOwner returns (uint) {
        return interestRate;
    }

    function getFunds() public view onlyOwner returns (uint) {
        return funds;
    }

    function getInvestedAmount() public view onlyOwner returns (uint){
        return investedAmount;
    }

    function changeRate(uint newRate) external onlyOwner{
        interestRate = newRate;
    }

    function changeLowestDepositAmount(uint value)external onlyOwner{
        lowestDepositAmount = value;
    }

    function register(string memory name) public {
        require((bytes(name)).length != 0, "Name is not provided");
        User memory user = User({
                balance: 0,
                lastUpdateTime: block.timestamp,
                name: name
            });
        users[msg.sender] = user;
    }

    function deposit() external isRegistered payable  {
        require(msg.value >= lowestDepositAmount, "Deposit amount can not be less than lowestDepositAmount");
        updateBalance(msg.sender);
        
        users[msg.sender].balance += msg.value;
        users[msg.sender].lastUpdateTime = block.timestamp;
        funds += msg.value;
    }

    function withdraw(uint amount) external isRegistered {
        require(amount > 0, "Withdrawal amount must be greater than zero");
        require(users[msg.sender].balance >= amount, "Insufficient balance");
        
        updateBalance(msg.sender);

        users[msg.sender].balance -= amount;
        users[msg.sender].lastUpdateTime = block.timestamp;
        funds -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    function updateBalance(address user)internal{
        uint interest = calculateInterest(user);
        lastUpdate = block.timestamp;
        totalInterest += interest;
        users[user].balance += interest;
        users[user].lastUpdateTime = block.timestamp;
    }

    function calculateInterest(address user) internal view returns(uint){
        uint timePassed = block.timestamp - users[user].lastUpdateTime;
        uint interest = (users[user].balance * interestRate * timePassed) / (365 days * 100);
        return interest;
    }

}