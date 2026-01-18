import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Customer } from '../types';
import { Search, Plus, Filter, Mail, Phone, MapPin, Edit2, Trash2, X, Check, Building2, ChevronUp, ChevronDown, ChevronsUpDown, Upload, Download, Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { exportCustomersToExcel, importCustomersFromExcel } from '../lib/import-export';

export const CRM: React.FC = () => {
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStato, setFilterStato] = useState<'tutti' | 'Attivo' | 'Prospetto' | 'Inattivo'>('tutti');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Sorting state
  type SortColumn = 'name' | 'company' | 'status' | 'revenue';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    const saved = localStorage.getItem('crm_sortColumn');
    return (saved as SortColumn) || 'name';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem('crm_sortDirection');
    return (saved as SortDirection) || 'asc';
  });

  // Persist sorting to localStorage
  React.useEffect(() => {
    localStorage.setItem('crm_sortColumn', sortColumn);
  }, [sortColumn]);

  React.useEffect(() => {
    localStorage.setItem('crm_sortDirection', sortDirection);
  }, [sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Calcola totali
  const totals = useMemo(() => {
    const attivi = customers.filter(c => c.status === 'Attivo');
    const prospetti = customers.filter(c => c.status === 'Prospetto');
    const inattivi = customers.filter(c => c.status === 'Inattivo');
    const totaleRevenue = customers.reduce((acc, c) => acc + (c.revenue || 0), 0);

    return {
      totale: customers.length,
      attivi: attivi.length,
      prospetti: prospetti.length,
      inattivi: inattivi.length,
      totaleRevenue
    };
  }, [customers]);

  // Filtra clienti
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = searchTerm === '' ||
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.vatId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStato = filterStato === 'tutti' || c.status === filterStato;

      return matchesSearch && matchesStato;
    });
  }, [customers, searchTerm, filterStato]);

  // Ordina clienti
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'company':
          comparison = (a.company || '').localeCompare(b.company || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'revenue':
          comparison = (a.revenue || 0) - (b.revenue || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCustomers, sortColumn, sortDirection]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo cliente?')) {
      await deleteCustomer(id);
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === sortedCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCustomers.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (confirm(`Sei sicuro di voler eliminare ${selectedIds.size} clienti selezionati?`)) {
      for (const id of selectedIds) {
        await deleteCustomer(id);
      }
      setSelectedIds(new Set());
    }
  };

  // Export customers to Excel
  const handleExport = () => {
    const dataToExport = sortedCustomers.length > 0 ? sortedCustomers : customers;
    exportCustomersToExcel(dataToExport, `clienti_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Import customers from Excel
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportErrors([]);

    try {
      const { customers: importedCustomers, errors } = await importCustomersFromExcel(file);

      if (errors.length > 0) {
        setImportErrors(errors);
      }

      // Add imported customers to database
      let successCount = 0;
      let errorCount = 0;

      for (const customer of importedCustomers) {
        try {
          let customerId = customer.id || `Cliente_${crypto.randomUUID()}`;

          // Check if ID already exists in MY company
          const existingCustomer = customers.find(c => c.id === customerId);

          if (existingCustomer) {
            // Skip duplicate ID in same company
            errorCount++;
            console.error(`ID duplicato nella tua azienda: ${customer.id}, riga saltata`);
            continue;
          }

          // Try to insert with original ID
          try {
            await addCustomer({ ...customer, id: customerId } as Customer);
            successCount++;
          } catch (insertErr: any) {
            // If insert fails due to duplicate key (ID exists in another company)
            if (insertErr?.code === '23505' || insertErr?.message?.includes('duplicate key')) {
              // Generate new unique ID and retry
              const newId = `Cliente_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              console.log(`ID ${customerId} esiste in altra azienda, generato nuovo ID: ${newId}`);
              await addCustomer({ ...customer, id: newId } as Customer);
              successCount++;
            } else {
              throw insertErr;
            }
          }
        } catch (err) {
          errorCount++;
          console.error(`Errore importazione cliente:`, err);
        }
      }

      const message = `Import completato!\n✅ Clienti importati: ${successCount}\n${errorCount > 0 ? `❌ Errori: ${errorCount}\n` : ''}${errors.length > 0 ? `⚠️ Righe scartate (validazione): ${errors.length}` : ''}`;
      alert(message);

      if (errors.length > 0) {
        console.error('Import errors:', errors);
      }
    } catch (err) {
      alert(`Errore durante l'import: ${err instanceof Error ? err.message : 'errore sconosciuto'}`);
    } finally {
      setImporting(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-page-title text-dark dark:text-white">Clienti</h1>
          <p className="text-page-subtitle mt-1">Gestisci le relazioni con i clienti</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={customers.length === 0}
            className="bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-dark dark:text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Esporta in Excel"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Esporta</span>
          </button>

          {/* Import Button */}
          <label className="bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-dark dark:text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2 shadow-sm cursor-pointer">
            <Upload size={18} />
            <span className="hidden sm:inline">{importing ? 'Importando...' : 'Importa'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
            />
          </label>

          {/* Add New Button */}
          <button
            onClick={() => { setEditingCustomer(null); setShowModal(true); }}
            className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Aggiungi Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-gray-400 dark:border-gray-500 shadow-sm">
          <h3 className="text-card-title mb-1">Totale Clienti</h3>
          <p className="text-kpi-value text-dark dark:text-white">{totals.totale}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-secondary shadow-sm">
          <h3 className="text-card-title mb-1">Attivi</h3>
          <p className="text-kpi-value text-secondary">{totals.attivi}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-primary shadow-sm">
          <h3 className="text-card-title mb-1">Prospetti</h3>
          <p className="text-kpi-value text-primary">{totals.prospetti}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-accent shadow-sm">
          <h3 className="text-card-title mb-1">Fatturato Totale</h3>
          <p className="text-kpi-value text-dark dark:text-white">{formatCurrency(totals.totaleRevenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-dark-card rounded-lg p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cerca per nome, azienda, email, P.IVA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800/30 border-none rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
            />
          </div>
          <select
            value={filterStato}
            onChange={(e) => setFilterStato(e.target.value as any)}
            className="pl-4 pr-10 py-2 bg-gray-50 dark:bg-gray-800/30 border-none rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
          >
            <option value="tutti">Tutti gli stati</option>
            <option value="Attivo">Attivo</option>
            <option value="Prospetto">Prospetto</option>
            <option value="Inattivo">Inattivo</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border-2 border-primary/30 dark:border-primary/40 rounded-xl p-5 flex items-center justify-between shadow-lg animate-fade-in backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 dark:bg-primary/30 rounded-full flex items-center justify-center">
              <Check size={20} className="text-primary dark:text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-dark dark:text-white">
                {selectedIds.size} {selectedIds.size === 1 ? 'cliente selezionato' : 'clienti selezionati'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Pronto per l'eliminazione
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              <X size={16} />
              Annulla
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Trash2 size={16} />
              Elimina {selectedIds.size > 1 ? 'tutti' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-dark-card rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-dark-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-4 w-12">
                  <div className="flex items-center justify-center">
                    <label className="inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === sortedCustomers.length && sortedCustomers.length > 0}
                        onChange={toggleSelectAll}
                        className="sr-only peer"
                      />
                      <div className="relative w-4 h-4 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/50 peer-focus:ring-2 peer-focus:ring-primary/20">
                        <Check
                          size={12}
                          className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                          strokeWidth={3}
                        />
                      </div>
                    </label>
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Cliente
                    {sortColumn === 'name' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-500 dark:text-gray-400" />}
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Stato
                    {sortColumn === 'status' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-500 dark:text-gray-400" />}
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleSort('company')}
                >
                  <div className="flex items-center gap-1">
                    Azienda
                    {sortColumn === 'company' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-500 dark:text-gray-400" />}
                  </div>
                </th>
                <th className="px-6 py-4 whitespace-nowrap">Sede & Contatti</th>
                <th
                  className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Fatturato
                    {sortColumn === 'revenue' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-500 dark:text-gray-400" />}
                  </div>
                </th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
              {sortedCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center">
                      <label className="inline-flex items-center cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.id)}
                          onChange={() => toggleSelect(customer.id)}
                          className="sr-only peer"
                        />
                        <div className="relative w-4 h-4 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/50 peer-focus:ring-2 peer-focus:ring-primary/20">
                          <Check
                            size={12}
                            className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                            strokeWidth={3}
                          />
                        </div>
                      </label>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {customer.avatar ? (
                          <img className="h-10 w-10 rounded-full object-cover" src={customer.avatar} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/20 dark:bg-primary/30 flex items-center justify-center">
                            <span className="text-primary dark:text-primary font-bold">{customer.name?.charAt(0) || '?'}</span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-dark dark:text-white">{customer.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{customer.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs font-medium rounded-md text-white ${
                      customer.status === 'Attivo'
                        ? 'bg-secondary'
                        : customer.status === 'Prospetto'
                        ? 'bg-primary'
                        : 'bg-gray-500'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-dark dark:text-white">{customer.company}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-col gap-0.5 mt-1">
                      <span title="P.IVA">P.IVA: {customer.vatId || '-'}</span>
                      <span title="Codice SDI">SDI: {customer.sdiCode || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin size={14} className="text-gray-500 dark:text-gray-400" />
                        {customer.address || '-'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Phone size={14} className="text-gray-500 dark:text-gray-400" />
                        {customer.phone || '-'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark dark:text-white text-right">
                    {formatCurrency(customer.revenue || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => { setEditingCustomer(customer); setShowModal(true); }}
                        className="text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-1"
                        title="Modifica"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => window.location.href = `mailto:${customer.email}`}
                        className="text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 p-1"
                        title="Invia Email"
                      >
                        <Mail size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1"
                        title="Elimina"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedCustomers.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nessun cliente trovato
            </div>
          )}
        </div>
      </div>

      {/* Modal per aggiungere/modificare */}
      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editingCustomer) {
              await updateCustomer(editingCustomer.id, data);
            } else {
              await addCustomer(data as Omit<Customer, 'id'>);
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Modal Component
interface CustomerModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSave: (data: Partial<Customer>) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ customer, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Customer>>(() => {
    if (customer) {
      return { ...customer };
    }
    return {
      name: '',
      company: '',
      email: '',
      status: 'Prospetto',
      revenue: 0,
      avatar: undefined,
      vatId: '',
      sdiCode: '',
      address: '',
      phone: ''
    };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateField = (field: keyof Customer, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Seleziona un file immagine valido');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('L\'immagine deve essere inferiore a 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      updateField('avatar', base64);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    updateField('avatar', undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-dark dark:text-white">
            {customer ? 'Modifica Cliente' : 'Nuovo Cliente'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome e Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Nome Referente *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Mario Rossi"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="mario@azienda.com"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
              />
            </div>
          </div>

          {/* Azienda e Stato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Azienda *</label>
              <input
                type="text"
                value={formData.company || ''}
                onChange={(e) => updateField('company', e.target.value)}
                placeholder="Azienda S.r.l."
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Stato</label>
              <select
                value={formData.status || 'Prospetto'}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full pl-4 pr-12 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
              >
                <option value="Prospetto">Prospetto</option>
                <option value="Attivo">Attivo</option>
                <option value="Inattivo">Inattivo</option>
              </select>
            </div>
          </div>

          {/* P.IVA e SDI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">P.IVA</label>
              <input
                type="text"
                value={formData.vatId || ''}
                onChange={(e) => updateField('vatId', e.target.value)}
                placeholder="IT12345678901"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Codice SDI</label>
              <input
                type="text"
                value={formData.sdiCode || ''}
                onChange={(e) => updateField('sdiCode', e.target.value)}
                placeholder="M5UXCR1"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
              />
            </div>
          </div>

          {/* Indirizzo */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-1">Indirizzo / Sede</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Via Roma 1, 00100 Roma (RM)"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
            />
          </div>

          {/* Telefono e Fatturato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Telefono</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+39 06 1234567"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark dark:text-white mb-1">Fatturato</label>
              <input
                type="number"
                step="0.01"
                value={formData.revenue || 0}
                onChange={(e) => updateField('revenue', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none text-dark dark:text-white"
              />
            </div>
          </div>

          {/* Immagine */}
          <div>
            <label className="block text-sm font-medium text-dark dark:text-white mb-2">Immagine (opzionale)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {formData.avatar ? (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={formData.avatar}
                    alt="Anteprima"
                    className="w-20 h-20 rounded-lg object-cover border border-gray-200 dark:border-dark-border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm text-dark dark:text-white border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
                >
                  Cambia immagine
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-6 border border-dashed border-gray-200 dark:border-dark-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
                  <ImageIcon size={24} className="text-gray-500 dark:text-gray-400" />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Clicca per caricare un'immagine</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF (max 2MB)</span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {customer ? 'Salva Modifiche' : 'Aggiungi Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
