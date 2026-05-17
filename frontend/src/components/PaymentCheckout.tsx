import { createPaymentOrder, verifyPayment } from '../services/payment';
import { openRazorpayCheckout } from '../services/razorpay';

interface PaymentCheckoutParams {
  appointmentId: string;
  patientId: string;
  doctorName: string;
  amount: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export const processConsultationPayment = ({
  appointmentId,
  patientId,
  doctorName,
  amount,
  onSuccess,
  onError,
}: PaymentCheckoutParams): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const order = await createPaymentOrder(appointmentId, patientId);

      if (order.mockMode) {
        await verifyPayment({
          razorpayOrderId: order.orderId,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          appointmentId,
          method: 'mock',
        });
        onSuccess();
        resolve();
        return;
      }

      await openRazorpayCheckout({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'Medivra',
        description: `Consultation with Dr. ${doctorName} (₹${amount})`,
        order_id: order.orderId,
        theme: { color: '#2563eb' },
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              appointmentId,
              method: 'razorpay',
            });
            onSuccess();
            resolve();
          } catch {
            const msg = 'Payment verification failed. Please contact support.';
            onError(msg);
            reject(new Error(msg));
          }
        },
        modal: {
          ondismiss: () => {
            const msg =
              'Payment cancelled. Your appointment is pending until paid.';
            onError(msg);
            reject(new Error(msg));
          },
        },
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : null;
      const finalMessage = message || 'Failed to initiate payment. Please try again.';
      onError(finalMessage);
      reject(new Error(finalMessage));
    }
  });
};
