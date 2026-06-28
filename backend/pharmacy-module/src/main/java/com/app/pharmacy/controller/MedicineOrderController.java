package com.app.pharmacy.controller;

import com.app.common.dto.ApiResponse;
import com.app.pharmacy.dto.CheckoutRequest;
import com.app.pharmacy.dto.MedicineOrderResponse;
import com.app.pharmacy.dto.MedicineOrderResponse.MedicineOrderItemDetail;
import com.app.pharmacy.dto.VerifyOrderPaymentRequest;
import com.app.pharmacy.entity.RefillReminder;
import com.app.pharmacy.service.MedicineOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/medicine-orders")
public class MedicineOrderController {

    private final MedicineOrderService orderService;

    public MedicineOrderController(MedicineOrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<MedicineOrderResponse>> checkout(@RequestBody CheckoutRequest request) {
        MedicineOrderResponse response = orderService.checkout(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Order placed successfully"));
    }

    @PostMapping("/verify-payment")
    public ResponseEntity<ApiResponse<MedicineOrderResponse>> verifyPayment(@RequestBody VerifyOrderPaymentRequest request) {
        MedicineOrderResponse response = orderService.verifyPayment(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Payment verified successfully"));
    }

    @PutMapping("/{orderId}/confirm-payment")
    public ResponseEntity<ApiResponse<MedicineOrderResponse>> confirmPayment(@PathVariable UUID orderId) {
        MedicineOrderResponse response = orderService.confirmPayment(orderId);
        return ResponseEntity.ok(ApiResponse.success(response, "Payment confirmed successfully"));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<MedicineOrderResponse>>> getPatientOrders(@PathVariable UUID patientId) {
        List<MedicineOrderResponse> response = orderService.getPatientOrders(patientId);
        return ResponseEntity.ok(ApiResponse.success(response, "Orders retrieved successfully"));
    }

    @GetMapping("/pharmacy")
    public ResponseEntity<ApiResponse<List<MedicineOrderItemDetail>>> getPharmacyOrders(Authentication authentication) {
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        List<MedicineOrderItemDetail> response = orderService.getPharmacyOrders(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(response, "Pharmacy orders retrieved successfully"));
    }

    @PutMapping("/items/{itemId}/status")
    public ResponseEntity<ApiResponse<MedicineOrderItemDetail>> updateItemStatus(
            @PathVariable UUID itemId,
            @RequestParam String status) {
        MedicineOrderItemDetail response = orderService.updateItemStatus(itemId, status);
        return ResponseEntity.ok(ApiResponse.success(response, "Order status updated successfully"));
    }

    @PostMapping("/reminders")
    public ResponseEntity<ApiResponse<RefillReminder>> scheduleReminder(
            @RequestParam UUID patientId,
            @RequestParam String medicineName,
            @RequestParam int daysInterval) {
        RefillReminder response = orderService.scheduleReminder(patientId, medicineName, daysInterval);
        return ResponseEntity.ok(ApiResponse.success(response, "Refill reminder scheduled successfully"));
    }

    @GetMapping("/reminders/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<RefillReminder>>> getPatientReminders(@PathVariable UUID patientId) {
        List<RefillReminder> response = orderService.getPatientActiveReminders(patientId);
        return ResponseEntity.ok(ApiResponse.success(response, "Reminders retrieved successfully"));
    }

    @DeleteMapping("/reminders/{reminderId}")
    public ResponseEntity<ApiResponse<Void>> deleteReminder(@PathVariable UUID reminderId) {
        orderService.deactivateReminder(reminderId);
        return ResponseEntity.ok(ApiResponse.success(null, "Reminder cancelled successfully"));
    }
}
