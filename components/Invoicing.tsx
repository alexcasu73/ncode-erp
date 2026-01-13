import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Invoice, Deal, DealStage } from '../types';
import { Plus, Download, Filter, ArrowUpCircle, ArrowDownCircle, Search, Calendar, Eye, Edit2, Trash2, X, Check, ChevronUp, ChevronDown, ChevronsUpDown, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../lib/currency';

// Mesi italiani
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Categorie spesa
const CATEGORIE_SPESA = ['Tools', 'Utenze', 'Affitto casa', 'Banca', 'Commercialista', 'Marketing', 'Intrattenimento', 'Generiche', 'Costi per servizi'];

// Tipi spesa
const TIPI_SPESA = ['Costi per servizi', 'Altri costi', 'Team'];

// Helper per formattare data
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('it-IT');
};

// Helper per formattare ID fattura: "Fattura_xyz" -> "xyz/anno"
const formatInvoiceId = (id: string, anno: number): string => {
  const numero = id.replace('Fattura_', '');
  return `${numero}/${anno}`;
};

export const Invoicing: React.FC = () => {
  const { invoices, deals, loading, addInvoice, updateInvoice, deleteInvoice } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'tutti' | 'Entrata' | 'Uscita'>(() => {
    const saved = localStorage.getItem('invoicing_filterTipo');
    return (saved as 'tutti' | 'Entrata' | 'Uscita') || 'tutti';
  });
  const [filterStato, setFilterStato] = useState<'tutti' | 'Stimato' | 'Effettivo' | 'Nessuno'>(() => {
    const saved = localStorage.getItem('invoicing_filterStato');
    return (saved as 'tutti' | 'Stimato' | 'Effettivo' | 'Nessuno') || 'tutti';
  });
  const [filterMese, setFilterMese] = useState<string>(() => {
    return localStorage.getItem('invoicing_filterMese') || 'tutti';
  });
  const [filterAnno, setFilterAnno] = useState<number | 'tutti'>(() => {
    const saved = localStorage.getItem('invoicing_filterAnno');
    return saved ? (saved === 'tutti' ? 'tutti' : parseInt(saved)) : new Date().getFullYear();
  });
  const [filterMeseTabella, setFilterMeseTabella] = useState<string>(() => {
    return localStorage.getItem('invoicing_filterMeseTabella') || 'tutti';
  });
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Persist filters to localStorage
  React.useEffect(() => {
    localStorage.setItem('invoicing_filterTipo', filterTipo);
  }, [filterTipo]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterStato', filterStato);
  }, [filterStato]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterMese', filterMese);
  }, [filterMese]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterAnno', String(filterAnno));
  }, [filterAnno]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterMeseTabella', filterMeseTabella);
  }, [filterMeseTabella]);

  // Reset tutti i filtri
  const resetAllFilters = () => {
    setFilterAnno('tutti');
    setFilterMese('tutti');
    setVistaStato('tutti');
    setSearchTerm('');
    setFilterTipo('tutti');
    setFilterStato('tutti');
    setFilterMeseTabella('tutti');
  };

  // Anni disponibili
  const anniDisponibili = useMemo((): number[] => {
    const anni = invoices.map(i => i.anno).filter((a): a is number => Boolean(a));
    const uniqueAnni = [...new Set(anni)];
    return uniqueAnni.sort((a, b) => b - a); // Ordine decrescente
  }, [invoices]);

  // Fatture per dashboard (KPI) - filtrate solo per anno e mese dalla dashboard top bar
  const invoicesForDashboard = useMemo(() => {
    let filtered = invoices;
    // Applica filtri Anno e Mese dalla dashboard
    if (filterAnno !== 'tutti') {
      filtered = filtered.filter(i => i.anno === filterAnno);
    }
    if (filterMese !== 'tutti') {
      filtered = filtered.filter(i => i.mese === filterMese);
    }
    return filtered;
  }, [invoices, filterAnno, filterMese]);

  // Sorting state
  type SortColumn = 'id' | 'data' | 'tipo' | 'progetto' | 'stato' | 'flusso' | 'totale';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    const saved = localStorage.getItem('invoicing_sortColumn');
    return (saved as SortColumn) || 'data';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem('invoicing_sortDirection');
    return (saved as SortDirection) || 'desc';
  });

  // Persist sorting to localStorage
  React.useEffect(() => {
    localStorage.setItem('invoicing_sortColumn', sortColumn);
  }, [sortColumn]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_sortDirection', sortDirection);
  }, [sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Stato per la vista bilancio
  const [vistaStato, setVistaStato] = useState<'tutti' | 'effettivo' | 'stimato'>(() => {
    const saved = localStorage.getItem('invoicing_vistaStato');
    return (saved as 'tutti' | 'effettivo' | 'stimato') || 'tutti';
  });

  React.useEffect(() => {
    localStorage.setItem('invoicing_vistaStato', vistaStato);
  }, [vistaStato]);

  // Calcola totali separati per Effettivo e Stimato (filtrati solo per anno dalla dashboard)
  const totals = useMemo(() => {
    const baseInvoices = invoicesForDashboard;

    const calcTotals = (filterFn: (i: Invoice) => boolean) => {
      const filtered = baseInvoices.filter(filterFn);
      const entrate = filtered.filter(i => i.tipo === 'Entrata');
      const uscite = filtered.filter(i => i.tipo === 'Uscita');

      return {
        entrate: entrate.reduce((acc, i) => acc + (i.flusso || 0), 0),
        uscite: uscite.reduce((acc, i) => acc + (i.flusso || 0), 0),
        ivaEntrate: entrate.reduce((acc, i) => acc + (i.iva || 0), 0),
        ivaUscite: uscite.reduce((acc, i) => acc + (i.iva || 0), 0),
        countEntrate: entrate.length,
        countUscite: uscite.length,
      };
    };

    const tutti = calcTotals(() => true);
    const effettivo = calcTotals(i => i.statoFatturazione === 'Effettivo');
    const stimato = calcTotals(i => i.statoFatturazione === 'Stimato');

    return {
      tutti: { ...tutti, margine: tutti.entrate - tutti.uscite, ivaBalance: tutti.ivaEntrate - tutti.ivaUscite },
      effettivo: { ...effettivo, margine: effettivo.entrate - effettivo.uscite, ivaBalance: effettivo.ivaEntrate - effettivo.ivaUscite },
      stimato: { ...stimato, margine: stimato.entrate - stimato.uscite, ivaBalance: stimato.ivaEntrate - stimato.ivaUscite },
      countStimate: baseInvoices.filter(i => i.statoFatturazione === 'Stimato').length,
      countEffettive: baseInvoices.filter(i => i.statoFatturazione === 'Effettivo').length,
    };
  }, [invoicesForDashboard]);

  // Dati attivi in base alla vista selezionata
  const activeData = totals[vistaStato];

  // Filtra fatture per tabella (NON include filtri Anno/Mese della dashboard)
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = searchTerm === '' ||
        inv.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.nomeProgetto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.spesa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTipo = filterTipo === 'tutti' || inv.tipo === filterTipo;
      const matchesStato = filterStato === 'tutti' || inv.statoFatturazione === filterStato;
      const matchesMeseTabella = filterMeseTabella === 'tutti' || inv.mese === filterMeseTabella;

      return matchesSearch && matchesTipo && matchesStato && matchesMeseTabella;
    });
  }, [invoices, searchTerm, filterTipo, filterStato, filterMeseTabella]);

  // Ordina fatture
  const sortedInvoices = useMemo(() => {
    return [...filteredInvoices].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'id':
          comparison = a.id.localeCompare(b.id);
          break;
        case 'data':
          const dateA = new Date(a.data).getTime();
          const dateB = new Date(b.data).getTime();
          comparison = dateA - dateB;
          break;
        case 'tipo':
          comparison = a.tipo.localeCompare(b.tipo);
          break;
        case 'progetto':
          const projA = a.tipo === 'Entrata' ? (a.nomeProgetto || '') : (a.spesa || '');
          const projB = b.tipo === 'Entrata' ? (b.nomeProgetto || '') : (b.spesa || '');
          comparison = projA.localeCompare(projB);
          break;
        case 'stato':
          comparison = (a.statoFatturazione || '').localeCompare(b.statoFatturazione || '');
          break;
        case 'flusso':
          comparison = (a.flusso || 0) - (b.flusso || 0);
          break;
        case 'totale':
          const totaleA = (a.flusso || 0) + (a.iva || 0);
          const totaleB = (b.flusso || 0) + (b.iva || 0);
          comparison = totaleA - totaleB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredInvoices, sortColumn, sortDirection]);

  // Mesi disponibili
  const mesiDisponibili = useMemo((): string[] => {
    const mesiArray = invoices.map(i => i.mese).filter((m): m is string => Boolean(m));
    const uniqueMesi = mesiArray.reduce<string[]>((acc, m) => {
      if (!acc.includes(m)) acc.push(m);
      return acc;
    }, []);
    return uniqueMesi.sort((a, b) => MESI.indexOf(a) - MESI.indexOf(b));
  }, [invoices]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa voce?')) {
      await deleteInvoice(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-page-title text-text-primary">Fatturazione</h1>
          <p className="text-page-subtitle mt-1">Gestione entrate e uscite</p>
        </div>
        <button
          onClick={() => { setEditingInvoice(null); setShowModal(true); }}
          className="bg-dark text-white px-6 py-2 rounded-full text-body font-medium hover:bg-black transition-colors flex items-center gap-2"
        >
          <Plus size={18} className="text-primary"/>
          Nuova Voce
        </button>
      </div>

      {/* Selettore Anno e Toggle Vista Stato */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Selettore Anno */}
        <div className="bg-secondary rounded-2xl p-2 flex items-center">
          <Calendar size={16} className="text-muted ml-2" />
          <select
            value={filterAnno === 'tutti' ? 'tutti' : filterAnno}
            onChange={(e) => setFilterAnno(e.target.value === 'tutti' ? 'tutti' : parseInt(e.target.value))}
            className="px-3 py-2 bg-transparent border-none font-medium text-text-primary text-sm focus:ring-0 focus:outline-none cursor-pointer"
          >
            <option value="tutti">Tutti gli anni</option>
            {anniDisponibili.map(anno => (
              <option key={anno} value={anno}>{anno}</option>
            ))}
          </select>
        </div>

        {/* Selettore Mese */}
        <div className="bg-secondary rounded-2xl p-2 flex items-center">
          <Calendar size={16} className="text-muted ml-2" />
          <select
            value={filterMese}
            onChange={(e) => setFilterMese(e.target.value)}
            className="px-3 py-2 bg-transparent border-none font-medium text-text-primary text-sm focus:ring-0 focus:outline-none cursor-pointer"
          >
            <option value="tutti">Tutti i mesi</option>
            {MESI.map(mese => (
              <option key={mese} value={mese}>{mese}</option>
            ))}
          </select>
        </div>

        {/* Toggle Vista Stato */}
        <div className="bg-secondary rounded-2xl p-2 inline-flex gap-1">
          <button
            onClick={() => setVistaStato('tutti')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              vistaStato === 'tutti'
                ? 'bg-dark text-white'
                : 'text-text-secondary hover:bg-dark-lighter'
            }`}
          >
            Tutti ({totals.countEffettive + totals.countStimate})
          </button>
          <button
            onClick={() => setVistaStato('effettivo')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              vistaStato === 'effettivo'
                ? 'bg-green-600 text-white'
                : 'text-text-secondary hover:bg-dark-lighter'
            }`}
          >
            Effettivo ({totals.countEffettive})
          </button>
          <button
            onClick={() => setVistaStato('stimato')}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              vistaStato === 'stimato'
                ? 'bg-blue-600 text-white'
                : 'text-text-secondary hover:bg-dark-lighter'
            }`}
          >
            Stimato ({totals.countStimate})
          </button>
        </div>

        {/* Reset filtri */}
        <button
          onClick={resetAllFilters}
          className="bg-secondary rounded-2xl p-2 hover:bg-dark-lighter transition-colors flex items-center gap-2"
          title="Reset tutti i filtri"
        >
          <RotateCcw size={16} className="text-muted ml-2" />
          <span className="px-3 py-2 font-medium text-text-primary text-sm">Reset</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-secondary p-5 rounded-2xl border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle size={16} className="text-green-500" />
            <h3 className="text-card-title">
              Entrate {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettive' : 'Stimate'})`}
            </h3>
          </div>
          <p className="text-kpi-value text-text-primary">{formatCurrency(activeData.entrate)}</p>
          <p className="text-small mt-1">{activeData.countEntrate} voci</p>
        </div>
        <div className="bg-secondary p-5 rounded-2xl border-l-4 border-orange-500">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle size={16} className="text-orange-500" />
            <h3 className="text-card-title">
              Uscite {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettive' : 'Stimate'})`}
            </h3>
          </div>
          <p className="text-kpi-value text-text-primary">{formatCurrency(activeData.uscite)}</p>
          <p className="text-small mt-1">{activeData.countUscite} voci</p>
        </div>
        <div className="bg-secondary p-5 rounded-2xl border-l-4 border-primary">
          <h3 className="text-card-title mb-1">
            Margine {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettivo' : 'Stimato'})`}
          </h3>
          <p className={`text-kpi-value ${activeData.margine >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(activeData.margine)}
          </p>
          <p className="text-small mt-1">IVA: {formatCurrency(activeData.ivaBalance)}</p>
        </div>
        <div className="bg-secondary p-5 rounded-2xl border-l-4 border-blue-500">
          <h3 className="text-card-title mb-3">Riepilogo per Stato</h3>
          <div className="flex justify-around">
            <div className="text-center px-4">
              <p className="text-kpi-small text-green-600">{totals.countEffettive}</p>
              <p className="text-small">Effettive</p>
            </div>
            <div className="w-px bg-dark-lighter self-stretch"></div>
            <div className="text-center px-4">
              <p className="text-kpi-small text-blue-600">{totals.countStimate}</p>
              <p className="text-small">Stimate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confronto Effettivo vs Stimato */}
      {vistaStato === 'tutti' && (
        <div className="bg-secondary rounded-2xl p-6">
          <h3 className="text-section-title text-text-primary mb-4">Confronto Bilancio: Effettivo vs Stimato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonna Effettivo */}
            <div className="border border-green-200 rounded-xl p-4 bg-green-50/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <h4 className="font-bold text-green-700">Effettivo (Confermato)</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Entrate:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(totals.effettivo.entrate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Uscite:</span>
                  <span className="font-semibold text-orange-600">-{formatCurrency(totals.effettivo.uscite)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-bold text-text-secondary">Margine:</span>
                  <span className={`font-bold ${totals.effettivo.margine >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.effettivo.margine)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Saldo IVA:</span>
                  <span className="text-text-secondary">{formatCurrency(totals.effettivo.ivaBalance)}</span>
                </div>
              </div>
            </div>

            {/* Colonna Stimato */}
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h4 className="font-bold text-blue-700">Stimato (Previsto)</h4>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Entrate:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(totals.stimato.entrate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Uscite:</span>
                  <span className="font-semibold text-orange-600">-{formatCurrency(totals.stimato.uscite)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-bold text-text-secondary">Margine:</span>
                  <span className={`font-bold ${totals.stimato.margine >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.stimato.margine)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Saldo IVA:</span>
                  <span className="text-text-secondary">{formatCurrency(totals.stimato.ivaBalance)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Totale Combinato */}
          <div className="mt-4 pt-4 border-t border-dark-lighter">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <span className="text-body text-text-secondary">Bilancio Totale (Effettivo + Stimato):</span>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-small">Entrate</p>
                  <p className="text-body font-bold text-green-600">{formatCurrency(totals.tutti.entrate)}</p>
                </div>
                <div className="text-center">
                  <p className="text-small">Uscite</p>
                  <p className="text-body font-bold text-orange-600">{formatCurrency(totals.tutti.uscite)}</p>
                </div>
                <div className="text-center">
                  <p className="text-small">Margine</p>
                  <p className={`text-body font-bold ${totals.tutti.margine >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.tutti.margine)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-secondary rounded-2xl p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Cerca per progetto, nota, categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-lighter border-none rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as any)}
            className="px-4 py-2 bg-dark-lighter border-none rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="tutti">Tutti i tipi</option>
            <option value="Entrata">Entrate</option>
            <option value="Uscita">Uscite</option>
          </select>
          <select
            value={filterStato}
            onChange={(e) => setFilterStato(e.target.value as any)}
            className="px-4 py-2 bg-dark-lighter border-none rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="tutti">Tutti gli stati</option>
            <option value="Stimato">Stimato</option>
            <option value="Effettivo">Effettivo</option>
            <option value="Nessuno">Nessuno</option>
          </select>
          <select
            value={filterMeseTabella}
            onChange={(e) => setFilterMeseTabella(e.target.value)}
            className="px-4 py-2 bg-dark-lighter border-none rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="tutti">Tutti i mesi</option>
            {MESI.map(mese => (
              <option key={mese} value={mese}>{mese}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-secondary rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-lighter">
              <tr className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    Id Fattura
                    {sortColumn === 'id' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('tipo')}
                >
                  <div className="flex items-center gap-1">
                    Tipo
                    {sortColumn === 'tipo' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('data')}
                >
                  <div className="flex items-center gap-1">
                    Data
                    {sortColumn === 'data' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('progetto')}
                >
                  <div className="flex items-center gap-1">
                    Progetto / Categoria
                    {sortColumn === 'progetto' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th className="px-4 py-3">Descrizione</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('stato')}
                >
                  <div className="flex items-center gap-1">
                    Stato
                    {sortColumn === 'stato' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('flusso')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Flusso
                    {sortColumn === 'flusso' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">IVA</th>
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:bg-dark-lighter transition-colors"
                  onClick={() => handleSort('totale')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Totale
                    {sortColumn === 'totale' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300" />}
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedInvoices.map((inv) => (
                <tr key={inv.id} className={`hover:bg-dark-lighter transition-colors ${inv.tipo === 'Uscita' ? 'bg-orange-50/30' : ''}`}>
                  <td className="px-4 py-3 text-sm text-text-primary font-semibold">
                    {formatInvoiceId(inv.id, inv.anno)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.tipo === 'Entrata' ? (
                      <ArrowUpCircle size={20} className="text-green-500" />
                    ) : (
                      <ArrowDownCircle size={20} className="text-orange-500" />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-text-secondary">
                    {formatDate(inv.data)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {inv.tipo === 'Entrata' ? (
                      <span className="font-medium text-text-primary">{inv.nomeProgetto || '-'}</span>
                    ) : (
                      <div>
                        <span className="font-medium text-text-primary">{inv.spesa || '-'}</span>
                        {inv.tipoSpesa && (
                          <span className="ml-2 px-2 py-0.5 bg-dark-lighter text-text-secondary text-xs rounded-full">
                            {inv.tipoSpesa}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary max-w-[200px] truncate">
                    {inv.note || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      inv.statoFatturazione === 'Effettivo'
                        ? 'bg-green-100 text-green-700'
                        : inv.statoFatturazione === 'Stimato'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-dark-lighter text-text-secondary'
                    }`}>
                      {inv.statoFatturazione || 'Nessuno'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium text-right ${inv.tipo === 'Uscita' ? 'text-orange-600' : 'text-text-primary'}`}>
                    {inv.tipo === 'Uscita' ? '-' : ''}{formatCurrency(inv.flusso || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary text-right">
                    {formatCurrency(inv.iva || 0)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${inv.tipo === 'Uscita' ? 'text-orange-600' : 'text-green-600'}`}>
                    {inv.tipo === 'Uscita' ? '-' : ''}{formatCurrency((inv.flusso || 0) + (inv.iva || 0))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => { setEditingInvoice(inv); setShowModal(true); }}
                        className="text-muted hover:text-blue-500"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-muted hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedInvoices.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              Nessuna voce trovata
            </div>
          )}
        </div>
      </div>

      {/* Modal per aggiungere/modificare */}
      {showModal && (
        <InvoiceModal
          invoice={editingInvoice}
          deals={deals}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editingInvoice) {
              await updateInvoice(editingInvoice.id, data);
            } else {
              await addInvoice(data as Omit<Invoice, 'id'>);
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Modal Component
interface InvoiceModalProps {
  invoice: Invoice | null;
  deals: Deal[];
  onClose: () => void;
  onSave: (data: Partial<Invoice>) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, deals, onClose, onSave }) => {
  // Filtra le opportunità per stato: Proposta, Negoziazione, Vinto
  const availableProjects = useMemo(() => {
    return deals.filter(d =>
      d.stage === DealStage.PROPOSAL ||
      d.stage === DealStage.NEGOTIATION ||
      d.stage === DealStage.WON
    );
  }, [deals]);
  const [formData, setFormData] = useState<Partial<Invoice>>(() => {
    if (invoice) {
      return { ...invoice };
    }
    const now = new Date();
    return {
      data: now,
      mese: MESI[now.getMonth()],
      anno: now.getFullYear(),
      tipo: 'Uscita',
      statoFatturazione: 'Stimato',
      nomeProgetto: '',
      spesa: '',
      tipoSpesa: '',
      note: '',
      flusso: 0,
      iva: 0,
      percentualeIva: 22,
      percentualeFatturazione: 100,
      checked: false
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = invoice?.id || `Fattura_${Date.now()}`;
    onSave({ ...formData, id });
  };

  const updateField = (field: keyof Invoice, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate IVA when flusso or percentualeIva changes
      if (field === 'flusso' || field === 'percentualeIva') {
        const flusso = field === 'flusso' ? value : (prev.flusso || 0);
        const percIva = field === 'percentualeIva' ? value : (prev.percentualeIva || 0);
        updated.iva = flusso * (percIva / 100);
      }

      // Update mese/anno when data changes
      if (field === 'data') {
        const d = new Date(value);
        updated.mese = MESI[d.getMonth()];
        updated.anno = d.getFullYear();
      }

      return updated;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-dark-lighter flex justify-between items-center">
          <h2 className="text-xl font-bold text-text-primary">
            {invoice ? 'Modifica Voce' : 'Nuova Voce'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-text-primary">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => updateField('tipo', 'Entrata')}
              className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                formData.tipo === 'Entrata'
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-dark-lighter text-text-secondary border-2 border-transparent'
              }`}
            >
              <ArrowUpCircle size={20} />
              Entrata
            </button>
            <button
              type="button"
              onClick={() => updateField('tipo', 'Uscita')}
              className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                formData.tipo === 'Uscita'
                  ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                  : 'bg-dark-lighter text-text-secondary border-2 border-transparent'
              }`}
            >
              <ArrowDownCircle size={20} />
              Uscita
            </button>
          </div>

          {/* Data e Stato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Data</label>
              <input
                type="date"
                value={formData.data ? new Date(formData.data).toISOString().split('T')[0] : ''}
                onChange={(e) => updateField('data', e.target.value)}
                className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Stato Fatturazione</label>
              <select
                value={formData.statoFatturazione || 'Nessuno'}
                onChange={(e) => updateField('statoFatturazione', e.target.value)}
                className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="Stimato">Stimato</option>
                <option value="Effettivo">Effettivo</option>
                <option value="Nessuno">Nessuno</option>
              </select>
            </div>
          </div>

          {/* Progetto (per Entrate) o Categoria (per Uscite) */}
          {formData.tipo === 'Entrata' ? (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Progetto (Opportunità)</label>
              <select
                value={formData.nomeProgetto || ''}
                onChange={(e) => updateField('nomeProgetto', e.target.value)}
                className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Seleziona progetto...</option>
                {availableProjects.map(deal => (
                  <option key={deal.id} value={deal.title}>
                    {deal.title} ({deal.customerName}) - {deal.stage}
                  </option>
                ))}
              </select>
              {availableProjects.length === 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  Nessuna opportunità in Proposta, Negoziazione o Vinto. Crea prima un'opportunità.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Categoria Spesa</label>
                <select
                  value={formData.spesa || ''}
                  onChange={(e) => updateField('spesa', e.target.value)}
                  className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Seleziona...</option>
                  {CATEGORIE_SPESA.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo Spesa</label>
                <select
                  value={formData.tipoSpesa || ''}
                  onChange={(e) => updateField('tipoSpesa', e.target.value)}
                  className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Seleziona...</option>
                  {TIPI_SPESA.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Note / Descrizione</label>
            <input
              type="text"
              value={formData.note || ''}
              onChange={(e) => updateField('note', e.target.value)}
              placeholder="Es: Claude, ChatGPT, Abbonamento mensile..."
              className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Importi */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Flusso (Netto)</label>
              <input
                type="number"
                step="0.01"
                value={formData.flusso || 0}
                onChange={(e) => updateField('flusso', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">% IVA</label>
              <select
                value={formData.percentualeIva || 0}
                onChange={(e) => updateField('percentualeIva', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value={0}>0%</option>
                <option value={4}>4%</option>
                <option value={10}>10%</option>
                <option value={22}>22%</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">IVA</label>
              <input
                type="number"
                step="0.01"
                value={formData.iva || 0}
                onChange={(e) => updateField('iva', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-dark-lighter rounded-xl focus:ring-2 focus:ring-primary focus:outline-none bg-dark-lighter"
                readOnly
              />
            </div>
          </div>

          {/* Totale */}
          <div className="bg-dark-lighter p-4 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Totale (Flusso + IVA)</span>
              <span className={`text-2xl font-bold ${formData.tipo === 'Uscita' ? 'text-orange-600' : 'text-green-600'}`}>
                {formData.tipo === 'Uscita' ? '- ' : ''}{formatCurrency((formData.flusso || 0) + (formData.iva || 0))}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-dark-lighter rounded-xl font-medium text-text-secondary hover:bg-dark-lighter transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-dark text-white rounded-xl font-medium hover:bg-black transition-colors flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {invoice ? 'Salva Modifiche' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
