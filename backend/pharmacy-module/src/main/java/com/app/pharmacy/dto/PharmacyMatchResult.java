package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PharmacyMatchResult {

    private boolean allSatisfied;
    private List<PharmacyAllocation> allocations;
    private BigDecimal totalAmount;
    private BigDecimal deliveryFee;
    private BigDecimal grandTotal;
    private List<UUID> unsatisfiedMedicineIds;
    private List<PharmacyComparisonOption> comparisonOptions = new ArrayList<>();
    private String selectedOptionType = "FASTEST";

    public PharmacyMatchResult() {}

    public PharmacyMatchResult(boolean allSatisfied, List<PharmacyAllocation> allocations,
                                BigDecimal totalAmount, List<UUID> unsatisfiedMedicineIds) {
        this.allSatisfied = allSatisfied;
        this.allocations = allocations;
        this.totalAmount = totalAmount;
        this.unsatisfiedMedicineIds = unsatisfiedMedicineIds;
        this.deliveryFee = BigDecimal.ZERO;
        this.grandTotal = totalAmount != null ? totalAmount : BigDecimal.ZERO;
    }

    public PharmacyMatchResult(boolean allSatisfied, List<PharmacyAllocation> allocations,
                                BigDecimal totalAmount, BigDecimal deliveryFee, BigDecimal grandTotal,
                                List<UUID> unsatisfiedMedicineIds,
                                List<PharmacyComparisonOption> comparisonOptions,
                                String selectedOptionType) {
        this.allSatisfied = allSatisfied;
        this.allocations = allocations;
        this.totalAmount = totalAmount;
        this.deliveryFee = deliveryFee;
        this.grandTotal = grandTotal;
        this.unsatisfiedMedicineIds = unsatisfiedMedicineIds;
        this.comparisonOptions = comparisonOptions;
        this.selectedOptionType = selectedOptionType;
    }

    public boolean isAllSatisfied() { return allSatisfied; }
    public void setAllSatisfied(boolean allSatisfied) { this.allSatisfied = allSatisfied; }

    public List<PharmacyAllocation> getAllocations() { return allocations; }
    public void setAllocations(List<PharmacyAllocation> allocations) { this.allocations = allocations; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(BigDecimal deliveryFee) { this.deliveryFee = deliveryFee; }

    public BigDecimal getGrandTotal() { return grandTotal; }
    public void setGrandTotal(BigDecimal grandTotal) { this.grandTotal = grandTotal; }

    public List<UUID> getUnsatisfiedMedicineIds() { return unsatisfiedMedicineIds; }
    public void setUnsatisfiedMedicineIds(List<UUID> unsatisfiedMedicineIds) {
        this.unsatisfiedMedicineIds = unsatisfiedMedicineIds;
    }

    public List<PharmacyComparisonOption> getComparisonOptions() { return comparisonOptions; }
    public void setComparisonOptions(List<PharmacyComparisonOption> comparisonOptions) {
        this.comparisonOptions = comparisonOptions;
    }

    public String getSelectedOptionType() { return selectedOptionType; }
    public void setSelectedOptionType(String selectedOptionType) {
        this.selectedOptionType = selectedOptionType;
    }
}
