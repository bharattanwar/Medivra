import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Truck, Calendar, Clock, Trash2, AlertCircle, Info,
  RefreshCw, MapPin, Sparkles, X
} from 'lucide-react';
import api from '../services/api';

interface OrderItemDetail {
  id: string;
  orderId: string;
  pharmacyId: string;
  pharmacyName: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  price: number;
  status: string;
  deliveryEstimate: string;
  explanation: string;
  instructions: string;
  sideEffects: string;
}

interface MedicineOrder {
  id: string;
  patientId: string;
  prescriptionId?: string;
  status: string;
  totalAmount: number;
  userLatitude: number;
  userLongitude: number;
  deliveryAddress: string;
  createdAt: string;
  items: OrderItemDetail[];
}

interface RefillReminder {
  id: string;
  patientId: string;
  medicineName: string;
  nextRefillDate: string;
  active: boolean;
}

const OrderTracking: React.FC = () => {
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [reminders, setReminders] = useState<RefillReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);

  // Reminder Modal States
  const [reminderMed, setReminderMed] = useState<string | null>(null);
  const [reminderDays, setReminderDays] = useState(30);
  const [reminderSaving, setReminderSaving] = useState(false);

  const patientId = localStorage.getItem('userId');

  const fetchOrdersAndReminders = useCallback(async () => {
    if (!patientId) return;
    try {
      setLoading(true);
      setError('');
      const ordersRes = await api.get(`/medicine-orders/patient/${patientId}`);
      if (ordersRes.data.success) {
        setOrders(ordersRes.data.data);
      }
      const remindersRes = await api.get(`/medicine-orders/reminders/patient/${patientId}`);
      if (remindersRes.data.success) {
        setReminders(remindersRes.data.data);
      }
    } catch {
      setError('Failed to fetch medicine orders or reminders.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchOrdersAndReminders();
  }, [fetchOrdersAndReminders]);

  const handleDeactivateReminder = async (id: string) => {
    try {
      const res = await api.delete(`/medicine-orders/reminders/${id}`);
      if (res.data.success) {
        setReminders(prev => prev.filter(r => r.id !== id));
      }
    } catch {
      alert('Failed to cancel refill reminder.');
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !reminderMed) return;
    try {
      setReminderSaving(true);
      const res = await api.post(`/medicine-orders/reminders?patientId=${patientId}&medicineName=${encodeURIComponent(reminderMed)}&daysInterval=${reminderDays}`);
      if (res.data.success) {
        setReminderMed(null);
        setReminderDays(30);
        // Refresh reminders
        const remindersRes = await api.get(`/medicine-orders/reminders/patient/${patientId}`);
        if (remindersRes.data.success) {
          setReminders(remindersRes.data.data);
        }
      }
    } catch {
      alert('Failed to set refill reminder.');
    } finally {
      setReminderSaving(false);
    }
  };

  // Helper to determine status progress step (0 to 3)
  const getStatusStep = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING': return 0;
      case 'PREPARING': return 1;
      case 'SHIPPED': return 2;
      case 'DELIVERED': return 3;
      default: return 0;
    }
  };

  const statusSteps = ['Placed', 'Preparing', 'Out for Delivery', 'Delivered'];

  const getParentStatusClass = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-purple-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-sm font-semibold w-max mb-4">
            <Truck className="h-4 w-4 animate-bounce" /> Medicine Tracking System
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Track Your Medicine Orders</h1>
          <p className="text-indigo-200 text-base max-w-xl mt-2">
            Monitor real-time fulfillment timelines, view medicine safety info, and manage automatic refill schedules.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMN 1: Orders list */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" /> Order History
              </h2>
              <button
                onClick={fetchOrdersAndReminders}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                title="Refresh Page"
              >
                <RefreshCw className="h-4 w-4 text-slate-600" />
              </button>
            </div>

            {loading && orders.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm font-medium">Fetching orders and reminders…</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                <Package className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No Orders Found</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  You have not ordered any medicines yet. Use the Pharmacy Finder to place your first checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
                      selectedOrder?.id === order.id ? 'border-indigo-500 ring-2 ring-indigo-50/50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                            ORDER ID: {order.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getParentStatusClass(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> Order Placed:{' '}
                          {new Date(order.createdAt).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-right sm:text-right shrink-0">
                        <p className="text-xs text-slate-400">Checkout Price</p>
                        <p className="text-lg font-bold text-slate-900">₹{Number(order.totalAmount).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Delivery Location: <strong className="text-slate-700">{order.deliveryAddress}</strong></span>
                    </div>

                    {/* Toggle Button */}
                    <div className="mt-4 pt-3 flex justify-between items-center border-t border-slate-50">
                      <p className="text-xs text-slate-400">
                        Contains <span className="font-semibold text-slate-700">{order.items.length}</span> medicine item(s)
                      </p>
                      <button
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {selectedOrder?.id === order.id ? 'Hide Details' : 'Track Order / Details'}
                      </button>
                    </div>

                    {/* Collapsible details & tracking */}
                    {selectedOrder?.id === order.id && (
                      <div className="mt-5 space-y-6 pt-5 border-t border-slate-100 animate-fade-in">
                        {order.items.map(item => {
                          const currentStep = getStatusStep(item.status);
                          return (
                            <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                              
                              {/* Header per Pharmacy Group */}
                              <div className="flex justify-between items-start gap-2 mb-4">
                                <div>
                                  <h4 className="font-bold text-slate-800 text-sm">{item.medicineName}</h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Fulfill Pharmacy: <strong className="text-slate-700">{item.pharmacyName}</strong>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    Est: {item.deliveryEstimate}
                                  </span>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {item.quantity} Unit(s) · ₹{Number(item.price * item.quantity).toFixed(2)}
                                  </p>
                                </div>
                              </div>

                              {/* Timeline Tracker */}
                              <div className="my-6">
                                <div className="relative flex justify-between items-center w-full">
                                  {/* Line Background */}
                                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0 rounded-full" />
                                  {/* Progress Line */}
                                  <div
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 z-0 transition-all duration-500 rounded-full"
                                    style={{ width: `${(currentStep / 3) * 100}%` }}
                                  />

                                  {statusSteps.map((step, idx) => {
                                    const isDone = currentStep >= idx;
                                    const isCurrent = currentStep === idx;
                                    return (
                                      <div key={step} className="flex flex-col items-center z-10">
                                        <div
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300 ${
                                            isDone
                                              ? 'bg-green-500 border-green-600 text-white scale-110'
                                              : 'bg-white border-slate-300 text-slate-400'
                                          } ${isCurrent ? 'ring-4 ring-green-100' : ''}`}
                                        >
                                          {isDone ? '✓' : idx + 1}
                                        </div>
                                        <span className={`text-[10px] font-bold mt-2 ${
                                          isDone ? 'text-slate-800' : 'text-slate-400'
                                        } ${isCurrent ? 'text-green-600 font-extrabold' : ''}`}>
                                          {step}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Medicine Details Accordion */}
                              <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-2 mt-4">
                                <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
                                  <Info className="h-3 w-3 text-indigo-500" /> Patient Medical Guidelines
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                                  <div>
                                    <strong className="text-slate-700 block mb-0.5">Explanation:</strong>
                                    <span className="text-slate-600 leading-relaxed">{item.explanation}</span>
                                  </div>
                                  <div>
                                    <strong className="text-slate-700 block mb-0.5">Instructions:</strong>
                                    <span className="text-slate-600 leading-relaxed">{item.instructions}</span>
                                  </div>
                                  <div>
                                    <strong className="text-red-700 block mb-0.5">Side Effects:</strong>
                                    <span className="text-slate-600 leading-relaxed">{item.sideEffects}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Reminders */}
                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setReminderMed(item.medicineName)}
                                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-100 hover:bg-indigo-50/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Clock className="h-3.5 w-3.5" /> Setup Refill Reminder
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLUMN 2: Refill Reminders and Setup */}
          <div className="space-y-6">
            
            {/* Active Refill Reminders */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600" /> Refill Reminders
              </h3>
              <p className="text-xs text-slate-400">
                Automatic reminder alerts for chronic or long-term medication programs.
              </p>

              {reminders.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                  <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">No active refill reminders</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reminders.map(reminder => (
                    <div key={reminder.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{reminder.medicineName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Next Refill:{' '}
                          <span className="font-bold text-indigo-600">{new Date(reminder.nextRefillDate).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeactivateReminder(reminder.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Cancel Reminder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simulated Medicine Safety Tip banner */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-600 animate-pulse" />
                <h4 className="font-bold text-orange-800 text-sm">Medivra Healthcare Tip</h4>
              </div>
              <p className="text-xs text-orange-700 leading-relaxed">
                Always ensure you check the expiry dates of items delivered. For long-term drugs like Metformin, setting up reminders prevents missed doses. Talk to our doctors if side effects persist.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Reminder Scheduling Modal */}
      {reminderMed && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600 animate-spin" /> Schedule Refill
              </h3>
              <button onClick={() => setReminderMed(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateReminder} className="space-y-4">
              <p className="text-xs text-slate-500">
                Configure when you will need a refill reminder for <strong className="text-slate-800">{reminderMed}</strong>.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">Select Frequency (Days)</label>
                <select
                  value={reminderDays}
                  onChange={e => setReminderDays(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 bg-white"
                >
                  <option value={7}>Weekly (7 days)</option>
                  <option value={15}>Half-month (15 days)</option>
                  <option value={30}>Monthly (30 days)</option>
                  <option value={60}>Bi-monthly (60 days)</option>
                  <option value={90}>Quarterly (90 days)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReminderMed(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reminderSaving}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {reminderSaving ? 'Saving…' : 'Schedule Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrderTracking;
