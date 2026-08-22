import api from './api';

export interface CreateOrderResponse {
  paymentId: string;
  orderId: string;
  keyId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  mockMode: boolean;
}

export interface PaymentRecord {
  id: string;
  appointmentId: string;
  doctorName: string;
  patientName: string;
  appointmentDate: string;
  timeSlot: string;
  appointmentStatus: string;
  amount: number;
  paymentStatus: string;
  paymentId: string | null;
  razorpayOrderId: string | null;
  method: string | null;
  refundStatus: string;
  invoiceNumber: string | null;
  createdAt: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  paymentId: string;
  appointmentId: string;
  patientName: string;
  patientEmail: string;
  doctorName: string;
  specialization: string;
  appointmentDate: string;
  timeSlot: string;
  amount: number;
  paymentStatus: string;
  paymentIdExternal: string;
  method: string;
}

export interface VerifyPaymentPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  appointmentId: string;
  method?: string;
}

/**
 * Creates a payment gateway order (Razorpay or mock) for a pending appointment.
 */
export const createPaymentOrder = async (
  appointmentId: string,
  patientId: string
): Promise<CreateOrderResponse> => {
  const response = await api.post<CreateOrderResponse>('/payments/create-order', {
    appointmentId,
    patientId,
  });
  return response.data;
};

/**
 * Validates Razorpay payment signature and confirms appointment.
 */
export const verifyPayment = async (payload: VerifyPaymentPayload): Promise<PaymentRecord> => {
  const response = await api.post<PaymentRecord>('/payments/verify', payload);
  return response.data;
};

/**
 * Retrieves appointment payment history for a patient.
 */
export const getPaymentHistory = async (patientId: string): Promise<PaymentRecord[]> => {
  const response = await api.get<PaymentRecord[]>(`/payments/patient/${patientId}`);
  return response.data;
};

/**
 * Retrieves detailed invoice information for a completed transaction.
 */
export const getInvoice = async (paymentId: string): Promise<InvoiceData> => {
  const response = await api.get<InvoiceData>(`/payments/${paymentId}/invoice`);
  return response.data;
};

/**
 * Requests a refund for a cancelled paid consultation.
 */
export const requestRefund = async (paymentId: string): Promise<PaymentRecord> => {
  const response = await api.post<PaymentRecord>(`/payments/${paymentId}/refund`);
  return response.data;
};
