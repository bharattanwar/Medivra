package com.app.pharmacy.service;

import com.app.pharmacy.dto.AllocatedItem;
import com.app.pharmacy.dto.NearbyPharmacyResponse;
import com.app.pharmacy.dto.PharmacyAllocation;
import com.app.pharmacy.dto.PharmacyMatchRequest;
import com.app.pharmacy.dto.PharmacyMatchResult;
import com.app.pharmacy.entity.Pharmacy;
import com.app.pharmacy.entity.PharmacyInventory;
import com.app.pharmacy.repository.PharmacyInventoryRepository;
import com.app.pharmacy.repository.PharmacyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PharmacyMatchService {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private final PharmacyRepository pharmacyRepository;
    private final PharmacyInventoryRepository pharmacyInventoryRepository;

    public PharmacyMatchService(PharmacyRepository pharmacyRepository,
                                 PharmacyInventoryRepository pharmacyInventoryRepository) {
        this.pharmacyRepository = pharmacyRepository;
        this.pharmacyInventoryRepository = pharmacyInventoryRepository;
    }

    // ─── Haversine Formula ───────────────────────────────────────────────────

    private double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    // ─── Scoring Formula ─────────────────────────────────────────────────────

    private double computeScore(int medicinesFound, double distanceKm) {
        return (medicinesFound * 100.0) - (distanceKm * 5.0);
    }

    // ─── Phase 3: Nearby Pharmacy List ───────────────────────────────────────

    @Transactional(readOnly = true)
    public List<NearbyPharmacyResponse> findNearbyPharmacies(double userLat, double userLng, double radiusKm) {
        List<Pharmacy> allActive = pharmacyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .collect(Collectors.toList());

        return allActive.stream()
                .map(pharmacy -> {
                    double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
                    int inventoryCount = pharmacyInventoryRepository.findByPharmacyId(pharmacy.getId()).size();
                    return new NearbyPharmacyResponse(
                            pharmacy.getId(),
                            pharmacy.getName(),
                            pharmacy.getAddress(),
                            round(dist),
                            pharmacy.getLatitude(),
                            pharmacy.getLongitude(),
                            pharmacy.getPhoneNumber(),
                            inventoryCount
                    );
                })
                .filter(r -> r.getDistanceKm() <= radiusKm)
                .sorted(Comparator.comparingDouble(NearbyPharmacyResponse::getDistanceKm))
                .collect(Collectors.toList());
    }

    // ─── Phase 4: Smart Pharmacy Matching ────────────────────────────────────

    @Transactional(readOnly = true)
    public PharmacyMatchResult matchPharmacies(PharmacyMatchRequest request) {
        double userLat = request.getUserLatitude();
        double userLng = request.getUserLongitude();
        double radiusKm = request.getRadiusKm() != null ? request.getRadiusKm() : 20.0;

        // Build a map of requested medicineId -> quantity needed
        Map<UUID, Integer> needed = new HashMap<>();
        for (PharmacyMatchRequest.MedicineItem item : request.getMedicines()) {
            needed.put(item.getMedicineId(), item.getQuantity());
        }

        // Find all active pharmacies within radius with their inventories
        List<Pharmacy> activePharmacies = pharmacyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .filter(p -> haversine(userLat, userLng, p.getLatitude(), p.getLongitude()) <= radiusKm)
                .collect(Collectors.toList());

        // Pre-load inventories for all candidate pharmacies
        Map<UUID, List<PharmacyInventory>> inventoryByPharmacy = new HashMap<>();
        for (Pharmacy pharmacy : activePharmacies) {
            List<PharmacyInventory> inv = pharmacyInventoryRepository.findByPharmacyId(pharmacy.getId());
            inventoryByPharmacy.put(pharmacy.getId(), inv);
        }

        // Score each pharmacy by how many requested medicines it can supply
        record ScoredPharmacy(Pharmacy pharmacy, double distanceKm, double score,
                               List<PharmacyInventory> matchingInventory) {}

        List<ScoredPharmacy> scored = activePharmacies.stream()
                .map(pharmacy -> {
                    double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
                    List<PharmacyInventory> inv = inventoryByPharmacy.get(pharmacy.getId());
                    List<PharmacyInventory> matching = inv.stream()
                            .filter(i -> needed.containsKey(i.getMedicine().getId()))
                            .filter(i -> i.getQuantity() >= needed.get(i.getMedicine().getId()))
                            .collect(Collectors.toList());
                    double sc = computeScore(matching.size(), dist);
                    return new ScoredPharmacy(pharmacy, dist, sc, matching);
                })
                .sorted(Comparator.comparingDouble(ScoredPharmacy::score).reversed())
                .collect(Collectors.toList());

        // ── Strategy 1: Single Pharmacy First ────────────────────────────────
        Optional<ScoredPharmacy> singleMatch = scored.stream()
                .filter(sp -> sp.matchingInventory().size() == needed.size())
                .findFirst();

        if (singleMatch.isPresent()) {
            ScoredPharmacy sp = singleMatch.get();
            List<AllocatedItem> items = buildAllocatedItems(sp.matchingInventory(), needed);
            BigDecimal subtotal = items.stream()
                    .map(AllocatedItem::getLineTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            PharmacyAllocation allocation = new PharmacyAllocation(
                    sp.pharmacy().getId(), sp.pharmacy().getName(),
                    sp.pharmacy().getAddress(), round(sp.distanceKm()),
                    round(sp.score()), items, subtotal);
            return new PharmacyMatchResult(true, List.of(allocation), subtotal, List.of());
        }

        // ── Strategy 2: Greedy Split Across Multiple Pharmacies ──────────────
        Set<UUID> remainingMedicineIds = new HashSet<>(needed.keySet());
        List<PharmacyAllocation> allocations = new ArrayList<>();
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (ScoredPharmacy sp : scored) {
            if (remainingMedicineIds.isEmpty()) break;

            List<PharmacyInventory> canFulfill = sp.matchingInventory().stream()
                    .filter(i -> remainingMedicineIds.contains(i.getMedicine().getId()))
                    .collect(Collectors.toList());

            if (canFulfill.isEmpty()) continue;

            // Build a subset of needed map only for this pharmacy's contribution
            Map<UUID, Integer> subsetNeeded = new HashMap<>();
            for (PharmacyInventory inv : canFulfill) {
                subsetNeeded.put(inv.getMedicine().getId(), needed.get(inv.getMedicine().getId()));
            }

            List<AllocatedItem> items = buildAllocatedItems(canFulfill, subsetNeeded);
            BigDecimal subtotal = items.stream()
                    .map(AllocatedItem::getLineTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            allocations.add(new PharmacyAllocation(
                    sp.pharmacy().getId(), sp.pharmacy().getName(),
                    sp.pharmacy().getAddress(), round(sp.distanceKm()),
                    round(sp.score()), items, subtotal));

            grandTotal = grandTotal.add(subtotal);
            canFulfill.forEach(i -> remainingMedicineIds.remove(i.getMedicine().getId()));
        }

        boolean allSatisfied = remainingMedicineIds.isEmpty();
        return new PharmacyMatchResult(allSatisfied, allocations, grandTotal,
                new ArrayList<>(remainingMedicineIds));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private List<AllocatedItem> buildAllocatedItems(List<PharmacyInventory> inventories,
                                                     Map<UUID, Integer> neededMap) {
        return inventories.stream().map(inv -> {
            UUID medId = inv.getMedicine().getId();
            int qty = neededMap.get(medId);
            BigDecimal lineTotal = inv.getPrice().multiply(BigDecimal.valueOf(qty));
            return new AllocatedItem(medId, inv.getMedicine().getName(), qty, inv.getPrice(), lineTotal);
        }).collect(Collectors.toList());
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
