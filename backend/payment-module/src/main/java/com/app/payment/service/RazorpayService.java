package com.app.payment.service;

import com.app.payment.config.RazorpayProperties;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Refund;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class RazorpayService {

    private final RazorpayProperties properties;

    public RazorpayService(RazorpayProperties properties) {
        this.properties = properties;
    }

    public boolean isLiveMode() {
        return properties.isEnabled()
                && properties.getKeyId() != null && !properties.getKeyId().isBlank()
                && properties.getKeySecret() != null && !properties.getKeySecret().isBlank();
    }

    public String getKeyId() {
        return properties.getKeyId();
    }

    public Order createOrder(BigDecimal amount, UUID appointmentId) throws RazorpayException {
        RazorpayClient client = new RazorpayClient(properties.getKeyId(), properties.getKeySecret());
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", toPaise(amount));
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "apt_" + appointmentId.toString().substring(0, 8));
        return client.orders.create(orderRequest);
    }

    public boolean verifySignature(String orderId, String paymentId, String signature) {
        try {
            JSONObject options = new JSONObject();
            options.put("razorpay_order_id", orderId);
            options.put("razorpay_payment_id", paymentId);
            options.put("razorpay_signature", signature);
            return Utils.verifyPaymentSignature(options, properties.getKeySecret());
        } catch (Exception e) {
            return false;
        }
    }

    public Refund initiateRefund(String razorpayPaymentId, BigDecimal amount) throws RazorpayException {
        RazorpayClient client = new RazorpayClient(properties.getKeyId(), properties.getKeySecret());
        JSONObject refundRequest = new JSONObject();
        refundRequest.put("amount", toPaise(amount));
        return client.payments.refund(razorpayPaymentId, refundRequest);
    }

    public String createMockOrderId() {
        return "order_mock_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
    }

    public String createMockPaymentId() {
        return "pay_mock_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
    }

    public long toPaise(BigDecimal amount) {
        return amount.multiply(BigDecimal.valueOf(100)).longValue();
    }
}
