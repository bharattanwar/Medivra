import React from 'react';
import type { InvoiceData } from '../services/payment';

interface InvoiceModalProps {
  invoice: InvoiceData;
  onClose: () => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, onClose }) => {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-8 space-y-6" id="invoice-content">
          <div className="text-center border-b pb-6">
            <h2 className="text-2xl font-bold text-gray-900">Medivra</h2>
            <p className="text-sm text-gray-500">Tax Invoice / Receipt</p>
            <p className="text-lg font-bold text-blue-600 mt-2">{invoice.invoiceNumber}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Patient</p>
              <p className="font-semibold">{invoice.patientName}</p>
              <p className="text-gray-600">{invoice.patientEmail}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Date</p>
              <p className="font-semibold">
                {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Doctor</span>
              <span className="font-medium">Dr. {invoice.doctorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Specialization</span>
              <span>{invoice.specialization}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Appointment</span>
              <span>
                {new Date(invoice.appointmentDate).toLocaleDateString('en-IN')} · {invoice.timeSlot}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment ID</span>
              <span className="font-mono text-xs">{invoice.paymentIdExternal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Method</span>
              <span className="capitalize">{invoice.method}</span>
            </div>
          </div>

          <div className="flex justify-between items-center border-t pt-4">
            <span className="text-lg font-bold">Total Paid</span>
            <span className="text-2xl font-bold text-green-600">₹{invoice.amount}</span>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700"
          >
            Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-3 rounded-xl font-bold hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
