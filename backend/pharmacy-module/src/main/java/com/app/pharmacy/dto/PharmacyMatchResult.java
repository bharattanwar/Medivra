package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public class PharmacyMatchResult {

    private boolean allSatisfied;
    private List<PharmacyAllocation> allocations;
    private BigDecimal totalAmount;
    private List<UUID> unsatisfiedMedicineIds;

    public PharmacyMatchResult() {}

    public PharmacyMatchResult(boolean allSatisfied, List<PharmacyAllocation> allocations,
                                BigDecimal totalAmount, List<UUID> unsatisfiedMedicineIds) {
        this.allSatisfied = allSatisfied;
        this.allocations = allocations;
        this.totalAmount = totalAmount;
        this.unsatisfiedMedicineIds = unsatisfiedMedicineIds;
    }

    public boolean isAllSatisfied() { return allSatisfied; }
    public void setAllSatisfied(boolean allSatisfied) { this.allSatisfied = allSatisfied; }

    public List<PharmacyAllocation> getAllocations() { return allocations; }
    public void setAllocations(List<PharmacyAllocation> allocations) { this.allocations = allocations; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public List<UUID> getUnsatisfiedMedicineIds() { return unsatisfiedMedicineIds; }
    public void setUnsatisfiedMedicineIds(List<UUID> unsatisfiedMedicineIds) {
        this.unsatisfiedMedicineIds = unsatisfiedMedicineIds;
    }
}
