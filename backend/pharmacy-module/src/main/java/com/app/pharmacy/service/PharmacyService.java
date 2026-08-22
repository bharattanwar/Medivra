package com.app.pharmacy.service;

import com.app.auth.util.JwtUtil;
import com.app.user.dto.AuthResponse;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import com.app.pharmacy.entity.Pharmacy;
import com.app.pharmacy.entity.Medicine;
import com.app.pharmacy.entity.PharmacyInventory;
import com.app.pharmacy.repository.PharmacyRepository;
import com.app.pharmacy.repository.MedicineRepository;
import com.app.pharmacy.repository.PharmacyInventoryRepository;
import com.app.pharmacy.dto.BulkInventoryUpdateRequest;
import com.app.pharmacy.dto.PharmacyRegisterRequest;
import com.app.pharmacy.dto.InventoryRequest;
import com.app.pharmacy.dto.InventoryResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Handles pharmacy registration and inventory management.
 *
 * A pharmacy registers as a user (role=PHARMACY) and links to a Pharmacy profile
 * that holds geo-coordinates, address, and contact info. All inventory operations
 * (add, update, bulk-update, delete) are scoped to the calling pharmacy's email
 * so a pharmacy can only modify its own stock.
 *
 * Medicine resolution order when adding inventory:
 *   1. Use provided medicineId if given.
 *   2. Case-insensitive name match against existing medicines.
 *   3. Create a new Medicine record if no match found.
 */
@Service
public class PharmacyService {

    private final PharmacyRepository pharmacyRepository;
    private final MedicineRepository medicineRepository;
    private final PharmacyInventoryRepository pharmacyInventoryRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public PharmacyService(PharmacyRepository pharmacyRepository,
                           MedicineRepository medicineRepository,
                           PharmacyInventoryRepository pharmacyInventoryRepository,
                           UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtUtil jwtUtil) {
        this.pharmacyRepository = pharmacyRepository;
        this.medicineRepository = medicineRepository;
        this.pharmacyInventoryRepository = pharmacyInventoryRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    /** Register a new pharmacy, create its user account, and return a JWT. */
    @Transactional
    public AuthResponse registerPharmacy(PharmacyRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // Create a standard User record with the PHARMACY role
        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("PHARMACY");
        User savedUser = userRepository.save(user);

        // Create the Pharmacy profile linked to this user
        Pharmacy pharmacy = new Pharmacy();
        pharmacy.setUserId(savedUser.getId());
        pharmacy.setName(request.getName());
        pharmacy.setAddress(request.getAddress());
        pharmacy.setLatitude(request.getLatitude());
        pharmacy.setLongitude(request.getLongitude());
        pharmacy.setPhoneNumber(request.getPhoneNumber());
        pharmacy.setActive(true);
        pharmacyRepository.save(pharmacy);

        String token = jwtUtil.generateToken(savedUser.getEmail());
        return new AuthResponse(
                token, savedUser.getEmail(), savedUser.getFullName(),
                savedUser.getRole(), savedUser.getId());
    }

    /**
     * Add a new medicine to the pharmacy's inventory, or top-up an existing entry.
     * If the inventory entry already exists, quantity is incremented and price updated.
     */
    @Transactional
    public InventoryResponse addOrUpdateInventory(String email, InventoryRequest request) {
        Pharmacy pharmacy = resolvePharmacyByEmail(email);

        Medicine medicine = resolveMedicine(request);

        // Upsert the inventory entry — increment stock if already present
        Optional<PharmacyInventory> existing = pharmacyInventoryRepository
                .findByPharmacyIdAndMedicineId(pharmacy.getId(), medicine.getId());

        PharmacyInventory inventory;
        if (existing.isPresent()) {
            inventory = existing.get();
            inventory.setQuantity(inventory.getQuantity() + request.getQuantity());
            inventory.setPrice(request.getPrice());
        } else {
            inventory = new PharmacyInventory();
            inventory.setPharmacy(pharmacy);
            inventory.setMedicine(medicine);
            inventory.setQuantity(request.getQuantity());
            inventory.setPrice(request.getPrice());
        }

        return convertToResponse(pharmacyInventoryRepository.save(inventory));
    }

    @Transactional(readOnly = true)
    public List<InventoryResponse> getPharmacyInventory(String email) {
        Pharmacy pharmacy = resolvePharmacyByEmail(email);
        return pharmacyInventoryRepository.findByPharmacyId(pharmacy.getId())
                .stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    /** Directly set stock quantity and price for a specific inventory item. */
    @Transactional
    public InventoryResponse updateStockAndPrice(String email, UUID inventoryId,
                                                  Integer quantity, BigDecimal price) {
        Pharmacy pharmacy = resolvePharmacyByEmail(email);
        PharmacyInventory inventory = findInventoryOwnedBy(inventoryId, pharmacy);

        inventory.setQuantity(quantity);
        inventory.setPrice(price);
        return convertToResponse(pharmacyInventoryRepository.save(inventory));
    }

    @Transactional
    public void deleteInventoryItem(String email, UUID inventoryId) {
        Pharmacy pharmacy = resolvePharmacyByEmail(email);
        PharmacyInventory inventory = findInventoryOwnedBy(inventoryId, pharmacy);
        pharmacyInventoryRepository.delete(inventory);
    }

    /** Update multiple inventory items in one request (e.g., after a stock-take). */
    @Transactional
    public List<InventoryResponse> bulkUpdateInventory(String email,
                                                        List<BulkInventoryUpdateRequest> requests) {
        Pharmacy pharmacy = resolvePharmacyByEmail(email);
        List<InventoryResponse> responses = new ArrayList<>();

        for (BulkInventoryUpdateRequest req : requests) {
            PharmacyInventory inventory = findInventoryOwnedBy(req.getInventoryId(), pharmacy);
            inventory.setQuantity(req.getQuantity());
            inventory.setPrice(req.getPrice());
            responses.add(convertToResponse(pharmacyInventoryRepository.save(inventory)));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public Pharmacy getPharmacyProfile(String email) {
        return resolvePharmacyByEmail(email);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Look up a pharmacy by the authenticated user's email.
     * Used by every inventory operation to scope it to the right pharmacy.
     */
    private Pharmacy resolvePharmacyByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException(
                        "Pharmacy profile not found for user: " + email));
    }

    /**
     * Find a medicine by ID or by name (case-insensitive). Creates a new
     * Medicine record if neither match is found.
     */
    private Medicine resolveMedicine(InventoryRequest request) {
        if (request.getMedicineId() != null) {
            return medicineRepository.findById(request.getMedicineId())
                    .orElseThrow(() -> new RuntimeException("Medicine not found"));
        }

        if (request.getMedicineName() == null || request.getMedicineName().isBlank()) {
            throw new RuntimeException("Medicine name is required when medicine ID is not provided");
        }

        // Check for an exact case-insensitive match before creating a new record
        List<Medicine> existing = medicineRepository
                .findByNameContainingIgnoreCase(request.getMedicineName());
        Optional<Medicine> exactMatch = existing.stream()
                .filter(m -> m.getName().equalsIgnoreCase(request.getMedicineName().trim()))
                .findFirst();

        if (exactMatch.isPresent()) {
            return exactMatch.get();
        }

        // No match — create a new medicine entry
        Medicine medicine = new Medicine();
        medicine.setName(request.getMedicineName().trim());
        medicine.setManufacturer(request.getManufacturer());
        medicine.setStrength(request.getStrength());
        return medicineRepository.save(medicine);
    }

    /** Fetch an inventory item and verify it belongs to the given pharmacy. */
    private PharmacyInventory findInventoryOwnedBy(UUID inventoryId, Pharmacy pharmacy) {
        PharmacyInventory inventory = pharmacyInventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new RuntimeException("Inventory item not found"));
        if (!inventory.getPharmacy().getId().equals(pharmacy.getId())) {
            throw new RuntimeException(
                    "Unauthorized action: this inventory does not belong to your pharmacy");
        }
        return inventory;
    }

    private InventoryResponse convertToResponse(PharmacyInventory inventory) {
        return new InventoryResponse(
                inventory.getId(),
                inventory.getMedicine().getId(),
                inventory.getMedicine().getName(),
                inventory.getMedicine().getManufacturer(),
                inventory.getMedicine().getStrength(),
                inventory.getQuantity(),
                inventory.getPrice());
    }
}
