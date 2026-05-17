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

export const createPaymentOrder = async (
  appointmentId: string,
  patientId: string
): Promise<CreateOrderResponse> => {
  const response = await api.post('/payments/create-order', {
    appointmentId,
    patientId,
  });
  return response.data;
};

export const verifyPayment = async (payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  appointmentId: string;
  method?: string;
}) => {
  const response = await api.post('/payments/verify', payload);
  return response.data;
};

export const getPaymentHistory = async (
  patientId: string
): Promise<PaymentRecord[]> => {
  const response = await api.get(`/payments/patient/${patientId}`);
  return response.data;
};

export const getInvoice = async (paymentId: string): Promise<InvoiceData> => {
  const response = await api.get(`/payments/${paymentId}/invoice`);
  return response.data;
};

export const requestRefund = async (paymentId: string) => {
  const response = await api.post(`/payments/${paymentId}/refund`);
  return response.data;
};
