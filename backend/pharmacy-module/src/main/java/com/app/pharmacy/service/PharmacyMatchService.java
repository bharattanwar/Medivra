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

        // 1. Single-pharmacy complete candidates
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
            List<PharmacyInventory> inv = inventoryByPharmacy.getOrDefault(pharmacy.getId(), List.of());

            List<PharmacyInventory> matching = inv.stream()
                    .filter(i -> needed.containsKey(i.getMedicine().getId()))
                    .filter(i -> i.getQuantity() >= needed.get(i.getMedicine().getId()))
                    .collect(Collectors.toList());

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

        // 2. Multi-pharmacy allocations
        List<PharmacyAllocation> fastestAllocations = buildFastestAllocations(candidates, inventoryByPharmacy, needed, userLat, userLng);
        List<PharmacyAllocation> cheapestAllocations = buildCheapestAllocations(candidates, inventoryByPharmacy, needed, userLat, userLng);
        List<PharmacyAllocation> bestValueAllocations = buildBestValueAllocations(candidates, inventoryByPharmacy, needed, userLat, userLng);

        // ── Build FASTEST Option ──
        PharmacyComparisonOption optFastest;
        List<PharmacyAllocation> allocsFastest;
        BigDecimal medTotFastest;
        BigDecimal delFeeFastest;
        BigDecimal totalFastest;
        int etaFastest;

        if (!completeCandidates.isEmpty()) {
            CompleteCandidate fastestCand = completeCandidates.stream()
                    .min(Comparator.comparingDouble(CompleteCandidate::distanceKm))
                    .orElse(completeCandidates.get(0));

            allocsFastest = List.of(new PharmacyAllocation(
                    fastestCand.pharmacy().getId(), fastestCand.pharmacy().getName(),
                    fastestCand.pharmacy().getAddress(), fastestCand.distanceKm(),
                    100.0, fastestCand.items(), fastestCand.medicineTotal()));
            medTotFastest = fastestCand.medicineTotal();
            delFeeFastest = fastestCand.deliveryFee();
            totalFastest = fastestCand.totalPayable();
            etaFastest = fastestCand.etaMinutes();

            optFastest = new PharmacyComparisonOption(
                    "FASTEST",
                    fastestCand.pharmacy().getId(),
                    fastestCand.pharmacy().getName(),
                    fastestCand.pharmacy().getAddress(),
                    fastestCand.distanceKm(),
                    fastestCand.etaMinutes(),
                    medTotFastest,
                    delFeeFastest,
                    totalFastest,
                    BigDecimal.ZERO,
                    "⚡ Fastest Delivery",
                    fastestCand.items(),
                    "FASTEST".equals(preferredMode)
            );
        } else {
            allocsFastest = fastestAllocations;
            medTotFastest = sumAllocationsMedicineTotal(fastestAllocations);
            double maxDist = maxAllocationsDistance(fastestAllocations);
            delFeeFastest = computeDeliveryFee(maxDist);
            totalFastest = medTotFastest.add(delFeeFastest);
            etaFastest = computeEtaMinutes(maxDist);

            optFastest = new PharmacyComparisonOption(
                    "FASTEST",
                    fastestAllocations.size() == 1 ? fastestAllocations.get(0).getPharmacyId() : null,
                    fastestAllocations.size() == 1 ? fastestAllocations.get(0).getPharmacyName() : "Multiple Pharmacies",
                    fastestAllocations.size() == 1 ? fastestAllocations.get(0).getPharmacyAddress() : "Split fulfillment across " + fastestAllocations.size() + " pharmacies",
                    round(maxDist),
                    etaFastest,
                    medTotFastest,
                    delFeeFastest,
                    totalFastest,
                    BigDecimal.ZERO,
                    "⚡ Fastest Delivery",
                    fastestAllocations.stream().flatMap(a -> a.getItems().stream()).collect(Collectors.toList()),
                    "FASTEST".equals(preferredMode)
            );
        }
        optFastest.setAllocations(allocsFastest);

        // ── Build CHEAPEST Option ──
        PharmacyComparisonOption optCheapest;
        List<PharmacyAllocation> allocsCheapest;
        BigDecimal medTotCheapest;
        BigDecimal delFeeCheapest;
        BigDecimal totalCheapest;
        int etaCheapest;

        BigDecimal splitMedTot = sumAllocationsMedicineTotal(cheapestAllocations);
        double splitMaxDist = maxAllocationsDistance(cheapestAllocations);
        BigDecimal splitDelFee = computeDeliveryFee(splitMaxDist);
        BigDecimal splitTotal = splitMedTot.add(splitDelFee);

        CompleteCandidate cheapestSingleCand = completeCandidates.stream()
                .min(Comparator.comparing(CompleteCandidate::totalPayable))
                .orElse(null);

        if (cheapestSingleCand != null && cheapestSingleCand.totalPayable().compareTo(splitTotal) <= 0) {
            allocsCheapest = List.of(new PharmacyAllocation(
                    cheapestSingleCand.pharmacy().getId(), cheapestSingleCand.pharmacy().getName(),
                    cheapestSingleCand.pharmacy().getAddress(), cheapestSingleCand.distanceKm(),
                    100.0, cheapestSingleCand.items(), cheapestSingleCand.medicineTotal()));
            medTotCheapest = cheapestSingleCand.medicineTotal();
            delFeeCheapest = cheapestSingleCand.deliveryFee();
            totalCheapest = cheapestSingleCand.totalPayable();
            etaCheapest = cheapestSingleCand.etaMinutes();

            BigDecimal savings = totalFastest.subtract(totalCheapest).max(BigDecimal.ZERO);
            optCheapest = new PharmacyComparisonOption(
                    "CHEAPEST",
                    cheapestSingleCand.pharmacy().getId(),
                    cheapestSingleCand.pharmacy().getName(),
                    cheapestSingleCand.pharmacy().getAddress(),
                    cheapestSingleCand.distanceKm(),
                    cheapestSingleCand.etaMinutes(),
                    medTotCheapest,
                    delFeeCheapest,
                    totalCheapest,
                    savings,
                    savings.compareTo(BigDecimal.ZERO) > 0 ? "Save ₹" + savings.intValue() : "Lowest Price",
                    cheapestSingleCand.items(),
                    "CHEAPEST".equals(preferredMode)
            );
        } else {
            allocsCheapest = cheapestAllocations;
            medTotCheapest = splitMedTot;
            delFeeCheapest = splitDelFee;
            totalCheapest = splitTotal;
            etaCheapest = computeEtaMinutes(splitMaxDist);

            BigDecimal savings = totalFastest.subtract(totalCheapest).max(BigDecimal.ZERO);
            optCheapest = new PharmacyComparisonOption(
                    "CHEAPEST",
                    cheapestAllocations.size() == 1 ? cheapestAllocations.get(0).getPharmacyId() : null,
                    cheapestAllocations.size() == 1 ? cheapestAllocations.get(0).getPharmacyName() : "Multiple Pharmacies",
                    cheapestAllocations.size() == 1 ? cheapestAllocations.get(0).getPharmacyAddress() : "Split fulfillment across " + cheapestAllocations.size() + " pharmacies",
                    round(splitMaxDist),
                    etaCheapest,
                    medTotCheapest,
                    delFeeCheapest,
                    totalCheapest,
                    savings,
                    savings.compareTo(BigDecimal.ZERO) > 0 ? "Save ₹" + savings.intValue() : "Lowest Price",
                    cheapestAllocations.stream().flatMap(a -> a.getItems().stream()).collect(Collectors.toList()),
                    "CHEAPEST".equals(preferredMode)
            );
        }
        optCheapest.setAllocations(allocsCheapest);

        // ── Build BEST VALUE Option ──
        PharmacyComparisonOption optBestValue;
        List<PharmacyAllocation> allocsBestValue;
        BigDecimal medTotBestVal;
        BigDecimal delFeeBestVal;
        BigDecimal totalBestVal;
        int etaBestVal;

        BigDecimal splitMedTotBV = sumAllocationsMedicineTotal(bestValueAllocations);
        double splitMaxDistBV = maxAllocationsDistance(bestValueAllocations);
        BigDecimal splitDelFeeBV = computeDeliveryFee(splitMaxDistBV);
        BigDecimal splitTotalBV = splitMedTotBV.add(splitDelFeeBV);

        CompleteCandidate bestValSingleCand = completeCandidates.stream()
                .max(Comparator.comparingDouble(c -> {
                    double savings = totalFastest.subtract(c.totalPayable()).max(BigDecimal.ZERO).doubleValue();
                    double extraMinutes = Math.max(0, c.etaMinutes() - etaFastest);
                    return (savings * 1.5) - (extraMinutes * 1.0);
                }))
                .orElse(null);

        if (bestValSingleCand != null && bestValSingleCand.totalPayable().compareTo(splitTotalBV) <= 0) {
            allocsBestValue = List.of(new PharmacyAllocation(
                    bestValSingleCand.pharmacy().getId(), bestValSingleCand.pharmacy().getName(),
                    bestValSingleCand.pharmacy().getAddress(), bestValSingleCand.distanceKm(),
                    100.0, bestValSingleCand.items(), bestValSingleCand.medicineTotal()));
            medTotBestVal = bestValSingleCand.medicineTotal();
            delFeeBestVal = bestValSingleCand.deliveryFee();
            totalBestVal = bestValSingleCand.totalPayable();
            etaBestVal = bestValSingleCand.etaMinutes();

            BigDecimal savings = totalFastest.subtract(totalBestVal).max(BigDecimal.ZERO);
            optBestValue = new PharmacyComparisonOption(
                    "BEST_VALUE",
                    bestValSingleCand.pharmacy().getId(),
                    bestValSingleCand.pharmacy().getName(),
                    bestValSingleCand.pharmacy().getAddress(),
                    bestValSingleCand.distanceKm(),
                    bestValSingleCand.etaMinutes(),
                    medTotBestVal,
                    delFeeBestVal,
                    totalBestVal,
                    savings,
                    savings.compareTo(BigDecimal.ZERO) > 0 ? "Save ₹" + savings.intValue() : "Optimal Balance",
                    bestValSingleCand.items(),
                    "BEST_VALUE".equals(preferredMode)
            );
        } else {
            allocsBestValue = bestValueAllocations;
            medTotBestVal = splitMedTotBV;
            delFeeBestVal = splitDelFeeBV;
            totalBestVal = splitTotalBV;
            etaBestVal = computeEtaMinutes(splitMaxDistBV);

            BigDecimal savings = totalFastest.subtract(totalBestVal).max(BigDecimal.ZERO);
            optBestValue = new PharmacyComparisonOption(
                    "BEST_VALUE",
                    bestValueAllocations.size() == 1 ? bestValueAllocations.get(0).getPharmacyId() : null,
                    bestValueAllocations.size() == 1 ? bestValueAllocations.get(0).getPharmacyName() : "Multiple Pharmacies",
                    bestValueAllocations.size() == 1 ? bestValueAllocations.get(0).getPharmacyAddress() : "Split fulfillment across " + bestValueAllocations.size() + " pharmacies",
                    round(splitMaxDistBV),
                    etaBestVal,
                    medTotBestVal,
                    delFeeBestVal,
                    totalBestVal,
                    savings,
                    savings.compareTo(BigDecimal.ZERO) > 0 ? "Save ₹" + savings.intValue() : "Optimal Balance",
                    bestValueAllocations.stream().flatMap(a -> a.getItems().stream()).collect(Collectors.toList()),
                    "BEST_VALUE".equals(preferredMode)
            );
        }
        optBestValue.setAllocations(allocsBestValue);

        List<PharmacyComparisonOption> options = List.of(optFastest, optBestValue, optCheapest);

        // Select active mode response payload
        List<PharmacyAllocation> activeAllocations;
        BigDecimal activeMedTotal;
        BigDecimal activeDelFee;
        BigDecimal activeTotalPayable;

        if ("CHEAPEST".equals(preferredMode)) {
            activeAllocations = allocsCheapest;
            activeMedTotal = medTotCheapest;
            activeDelFee = delFeeCheapest;
            activeTotalPayable = totalCheapest;
        } else if ("BEST_VALUE".equals(preferredMode)) {
            activeAllocations = allocsBestValue;
            activeMedTotal = medTotBestVal;
            activeDelFee = delFeeBestVal;
            activeTotalPayable = totalBestVal;
        } else {
            activeAllocations = allocsFastest;
            activeMedTotal = medTotFastest;
            activeDelFee = delFeeFastest;
            activeTotalPayable = totalFastest;
        }

        Set<UUID> satisfiedIds = activeAllocations.stream()
                .flatMap(a -> a.getItems().stream())
                .map(AllocatedItem::getMedicineId)
                .collect(Collectors.toSet());

        List<UUID> unsatisfiedIds = needed.keySet().stream()
                .filter(id -> !satisfiedIds.contains(id))
                .collect(Collectors.toList());

        return new PharmacyMatchResult(
                unsatisfiedIds.isEmpty(),
                activeAllocations,
                activeMedTotal,
                activeDelFee,
                activeTotalPayable,
                unsatisfiedIds,
                options,
                preferredMode
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

    private List<PharmacyAllocation> buildFastestAllocations(
            List<Pharmacy> candidates,
            Map<UUID, List<PharmacyInventory>> inventoryByPharmacy,
            Map<UUID, Integer> needed,
            double userLat, double userLng) {

        record ScoredPharmacy(Pharmacy pharmacy, double distanceKm, double score,
                               List<PharmacyInventory> matchingInventory) {}

        List<ScoredPharmacy> scored = candidates.stream()
                .map(pharmacy -> {
                    double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
                    List<PharmacyInventory> inv = inventoryByPharmacy.getOrDefault(pharmacy.getId(), List.of());
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

            canFulfil.forEach(i -> remaining.remove(i.getMedicine().getId()));
        }

        return allocations;
    }

    private List<PharmacyAllocation> buildCheapestAllocations(
            List<Pharmacy> candidates,
            Map<UUID, List<PharmacyInventory>> inventoryByPharmacy,
            Map<UUID, Integer> needed,
            double userLat, double userLng) {

        Map<Pharmacy, List<PharmacyInventory>> chosenMap = new LinkedHashMap<>();

        for (UUID medicineId : needed.keySet()) {
            int qtyNeeded = needed.get(medicineId);
            PharmacyInventory cheapestInv = null;
            Pharmacy cheapestPharmacy = null;
            double minDistance = Double.MAX_VALUE;

            for (Pharmacy pharmacy : candidates) {
                double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
                List<PharmacyInventory> invList = inventoryByPharmacy.getOrDefault(pharmacy.getId(), List.of());
                for (PharmacyInventory inv : invList) {
                    if (inv.getMedicine().getId().equals(medicineId) && inv.getQuantity() >= qtyNeeded) {
                        if (cheapestInv == null || inv.getPrice().compareTo(cheapestInv.getPrice()) < 0
                                || (inv.getPrice().compareTo(cheapestInv.getPrice()) == 0 && dist < minDistance)) {
                            cheapestInv = inv;
                            cheapestPharmacy = pharmacy;
                            minDistance = dist;
                        }
                    }
                }
            }

            if (cheapestPharmacy != null && cheapestInv != null) {
                chosenMap.computeIfAbsent(cheapestPharmacy, k -> new ArrayList<>()).add(cheapestInv);
            }
        }

        List<PharmacyAllocation> allocations = new ArrayList<>();
        for (Map.Entry<Pharmacy, List<PharmacyInventory>> entry : chosenMap.entrySet()) {
            Pharmacy pharmacy = entry.getKey();
            List<PharmacyInventory> invs = entry.getValue();
            double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
            Map<UUID, Integer> subsetNeeded = new HashMap<>();
            invs.forEach(inv -> subsetNeeded.put(inv.getMedicine().getId(), needed.get(inv.getMedicine().getId())));
            List<AllocatedItem> items = buildAllocatedItems(invs, subsetNeeded);
            BigDecimal subtotal = sumLineTotals(items);
            allocations.add(new PharmacyAllocation(
                    pharmacy.getId(), pharmacy.getName(), pharmacy.getAddress(),
                    round(dist), 100.0, items, subtotal));
        }

        return allocations;
    }

    private List<PharmacyAllocation> buildBestValueAllocations(
            List<Pharmacy> candidates,
            Map<UUID, List<PharmacyInventory>> inventoryByPharmacy,
            Map<UUID, Integer> needed,
            double userLat, double userLng) {

        Map<Pharmacy, List<PharmacyInventory>> chosenMap = new LinkedHashMap<>();

        for (UUID medicineId : needed.keySet()) {
            int qtyNeeded = needed.get(medicineId);
            PharmacyInventory bestInv = null;
            Pharmacy bestPharmacy = null;
            double bestValScore = Double.MAX_VALUE;

            for (Pharmacy pharmacy : candidates) {
                double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
                List<PharmacyInventory> invList = inventoryByPharmacy.getOrDefault(pharmacy.getId(), List.of());
                for (PharmacyInventory inv : invList) {
                    if (inv.getMedicine().getId().equals(medicineId) && inv.getQuantity() >= qtyNeeded) {
                        double valScore = inv.getPrice().doubleValue() * 1.0 + dist * 0.5;
                        if (bestInv == null || valScore < bestValScore) {
                            bestInv = inv;
                            bestPharmacy = pharmacy;
                            bestValScore = valScore;
                        }
                    }
                }
            }

            if (bestPharmacy != null && bestInv != null) {
                chosenMap.computeIfAbsent(bestPharmacy, k -> new ArrayList<>()).add(bestInv);
            }
        }

        List<PharmacyAllocation> allocations = new ArrayList<>();
        for (Map.Entry<Pharmacy, List<PharmacyInventory>> entry : chosenMap.entrySet()) {
            Pharmacy pharmacy = entry.getKey();
            List<PharmacyInventory> invs = entry.getValue();
            double dist = haversine(userLat, userLng, pharmacy.getLatitude(), pharmacy.getLongitude());
            Map<UUID, Integer> subsetNeeded = new HashMap<>();
            invs.forEach(inv -> subsetNeeded.put(inv.getMedicine().getId(), needed.get(inv.getMedicine().getId())));
            List<AllocatedItem> items = buildAllocatedItems(invs, subsetNeeded);
            BigDecimal subtotal = sumLineTotals(items);
            allocations.add(new PharmacyAllocation(
                    pharmacy.getId(), pharmacy.getName(), pharmacy.getAddress(),
                    round(dist), 100.0, items, subtotal));
        }

        return allocations;
    }

    private BigDecimal sumAllocationsMedicineTotal(List<PharmacyAllocation> allocations) {
        return allocations.stream()
                .map(PharmacyAllocation::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private double maxAllocationsDistance(List<PharmacyAllocation> allocations) {
        return allocations.stream()
                .mapToDouble(PharmacyAllocation::getDistanceKm)
                .max()
                .orElse(0.0);
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
