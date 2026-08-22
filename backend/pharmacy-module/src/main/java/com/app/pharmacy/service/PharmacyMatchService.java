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

/**
 * Smart pharmacy matching engine — finds the best pharmacies for a patient's medicine list.
 *
 * Phase 1 — Nearby list: shows all active pharmacies within a radius, sorted by distance.
 *
 * Phase 2 — Smart matching (3-step greedy strategy):
 *   Step 1: Try to fulfil the entire order at a single pharmacy (best UX).
 *   Step 2: Greedily split across multiple pharmacies, picking the highest-scoring
 *           pharmacy for each batch of medicines.
 *   Step 3: If any medicines still can't be found, expand the search radius up to
 *           50 km and query per-medicine to locate rare stock.
 *
 * Scoring: score = (medicines_found × 100) − (distance_km × 5)
 * This means a pharmacy 1 km away with 3 out of 5 medicines beats one 10 km away with 3 of 5.
 */
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

    // ── Phase 1: Nearby pharmacy list ────────────────────────────────────────

    /**
     * Returns all active pharmacies within {@code radiusKm} of the user,
     * sorted by distance ascending.
     *
     * Performance: pre-loads all inventories in two bulk queries instead of
     * running one query per pharmacy (eliminates N+1).
     */
    @Transactional(readOnly = true)
    public List<NearbyPharmacyResponse> findNearbyPharmacies(
            double userLat, double userLng, double radiusKm) {

        // 1. Load all active pharmacies in one query
        List<Pharmacy> activePharmacies = pharmacyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .collect(Collectors.toList());

        // 2. Load all inventory records in one query and group by pharmacy ID
        //    (avoids the previous N+1 of calling findByPharmacyId inside the map)
        Map<UUID, Long> inventoryCountByPharmacy = pharmacyInventoryRepository.findAll()
                .stream()
                .collect(Collectors.groupingBy(
                        inv -> inv.getPharmacy().getId(),
                        Collectors.counting()));

        // 3. Filter to radius, attach inventory count, and sort by distance
        return activePharmacies.stream()
                .map(pharmacy -> {
                    double dist = haversine(
                            userLat, userLng,
                            pharmacy.getLatitude(), pharmacy.getLongitude());
                    long count = inventoryCountByPharmacy.getOrDefault(pharmacy.getId(), 0L);
                    return new NearbyPharmacyResponse(
                            pharmacy.getId(),
                            pharmacy.getName(),
                            pharmacy.getAddress(),
                            round(dist),
                            pharmacy.getLatitude(),
                            pharmacy.getLongitude(),
                            pharmacy.getPhoneNumber(),
                            (int) count);
                })
                .filter(r -> r.getDistanceKm() <= radiusKm)
                .sorted(Comparator.comparingDouble(NearbyPharmacyResponse::getDistanceKm))
                .collect(Collectors.toList());
    }

    // ── Phase 2: Smart matching ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PharmacyMatchResult matchPharmacies(PharmacyMatchRequest request) {
        double userLat = request.getUserLatitude();
        double userLng = request.getUserLongitude();
        double radiusKm = request.getRadiusKm() != null ? request.getRadiusKm() : 25.0;

        // Build a map of requested medicineId → quantity needed
        Map<UUID, Integer> needed = new HashMap<>();
        for (PharmacyMatchRequest.MedicineItem item : request.getMedicines()) {
            needed.put(item.getMedicineId(), item.getQuantity());
        }

        // Filter to active pharmacies within the requested radius
        List<Pharmacy> candidates = pharmacyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .filter(p -> haversine(userLat, userLng,
                        p.getLatitude(), p.getLongitude()) <= radiusKm)
                .collect(Collectors.toList());

        // Pre-load inventories for all candidate pharmacies in one query
        Map<UUID, List<PharmacyInventory>> inventoryByPharmacy = new HashMap<>();
        for (Pharmacy pharmacy : candidates) {
            inventoryByPharmacy.put(
                    pharmacy.getId(),
                    pharmacyInventoryRepository.findByPharmacyId(pharmacy.getId()));
        }

        // Score each pharmacy by how many requested medicines it can fully supply
        record ScoredPharmacy(Pharmacy pharmacy, double distanceKm, double score,
                               List<PharmacyInventory> matchingInventory) {}

        List<ScoredPharmacy> scored = candidates.stream()
                .map(pharmacy -> {
                    double dist = haversine(
                            userLat, userLng,
                            pharmacy.getLatitude(), pharmacy.getLongitude());
                    List<PharmacyInventory> inv = inventoryByPharmacy.get(pharmacy.getId());
                    List<PharmacyInventory> matching = inv.stream()
                            .filter(i -> needed.containsKey(i.getMedicine().getId()))
                            .filter(i -> i.getQuantity() >= needed.get(i.getMedicine().getId()))
                            .collect(Collectors.toList());
                    return new ScoredPharmacy(pharmacy, dist,
                            computeScore(matching.size(), dist), matching);
                })
                .sorted(Comparator.comparingDouble(ScoredPharmacy::score).reversed())
                .collect(Collectors.toList());

        // ── Step 1: Single-pharmacy fulfilment ────────────────────────────────
        Optional<ScoredPharmacy> singleMatch = scored.stream()
                .filter(sp -> sp.matchingInventory().size() == needed.size())
                .findFirst();

        if (singleMatch.isPresent()) {
            ScoredPharmacy sp = singleMatch.get();
            List<AllocatedItem> items = buildAllocatedItems(sp.matchingInventory(), needed);
            BigDecimal subtotal = sumLineTotals(items);
            PharmacyAllocation allocation = new PharmacyAllocation(
                    sp.pharmacy().getId(), sp.pharmacy().getName(),
                    sp.pharmacy().getAddress(), round(sp.distanceKm()),
                    round(sp.score()), items, subtotal);
            return new PharmacyMatchResult(true, List.of(allocation), subtotal, List.of());
        }

        // ── Step 2: Greedy split across multiple pharmacies ───────────────────
        Set<UUID> remaining = new HashSet<>(needed.keySet());
        List<PharmacyAllocation> allocations = new ArrayList<>();
        BigDecimal grandTotal = BigDecimal.ZERO;
        Set<UUID> usedPharmacyIds = new HashSet<>();

        for (ScoredPharmacy sp : scored) {
            if (remaining.isEmpty()) break;

            List<PharmacyInventory> canFulfil = sp.matchingInventory().stream()
                    .filter(i -> remaining.contains(i.getMedicine().getId()))
                    .collect(Collectors.toList());

            if (canFulfil.isEmpty()) continue;

            Map<UUID, Integer> subsetNeeded = new HashMap<>();
            canFulfil.forEach(inv ->
                    subsetNeeded.put(inv.getMedicine().getId(),
                            needed.get(inv.getMedicine().getId())));

            List<AllocatedItem> items = buildAllocatedItems(canFulfil, subsetNeeded);
            BigDecimal subtotal = sumLineTotals(items);

            allocations.add(new PharmacyAllocation(
                    sp.pharmacy().getId(), sp.pharmacy().getName(),
                    sp.pharmacy().getAddress(), round(sp.distanceKm()),
                    round(sp.score()), items, subtotal));

            grandTotal = grandTotal.add(subtotal);
            usedPharmacyIds.add(sp.pharmacy().getId());
            canFulfil.forEach(i -> remaining.remove(i.getMedicine().getId()));
        }

        // ── Step 3: Expanded search for any still-unmatched medicines ─────────
        // If some medicines couldn't be found within the original radius, widen
        // the search to max(2 × radius, 50 km) and check per medicine.
        if (!remaining.isEmpty()) {
            double expandedRadius = Math.max(radiusKm * 2, 50.0);

            for (UUID medicineId : new ArrayList<>(remaining)) {
                Optional<PharmacyInventory> bestMatch =
                        pharmacyInventoryRepository.findByMedicineId(medicineId).stream()
                                .filter(inv -> inv.getQuantity() >= needed.get(medicineId))
                                .filter(inv -> Boolean.TRUE.equals(inv.getPharmacy().getActive()))
                                .filter(inv -> haversine(userLat, userLng,
                                        inv.getPharmacy().getLatitude(),
                                        inv.getPharmacy().getLongitude()) <= expandedRadius)
                                .min(Comparator.comparingDouble(inv -> haversine(
                                        userLat, userLng,
                                        inv.getPharmacy().getLatitude(),
                                        inv.getPharmacy().getLongitude())));

                if (bestMatch.isPresent()) {
                    PharmacyInventory inv = bestMatch.get();
                    Pharmacy pharmacy = inv.getPharmacy();
                    double dist = haversine(userLat, userLng,
                            pharmacy.getLatitude(), pharmacy.getLongitude());

                    int qty = needed.get(medicineId);
                    BigDecimal lineTotal = inv.getPrice().multiply(BigDecimal.valueOf(qty));
                    AllocatedItem newItem = new AllocatedItem(
                            medicineId, inv.getMedicine().getName(),
                            qty, inv.getPrice(), lineTotal);

                    // Merge into an existing allocation for this pharmacy if there is one
                    Optional<PharmacyAllocation> existingAlloc = allocations.stream()
                            .filter(a -> a.getPharmacyId().equals(pharmacy.getId()))
                            .findFirst();

                    if (existingAlloc.isPresent()) {
                        PharmacyAllocation existing = existingAlloc.get();
                        List<AllocatedItem> updatedItems = new ArrayList<>(existing.getItems());
                        updatedItems.add(newItem);
                        existing.setItems(updatedItems);
                        existing.setSubtotal(existing.getSubtotal().add(lineTotal));
                    } else {
                        allocations.add(new PharmacyAllocation(
                                pharmacy.getId(), pharmacy.getName(),
                                pharmacy.getAddress(), round(dist),
                                round(computeScore(1, dist)),
                                new ArrayList<>(List.of(newItem)), lineTotal));
                        usedPharmacyIds.add(pharmacy.getId());
                    }

                    grandTotal = grandTotal.add(lineTotal);
                    remaining.remove(medicineId);
                }
            }
        }

        boolean allSatisfied = remaining.isEmpty();
        return new PharmacyMatchResult(allSatisfied, allocations, grandTotal,
                new ArrayList<>(remaining));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Build AllocatedItem list from a set of matching inventory rows. */
    private List<AllocatedItem> buildAllocatedItems(List<PharmacyInventory> inventories,
                                                     Map<UUID, Integer> neededMap) {
        return inventories.stream().map(inv -> {
            UUID medId = inv.getMedicine().getId();
            int qty = neededMap.get(medId);
            BigDecimal lineTotal = inv.getPrice().multiply(BigDecimal.valueOf(qty));
            return new AllocatedItem(medId, inv.getMedicine().getName(),
                    qty, inv.getPrice(), lineTotal);
        }).collect(Collectors.toList());
    }

    /** Sum the line totals of all allocated items. */
    private BigDecimal sumLineTotals(List<AllocatedItem> items) {
        return items.stream()
                .map(AllocatedItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** score = (medicines found × 100) − (distance × 5) — favours nearby, well-stocked pharmacies. */
    private double computeScore(int medicinesFound, double distanceKm) {
        return (medicinesFound * 100.0) - (distanceKm * 5.0);
    }

    /** Haversine formula — returns the great-circle distance in kilometres. */
    private double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Round a double to 2 decimal places. */
    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
