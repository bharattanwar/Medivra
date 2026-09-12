package com.app.pharmacy.controller;

import com.app.common.dto.ApiResponse;
import com.app.user.dto.AuthResponse;
import com.app.pharmacy.dto.PharmacyRegisterRequest;
import com.app.pharmacy.dto.InventoryRequest;
import com.app.pharmacy.dto.InventoryResponse;
import com.app.pharmacy.dto.InventoryImportConfirmRequest;
import com.app.pharmacy.dto.InventoryImportResponse;
import com.app.pharmacy.service.InventoryImportService;
import com.app.pharmacy.service.PharmacyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/pharmacies")
public class PharmacyController {

    private final PharmacyService pharmacyService;
    private final InventoryImportService inventoryImportService;

    public PharmacyController(PharmacyService pharmacyService, InventoryImportService inventoryImportService) {
        this.pharmacyService = pharmacyService;
        this.inventoryImportService = inventoryImportService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> registerPharmacy(
            @Valid @RequestBody PharmacyRegisterRequest request) {
        AuthResponse response = pharmacyService.registerPharmacy(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Pharmacy registered successfully"));
    }

    @PostMapping("/inventory")
    public ResponseEntity<ApiResponse<InventoryResponse>> addOrUpdateInventory(
            @Valid @RequestBody InventoryRequest request,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        InventoryResponse response = pharmacyService.addOrUpdateInventory(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success(response, "Inventory item added/updated successfully"));
    }

    @GetMapping("/inventory")
    public ResponseEntity<ApiResponse<List<InventoryResponse>>> getPharmacyInventory(
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        List<InventoryResponse> response = pharmacyService.getPharmacyInventory(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(response, "Inventory items retrieved successfully"));
    }

    @PutMapping("/inventory/{inventoryId}")
    public ResponseEntity<ApiResponse<InventoryResponse>> updateStockAndPrice(
            @PathVariable UUID inventoryId,
            @Valid @RequestBody InventoryRequest request,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        InventoryResponse response = pharmacyService.updateStockAndPrice(
                userDetails.getUsername(),
                inventoryId,
                request.getQuantity(),
                request.getPrice()
        );
        return ResponseEntity.ok(ApiResponse.success(response, "Inventory updated successfully"));
    }

    @DeleteMapping("/inventory/{inventoryId}")
    public ResponseEntity<ApiResponse<Void>> deleteInventoryItem(
            @PathVariable UUID inventoryId,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        pharmacyService.deleteInventoryItem(userDetails.getUsername(), inventoryId);
        return ResponseEntity.ok(ApiResponse.success(null, "Inventory item deleted successfully"));
    }

    @PostMapping("/inventory/bulk")
    public ResponseEntity<ApiResponse<List<InventoryResponse>>> bulkUpdateInventory(
            @RequestBody List<com.app.pharmacy.dto.BulkInventoryUpdateRequest> requests,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        List<InventoryResponse> response = pharmacyService.bulkUpdateInventory(userDetails.getUsername(), requests);
        return ResponseEntity.ok(ApiResponse.success(response, "Bulk inventory items updated successfully"));
    }

    @PostMapping("/inventory/import")
    public ResponseEntity<ApiResponse<InventoryImportResponse>> importInventoryFile(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        InventoryImportResponse response = inventoryImportService.processUpload(userDetails.getUsername(), file);
        return ResponseEntity.ok(ApiResponse.success(response, "File processed and mapped successfully"));
    }

    @GetMapping("/inventory/import/{jobId}")
    public ResponseEntity<ApiResponse<InventoryImportResponse>> getImportJob(
            @PathVariable UUID jobId,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        InventoryImportResponse response = inventoryImportService.getImportJob(userDetails.getUsername(), jobId);
        return ResponseEntity.ok(ApiResponse.success(response, "Import job retrieved successfully"));
    }

    @PostMapping("/inventory/import/{jobId}/confirm")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmImport(
            @PathVariable UUID jobId,
            @RequestBody InventoryImportConfirmRequest request,
            Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        Map<String, Object> response = inventoryImportService.confirmImport(userDetails.getUsername(), jobId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Inventory import completed successfully"));
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getPharmacyProfile(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        com.app.pharmacy.entity.Pharmacy pharmacy = pharmacyService.getPharmacyProfile(userDetails.getUsername());
        
        java.util.Map<String, Object> profile = new java.util.HashMap<>();
        profile.put("name", pharmacy.getName());
        profile.put("address", pharmacy.getAddress());
        profile.put("phoneNumber", pharmacy.getPhoneNumber());
        profile.put("active", pharmacy.getActive());
        
        return ResponseEntity.ok(ApiResponse.success(profile, "Pharmacy profile retrieved successfully"));
    }
}
