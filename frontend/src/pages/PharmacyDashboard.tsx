import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Trash2, Edit3, Check, X, Search,
  Building2, MapPin, Phone, RefreshCw, AlertCircle, Loader2,
  FileText, Download, CheckSquare, ShoppingCart, Clock, ArrowRight
} from 'lucide-react';
import api from '../services/api';

interface InventoryItem {
  id: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  quantity: number;
  price: number;
}

interface PharmacyProfile {
  name: string;
  address: string;
  phoneNumber: string;
  active: boolean;
}

interface AddForm {
  medicineName: string;
  strength: string;
  quantity: string;
  price: string;
}

interface EditForm {
  quantity: string;
  price: string;
}

interface PharmacyOrderItem {
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

const PharmacyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'orders'>('inventory');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<PharmacyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Orders State
  const [orders, setOrders] = useState<PharmacyOrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');

  // Add medicine form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    medicineName: '', strength: '', quantity: '', price: ''
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Medicine autocomplete
  const [medicineQuery, setMedicineQuery] = useState('');
  const [medicineSuggestions, setMedicineSuggestions] = useState<{ id: string; name: string; strength: string }[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);

  // Single Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ quantity: '', price: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Bulk Edit Mode
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkForm, setBulkForm] = useState<Record<string, { quantity: string; price: string }>>({});
  const [bulkLoading, setBulkLoading] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/pharmacies/profile');
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch {
      setProfile({
        name: 'Apollo Pharmacy',
        address: '12 MG Road, Bengaluru, Karnataka 560001',
        phoneNumber: '+91 98765 43210',
        active: true
      });
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/pharmacies/inventory');
      if (res.data.success) {
        const mapped = res.data.data.map((item: any) => ({
          ...item,
          id: item.inventoryId
        }));
        setInventory(mapped);
      }
    } catch {
      setError('Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError('');
      const res = await api.get('/medicine-orders/pharmacy');
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch {
      setOrdersError('Failed to load incoming orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchInventory();
    fetchOrders();
  }, [fetchProfile, fetchInventory, fetchOrders]);

  // Handle Tab Switch
  const handleTabSwitch = (tab: 'inventory' | 'orders') => {
    setActiveTab(tab);
    if (tab === 'orders') {
      fetchOrders();
    } else {
      fetchInventory();
    }
  };

  // Medicine search debounce
  useEffect(() => {
    if (medicineQuery.length < 2) {
      setMedicineSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSuggestionLoading(true);
        const res = await api.get(`/medicines/search?q=${encodeURIComponent(medicineQuery)}`);
        if (res.data.success) setMedicineSuggestions(res.data.data);
      } catch {
        /* ignore */
      } finally {
        setSuggestionLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [medicineQuery]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.quantity || !addForm.price) {
      setAddError('Quantity and price are required.');
      return;
    }
    try {
      setAddLoading(true);
      setAddError('');
      await api.post('/pharmacies/inventory', {
        medicineId: selectedMedicineId || undefined,
        medicineName: selectedMedicineId ? undefined : addForm.medicineName,
        strength: addForm.strength || undefined,
        quantity: parseInt(addForm.quantity),
        price: parseFloat(addForm.price),
      });
      setAddForm({ medicineName: '', strength: '', quantity: '', price: '' });
      setMedicineQuery('');
      setSelectedMedicineId(null);
      setMedicineSuggestions([]);
      setShowAdd(false);
      await fetchInventory();
    } catch (err: any) {
      setAddError(err.response?.data?.message || 'Failed to add item.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm({ quantity: item.quantity.toString(), price: item.price.toString() });
  };

  const handleEditSave = async (itemId: string) => {
    try {
      setEditLoading(true);
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;
      await api.put(`/pharmacies/inventory/${itemId}`, {
        medicineName: item.medicineName,
        quantity: parseInt(editForm.quantity),
        price: parseFloat(editForm.price),
      });
      setEditingId(null);
      await fetchInventory();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Update failed.');
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle Bulk Edit Mode
  const toggleBulkEdit = () => {
    if (bulkEditMode) {
      setBulkEditMode(false);
    } else {
      const initialForm: Record<string, { quantity: string; price: string }> = {};
      inventory.forEach(item => {
        initialForm[item.id] = { quantity: item.quantity.toString(), price: item.price.toString() };
      });
      setBulkForm(initialForm);
      setBulkEditMode(true);
    }
  };

  // Handle input change in bulk form
  const handleBulkChange = (itemId: string, field: 'quantity' | 'price', value: string) => {
    setBulkForm(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  // Submit bulk update
  const handleBulkSave = async () => {
    try {
      setBulkLoading(true);
      const requests = Object.entries(bulkForm).map(([itemId, val]) => ({
        inventoryId: itemId,
        quantity: parseInt(val.quantity) || 0,
        price: parseFloat(val.price) || 0
      }));

      const res = await api.post('/pharmacies/inventory/bulk', requests);
      if (res.data.success) {
        setBulkEditMode(false);
        await fetchInventory();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Bulk update failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      setDeletingId(itemId);
      await api.delete(`/pharmacies/inventory/${itemId}`);
      setInventory(prev => prev.filter(i => i.id !== itemId));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Medicine Name,Strength,Quantity,Price per Unit (INR),Total Valuation (INR)\n";
    
    inventory.forEach(item => {
      const valuation = item.quantity * item.price;
      csvContent += `"${item.medicineName}","${item.strength || '—'}",${item.quantity},${item.price},${valuation}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${profile?.name?.replace(/\s+/g, '_')}_inventory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print Report
  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Medivra Inventory - ${profile?.name || 'Pharmacy'}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; }
            h1 { margin-bottom: 5px; color: #ea580c; font-size: 26px; }
            p { margin-top: 0; color: #64748b; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 13px; }
            th { background-color: #f1f5f9; color: #475569; font-weight: bold; }
            .text-right { text-align: right; }
            .total { margin-top: 35px; text-align: right; font-size: 16px; font-weight: bold; color: #ea580c; border-top: 2px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <h1>${profile?.name || 'Pharmacy Inventory Report'}</h1>
          <p>Location: ${profile?.address || 'N/A'} | Contact: ${profile?.phoneNumber || 'N/A'}</p>
          <p>Report Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Strength</th>
                <th class="text-right">Quantity (units)</th>
                <th class="text-right">Price per Unit</th>
                <th class="text-right">Valuation</th>
              </tr>
            </thead>
            <tbody>
              ${inventory.map(item => `
                <tr>
                  <td><strong>${item.medicineName}</strong></td>
                  <td>${item.strength || '—'}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">₹${Number(item.price).toFixed(2)}</td>
                  <td class="text-right">₹${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total">Grand Valuation: ₹${totalValue.toFixed(2)}</div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleUpdateStatus = async (itemId: string, status: string) => {
    try {
      const res = await api.put(`/medicine-orders/items/${itemId}/status?status=${status}`);
      if (res.data.success) {
        await fetchOrders();
      }
    } catch {
      alert('Failed to update status.');
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.medicineName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = inventory.reduce((sum, item) => sum + item.quantity * item.price, 0);

  // Status Classes
  const getItemStatusClass = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'SHIPPED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PREPARING': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Building2 className="h-6 w-6" />
                </div>
                <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                  Pharmacy Dashboard
                </span>
              </div>
              <h1 className="text-3xl font-bold">
                {profile?.name || 'My Pharmacy'}
              </h1>
              {profile && (
                <div className="flex flex-wrap gap-4 mt-2 text-orange-200 text-sm">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {profile.address}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> {profile.phoneNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex gap-3">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-4 text-center min-w-[110px]">
                <p className="text-2xl font-bold">{inventory.length}</p>
                <p className="text-orange-200 text-xs mt-0.5">Medicines</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-4 text-center min-w-[110px]">
                <p className="text-2xl font-bold">₹{totalValue.toFixed(0)}</p>
                <p className="text-orange-200 text-xs mt-0.5">Stock Value</p>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="mt-8 flex gap-2 p-1.5 bg-orange-700/30 backdrop-blur rounded-2xl w-max">
            <button
              onClick={() => handleTabSwitch('inventory')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-white text-orange-700 shadow-md'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              <Package className="h-4 w-4" /> Inventory Management
            </button>
            <button
              onClick={() => handleTabSwitch('orders')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-white text-orange-700 shadow-md'
                  : 'text-orange-100 hover:text-white'
              }`}
            >
              <ShoppingCart className="h-4 w-4" /> Order Requests
              {orders.filter(o => o.status === 'PENDING').length > 0 && (
                <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                  {orders.filter(o => o.status === 'PENDING').length}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search medicines by name…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={inventory.length === 0}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-4 w-4 text-emerald-600" /> Excel/CSV
                </button>
                <button
                  onClick={handlePrintPDF}
                  disabled={inventory.length === 0}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <FileText className="h-4 w-4 text-orange-600" /> Print PDF
                </button>
                
                <div className="h-8 w-[1px] bg-slate-200 hidden sm:block self-center mx-1" />

                <button
                  onClick={toggleBulkEdit}
                  disabled={inventory.length === 0}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    bulkEditMode
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <CheckSquare className="h-4 w-4 text-amber-600" /> {bulkEditMode ? 'Cancel Bulk' : 'Bulk Edit'}
                </button>

                <button
                  onClick={fetchInventory}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-orange-600 transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                
                <button
                  id="add-medicine-btn"
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-md shadow-orange-100 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add Medicine
                </button>
              </div>
            </div>

            {/* Add Medicine Panel */}
            {showAdd && (
              <div className="bg-white rounded-2xl border border-orange-100 shadow-lg overflow-hidden animate-scale-in">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-orange-600" /> Add Inventory Item
                  </h3>
                  <button onClick={() => { setShowAdd(false); setAddError(''); }} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                  {addError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {addError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 relative">
                      <label className="text-xs font-bold text-slate-600">Medicine Name</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={medicineQuery}
                          onChange={e => {
                            setMedicineQuery(e.target.value);
                            setAddForm(prev => ({ ...prev, medicineName: e.target.value }));
                            setSelectedMedicineId(null);
                          }}
                          placeholder="Search database (e.g. Paracetamol)…"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 outline-none"
                          required
                        />
                      </div>
                      
                      {suggestionLoading && (
                        <div className="absolute right-3 top-[38px]">
                          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                        </div>
                      )}

                      {medicineSuggestions.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                          {medicineSuggestions.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedMedicineId(m.id);
                                setAddForm(prev => ({ ...prev, medicineName: m.name, strength: m.strength || '' }));
                                setMedicineQuery(m.name);
                                setMedicineSuggestions([]);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-orange-50 border-b border-slate-100 last:border-b-0 text-sm transition-colors cursor-pointer"
                            >
                              <span className="font-semibold text-slate-800">{m.name}</span> {m.strength && `· ${m.strength}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Strength (e.g. 500mg)</label>
                      <input
                        type="text"
                        value={addForm.strength}
                        onChange={e => setAddForm(prev => ({ ...prev, strength: e.target.value }))}
                        placeholder="Strength"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        disabled={selectedMedicineId !== null}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Quantity (Units)</label>
                      <input
                        type="number"
                        min="1"
                        value={addForm.quantity}
                        onChange={e => setAddForm(prev => ({ ...prev, quantity: e.target.value }))}
                        placeholder="e.g. 100"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Price per unit (INR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={addForm.price}
                        onChange={e => setAddForm(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="e.g. 12.50"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setAddError(''); }}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addLoading}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {addLoading ? 'Saving…' : 'Save Item'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Inventory List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Inventory Stock List</h2>
                {bulkEditMode && (
                  <button
                    onClick={handleBulkSave}
                    disabled={bulkLoading}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow shadow-green-100 cursor-pointer"
                  >
                    {bulkLoading ? 'Saving…' : 'Save Bulk Changes'}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Package className="h-12 w-12 mx-auto text-slate-200 mb-2" />
                  <p className="text-sm">No items found matching your filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase">
                        <th className="px-6 py-3">Medicine Details</th>
                        <th className="px-6 py-3">Strength</th>
                        <th className="px-6 py-3 text-right">Quantity In Stock</th>
                        <th className="px-6 py-3 text-right">Price per unit</th>
                        <th className="px-6 py-3 text-right">Valuation</th>
                        <th className="px-6 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInventory.map(item => {
                        const isEditing = editingId === item.id;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-800 block">{item.medicineName}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-500">
                              {item.strength || '—'}
                            </td>

                            {/* Quantity column */}
                            <td className="px-6 py-4 text-right">
                              {bulkEditMode ? (
                                <input
                                  type="number"
                                  value={bulkForm[item.id]?.quantity || ''}
                                  onChange={e => handleBulkChange(item.id, 'quantity', e.target.value)}
                                  className="w-20 text-right px-2 py-1 rounded-lg border border-orange-350 text-sm bg-white"
                                />
                              ) : isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.quantity}
                                  onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                                  className="w-20 text-right px-2 py-1 rounded-lg border border-orange-300 text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none animate-fade-in"
                                />
                              ) : (
                                <span className={`font-semibold text-sm ${item.quantity <= 10 ? 'text-red-600 font-black' : 'text-slate-800'}`}>
                                  {item.quantity} {item.quantity <= 10 && '⚠️ Low Stock'}
                                </span>
                              )}
                            </td>

                            {/* Price column */}
                            <td className="px-6 py-4 text-right">
                              {bulkEditMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={bulkForm[item.id]?.price || ''}
                                  onChange={e => handleBulkChange(item.id, 'price', e.target.value)}
                                  className="w-24 text-right px-2 py-1 rounded-lg border border-orange-350 text-sm bg-white"
                                />
                              ) : isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editForm.price}
                                  onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                                  className="w-24 text-right px-2 py-1 rounded-lg border border-orange-300 text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none animate-fade-in"
                                />
                              ) : (
                                <span className="font-semibold text-slate-800">₹{Number(item.price).toFixed(2)}</span>
                              )}
                            </td>

                            {/* Valuation */}
                            <td className="px-6 py-4 text-right text-slate-700 font-bold">
                              ₹{(item.quantity * item.price).toFixed(2)}
                            </td>

                            {/* Actions Column */}
                            <td className="px-6 py-4 text-center">
                              {bulkEditMode ? (
                                <span className="text-xs text-slate-400 font-semibold">—</span>
                              ) : isEditing ? (
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() => handleEditSave(item.id)}
                                    disabled={editLoading}
                                    className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100"
                                    title="Save"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100"
                                    title="Cancel"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-center gap-1.5">
                                  <button
                                    onClick={() => handleEdit(item)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50/50 transition-colors cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Delete"
                                  >
                                    {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ORDER REQUESTS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-orange-600" /> Incoming Deliveries
              </h2>
              <button
                onClick={fetchOrders}
                className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-orange-600 transition-colors cursor-pointer shadow-sm"
                title="Refresh Deliveries"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {ordersLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              </div>
            ) : ordersError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{ordersError}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-300">
                <ShoppingCart className="h-14 w-14 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No Orders Assigned</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  Your pharmacy has no pending customer delivery requests right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {orders.map(orderItem => (
                  <div key={orderItem.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all">
                    
                    {/* Item header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg">
                            ORDER ITEM ID: {orderItem.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${getItemStatusClass(orderItem.status)}`}>
                            {orderItem.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1.5">
                          Delivery Route Time Limit: <strong className="text-orange-700">{orderItem.deliveryEstimate}</strong>
                        </p>
                      </div>
                      
                      {/* Price and qty */}
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-medium">Earnings</span>
                        <p className="font-extrabold text-slate-900 text-lg">₹{Number(orderItem.price * orderItem.quantity).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Content Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                      <div className="space-y-1 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                        <p className="font-bold text-slate-800 mb-1.5 uppercase tracking-wider text-[10px]">📦 Medication Detail</p>
                        <p>Medicine Name: <strong className="text-slate-900">{orderItem.medicineName}</strong></p>
                        <p>Total Quantity: <strong className="text-slate-900">{orderItem.quantity} unit(s)</strong></p>
                        <p>Unit Price: <strong className="text-slate-900">₹{Number(orderItem.price).toFixed(2)}</strong></p>
                      </div>
                      
                      {/* Update actions */}
                      <div className="flex flex-col justify-center space-y-2">
                        <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">⚙ Shipment Action</p>
                        <div className="flex gap-2">
                          {orderItem.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateStatus(orderItem.id, 'PREPARING')}
                              className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              Accept & Prepare <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {orderItem.status === 'PREPARING' && (
                            <button
                              onClick={() => handleUpdateStatus(orderItem.id, 'SHIPPED')}
                              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              Dispatch to Delivery agent <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {orderItem.status === 'SHIPPED' && (
                            <button
                              onClick={() => handleUpdateStatus(orderItem.id, 'DELIVERED')}
                              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              Mark Delivered ✓
                            </button>
                          )}
                          {orderItem.status === 'DELIVERED' && (
                            <div className="flex-1 bg-green-50 text-green-700 border border-green-200 text-center py-2.5 rounded-xl font-bold flex items-center justify-center gap-1">
                              ✓ Completed Fulfilling Order
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default PharmacyDashboard;
