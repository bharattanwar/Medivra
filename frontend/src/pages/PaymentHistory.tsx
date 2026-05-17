import React, { useEffect, useState } from 'react';
import {
  getPaymentHistory,
  getInvoice,
  requestRefund,
  type PaymentRecord,
  type InvoiceData,
} from '../services/payment';
import InvoiceModal from '../components/InvoiceModal';

const PaymentHistory: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      const data = await getPaymentHistory(userId);
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
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
    if (!confirm('Request a refund for this consultation? The appointment will be cancelled.')) {
      return;
    }
    try {
      setRefundingId(paymentId);
      await requestRefund(paymentId);
      await fetchPayments();
    } catch {
      alert('Refund request failed. Please try again.');
    } finally {
      setRefundingId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'ORDER_CREATED':
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'FAILED':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'REFUNDED':
      case 'REFUND_INITIATED':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRefundStyle = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return 'text-green-600';
      case 'PENDING':
        return 'text-yellow-600';
      case 'FAILED':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900">Payment History</h1>
          <p className="text-gray-500 mt-1">All consultation payments, invoices, and refunds.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600" />
          </div>
        ) : payments.length > 0 ? (
          <div className="grid gap-6">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Dr. {payment.doctorName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(payment.appointmentDate).toLocaleDateString('en-IN')} ·{' '}
                      {payment.timeSlot}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">₹{payment.amount}</p>
                    {payment.invoiceNumber && (
                      <p className="text-xs text-gray-400 mt-1">{payment.invoiceNumber}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(payment.paymentStatus)}`}
                    >
                      {payment.paymentStatus}
                    </span>
                    <span className={`text-xs font-medium ${getRefundStyle(payment.refundStatus)}`}>
                      Refund: {payment.refundStatus}
                    </span>
                    {payment.method && (
                      <span className="text-xs text-gray-500 capitalize">
                        via {payment.method}
                      </span>
                    )}
                    <div className="flex gap-3 mt-2">
                      {payment.paymentStatus === 'PAID' && (
                        <>
                          <button
                            onClick={() => handleViewInvoice(payment.id)}
                            className="text-blue-600 font-bold text-sm hover:underline"
                          >
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
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="text-6xl mb-4">💳</div>
            <h3 className="text-xl font-bold text-gray-900">No payments yet</h3>
            <p className="text-gray-500 mt-2">Payments appear here after you book a consultation.</p>
          </div>
        )}
      </div>

      {invoice && <InvoiceModal invoice={invoice} onClose={() => setInvoice(null)} />}
    </div>
  );
};

export default PaymentHistory;
