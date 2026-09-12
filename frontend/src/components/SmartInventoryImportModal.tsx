import React, { useState, useRef } from 'react';
import {
  UploadCloud, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle,
  AlertCircle, Trash2, Search, X, Loader2, Sparkles, ArrowRight,
  Check, Layers
} from 'lucide-react';
import api from '../services/api';

export interface InventoryImportRow {
  rowNumber: number;
  medicineName: string;
  strength?: string;
  manufacturer?: string;
  quantity?: number;
  price?: number;
  expiryDate?: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  validationError?: string;
  selected: boolean;
}

export interface InventoryImportResponse {
  jobId: string;
  fileName: string;
  fileType: string;
  status: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  detectedMappings: Record<string, string>;
  rawHeaders?: string[];
  rows: InventoryImportRow[];
}

interface SmartInventoryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const SmartInventoryImportModal: React.FC<SmartInventoryImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [stage, setStage] = useState<'upload' | 'analyzing' | 'preview' | 'success'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Preview State
  const [importData, setImportData] = useState<InventoryImportResponse | null>(null);
  const [rows, setRows] = useState<InventoryImportRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setStage('upload');
    setSelectedFile(null);
    setErrorMsg('');
    setImportData(null);
    setRows([]);
    setSearchTerm('');
    setStatusFilter('ALL');
    setConfirmLoading(false);
    setConfirmResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    const validExtensions = ['xlsx', 'xls', 'csv', 'pdf'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!validExtensions.includes(ext)) {
      setErrorMsg('Unsupported file format. Please upload an Excel (.xlsx, .xls), CSV (.csv), or PDF (.pdf) file.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 20MB limit.');
      return;
    }

    setSelectedFile(file);
    setErrorMsg('');
    setStage('analyzing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/pharmacies/inventory/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.data) {
        const data: InventoryImportResponse = res.data.data;
        setImportData(data);
        setRows(data.rows.map(r => ({
          ...r,
          selected: r.status !== 'ERROR'
        })));
        setStage('preview');
      } else {
        throw new Error(res.data.message || 'Failed to parse file.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Error processing inventory file.');
      setStage('upload');
    }
  };

  // Row Manipulation
  const handleCellChange = (rowNumber: number, field: keyof InventoryImportRow, value: any) => {
    setRows(prevRows => prevRows.map(row => {
      if (row.rowNumber !== rowNumber) return row;
      const updated = { ...row, [field]: value };

      // Re-validate row status
      const name = updated.medicineName?.trim() || '';
      const qty = Number(updated.quantity);
      const price = Number(updated.price);

      if (!name) {
        updated.status = 'ERROR';
        updated.validationError = 'Medicine name is missing';
      } else if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
        if ((isNaN(qty) || qty <= 0) && (isNaN(price) || price <= 0)) {
          updated.status = 'ERROR';
          updated.validationError = 'Invalid quantity and price';
        } else {
          updated.status = 'WARNING';
          updated.validationError = isNaN(qty) || qty <= 0 ? 'Quantity missing/0' : 'Price missing/0';
        }
      } else {
        updated.status = 'VALID';
        updated.validationError = undefined;
      }

      return updated;
    }));
  };

  const handleRowToggle = (rowNumber: number) => {
    setRows(prevRows => prevRows.map(row => {
      if (row.rowNumber === rowNumber) {
        return { ...row, selected: !row.selected };
      }
      return row;
    }));
  };

  const handleSelectAll = (select: boolean) => {
    setRows(prevRows => prevRows.map(row => ({
      ...row,
      selected: select ? row.status !== 'ERROR' : false
    })));
  };

  const handleDeleteRow = (rowNumber: number) => {
    setRows(prevRows => prevRows.filter(r => r.rowNumber !== rowNumber));
  };

  const handleConfirmImport = async () => {
    if (!importData) return;
    const selectedRows = rows.filter(r => r.selected && r.status !== 'ERROR');
    if (selectedRows.length === 0) {
      setErrorMsg('No valid rows selected for import.');
      return;
    }

    try {
      setConfirmLoading(true);
      setErrorMsg('');

      const res = await api.post(`/pharmacies/inventory/import/${importData.jobId}/confirm`, {
        rows: selectedRows,
        updateExisting
      });

      if (res.data.success) {
        setConfirmResult(res.data.data);
        setStage('success');
        onImportSuccess();
      } else {
        throw new Error(res.data.message || 'Import failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to complete inventory import.');
    } finally {
      setConfirmLoading(false);
    }
  };

  // Filtered Rows
  const filteredRows = rows.filter(row => {
    const matchesSearch = searchTerm === '' ||
      row.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.manufacturer && row.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      row.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const validCount = rows.filter(r => r.status === 'VALID').length;
  const warningCount = rows.filter(r => r.status === 'WARNING').length;
  const errorCount = rows.filter(r => r.status === 'ERROR').length;
  const selectedCount = rows.filter(r => r.selected && r.status !== 'ERROR').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 px-6 sm:px-8 py-5 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl">
              <Sparkles className="h-6 w-6 text-amber-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">AI Smart Inventory Import</h2>
                <span className="bg-white/25 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Excel • CSV • PDF
                </span>
              </div>
              <p className="text-orange-100 text-xs mt-0.5">
                Upload your supplier or inventory file in any format. Medivra AI automatically detects and maps columns.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-orange-200 hover:text-white hover:bg-white/15 rounded-xl transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          
          {errorMsg && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-2xl text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STAGE 1: UPLOAD */}
          {stage === 'upload' && (
            <div className="space-y-6">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                  dragActive
                    ? 'border-orange-500 bg-orange-50/70 scale-[1.01]'
                    : 'border-slate-200 hover:border-orange-400 bg-slate-50/60 hover:bg-orange-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="p-4 bg-orange-100 text-orange-600 rounded-3xl shadow-inner mb-4 animate-bounce-subtle">
                  <UploadCloud className="h-10 w-10" />
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  Drag & Drop your inventory file here, or <span className="text-orange-600 underline">Browse</span>
                </h3>
                <p className="text-slate-500 text-xs max-w-md mx-auto mb-6">
                  Supports Microsoft Excel (<strong className="text-slate-700">.xlsx, .xls</strong>), Comma-Separated Values (<strong className="text-slate-700">.csv</strong>), or Scanned Documents (<strong className="text-slate-700">.pdf</strong>) up to 20MB.
                </p>

                {/* Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel Spreadsheet (.xlsx, .xls)
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <Layers className="h-4 w-4 text-blue-600" /> CSV Text File (.csv)
                  </span>
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <FileText className="h-4 w-4 text-rose-600" /> PDF Catalog (.pdf)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: ANALYZING */}
          {stage === 'analyzing' && (
            <div className="py-16 text-center space-y-6">
              <div className="relative inline-block">
                <div className="p-6 bg-orange-100 text-orange-600 rounded-full animate-pulse">
                  <Sparkles className="h-12 w-12 text-orange-600 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  AI Analyzing & Extracting Data...
                </h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                  Parsing <strong>{selectedFile?.name}</strong>, identifying column headers, and validating inventory items...
                </p>
              </div>
              <div className="w-48 mx-auto h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 animate-pulse w-full rounded-full" />
              </div>
            </div>
          )}

          {/* STAGE 3: PREVIEW & VERIFICATION TABLE */}
          {stage === 'preview' && importData && (
            <div className="space-y-6">
              
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                  <p className="text-xs text-slate-500 font-semibold">Total Rows</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{rows.length}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready (Valid)
                  </p>
                  <p className="text-2xl font-black text-emerald-800 mt-1">{validCount}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Warnings (Fixed)
                  </p>
                  <p className="text-2xl font-black text-amber-800 mt-1">{warningCount}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                  <p className="text-xs text-rose-700 font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Errors (Issues)
                  </p>
                  <p className="text-2xl font-black text-rose-800 mt-1">{errorCount}</p>
                </div>
              </div>

              {/* AI Detected Mappings Pill Bar */}
              <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/80 border border-amber-200/80 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-amber-900">
                  <Sparkles className="h-4 w-4 text-orange-600" /> AI Detected Column Mappings:
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(importData.detectedMappings || {}).map(([field, rawCol]) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-xl border border-amber-200 text-slate-700 font-medium shadow-2xs"
                    >
                      <strong className="text-orange-700 capitalize font-bold">{field}</strong>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="text-slate-900 font-semibold">"{rawCol}"</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search parsed medicines…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  {(['ALL', 'VALID', 'WARNING', 'ERROR'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        statusFilter === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab === 'ALL' && `All (${rows.length})`}
                      {tab === 'VALID' && `Valid (${validCount})`}
                      {tab === 'WARNING' && `Warnings (${warningCount})`}
                      {tab === 'ERROR' && `Errors (${errorCount})`}
                    </button>
                  ))}
                </div>

                {/* Quick Selection */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Select All Valid
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Editable Verification Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCount > 0 && selectedCount === rows.filter(r => r.status !== 'ERROR').length}
                            onChange={e => handleSelectAll(e.target.checked)}
                            className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-2 w-12 text-slate-500">#</th>
                        <th className="py-3 px-3 w-28">Status</th>
                        <th className="py-3 px-3 min-w-[200px]">Medicine Name *</th>
                        <th className="py-3 px-3 w-28">Strength</th>
                        <th className="py-3 px-3 w-36">Manufacturer</th>
                        <th className="py-3 px-3 w-24">Quantity *</th>
                        <th className="py-3 px-3 w-28">Price (₹) *</th>
                        <th className="py-3 px-3 w-28">Expiry</th>
                        <th className="py-3 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400">
                            No rows matching the current search / filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map(row => (
                          <tr
                            key={row.rowNumber}
                            className={`transition-colors ${
                              !row.selected
                                ? 'opacity-50 bg-slate-50/50'
                                : row.status === 'ERROR'
                                ? 'bg-rose-50/40'
                                : row.status === 'WARNING'
                                ? 'bg-amber-50/30'
                                : 'hover:bg-orange-50/30'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                disabled={row.status === 'ERROR'}
                                onChange={() => handleRowToggle(row.rowNumber)}
                                className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-40"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-slate-400 font-mono text-[11px]">
                              {row.rowNumber}
                            </td>
                            <td className="py-2.5 px-3">
                              {row.status === 'VALID' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <Check className="h-3 w-3" /> Valid
                                </span>
                              )}
                              {row.status === 'WARNING' && (
                                <span
                                  title={row.validationError}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold cursor-help"
                                >
                                  <AlertTriangle className="h-3 w-3" /> Warning
                                </span>
                              )}
                              {row.status === 'ERROR' && (
                                <span
                                  title={row.validationError}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold cursor-help"
                                >
                                  <AlertCircle className="h-3 w-3" /> Error
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.medicineName}
                                onChange={e => handleCellChange(row.rowNumber, 'medicineName', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-orange-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.strength || ''}
                                placeholder="e.g. 500mg"
                                onChange={e => handleCellChange(row.rowNumber, 'strength', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-orange-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.manufacturer || ''}
                                placeholder="e.g. Cipla"
                                onChange={e => handleCellChange(row.rowNumber, 'manufacturer', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-orange-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity !== undefined ? row.quantity : ''}
                                onChange={e => handleCellChange(row.rowNumber, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-orange-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={row.price !== undefined ? row.price : ''}
                                onChange={e => handleCellChange(row.rowNumber, 'price', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-orange-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={row.expiryDate || ''}
                                placeholder="MM/YYYY"
                                onChange={e => handleCellChange(row.rowNumber, 'expiryDate', e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:ring-1 focus:ring-orange-500 outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                onClick={() => handleDeleteRow(row.rowNumber)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Options & Actions */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={e => setUpdateExisting(e.target.checked)}
                    className="rounded text-orange-600 focus:ring-orange-500 cursor-pointer h-4 w-4"
                  />
                  <span>Top-up / increment existing medicine stock in inventory</span>
                </label>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setStage('upload')}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Re-upload File
                  </button>

                  <button
                    onClick={handleConfirmImport}
                    disabled={confirmLoading || selectedCount === 0}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-orange-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirmLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Ingesting Data...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" /> Confirm & Import ({selectedCount} items)
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* STAGE 4: SUCCESS */}
          {stage === 'success' && confirmResult && (
            <div className="py-12 text-center space-y-6">
              <div className="p-5 bg-emerald-100 text-emerald-600 rounded-full inline-block animate-scale-in">
                <CheckCircle2 className="h-16 w-16" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">
                  Inventory Successfully Imported!
                </h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto">
                  {confirmResult.message}
                </p>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-4 max-w-sm mx-auto">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                  <p className="text-xs font-semibold text-emerald-700">New Medicines</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">+{confirmResult.newlyAdded}</p>
                </div>
                <div className="flex-1 bg-blue-50 border border-blue-200 p-4 rounded-2xl">
                  <p className="text-xs font-semibold text-blue-700">Stock Updated</p>
                  <p className="text-2xl font-black text-blue-900 mt-1">{confirmResult.updatedExisting}</p>
                </div>
              </div>

              <div>
                <button
                  onClick={handleClose}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-2xl font-bold text-xs shadow-lg shadow-orange-100 transition-all cursor-pointer"
                >
                  Done & View Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
