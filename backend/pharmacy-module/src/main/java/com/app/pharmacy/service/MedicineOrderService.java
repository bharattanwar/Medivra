package com.app.pharmacy.service;

import com.app.payment.service.RazorpayService;
import com.app.payment.config.RazorpayProperties;
import com.app.pharmacy.dto.CheckoutRequest;
import com.app.pharmacy.dto.MedicineOrderResponse;
import com.app.pharmacy.dto.MedicineOrderResponse.MedicineOrderItemDetail;
import com.app.pharmacy.dto.VerifyOrderPaymentRequest;
import com.app.pharmacy.entity.Medicine;
import com.app.pharmacy.entity.MedicineOrder;
import com.app.pharmacy.entity.MedicineOrderItem;
import com.app.pharmacy.entity.Pharmacy;
import com.app.pharmacy.entity.PharmacyInventory;
import com.app.pharmacy.entity.RefillReminder;
import com.app.pharmacy.repository.MedicineOrderItemRepository;
import com.app.pharmacy.repository.MedicineOrderRepository;
import com.app.pharmacy.repository.MedicineRepository;
import com.app.pharmacy.repository.PharmacyInventoryRepository;
import com.app.pharmacy.repository.PharmacyRepository;
import com.app.pharmacy.repository.RefillReminderRepository;
import com.app.user.entity.User;
import com.app.user.repository.UserRepository;
import com.razorpay.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MedicineOrderService {

    private final MedicineOrderRepository orderRepository;
    private final MedicineOrderItemRepository orderItemRepository;
    private final RefillReminderRepository refillReminderRepository;
    private final PharmacyRepository pharmacyRepository;
    private final MedicineRepository medicineRepository;
    private final PharmacyInventoryRepository inventoryRepository;
    private final UserRepository userRepository;
    private final RazorpayService razorpayService;
    private final RazorpayProperties razorpayProperties;

    public MedicineOrderService(MedicineOrderRepository orderRepository,
                               MedicineOrderItemRepository orderItemRepository,
                               RefillReminderRepository refillReminderRepository,
                               PharmacyRepository pharmacyRepository,
                               MedicineRepository medicineRepository,
                               PharmacyInventoryRepository inventoryRepository,
                               UserRepository userRepository,
                               RazorpayService razorpayService,
                               RazorpayProperties razorpayProperties) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.refillReminderRepository = refillReminderRepository;
        this.pharmacyRepository = pharmacyRepository;
        this.medicineRepository = medicineRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
        this.razorpayService = razorpayService;
        this.razorpayProperties = razorpayProperties;
    }

    // ─── Haversine Formula Helper ───────────────────────────────────────────

    private double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c;
    }

    // ─── Checkout API ────────────────────────────────────────────────────────

    @Transactional
    public MedicineOrderResponse checkout(CheckoutRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new RuntimeException("Cannot place order with empty items list");
        }

        // Calculate total amount
        BigDecimal total = BigDecimal.ZERO;
        for (CheckoutRequest.CheckoutItem item : request.getItems()) {
            BigDecimal itemTotal = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            total = total.add(itemTotal);
        }

        // Save Parent Order
        MedicineOrder parentOrder = new MedicineOrder();
        parentOrder.setPatientId(request.getPatientId());
        parentOrder.setPrescriptionId(request.getPrescriptionId());
        parentOrder.setDeliveryAddress(request.getDeliveryAddress());
        parentOrder.setUserLatitude(request.getUserLatitude());
        parentOrder.setUserLongitude(request.getUserLongitude());
        parentOrder.setTotalAmount(total);

        // Determine payment method and initial status
        String method = request.getPaymentMethod() != null ? request.getPaymentMethod().toLowerCase() : "online";
        parentOrder.setPaymentMethod(method);
        if ("cod".equals(method)) {
            parentOrder.setStatus("CONFIRMED"); // COD: confirmed
            parentOrder.setPaymentStatus("TO_BE_PAID");
        } else {
            parentOrder.setStatus("PENDING"); // Online: pending verification
            parentOrder.setPaymentStatus("PENDING");
        }
        
        MedicineOrder savedParent = orderRepository.save(parentOrder);

        // Process each item
        for (CheckoutRequest.CheckoutItem item : request.getItems()) {
            MedicineOrderItem childItem = new MedicineOrderItem();
            childItem.setOrderId(savedParent.getId());
            childItem.setPharmacyId(item.getPharmacyId());
            childItem.setMedicineId(item.getMedicineId());
            childItem.setQuantity(item.getQuantity());
            childItem.setPrice(item.getPrice());
            childItem.setStatus("PENDING");

            // Calculate Delivery Estimate based on Haversine distance
            Pharmacy pharmacy = pharmacyRepository.findById(item.getPharmacyId())
                    .orElseThrow(() -> new RuntimeException("Pharmacy not found: " + item.getPharmacyId()));
            double dist = haversine(request.getUserLatitude(), request.getUserLongitude(),
                                    pharmacy.getLatitude(), pharmacy.getLongitude());
            
            String estimate;
            if (dist <= 3.0) {
                estimate = "30-45 mins";
            } else if (dist <= 8.0) {
                estimate = "1-1.5 hours";
            } else if (dist <= 15.0) {
                estimate = "2-3 hours";
            } else {
                estimate = "Same day (within 6 hours)";
            }
            childItem.setDeliveryEstimate(estimate);

            orderItemRepository.save(childItem);
        }

        MedicineOrderResponse response = getOrderDetails(savedParent.getId());
        if ("online".equals(method)) {
            if (razorpayService.isLiveMode()) {
                try {
                    Order razorpayOrder = razorpayService.createMedicineOrder(total, savedParent.getId());
                    savedParent.setRazorpayOrderId(razorpayOrder.get("id"));
                    orderRepository.save(savedParent);

                    response.setRazorpayOrderId(razorpayOrder.get("id"));
                    response.setRazorpayKeyId(razorpayProperties.getKeyId());
                    response.setAmountPaise(razorpayService.toPaise(total));
                    response.setCurrency("INR");
                    response.setMockMode(false);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to create Razorpay order: " + e.getMessage());
                }
            } else {
                String mockOrderId = razorpayService.createMockOrderId();
                savedParent.setRazorpayOrderId(mockOrderId);
                orderRepository.save(savedParent);

                response.setRazorpayOrderId(mockOrderId);
                response.setRazorpayKeyId("mock_key");
                response.setAmountPaise(razorpayService.toPaise(total));
                response.setCurrency("INR");
                response.setMockMode(true);
            }
        }
        response.setPaymentStatus(savedParent.getPaymentStatus());
        return response;
    }

    // ─── Order Queries ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<MedicineOrderResponse> getPatientOrders(UUID patientId) {
        List<MedicineOrder> parents = orderRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
        return parents.stream()
                .map(p -> getOrderDetails(p.getId()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MedicineOrderItemDetail> getPharmacyOrders(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Pharmacy pharmacy = pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("Pharmacy profile not found for user: " + email));

        List<MedicineOrderItem> items = orderItemRepository.findByPharmacyIdOrderByCreatedAtDesc(pharmacy.getId());
        return items.stream()
                .filter(item -> {
                    Optional<MedicineOrder> parentOpt = orderRepository.findById(item.getOrderId());
                    if (parentOpt.isPresent()) {
                        MedicineOrder parent = parentOpt.get();
                        if ("online".equalsIgnoreCase(parent.getPaymentMethod())) {
                            return "PAID".equalsIgnoreCase(parent.getPaymentStatus()) ||
                                   "PROCESSING".equalsIgnoreCase(parent.getStatus()) ||
                                   "DELIVERED".equalsIgnoreCase(parent.getStatus());
                        }
                    }
                    return true;
                })
                .map(this::convertToDetailDto)
                .collect(Collectors.toList());
    }

    // ─── Status Updates ──────────────────────────────────────────────────────

    @Transactional
    public MedicineOrderItemDetail updateItemStatus(UUID itemId, String status) {
        MedicineOrderItem item = orderItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Order item not found: " + itemId));
        String oldStatus = item.getStatus();
        item.setStatus(status);
        if (item.getUpdatedAt() == null) {
            item.setUpdatedAt(LocalDateTime.now());
        }
        MedicineOrderItem savedItem = orderItemRepository.save(item);

        // Decrement stock only when transitioning to SHIPPED
        if ("SHIPPED".equalsIgnoreCase(status) && !"SHIPPED".equalsIgnoreCase(oldStatus)) {
            Optional<PharmacyInventory> inventoryOpt = inventoryRepository
                    .findByPharmacyIdAndMedicineId(item.getPharmacyId(), item.getMedicineId());
            if (inventoryOpt.isPresent()) {
                PharmacyInventory inv = inventoryOpt.get();
                int currentQty = inv.getQuantity();
                inv.setQuantity(Math.max(0, currentQty - item.getQuantity()));
                inventoryRepository.save(inv);
            }
        }

        // Check if all sibling items in parent order are DELIVERED
        UUID parentId = item.getOrderId();
        List<MedicineOrderItem> siblingItems = orderItemRepository.findByOrderId(parentId);
        boolean allDelivered = siblingItems.stream()
                .allMatch(sib -> "DELIVERED".equalsIgnoreCase(sib.getStatus()));

        if (allDelivered) {
            MedicineOrder parent = orderRepository.findById(parentId)
                    .orElseThrow(() -> new RuntimeException("Parent order not found"));
            parent.setStatus("DELIVERED");
            parent.setUpdatedAt(LocalDateTime.now());
            orderRepository.save(parent);
        } else {
            // Check if any is processing/shipped to mark parent as active
            boolean anyProcessing = siblingItems.stream()
                    .anyMatch(sib -> "PREPARING".equalsIgnoreCase(sib.getStatus()) || "SHIPPED".equalsIgnoreCase(sib.getStatus()));
            if (anyProcessing) {
                MedicineOrder parent = orderRepository.findById(parentId)
                        .orElseThrow(() -> new RuntimeException("Parent order not found"));
                parent.setStatus("PROCESSING");
                parent.setUpdatedAt(LocalDateTime.now());
                orderRepository.save(parent);
            }
        }

        return convertToDetailDto(savedItem);
    }

    // ─── Refill Reminders ────────────────────────────────────────────────────

    @Transactional
    public RefillReminder scheduleReminder(UUID patientId, String medicineName, int daysInterval) {
        RefillReminder reminder = new RefillReminder();
        reminder.setPatientId(patientId);
        reminder.setMedicineName(medicineName);
        reminder.setNextRefillDate(LocalDate.now().plusDays(daysInterval));
        reminder.setActive(true);
        return refillReminderRepository.save(reminder);
    }

    @Transactional(readOnly = true)
    public List<RefillReminder> getPatientActiveReminders(UUID patientId) {
        return refillReminderRepository.findByPatientIdAndIsActiveTrueOrderByNextRefillDateAsc(patientId);
    }

    @Transactional
    public void deactivateReminder(UUID reminderId) {
        Optional<RefillReminder> reminderOpt = refillReminderRepository.findById(reminderId);
        if (reminderOpt.isPresent()) {
            RefillReminder reminder = reminderOpt.get();
            reminder.setActive(false);
            refillReminderRepository.save(reminder);
        }
    }

    // ─── Mapping Helpers ─────────────────────────────────────────────────────

    private MedicineOrderResponse getOrderDetails(UUID parentId) {
        MedicineOrder p = orderRepository.findById(parentId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + parentId));

        MedicineOrderResponse resp = new MedicineOrderResponse();
        resp.setId(p.getId());
        resp.setPatientId(p.getPatientId());
        resp.setPrescriptionId(p.getPrescriptionId());
        resp.setStatus(p.getStatus());
        resp.setPaymentMethod(p.getPaymentMethod());
        resp.setTotalAmount(p.getTotalAmount());
        resp.setUserLatitude(p.getUserLatitude());
        resp.setUserLongitude(p.getUserLongitude());
        resp.setDeliveryAddress(p.getDeliveryAddress());
        resp.setCreatedAt(p.getCreatedAt());
        resp.setPaymentStatus(p.getPaymentStatus());
        resp.setRazorpayOrderId(p.getRazorpayOrderId());

        List<MedicineOrderItem> items = orderItemRepository.findByOrderId(parentId);
        List<MedicineOrderItemDetail> details = items.stream()
                .map(this::convertToDetailDto)
                .collect(Collectors.toList());
        resp.setItems(details);

        return resp;
    }

    private MedicineOrderItemDetail convertToDetailDto(MedicineOrderItem item) {
        MedicineOrderItemDetail detail = new MedicineOrderItemDetail();
        detail.setId(item.getId());
        detail.setOrderId(item.getOrderId());
        detail.setPharmacyId(item.getPharmacyId());
        detail.setMedicineId(item.getMedicineId());
        detail.setQuantity(item.getQuantity());
        detail.setPrice(item.getPrice());
        detail.setStatus(item.getStatus());
        detail.setDeliveryEstimate(item.getDeliveryEstimate());

        // Resolve parent order info
        Optional<MedicineOrder> parentOpt = orderRepository.findById(item.getOrderId());
        if (parentOpt.isPresent()) {
            MedicineOrder parent = parentOpt.get();
            detail.setPaymentMethod(parent.getPaymentMethod());
            detail.setPaymentStatus(parent.getPaymentStatus());
        }

        // Resolve Pharmacy Name
        Pharmacy pharmacy = pharmacyRepository.findById(item.getPharmacyId()).orElse(null);
        detail.setPharmacyName(pharmacy != null ? pharmacy.getName() : "Unknown Pharmacy");

        // Resolve Medicine Name
        Medicine medicine = medicineRepository.findById(item.getMedicineId()).orElse(null);
        String medName = medicine != null ? medicine.getName() : "Unknown Medicine";
        detail.setMedicineName(medName);

        // Enrich with mock explanation/instructions/side effects
        MedicineDetails mockInfo = getMedicineDetails(medName);
        detail.setExplanation(mockInfo.explanation);
        detail.setInstructions(mockInfo.instructions);
        detail.setSideEffects(mockInfo.sideEffects);

        return detail;
    }

    private static class MedicineDetails {
        public String explanation;
        public String instructions;
        public String sideEffects;

        public MedicineDetails(String explanation, String instructions, String sideEffects) {
            this.explanation = explanation;
            this.instructions = instructions;
            this.sideEffects = sideEffects;
        }
    }

    private MedicineDetails getMedicineDetails(String name) {
        if (name == null) {
            return new MedicineDetails("General medication", "Use as directed by physician", "Consult doctor");
        }
        String lowerName = name.toLowerCase();
        if (lowerName.contains("paracetamol") || lowerName.contains("crocin") || lowerName.contains("calpol")) {
            return new MedicineDetails(
                "Common analgesic (pain reliever) and antipyretic (fever reducer).",
                "Take 1 tablet after meals as needed. Max 4 tablets a day. Keep at least 4-6 hours gap.",
                "Mild skin rash, liver damage if overdosed."
            );
        } else if (lowerName.contains("cetirizine") || lowerName.contains("alerid") || lowerName.contains("okacet")) {
            return new MedicineDetails(
                "Antihistamine used to relieve allergy symptoms like runny nose, watery eyes, and sneezing.",
                "Take 1 tablet once a day, preferably at bedtime as it may cause drowsiness.",
                "Dry mouth, sleepiness, fatigue, headache."
            );
        } else if (lowerName.contains("amoxicillin") || lowerName.contains("mox")) {
            return new MedicineDetails(
                "Penicillin antibiotic used to treat bacterial infections of ears, throat, and lungs.",
                "Take 1 capsule three times daily for the full prescribed duration. Do not skip doses.",
                "Nausea, diarrhea, stomach upset, allergic reactions."
            );
        } else if (lowerName.contains("ibuprofen") || lowerName.contains("combiflam")) {
            return new MedicineDetails(
                "Nonsteroidal anti-inflammatory drug (NSAID) for pain relief and reducing inflammation.",
                "Take 1 tablet with food or milk to prevent stomach irritation. Max 3 times a day.",
                "Acid reflux, stomach pain, dizziness, mild nausea."
            );
        } else if (lowerName.contains("metformin") || lowerName.contains("glycomet")) {
            return new MedicineDetails(
                "Oral diabetes medicine that helps control blood sugar levels for Type 2 diabetes.",
                "Take 1 tablet twice daily with breakfast and dinner to reduce stomach side effects.",
                "Loss of appetite, diarrhea, metallic taste, nausea."
            );
        } else {
            return new MedicineDetails(
                "General therapeutic formulation.",
                "Consume as advised by your healthcare practitioner. Read packaging instructions.",
                "May cause mild stomach upset or drowsiness. Consult doctor if symptoms persist."
            );
        }
    }

    @Transactional
    public MedicineOrderResponse verifyPayment(VerifyOrderPaymentRequest request) {
        MedicineOrder order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new RuntimeException("Medicine order not found: " + request.getOrderId()));

        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())) {
            return getOrderDetails(order.getId());
        }

        if (order.getRazorpayOrderId() == null || !order.getRazorpayOrderId().equals(request.getRazorpayOrderId())) {
            throw new RuntimeException("Order ID mismatch");
        }

        boolean verified;
        if (razorpayService.isLiveMode()) {
            if (request.getRazorpaySignature() == null || request.getRazorpaySignature().isBlank()) {
                throw new RuntimeException("Payment signature is required");
            }
            verified = razorpayService.verifySignature(
                    request.getRazorpayOrderId(),
                    request.getRazorpayPaymentId(),
                    request.getRazorpaySignature());
        } else {
            verified = request.getRazorpayPaymentId() != null && !request.getRazorpayPaymentId().isBlank();
        }

        if (!verified) {
            order.setPaymentStatus("FAILED");
            orderRepository.save(order);
            throw new RuntimeException("Payment verification failed");
        }

        order.setPaymentStatus("PAID");
        order.setStatus("PAID");
        MedicineOrder saved = orderRepository.save(order);

        return getOrderDetails(saved.getId());
    }

    @Transactional
    public MedicineOrderResponse confirmPayment(UUID orderId) {
        MedicineOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));
        order.setPaymentStatus("PAID");
        MedicineOrder saved = orderRepository.save(order);
        return getOrderDetails(saved.getId());
    }
}
