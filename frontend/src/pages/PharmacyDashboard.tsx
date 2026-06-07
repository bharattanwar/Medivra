import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Trash2, Edit3, Check, X, Search,
  Building2, MapPin, Phone, RefreshCw, AlertCircle, Loader2,
  FileText, Download, CheckSquare
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

const PharmacyDashboard: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<PharmacyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      // If endpoint doesn't exist, we fallback
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch {
      // Fallback details
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

  useEffect(() => {
    fetchProfile();
    fetchInventory();
  }, [fetchProfile, fetchInventory]);

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
            h1 { margin-bottom: 5px; color: #312e81; font-size: 26px; }
            p { margin-top: 0; color: #64748b; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 13px; }
            th { background-color: #f1f5f9; color: #475569; font-weight: bold; }
            .text-right { text-align: right; }
            .total { margin-top: 35px; text-align: right; font-size: 16px; font-weight: bold; color: #4f46e5; border-top: 2px solid #e2e8f0; padding-top: 15px; }
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

  const filteredInventory = inventory.filter(item =>
    item.medicineName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = inventory.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white">
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
                <div className="flex flex-wrap gap-4 mt-2 text-indigo-200 text-sm">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {profile.address}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> {profile.phoneNumber}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-4 text-center min-w-[110px]">
                <p className="text-2xl font-bold">{inventory.length}</p>
                <p className="text-indigo-200 text-xs mt-0.5">Medicines</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-4 text-center min-w-[110px]">
                <p className="text-2xl font-bold">₹{totalValue.toFixed(0)}</p>
                <p className="text-indigo-200 text-xs mt-0.5">Stock Value</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Export Buttons */}
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
              <FileText className="h-4 w-4 text-indigo-600" /> Print PDF
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
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            
            <button
              id="add-medicine-btn"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-md shadow-indigo-100 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Medicine
            </button>
          </div>
        </div>

        {/* Add Medicine Panel */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" /> Add Inventory Item
              </h3>
              <button onClick={() => { setShowAdd(false); setAddError(''); }} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {addError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-2.5 rounded-xl border border-red-100">
                  {addError}
                </div>
              )}
              {/* Medicine search */}
              <div className="relative space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Medicine Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  {suggestionLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 animate-spin" />
                  )}
                  <input
                    type="text"
                    value={medicineQuery}
                    onChange={e => {
                      setMedicineQuery(e.target.value);
                      setAddForm(prev => ({ ...prev, medicineName: e.target.value }));
                      setSelectedMedicineId(null);
                    }}
                    placeholder="Search existing medicines or type a new name…"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                {medicineSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {medicineSuggestions.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMedicineId(m.id);
                          setMedicineQuery(m.name);
                          setAddForm(prev => ({
                            ...prev,
                            medicineName: m.name,
                            strength: m.strength || '',
                          }));
                          setMedicineSuggestions([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 transition-colors"
                      >
                        <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.strength && `Strength: ${m.strength}`}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Strength / Dosage</label>
                  <input
                    type="text"
                    value={addForm.strength}
                    onChange={e => setAddForm(prev => ({ ...prev, strength: e.target.value }))}
                    placeholder="e.g. 500mg"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Quantity (units) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={addForm.quantity}
                    onChange={e => setAddForm(prev => ({ ...prev, quantity: e.target.value }))}
                    placeholder="100"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Price per unit (₹) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addForm.price}
                    onChange={e => setAddForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="25.00"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError(''); }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !medicineQuery}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {addLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : <><Check className="h-4 w-4" /> Add to Inventory</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Inventory Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-500" /> Inventory
              <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full ml-1">
                {filteredInventory.length}
              </span>
            </h2>
            {bulkEditMode && (
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSave}
                  disabled={bulkLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save All Changes
                </button>
                <button
                  onClick={() => setBulkEditMode(false)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              <p className="text-slate-400 text-sm">Loading inventory…</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-20">
              <Package className="h-14 w-14 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No medicines yet</h3>
              <p className="text-slate-400 text-sm mb-6">Add your first inventory item to get started.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Medicine
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Medicine</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Strength</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Quantity</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Price/Unit</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Stock Value</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900 text-sm">{item.medicineName}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.strength || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {bulkEditMode ? (
                          <input
                            type="number"
                            value={bulkForm[item.id]?.quantity || ''}
                            onChange={e => handleBulkChange(item.id, 'quantity', e.target.value)}
                            className="w-20 text-right px-2 py-1 rounded-lg border border-indigo-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            min={0}
                          />
                        ) : editingId === item.id ? (
                          <input
                            type="number"
                            value={editForm.quantity}
                            onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                            className="w-20 text-right px-2 py-1 rounded-lg border border-indigo-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            min={0}
                          />
                        ) : (
                          <span className={`text-sm font-semibold ${item.quantity < 10 ? 'text-red-600' : 'text-slate-800'}`}>
                            {item.quantity}
                            {item.quantity < 10 && (
                              <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">Low</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {bulkEditMode ? (
                          <input
                            type="number"
                            value={bulkForm[item.id]?.price || ''}
                            onChange={e => handleBulkChange(item.id, 'price', e.target.value)}
                            className="w-24 text-right px-2 py-1 rounded-lg border border-indigo-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            min={0}
                            step={0.01}
                          />
                        ) : editingId === item.id ? (
                          <input
                            type="number"
                            value={editForm.price}
                            onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                            className="w-24 text-right px-2 py-1 rounded-lg border border-indigo-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            min={0}
                            step={0.01}
                          />
                        ) : (
                          <span className="text-sm text-slate-700">₹{Number(item.price).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-indigo-700">
                          {bulkEditMode ? (
                            `₹${((parseInt(bulkForm[item.id]?.quantity) || 0) * (parseFloat(bulkForm[item.id]?.price) || 0)).toFixed(2)}`
                          ) : (
                            `₹${(item.quantity * item.price).toFixed(2)}`
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {bulkEditMode ? (
                            <span className="text-xs text-slate-400 font-semibold italic">Bulk Editing</span>
                          ) : editingId === item.id ? (
                            <>
                              <button
                                onClick={() => handleEditSave(item.id)}
                                disabled={editLoading}
                                className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-60 cursor-pointer"
                                title="Save"
                              >
                                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(item)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove "${item.medicineName}" from inventory?`)) handleDelete(item.id);
                                }}
                                disabled={deletingId === item.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-60 cursor-pointer"
                                title="Delete"
                              >
                                {deletingId === item.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />
                                }
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
