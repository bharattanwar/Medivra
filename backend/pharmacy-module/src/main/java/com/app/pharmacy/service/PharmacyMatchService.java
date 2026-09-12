package com.app.pharmacy.service;

import com.app.pharmacy.dto.AllocatedItem;
import com.app.pharmacy.dto.NearbyPharmacyResponse;
import com.app.pharmacy.dto.PharmacyAllocation;
import com.app.pharmacy.dto.PharmacyComparisonOption;
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
import java.util.*;
import java.util.stream.Collectors;

/**
 * Smart pharmacy matching & comparison engine — evaluates full prescription baskets
 * across candidate pharmacies and produces multi-mode comparison options:
 *
 * 1. ⚡ FASTEST: Nearest pharmacy offering full basket fulfillment (lowest ETA).
 * 2. 💰 CHEAPEST: Pharmacy offering lowest total payable amount (medicines + delivery fee).
 * 3. ⚖️ BEST VALUE: Optimal trade-off between price savings and delivery wait time.
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

    @Transactional(readOnly = true)
    public List<NearbyPharmacyResponse> findNearbyPharmacies(
            double userLat, double userLng, double radiusKm) {

        List<Pharmacy> activePharmacies = pharmacyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .collect(Collectors.toList());

        Map<UUID, Long> inventoryCountByPharmacy = pharmacyInventoryRepository.findAll()
                .stream()
                .collect(Collectors.groupingBy(
                        inv -> inv.getPharmacy().getId(),
                        Collectors.counting()));

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

    // ── Phase 2: Smart Matching & Comparison Engine ──────────────────────────

    @Transactional(readOnly = true)
    public PharmacyMatchResult matchPharmacies(PharmacyMatchRequest request) {
        double userLat = request.getUserLatitude();
        double userLng = request.getUserLongitude();
        double radiusKm = request.getRadiusKm() != null ? Math.max(request.getRadiusKm(), 50.0) : 50.0;
        String preferredMode = request.getPreferredMode() != null ? request.getPreferredMode().toUpperCase() : "FASTEST";

        // Build a map of requested medicineId → quantity needed
        Map<UUID, Integer> needed = new HashMap<>();
        for (PharmacyMatchRequest.MedicineItem item : request.getMedicines()) {
            needed.put(item.getMedicineId(), item.getQuantity());
        }

        // Filter active pharmacies within search radius
        List<Pharmacy> candidates = pharmacyRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getActive()))
                .filter(p -> haversine(userLat, userLng, p.getLatitude(), p.getLongitude()) <= radiusKm)
                .collect(Collectors.toList());

        // Pre-load inventories for all candidate pharmacies in bulk
        Map<UUID, List<PharmacyInventory>> inventoryByPharmacy = new HashMap<>();
        for (Pharmacy pharmacy : candidates) {
            inventoryByPharmacy.put(
                    pharmacy.getId(),
                    pharmacyInventoryRepository.findByPharmacyId(pharmacy.getId()));
        }

        // Internal evaluation record
        record CompleteCandidate(
                Pharmacy pharmacy,
                double distanceKm,
                int etaMinutes,
                List<AllocatedItem> items,
                BigDecimal medicineTotal,
                BigDecimal deliveryFee,
                BigDecimal totalPayable
        ) {}

        List<CompleteCandidate> completeCandidates = new ArrayList<>();

        for (Pharmacy pharmacy : candidates) {
            double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
            List<PharmacyInventory> inv = inventoryByPharmacy.get(pharmacy.getId());

            List<PharmacyInventory> matching = inv.stream()
                    .filter(i -> needed.containsKey(i.getMedicine().getId()))
                    .filter(i -> i.getQuantity() >= needed.get(i.getMedicine().getId()))
                    .collect(Collectors.toList());

            // Check if this pharmacy has the COMPLETE basket
            if (matching.size() == needed.size()) {
                List<AllocatedItem> items = buildAllocatedItems(matching, needed);
                BigDecimal medicineTotal = sumLineTotals(items);
                BigDecimal deliveryFee = computeDeliveryFee(dist);
                BigDecimal totalPayable = medicineTotal.add(deliveryFee);
                int etaMinutes = computeEtaMinutes(dist);

                completeCandidates.add(new CompleteCandidate(
                        pharmacy, round(dist), etaMinutes, items,
                        medicineTotal, deliveryFee, totalPayable));
            }
        }

        // ── Case A: We found complete basket fulfillment ──────────────────────
        if (!completeCandidates.isEmpty()) {
            // 1. FASTEST candidate (min distance / ETA)
            CompleteCandidate fastestCand = completeCandidates.stream()
                    .min(Comparator.comparingDouble(CompleteCandidate::distanceKm))
                    .orElse(completeCandidates.get(0));

            // 2. CHEAPEST candidate (min total payable amount = medicine + delivery)
            CompleteCandidate cheapestCand = completeCandidates.stream()
                    .min(Comparator.comparing(CompleteCandidate::totalPayable))
                    .orElse(completeCandidates.get(0));

            // 3. BEST VALUE candidate (optimizes price savings vs additional wait time)
            CompleteCandidate bestValueCand = completeCandidates.stream()
                    .max(Comparator.comparingDouble(c -> {
                        double savings = fastestCand.totalPayable().subtract(c.totalPayable()).max(BigDecimal.ZERO).doubleValue();
                        double extraMinutes = Math.max(0, c.etaMinutes() - fastestCand.etaMinutes());
                        return (savings * 1.5) - (extraMinutes * 1.0);
                    }))
                    .orElse(cheapestCand);

            // If bestValue savings is 0 or negative compared to fastest, fallback to fastest
            if (fastestCand.totalPayable().compareTo(bestValueCand.totalPayable()) <= 0) {
                bestValueCand = fastestCand;
            }

            // Build comparison options
            List<PharmacyComparisonOption> options = new ArrayList<>();

            // Option 1: FASTEST
            options.add(new PharmacyComparisonOption(
                    "FASTEST",
                    fastestCand.pharmacy().getId(),
                    fastestCand.pharmacy().getName(),
                    fastestCand.pharmacy().getAddress(),
                    fastestCand.distanceKm(),
                    fastestCand.etaMinutes(),
                    fastestCand.medicineTotal(),
                    fastestCand.deliveryFee(),
                    fastestCand.totalPayable(),
                    BigDecimal.ZERO,
                    "⚡ Fastest Delivery",
                    fastestCand.items(),
                    "FASTEST".equals(preferredMode)
            ));

            // Option 2: BEST VALUE
            BigDecimal bestValueSavings = fastestCand.totalPayable().subtract(bestValueCand.totalPayable()).max(BigDecimal.ZERO);
            options.add(new PharmacyComparisonOption(
                    "BEST_VALUE",
                    bestValueCand.pharmacy().getId(),
                    bestValueCand.pharmacy().getName(),
                    bestValueCand.pharmacy().getAddress(),
                    bestValueCand.distanceKm(),
                    bestValueCand.etaMinutes(),
                    bestValueCand.medicineTotal(),
                    bestValueCand.deliveryFee(),
                    bestValueCand.totalPayable(),
                    bestValueSavings,
                    bestValueSavings.compareTo(BigDecimal.ZERO) > 0 ? "Save ₹" + bestValueSavings.intValue() : "Optimal Balance",
                    bestValueCand.items(),
                    "BEST_VALUE".equals(preferredMode)
            ));

            // Option 3: CHEAPEST
            BigDecimal cheapestSavings = fastestCand.totalPayable().subtract(cheapestCand.totalPayable()).max(BigDecimal.ZERO);
            options.add(new PharmacyComparisonOption(
                    "CHEAPEST",
                    cheapestCand.pharmacy().getId(),
                    cheapestCand.pharmacy().getName(),
                    cheapestCand.pharmacy().getAddress(),
                    cheapestCand.distanceKm(),
                    cheapestCand.etaMinutes(),
                    cheapestCand.medicineTotal(),
                    cheapestCand.deliveryFee(),
                    cheapestCand.totalPayable(),
                    cheapestSavings,
                    cheapestSavings.compareTo(BigDecimal.ZERO) > 0 ? "Save ₹" + cheapestSavings.intValue() : "Lowest Price",
                    cheapestCand.items(),
                    "CHEAPEST".equals(preferredMode)
            ));

            // Select active candidate based on preferred mode
            CompleteCandidate activeCand;
            if ("CHEAPEST".equals(preferredMode)) {
                activeCand = cheapestCand;
            } else if ("BEST_VALUE".equals(preferredMode)) {
                activeCand = bestValueCand;
            } else {
                activeCand = fastestCand;
            }

            PharmacyAllocation allocation = new PharmacyAllocation(
                    activeCand.pharmacy().getId(),
                    activeCand.pharmacy().getName(),
                    activeCand.pharmacy().getAddress(),
                    activeCand.distanceKm(),
                    round(computeScore(needed.size(), activeCand.distanceKm())),
                    activeCand.items(),
                    activeCand.medicineTotal()
            );

            return new PharmacyMatchResult(
                    true,
                    List.of(allocation),
                    activeCand.medicineTotal(),
                    activeCand.deliveryFee(),
                    activeCand.totalPayable(),
                    List.of(),
                    options,
                    preferredMode
            );
        }

        // ── Case B: Fallback - Partial/Greedy split across multiple pharmacies ──
        record ScoredPharmacy(Pharmacy pharmacy, double distanceKm, double score,
                               List<PharmacyInventory> matchingInventory) {}

        List<ScoredPharmacy> scored = candidates.stream()
                .map(pharmacy -> {
                    double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
                    List<PharmacyInventory> inv = inventoryByPharmacy.get(pharmacy.getId());
                    List<PharmacyInventory> matching = inv.stream()
                            .filter(i -> needed.containsKey(i.getMedicine().getId()))
                            .filter(i -> i.getQuantity() >= needed.get(i.getMedicine().getId()))
                            .collect(Collectors.toList());
                    return new ScoredPharmacy(pharmacy, dist, computeScore(matching.size(), dist), matching);
                })
                .sorted(Comparator.comparingDouble(ScoredPharmacy::score).reversed())
                .collect(Collectors.toList());

        Set<UUID> remaining = new HashSet<>(needed.keySet());
        List<PharmacyAllocation> allocations = new ArrayList<>();
        BigDecimal grandMedicineTotal = BigDecimal.ZERO;
        double maxDist = 0.0;

        for (ScoredPharmacy sp : scored) {
            if (remaining.isEmpty()) break;

            List<PharmacyInventory> canFulfil = sp.matchingInventory().stream()
                    .filter(i -> remaining.contains(i.getMedicine().getId()))
                    .collect(Collectors.toList());

            if (canFulfil.isEmpty()) continue;

            Map<UUID, Integer> subsetNeeded = new HashMap<>();
            canFulfil.forEach(inv -> subsetNeeded.put(inv.getMedicine().getId(), needed.get(inv.getMedicine().getId())));

            List<AllocatedItem> items = buildAllocatedItems(canFulfil, subsetNeeded);
            BigDecimal subtotal = sumLineTotals(items);

            allocations.add(new PharmacyAllocation(
                    sp.pharmacy().getId(), sp.pharmacy().getName(),
                    sp.pharmacy().getAddress(), round(sp.distanceKm()),
                    round(sp.score()), items, subtotal));

            grandMedicineTotal = grandMedicineTotal.add(subtotal);
            maxDist = Math.max(maxDist, sp.distanceKm());
            canFulfil.forEach(i -> remaining.remove(i.getMedicine().getId()));
        }

        BigDecimal deliveryFee = computeDeliveryFee(maxDist);
        BigDecimal totalPayable = grandMedicineTotal.add(deliveryFee);

        List<PharmacyComparisonOption> fallbackOptions = List.of(
                new PharmacyComparisonOption(
                        "FASTEST",
                        allocations.isEmpty() ? null : allocations.get(0).getPharmacyId(),
                        allocations.isEmpty() ? "Multiple Pharmacies" : allocations.get(0).getPharmacyName(),
                        allocations.isEmpty() ? "" : allocations.get(0).getPharmacyAddress(),
                        round(maxDist),
                        computeEtaMinutes(maxDist),
                        grandMedicineTotal,
                        deliveryFee,
                        totalPayable,
                        BigDecimal.ZERO,
                        "Split Order Allocation",
                        allocations.stream().flatMap(a -> a.getItems().stream()).collect(Collectors.toList()),
                        true
                )
        );

        boolean allSatisfied = remaining.isEmpty();
        return new PharmacyMatchResult(
                allSatisfied,
                allocations,
                grandMedicineTotal,
                deliveryFee,
                totalPayable,
                new ArrayList<>(remaining),
                fallbackOptions,
                "FASTEST"
        );
    }

    // ── Delivery & ETA Calculation Helpers ────────────────────────────────────

    public static BigDecimal computeDeliveryFee(double distanceKm) {
        if (distanceKm <= 2.0) {
            return BigDecimal.valueOf(25.00);
        }
        double extraKm = Math.ceil(distanceKm - 2.0);
        double fee = 25.00 + (extraKm * 5.0);
        return BigDecimal.valueOf(fee).setScale(2, RoundingMode.HALF_UP);
    }

    public static int computeEtaMinutes(double distanceKm) {
        int prepTime = 15;
        int travelTime = (int) Math.round(distanceKm * 3.5);
        return Math.max(20, prepTime + travelTime);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

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

    private BigDecimal sumLineTotals(List<AllocatedItem> items) {
        return items.stream()
                .map(AllocatedItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private double computeScore(int medicinesFound, double distanceKm) {
        return (medicinesFound * 100.0) - (distanceKm * 5.0);
    }

    private double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
