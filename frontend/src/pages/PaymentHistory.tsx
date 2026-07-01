import React, { useEffect, useState } from 'react';
import {
  getInvoice,
  requestRefund,
  type PaymentRecord,
  type InvoiceData,
} from '../services/payment';
import InvoiceModal from '../components/InvoiceModal';
import api from '../services/api';
import { ShoppingBag, Stethoscope, AlertCircle } from 'lucide-react';

interface MedicineOrder {
  id: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  deliveryAddress: string;
  createdAt: string;
  items: { medicineName?: string; quantity: number; price: number }[];
}

type CombinedEntry =
  | { type: 'consultation'; data: PaymentRecord }
  | { type: 'medicine'; data: MedicineOrder };

const PaymentHistory: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [medicineOrders, setMedicineOrders] = useState<MedicineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'consultations' | 'medicines'>('all');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const [paymentsRes, ordersRes] = await Promise.allSettled([
        api.get(`/payments/patient/${userId}`),
        api.get(`/medicine-orders/patient/${userId}`),
      ]);
      if (paymentsRes.status === 'fulfilled') {
        setPayments(paymentsRes.value.data || []);
      }
      if (ordersRes.status === 'fulfilled') {
        // medicine-orders uses ApiResponse wrapper: { success, data: [...] }
        const body = ordersRes.value.data;
        setMedicineOrders(body?.data || body || []);
      }
    } catch (err) {
      setError('Failed to load payment history.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (paymentId: string) => {
    try {
      const data = await getInvoice(paymentId);
      setInvoice(data);
    } catch {
      alert('Invoice not available for this payment.');
    }
  };

  const handleRefund = async (paymentId: string) => {
    if (!confirm('Request a refund for this consultation? The appointment will be cancelled.')) return;
    try {
      setRefundingId(paymentId);
      await requestRefund(paymentId);
      await fetchAll();
    } catch {
      alert('Refund request failed. Please try again.');
    } finally {
      setRefundingId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID': case 'PAYMENT_SUCCESS': return 'bg-green-100 text-green-700 border-green-200';
      case 'TO_BE_PAID': case 'ORDER_CREATED': case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'FAILED': return 'bg-red-100 text-red-700 border-red-200';
      case 'REFUNDED': case 'REFUND_INITIATED': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPaymentStatusLabel = (order: MedicineOrder) => {
    if (order.paymentStatus === 'PAID') return 'Paid';
    if (order.paymentStatus === 'TO_BE_PAID') return 'Pay on Delivery';
    if (order.paymentStatus === 'FAILED') return 'Payment Failed';
    return order.paymentStatus;
  };

  // Combine and sort all entries by date descending
  const allEntries: CombinedEntry[] = [
    ...payments.map(p => ({ type: 'consultation' as const, data: p })),
    ...medicineOrders.map(o => ({ type: 'medicine' as const, data: o })),
  ].sort((a, b) => {
    const dateA = a.type === 'consultation' ? a.data.createdAt : a.data.createdAt;
    const dateB = b.type === 'consultation' ? b.data.createdAt : b.data.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const filteredEntries = allEntries.filter(e => {
    if (activeTab === 'consultations') return e.type === 'consultation';
    if (activeTab === 'medicines') return e.type === 'medicine';
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Payment History</h1>
          <p className="text-gray-500 mt-1">All consultation and medicine order payments.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit">
          {(['all', 'consultations', 'medicines'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab === 'all' ? `All (${allEntries.length})` : tab === 'consultations' ? `Consultations (${payments.length})` : `Medicine Orders (${medicineOrders.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            <AlertCircle className="h-5 w-5 shrink-0" /> {error}
          </div>
        ) : filteredEntries.length > 0 ? (
          <div className="grid gap-5">
            {filteredEntries.map(entry => {
              if (entry.type === 'consultation') {
                const payment = entry.data;
                return (
                  <div key={`consult-${payment.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            <Stethoscope className="h-3 w-3" /> Consultation
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Dr. {payment.doctorName}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(payment.appointmentDate).toLocaleDateString('en-IN')} · {payment.timeSlot}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">₹{payment.amount}</p>
                        {payment.invoiceNumber && (
                          <p className="text-xs text-gray-400 mt-1">{payment.invoiceNumber}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(payment.paymentStatus)}`}>
                          {payment.paymentStatus}
                        </span>
                        {payment.method && (
                          <span className="text-xs text-gray-500 capitalize">via {payment.method}</span>
                        )}
                        <div className="flex gap-3 mt-2">
                          {payment.paymentStatus === 'PAID' && (
                            <>
                              <button onClick={() => handleViewInvoice(payment.id)} className="text-indigo-600 font-bold text-sm hover:underline">
                                Invoice
                              </button>
                              {payment.refundStatus === 'NONE' && (
                                <button
                                  onClick={() => handleRefund(payment.id)}
                                  disabled={refundingId === payment.id}
                                  className="text-red-600 font-bold text-sm hover:underline disabled:opacity-50"
                                >
                                  {refundingId === payment.id ? 'Processing...' : 'Request Refund'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                const order = entry.data;
                return (
                  <div key={`med-${order.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <ShoppingBag className="h-3 w-3" /> Medicine Order
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        <p className="text-sm text-gray-400 mt-0.5">📍 {order.deliveryAddress}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">₹{Number(order.totalAmount).toFixed(2)}</p>
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(order.paymentStatus)}`}>
                          {getPaymentStatusLabel(order)}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">
                          via {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online / UPI'}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          order.status === 'DELIVERED' ? 'bg-green-50 text-green-700 border-green-200' :
                          order.status === 'PAID' || order.status === 'PROCESSING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          Order: {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="text-6xl mb-4">💳</div>
            <h3 className="text-xl font-bold text-gray-900">No payments yet</h3>
            <p className="text-gray-500 mt-2">
              {activeTab === 'medicines'
                ? 'No medicine orders found. Order medicines from Pharmacy Finder.'
                : activeTab === 'consultations'
                ? 'No consultation payments found. Book a consultation to get started.'
                : 'No payments found yet.'}
            </p>
          </div>
        )}
      </div>

      {invoice && <InvoiceModal invoice={invoice} onClose={() => setInvoice(null)} />}
    </div>
  );
};

export default PaymentHistory;
