// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ComplianceRegistry {
    address public immutable complianceAdmin;

    struct ComplianceRecord {
        bool approved;
        uint64 expiry;
        bytes32 method;
        uint256 updatedAt;
    }

    mapping(address => ComplianceRecord) private records;

    event ComplianceGranted(address indexed user, uint64 expiry, bytes32 indexed method);
    event ComplianceRevoked(address indexed user);

    modifier onlyComplianceAdmin() {
        require(msg.sender == complianceAdmin, "Only compliance admin can update records.");
        _;
    }

    constructor(address _complianceAdmin) {
        require(_complianceAdmin != address(0), "Invalid compliance admin.");
        complianceAdmin = _complianceAdmin;
    }

    function grantCompliance(address user, uint64 expiry, bytes32 method) external onlyComplianceAdmin {
        require(user != address(0), "Invalid user.");
        require(expiry > block.timestamp, "Expiry must be in the future.");
        require(method != bytes32(0), "Method is required.");

        records[user] = ComplianceRecord({
            approved: true,
            expiry: expiry,
            method: method,
            updatedAt: block.timestamp
        });

        emit ComplianceGranted(user, expiry, method);
    }

    function revokeCompliance(address user) external onlyComplianceAdmin {
        require(records[user].approved, "User is not approved.");
        delete records[user];
        emit ComplianceRevoked(user);
    }

    function isCompliant(address user) external view returns (bool) {
        ComplianceRecord memory record = records[user];
        return record.approved && record.expiry > block.timestamp;
    }

    function getRecord(address user) external view returns (ComplianceRecord memory) {
        return records[user];
    }
}
