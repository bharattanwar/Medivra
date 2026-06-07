package com.app.pharmacy.dto;

import java.math.BigDecimal;
import java.util.UUID;

public class BulkInventoryUpdateRequest {
    private UUID inventoryId;
    private Integer quantity;
    private BigDecimal price;

    public BulkInventoryUpdateRequest() {}

    public BulkInventoryUpdateRequest(UUID inventoryId, Integer quantity, BigDecimal price) {
        this.inventoryId = inventoryId;
        this.quantity = quantity;
        this.price = price;
    }

    public UUID getInventoryId() {
        return inventoryId;
    }

    public void setInventoryId(UUID inventoryId) {
        this.inventoryId = inventoryId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }
}
