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
import com.app.pharmacy.dto.PharmacyRegisterRequest;
import com.app.pharmacy.dto.InventoryRequest;
import com.app.pharmacy.dto.InventoryResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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

    @Transactional
    public AuthResponse registerPharmacy(PharmacyRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // Create standard User record with role PHARMACY
        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole("PHARMACY");

        User savedUser = userRepository.save(user);

        // Create Pharmacy profile linked to this user
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
                token,
                savedUser.getEmail(),
                savedUser.getFullName(),
                savedUser.getRole(),
                savedUser.getId()
        );
    }

    @Transactional
    public InventoryResponse addOrUpdateInventory(String email, InventoryRequest request) {
        // Resolve pharmacy through email
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Pharmacy pharmacy = pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Pharmacy profile not found for user: " + email));

        // Resolve medicine
        Medicine medicine;
        if (request.getMedicineId() != null) {
            medicine = medicineRepository.findById(request.getMedicineId())
                    .orElseThrow(() -> new RuntimeException("Medicine not found"));
        } else {
            if (request.getMedicineName() == null || request.getMedicineName().isBlank()) {
                throw new RuntimeException("Medicine name is required when medicine ID is not provided");
            }
            // Check if medicine already exists case-insensitively
            List<Medicine> existingList = medicineRepository.findByNameContainingIgnoreCase(request.getMedicineName());
            Optional<Medicine> exactMatch = existingList.stream()
                    .filter(m -> m.getName().equalsIgnoreCase(request.getMedicineName().trim()))
                    .findFirst();

            if (exactMatch.isPresent()) {
                medicine = exactMatch.get();
            } else {
                medicine = new Medicine();
                medicine.setName(request.getMedicineName().trim());
                medicine.setManufacturer(request.getManufacturer());
                medicine.setStrength(request.getStrength());
                medicine = medicineRepository.save(medicine);
            }
        }

        // Add or update inventory mapping
        Optional<PharmacyInventory> inventoryOpt = pharmacyInventoryRepository
                .findByPharmacyIdAndMedicineId(pharmacy.getId(), medicine.getId());
        PharmacyInventory inventory;

        if (inventoryOpt.isPresent()) {
            inventory = inventoryOpt.get();
            inventory.setQuantity(inventory.getQuantity() + request.getQuantity());
            inventory.setPrice(request.getPrice());
        } else {
            inventory = new PharmacyInventory();
            inventory.setPharmacy(pharmacy);
            inventory.setMedicine(medicine);
            inventory.setQuantity(request.getQuantity());
            inventory.setPrice(request.getPrice());
        }

        PharmacyInventory savedInventory = pharmacyInventoryRepository.save(inventory);
        return convertToResponse(savedInventory);
    }

    @Transactional(readOnly = true)
    public List<InventoryResponse> getPharmacyInventory(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Pharmacy pharmacy = pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Pharmacy profile not found for user: " + email));

        List<PharmacyInventory> inventories = pharmacyInventoryRepository.findByPharmacyId(pharmacy.getId());
        return inventories.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public InventoryResponse updateStockAndPrice(String email, UUID inventoryId, Integer quantity, BigDecimal price) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Pharmacy pharmacy = pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Pharmacy profile not found for user: " + email));

        PharmacyInventory inventory = pharmacyInventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new RuntimeException("Inventory item not found"));

        if (!inventory.getPharmacy().getId().equals(pharmacy.getId())) {
            throw new RuntimeException("Unauthorized action: This inventory does not belong to your pharmacy");
        }

        inventory.setQuantity(quantity);
        inventory.setPrice(price);

        PharmacyInventory saved = pharmacyInventoryRepository.save(inventory);
        return convertToResponse(saved);
    }

    @Transactional
    public void deleteInventoryItem(String email, UUID inventoryId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Pharmacy pharmacy = pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Pharmacy profile not found for user: " + email));

        PharmacyInventory inventory = pharmacyInventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new RuntimeException("Inventory item not found"));

        if (!inventory.getPharmacy().getId().equals(pharmacy.getId())) {
            throw new RuntimeException("Unauthorized action: This inventory does not belong to your pharmacy");
        }

        pharmacyInventoryRepository.delete(inventory);
    }

    private InventoryResponse convertToResponse(PharmacyInventory inventory) {
        return new InventoryResponse(
                inventory.getId(),
                inventory.getMedicine().getId(),
                inventory.getMedicine().getName(),
                inventory.getMedicine().getManufacturer(),
                inventory.getMedicine().getStrength(),
                inventory.getQuantity(),
                inventory.getPrice()
        );
    }
}
