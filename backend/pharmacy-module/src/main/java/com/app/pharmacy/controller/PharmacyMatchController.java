package com.app.pharmacy.controller;

import com.app.common.dto.ApiResponse;
import com.app.pharmacy.dto.NearbyPharmacyResponse;
import com.app.pharmacy.dto.PharmacyMatchRequest;
import com.app.pharmacy.dto.PharmacyMatchResult;
import com.app.pharmacy.service.PharmacyMatchService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pharmacies")
public class PharmacyMatchController {

    private final PharmacyMatchService pharmacyMatchService;

    public PharmacyMatchController(PharmacyMatchService pharmacyMatchService) {
        this.pharmacyMatchService = pharmacyMatchService;
    }

    /**
     * GET /api/pharmacies/nearby?lat=28.61&lng=77.20&radiusKm=20
     * Returns all active pharmacies within the given radius, sorted by distance.
     */
    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<NearbyPharmacyResponse>>> findNearbyPharmacies(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "5.0") double radiusKm) {
        List<NearbyPharmacyResponse> result = pharmacyMatchService.findNearbyPharmacies(lat, lng, radiusKm);
        return ResponseEntity.ok(ApiResponse.success(result, "Nearby pharmacies retrieved"));
    }

    /**
     * POST /api/pharmacies/match
     * Accepts a prescription (medicine IDs + quantities) and user location.
     * Returns an optimised pharmacy allocation:
     *  - Single pharmacy if one has everything in stock
     *  - Greedy split across multiple pharmacies otherwise
     */
    @PostMapping("/match")
    public ResponseEntity<ApiResponse<PharmacyMatchResult>> matchPharmacies(
            @Valid @RequestBody PharmacyMatchRequest request) {
        PharmacyMatchResult result = pharmacyMatchService.matchPharmacies(request);
        String message = result.isAllSatisfied()
                ? "All medicines matched successfully"
                : "Partial match — some medicines unavailable in your area";
        return ResponseEntity.ok(ApiResponse.success(result, message));
    }
}
