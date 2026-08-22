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
import com.app.common.entity.NotificationType;
import com.app.common.event.NotificationEvent;
import com.razorpay.Order;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Handles medicine orders from checkout through payment verification to delivery.
 *
 * Order lifecycle:
 *   PENDING → (online) → order created in Razorpay → payment verified → PAID
 *   PENDING → (COD)    → CONFIRMED immediately (pay at delivery)
 *
 * Each order has one parent MedicineOrder and one MedicineOrderItem per pharmacy.
 * Status is tracked at item level; the parent order rolls up to PROCESSING / DELIVERED
 * once all items reach the same terminal state.
 *
 * Delivery estimate is calculated from the Haversine distance between the patient
 * and the fulfilling pharmacy: ≤3 km → 30-45 min, ≤8 km → 1-1.5 h, etc.
 */
@Service
public class MedicineOrderService {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private final MedicineOrderRepository orderRepository;
    private final MedicineOrderItemRepository orderItemRepository;
    private final RefillReminderRepository refillReminderRepository;
    private final PharmacyRepository pharmacyRepository;
    private final MedicineRepository medicineRepository;
    private final PharmacyInventoryRepository inventoryRepository;
    private final UserRepository userRepository;
    private final RazorpayService razorpayService;
    private final RazorpayProperties razorpayProperties;
    private final ApplicationEventPublisher eventPublisher;

    public MedicineOrderService(MedicineOrderRepository orderRepository,
                                MedicineOrderItemRepository orderItemRepository,
                                RefillReminderRepository refillReminderRepository,
                                PharmacyRepository pharmacyRepository,
                                MedicineRepository medicineRepository,
                                PharmacyInventoryRepository inventoryRepository,
                                UserRepository userRepository,
                                RazorpayService razorpayService,
                                RazorpayProperties razorpayProperties,
                                ApplicationEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.refillReminderRepository = refillReminderRepository;
        this.pharmacyRepository = pharmacyRepository;
        this.medicineRepository = medicineRepository;
        this.inventoryRepository = inventoryRepository;
        this.userRepository = userRepository;
        this.razorpayService = razorpayService;
        this.razorpayProperties = razorpayProperties;
        this.eventPublisher = eventPublisher;
    }

    // ── Checkout ─────────────────────────────────────────────────────────────

    /**
     * Place a medicine order. Creates a parent order + one item per pharmacy allocation,
     * calculates delivery estimates, and (for online payment) creates a Razorpay order.
     */
    @Transactional
    public MedicineOrderResponse checkout(CheckoutRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new RuntimeException("Cannot place order with empty items list");
        }

        // Sum the total from the client-provided prices
        BigDecimal total = request.getItems().stream()
                .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Persist parent order
        MedicineOrder parentOrder = new MedicineOrder();
        parentOrder.setPatientId(request.getPatientId());
        parentOrder.setPrescriptionId(request.getPrescriptionId());
        parentOrder.setDeliveryAddress(request.getDeliveryAddress());
        parentOrder.setUserLatitude(request.getUserLatitude());
        parentOrder.setUserLongitude(request.getUserLongitude());
        parentOrder.setTotalAmount(total);

        String method = request.getPaymentMethod() != null
                ? request.getPaymentMethod().toLowerCase() : "online";
        parentOrder.setPaymentMethod(method);

        // COD orders are immediately confirmed; online orders wait for payment verification
        if ("cod".equals(method)) {
            parentOrder.setStatus("CONFIRMED");
            parentOrder.setPaymentStatus("TO_BE_PAID");
        } else {
            parentOrder.setStatus("PENDING");
            parentOrder.setPaymentStatus("PENDING");
        }

        MedicineOrder savedParent = orderRepository.save(parentOrder);

        // Persist one child item per pharmacy, with a delivery estimate
        for (CheckoutRequest.CheckoutItem item : request.getItems()) {
            Pharmacy pharmacy = pharmacyRepository.findById(item.getPharmacyId())
                    .orElseThrow(() -> new RuntimeException("Pharmacy not found: " + item.getPharmacyId()));

            double dist = haversine(
                    request.getUserLatitude(), request.getUserLongitude(),
                    pharmacy.getLatitude(), pharmacy.getLongitude());

            MedicineOrderItem child = new MedicineOrderItem();
            child.setOrderId(savedParent.getId());
            child.setPharmacyId(item.getPharmacyId());
            child.setMedicineId(item.getMedicineId());
            child.setQuantity(item.getQuantity());
            child.setPrice(item.getPrice());
            child.setStatus("PENDING");
            child.setDeliveryEstimate(deliveryEstimate(dist));
            orderItemRepository.save(child);
        }

        // For online payments, create a Razorpay order (or a mock one in dev mode)
        MedicineOrderResponse response = getOrderDetails(savedParent.getId());
        if ("online".equals(method)) {
            if (razorpayService.isLiveMode()) {
                try {
                    Order razorpayOrder = razorpayService.createMedicineOrder(total, savedParent.getId());
                    savedParent.setRazorpayOrderId(razorpayOrder.get("id"));
                    orderRepository.save(savedParent);
                    response.setRazorpayOrderId(razorpayOrder.get("id"));
                    response.setRazorpayKeyId(razorpayProperties.getKeyId());
                    response.setMockMode(false);
                } catch (Exception e) {
                    throw new RuntimeException("Failed to create Razorpay order: " + e.getMessage());
                }
            } else {
                // Dev/mock mode — simulate a Razorpay order ID
                String mockOrderId = razorpayService.createMockOrderId();
                savedParent.setRazorpayOrderId(mockOrderId);
                orderRepository.save(savedParent);
                response.setRazorpayOrderId(mockOrderId);
                response.setRazorpayKeyId("mock_key");
                response.setMockMode(true);
            }
            response.setAmountPaise(razorpayService.toPaise(total));
            response.setCurrency("INR");
        }

        response.setPaymentStatus(savedParent.getPaymentStatus());

        // Notify patient about COD order placement
        if ("cod".equals(method)) {
            eventPublisher.publishEvent(new NotificationEvent(
                    this,
                    savedParent.getPatientId(),
                    "Order Confirmed",
                    "Your medicine order has been placed with Cash on Delivery.",
                    NotificationType.SYSTEM,
                    savedParent.getId().toString()
            ));
        }

        return response;
    }

    // ── Order queries ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<MedicineOrderResponse> getPatientOrders(UUID patientId) {
        return orderRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(p -> getOrderDetails(p.getId()))
                .collect(Collectors.toList());
    }

    /**
     * Returns orders for the pharmacy identified by the caller's email.
     *
     * Performance: pre-loads all parent orders in one batch query and uses a map
     * for O(1) lookup inside the stream — avoids N+1 DB calls.
     */
    @Transactional(readOnly = true)
    public List<MedicineOrderItemDetail> getPharmacyOrders(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Pharmacy pharmacy = pharmacyRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException(
                        "Pharmacy profile not found for user: " + email));

        List<MedicineOrderItem> items = orderItemRepository
                .findByPharmacyIdOrderByCreatedAtDesc(pharmacy.getId());

        // Batch-load all parent orders to avoid one DB call per item
        List<UUID> parentIds = items.stream()
                .map(MedicineOrderItem::getOrderId)
                .distinct()
                .collect(Collectors.toList());
        Map<UUID, MedicineOrder> parentMap = orderRepository.findAllById(parentIds)
                .stream()
                .collect(Collectors.toMap(MedicineOrder::getId, Function.identity()));

        return items.stream()
                .filter(item -> {
                    MedicineOrder parent = parentMap.get(item.getOrderId());
                    if (parent == null) return false;
                    // Only show online orders that have been paid (or are processing/delivered)
                    if ("online".equalsIgnoreCase(parent.getPaymentMethod())) {
                        String status = parent.getStatus();
                        String payStatus = parent.getPaymentStatus();
                        return "PAID".equalsIgnoreCase(payStatus)
                                || "PROCESSING".equalsIgnoreCase(status)
                                || "DELIVERED".equalsIgnoreCase(status);
                    }
                    return true; // COD orders are always visible
                })
                .map(item -> convertToDetailDto(item, parentMap))
                .collect(Collectors.toList());
    }

    // ── Status updates ───────────────────────────────────────────────────────

    /**
     * Update a single item's status (e.g., PENDING → PREPARING → SHIPPED → DELIVERED).
     * Stock is decremented when an item transitions to SHIPPED.
     * The parent order rolls up to PROCESSING / DELIVERED based on sibling statuses.
     */
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

        // Decrement pharmacy stock only on the first transition to SHIPPED
        if ("SHIPPED".equalsIgnoreCase(status) && !("SHIPPED".equalsIgnoreCase(oldStatus))) {
            inventoryRepository
                    .findByPharmacyIdAndMedicineId(item.getPharmacyId(), item.getMedicineId())
                    .ifPresent(inv -> {
                        inv.setQuantity(Math.max(0, inv.getQuantity() - item.getQuantity()));
                        inventoryRepository.save(inv);
                    });
        }

        // Roll up parent order status
        UUID parentId = item.getOrderId();
        List<MedicineOrderItem> siblings = orderItemRepository.findByOrderId(parentId);
        boolean allDelivered = siblings.stream()
                .allMatch(sib -> "DELIVERED".equalsIgnoreCase(sib.getStatus()));

        MedicineOrder parent = orderRepository.findById(parentId)
                .orElseThrow(() -> new RuntimeException("Parent order not found"));

        if (allDelivered) {
            parent.setStatus("DELIVERED");
        } else {
            boolean anyActive = siblings.stream().anyMatch(
                    sib -> "PREPARING".equalsIgnoreCase(sib.getStatus())
                            || "SHIPPED".equalsIgnoreCase(sib.getStatus()));
            if (anyActive) {
                parent.setStatus("PROCESSING");
            }
        }
        parent.setUpdatedAt(LocalDateTime.now());
        orderRepository.save(parent);

        // Build response using a simple pre-loaded parent map
        Map<UUID, MedicineOrder> parentMap = Map.of(parent.getId(), parent);
        return convertToDetailDto(savedItem, parentMap);
    }

    // ── Refill reminders ─────────────────────────────────────────────────────

    /** Schedule a refill reminder for a patient — fires after {@code daysInterval} days. */
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
        return refillReminderRepository
                .findByPatientIdAndIsActiveTrueOrderByNextRefillDateAsc(patientId);
    }

    @Transactional
    public void deactivateReminder(UUID reminderId) {
        refillReminderRepository.findById(reminderId).ifPresent(reminder -> {
            reminder.setActive(false);
            refillReminderRepository.save(reminder);
        });
    }

    // ── Payment verification ─────────────────────────────────────────────────

    @Transactional
    public MedicineOrderResponse verifyPayment(VerifyOrderPaymentRequest request) {
        MedicineOrder order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new RuntimeException(
                        "Medicine order not found: " + request.getOrderId()));

        // Idempotent — return current state if already paid
        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())) {
            return getOrderDetails(order.getId());
        }

        if (order.getRazorpayOrderId() == null
                || !order.getRazorpayOrderId().equals(request.getRazorpayOrderId())) {
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
            verified = request.getRazorpayPaymentId() != null
                    && !request.getRazorpayPaymentId().isBlank();
        }

        if (!verified) {
            order.setPaymentStatus("FAILED");
            orderRepository.save(order);
            throw new RuntimeException("Payment verification failed");
        }

        order.setPaymentStatus("PAID");
        order.setStatus("PAID");
        MedicineOrder saved = orderRepository.save(order);

        eventPublisher.publishEvent(new NotificationEvent(
                this,
                saved.getPatientId(),
                "Payment Confirmed",
                "Your online payment for the medicine order has been successfully verified.",
                NotificationType.PAYMENT_SUCCESS,
                saved.getId().toString()
        ));

        return getOrderDetails(saved.getId());
    }

    @Transactional
    public MedicineOrderResponse confirmPayment(UUID orderId) {
        MedicineOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));
        order.setPaymentStatus("PAID");
        MedicineOrder saved = orderRepository.save(order);

        eventPublisher.publishEvent(new NotificationEvent(
                this,
                saved.getPatientId(),
                "Payment Confirmed",
                "Your payment for the medicine order has been confirmed by the pharmacy.",
                NotificationType.PAYMENT_SUCCESS,
                saved.getId().toString()
        ));

        return getOrderDetails(saved.getId());
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /** Build a full MedicineOrderResponse by loading the parent + all its items. */
    private MedicineOrderResponse getOrderDetails(UUID parentId) {
        MedicineOrder parent = orderRepository.findById(parentId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + parentId));

        MedicineOrderResponse resp = new MedicineOrderResponse();
        resp.setId(parent.getId());
        resp.setPatientId(parent.getPatientId());
        resp.setPrescriptionId(parent.getPrescriptionId());
        resp.setStatus(parent.getStatus());
        resp.setPaymentMethod(parent.getPaymentMethod());
        resp.setTotalAmount(parent.getTotalAmount());
        resp.setUserLatitude(parent.getUserLatitude());
        resp.setUserLongitude(parent.getUserLongitude());
        resp.setDeliveryAddress(parent.getDeliveryAddress());
        resp.setCreatedAt(parent.getCreatedAt());
        resp.setPaymentStatus(parent.getPaymentStatus());
        resp.setRazorpayOrderId(parent.getRazorpayOrderId());

        // Build a pre-loaded parent map for the detail DTO builder
        Map<UUID, MedicineOrder> parentMap = Map.of(parent.getId(), parent);
        List<MedicineOrderItemDetail> details = orderItemRepository.findByOrderId(parentId)
                .stream()
                .map(item -> convertToDetailDto(item, parentMap))
                .collect(Collectors.toList());
        resp.setItems(details);

        return resp;
    }

    /**
     * Convert a MedicineOrderItem to the detail DTO.
     * Parent order info is taken from the pre-loaded map to avoid extra DB calls.
     */
    private MedicineOrderItemDetail convertToDetailDto(MedicineOrderItem item,
                                                        Map<UUID, MedicineOrder> parentMap) {
        MedicineOrderItemDetail detail = new MedicineOrderItemDetail();
        detail.setId(item.getId());
        detail.setOrderId(item.getOrderId());
        detail.setPharmacyId(item.getPharmacyId());
        detail.setMedicineId(item.getMedicineId());
        detail.setQuantity(item.getQuantity());
        detail.setPrice(item.getPrice());
        detail.setStatus(item.getStatus());
        detail.setDeliveryEstimate(item.getDeliveryEstimate());

        // Enrich with parent order fields
        MedicineOrder parent = parentMap.get(item.getOrderId());
        if (parent != null) {
            detail.setPaymentMethod(parent.getPaymentMethod());
            detail.setPaymentStatus(parent.getPaymentStatus());
            detail.setOrderDate(parent.getCreatedAt());
            detail.setDeliveryAddress(parent.getDeliveryAddress());
            detail.setUserLatitude(parent.getUserLatitude());
            detail.setUserLongitude(parent.getUserLongitude());
        }

        // Resolve pharmacy info
        Pharmacy pharmacy = pharmacyRepository.findById(item.getPharmacyId()).orElse(null);
        if (pharmacy != null) {
            detail.setPharmacyName(pharmacy.getName());
            detail.setPharmacyAddress(pharmacy.getAddress());
            detail.setPharmacyLatitude(pharmacy.getLatitude());
            detail.setPharmacyLongitude(pharmacy.getLongitude());
        } else {
            detail.setPharmacyName("Unknown Pharmacy");
        }

        // Resolve medicine name and attach usage details
        Medicine medicine = medicineRepository.findById(item.getMedicineId()).orElse(null);
        String medName = medicine != null ? medicine.getName() : "Unknown Medicine";
        detail.setMedicineName(medName);

        MedicineDetails info = getMedicineDetails(medName);
        detail.setExplanation(info.explanation);
        detail.setInstructions(info.instructions);
        detail.setSideEffects(info.sideEffects);

        return detail;
    }

    /** Returns a human-friendly delivery window based on distance from pharmacy. */
    private String deliveryEstimate(double distKm) {
        if (distKm <= 3.0)  return "30-45 mins";
        if (distKm <= 8.0)  return "1-1.5 hours";
        if (distKm <= 15.0) return "2-3 hours";
        return "Same day (within 6 hours)";
    }

    /** Haversine formula — great-circle distance in kilometres. */
    private double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Medicine info catalogue ───────────────────────────────────────────────

    private static class MedicineDetails {
        final String explanation;
        final String instructions;
        final String sideEffects;

        MedicineDetails(String explanation, String instructions, String sideEffects) {
            this.explanation = explanation;
            this.instructions = instructions;
            this.sideEffects = sideEffects;
        }
    }

    /**
     * Returns patient-friendly explanation, dosage instructions, and side-effect
     * information for common medicines. Falls back to generic text for unknown names.
     */
    private MedicineDetails getMedicineDetails(String name) {
        if (name == null) {
            return new MedicineDetails(
                    "General medication",
                    "Use as directed by physician",
                    "Consult doctor");
        }

        String lower = name.toLowerCase();

        if (lower.contains("paracetamol") || lower.contains("crocin") || lower.contains("calpol")) {
            return new MedicineDetails(
                    "Common analgesic (pain reliever) and antipyretic (fever reducer).",
                    "Take 1 tablet after meals as needed. Max 4 tablets per day, at least 4-6 hours apart.",
                    "Mild skin rash, liver damage if overdosed.");
        }
        if (lower.contains("cetirizine") || lower.contains("alerid") || lower.contains("okacet")) {
            return new MedicineDetails(
                    "Antihistamine used to relieve allergy symptoms like runny nose and sneezing.",
                    "Take 1 tablet once a day, preferably at bedtime as it may cause drowsiness.",
                    "Dry mouth, sleepiness, fatigue, headache.");
        }
        if (lower.contains("amoxicillin") || lower.contains("mox")) {
            return new MedicineDetails(
                    "Penicillin antibiotic used to treat bacterial infections of ears, throat, and lungs.",
                    "Take 1 capsule three times daily for the full prescribed duration. Do not skip doses.",
                    "Nausea, diarrhea, stomach upset, allergic reactions.");
        }
        if (lower.contains("ibuprofen") || lower.contains("combiflam")) {
            return new MedicineDetails(
                    "NSAID for pain relief and reducing inflammation.",
                    "Take 1 tablet with food or milk to prevent stomach irritation. Max 3 times a day.",
                    "Acid reflux, stomach pain, dizziness, mild nausea.");
        }
        if (lower.contains("metformin") || lower.contains("glycomet")) {
            return new MedicineDetails(
                    "Oral diabetes medicine that helps control blood sugar levels for Type 2 diabetes.",
                    "Take 1 tablet twice daily with breakfast and dinner.",
                    "Loss of appetite, diarrhea, metallic taste, nausea.");
        }

        return new MedicineDetails(
                "General therapeutic formulation.",
                "Consume as advised by your healthcare practitioner.",
                "May cause mild stomach upset or drowsiness. Consult doctor if symptoms persist.");
    }
}
