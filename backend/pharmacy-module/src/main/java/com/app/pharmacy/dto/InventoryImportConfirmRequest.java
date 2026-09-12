package com.app.pharmacy.dto;

import java.util.List;

public class InventoryImportConfirmRequest {

    private List<InventoryImportRowDto> rows;
    private boolean updateExisting = true;

    public List<InventoryImportRowDto> getRows() {
        return rows;
    }

    public void setRows(List<InventoryImportRowDto> rows) {
        this.rows = rows;
    }

    public boolean isUpdateExisting() {
        return updateExisting;
    }

    public void setUpdateExisting(boolean updateExisting) {
        this.updateExisting = updateExisting;
    }
}
