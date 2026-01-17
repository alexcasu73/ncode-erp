import React, { useState, useMemo } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { useData } from '../context/DataContext';
import { CashflowRecord, Invoice } from '../types';
import { Plus, ArrowUpCircle, ArrowDownCircle, Calendar, Search, ChevronUp, ChevronDown, ChevronsUpDown, X, Edit2, Trash2, Wallet, Settings, RotateCcw, Check } from 'lucide-react';
import { formatCurrency } from '../lib/currency';

// Mesi italiani abbreviati
const MESI_ABR = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MESI_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Helper per estrarre anno e mese dalla data di pagamento (formato YYYY-MM-DD)
const getAnnoFromDate = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const year = parseInt(dateStr.substring(0, 4));
  return isNaN(year) ? null : year;
};

const getMeseFromDate = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  const month = parseInt(dateStr.substring(5, 7));
  if (isNaN(month) || month < 1 || month > 12) return null;
  return MESI_FULL[month - 1];
};

const getMeseIndexFromDate = (dateStr?: string): number => {
  if (!dateStr) return -1;
  const month = parseInt(dateStr.substring(5, 7));
  if (isNaN(month) || month < 1 || month > 12) return -1;
  return month - 1;
};

// Formatta la data di pagamento in formato leggibile (DD/MM/YYYY)
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Formatta ID fattura: "Fattura_xyz" -> "N. xyz/anno"
const formatInvoiceNumber = (id: string, anno?: number): string => {
  const numero = id.replace('Fattura_', '');
  // Se il numero contiene già l'anno (es. "180/2026"), non duplicarlo
  if (numero.includes('/')) {
    return `N. ${numero}`;
  }
  return anno ? `N. ${numero}/${anno}` : `N. ${numero}`;
};

// Ottiene l'importo effettivo del movimento (importo personalizzato o totale fattura)
const getImportoEffettivo = (cf: { importo?: number; invoice?: { flusso?: number; iva?: number } }): number => {
  if (cf.importo !== undefined && cf.importo !== null) {
    return cf.importo;
  }
  return (cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0);
};

// Formatta data emissione fattura (può essere Date o string)
const formatInvoiceDate = (data?: Date | string): string => {
  if (!data) return '-';
  if (data instanceof Date) {
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
  }
  // Se è stringa in formato YYYY-MM-DD
  if (typeof data === 'string' && data.includes('-')) {
    const parts = data.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return String(data);
};

export const Cashflow: React.FC = () => {
  const {
    invoices,
    cashflowRecords,
    loading,
    addCashflowRecord,
    updateCashflowRecord,
    deleteCashflowRecord,
    updateInvoice,
    getBankBalance,
    setBankBalance
  } = useData();

  const [filterAnno, setFilterAnno] = useState<number | 'tutti'>(() => {
    const saved = localStorage.getItem('cashflow_filterAnno');
    return saved ? (saved === 'tutti' ? 'tutti' : parseInt(saved)) : new Date().getFullYear();
  });
  const [filterMese, setFilterMese] = useState<string>(() => {
    return localStorage.getItem('cashflow_filterMese') || 'tutti';
  });
  const [vistaStato, setVistaStato] = useState<'tutti' | 'effettivo' | 'stimato'>(() => {
    const saved = localStorage.getItem('cashflow_vistaStato');
    return (saved as 'tutti' | 'effettivo' | 'stimato') || 'tutti';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'tutti' | 'Entrata' | 'Uscita'>(() => {
    const saved = localStorage.getItem('cashflow_filterTipo');
    return (saved as 'tutti' | 'Entrata' | 'Uscita') || 'tutti';
  });
  const [filterMeseTabella, setFilterMeseTabella] = useState<string>(() => {
    return localStorage.getItem('cashflow_filterMeseTabella') || 'tutti';
  });
  const [filterAnnoTabella, setFilterAnnoTabella] = useState<number | 'tutti'>(() => {
    const saved = localStorage.getItem('cashflow_filterAnnoTabella');
    return saved ? (saved === 'tutti' ? 'tutti' : parseInt(saved)) : 'tutti';
  });
  const [filterStatoTabella, setFilterStatoTabella] = useState<'tutti' | 'Stimato' | 'Effettivo' | 'Nessuno'>(() => {
    const saved = localStorage.getItem('cashflow_filterStatoTabella');
    return (saved as 'tutti' | 'Stimato' | 'Effettivo' | 'Nessuno') || 'tutti';
  });
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CashflowRecord | null>(null);
  const [showBankBalanceModal, setShowBankBalanceModal] = useState(false);
  const [bankBalanceInput, setBankBalanceInput] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Persist filters to localStorage
  React.useEffect(() => {
    localStorage.setItem('cashflow_filterAnno', String(filterAnno));
  }, [filterAnno]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_filterMese', filterMese);
  }, [filterMese]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_vistaStato', vistaStato);
  }, [vistaStato]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_filterTipo', filterTipo);
  }, [filterTipo]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_filterMeseTabella', filterMeseTabella);
  }, [filterMeseTabella]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_filterAnnoTabella', String(filterAnnoTabella));
  }, [filterAnnoTabella]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_filterStatoTabella', filterStatoTabella);
  }, [filterStatoTabella]);

  // Reset tutti i filtri
  const resetAllFilters = () => {
    setFilterAnno('tutti');
    setFilterMese('tutti');
    setVistaStato('tutti');
    setSearchTerm('');
    setFilterTipo('tutti');
    setFilterMeseTabella('tutti');
    setFilterAnnoTabella('tutti');
    setFilterStatoTabella('tutti');
  };

  // Form state
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formDataPagamento, setFormDataPagamento] = useState('');
  const [formImporto, setFormImporto] = useState<string>('');
  const [formNote, setFormNote] = useState('');
  const [formStatoFatturazione, setFormStatoFatturazione] = useState<'Stimato' | 'Effettivo' | 'Nessuno'>('Effettivo');
  const [formTipoStandalone, setFormTipoStandalone] = useState<'Entrata' | 'Uscita'>('Entrata');

  // Filtri per la selezione fatture nel modal
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceFilterTipo, setInvoiceFilterTipo] = useState<'tutti' | 'Entrata' | 'Uscita'>('tutti');
  const [invoiceFilterAnno, setInvoiceFilterAnno] = useState<number | 'tutti'>('tutti');

  // Sorting
  type SortColumn = 'mese' | 'progetto' | 'spesa' | 'tipo' | 'stato' | 'totale';
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(() => {
    const saved = localStorage.getItem('cashflow_sortColumn');
    return (saved as SortColumn) || 'mese';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem('cashflow_sortDirection');
    return (saved as SortDirection) || 'asc';
  });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    type: 'single' | 'bulk';
    id?: string;
    count?: number;
  } | null>(null);

  // Persist sorting to localStorage
  React.useEffect(() => {
    localStorage.setItem('cashflow_sortColumn', sortColumn);
  }, [sortColumn]);

  React.useEffect(() => {
    localStorage.setItem('cashflow_sortDirection', sortDirection);
  }, [sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  // Anni disponibili (basati sulle date di pagamento dei cashflow records)
  const anniDisponibili = useMemo((): number[] => {
    const anni = cashflowRecords
      .map(cf => getAnnoFromDate(cf.dataPagamento))
      .filter((a): a is number => a !== null);
    const uniqueAnni = [...new Set(anni)];
    return uniqueAnni.sort((a, b) => b - a);
  }, [cashflowRecords]);

  // Mappa cashflow records con le fatture
  const cashflowWithInvoices = useMemo(() => {
    return cashflowRecords.map(cf => {
      const invoice = invoices.find(inv => inv.id === cf.invoiceId);
      return { ...cf, invoice };
    }); // Include anche movimenti standalone senza fattura
  }, [cashflowRecords, invoices]);

  // Records per dashboard (KPI) - filtrati per anno, mese e stato dalla dashboard top bar
  const recordsForDashboard = useMemo(() => {
    let filtered = cashflowWithInvoices;
    if (filterAnno !== 'tutti') {
      filtered = filtered.filter(cf => getAnnoFromDate(cf.dataPagamento) === filterAnno);
    }
    if (filterMese !== 'tutti') {
      filtered = filtered.filter(cf => getMeseFromDate(cf.dataPagamento) === filterMese);
    }
    if (vistaStato === 'effettivo') {
      filtered = filtered.filter(cf => {
        // Usa lo stato del cashflow record se presente, altrimenti della fattura
        const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
        return stato === 'Effettivo';
      });
    } else if (vistaStato === 'stimato') {
      filtered = filtered.filter(cf => {
        // Usa lo stato del cashflow record se presente, altrimenti della fattura
        const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
        return stato === 'Stimato';
      });
    }
    return filtered;
  }, [cashflowWithInvoices, filterAnno, filterMese, vistaStato]);

  // Fatture filtrate per tabella (NON include filtri Anno/Mese/Stato della dashboard)
  const recordsPerTabella = useMemo(() => {
    return cashflowWithInvoices.filter(cf => {
      const inv = cf.invoice;

      // Gestione movimenti standalone (senza fattura)
      if (!inv) {
        // Per movimenti standalone usa i campi del cashflow record stesso
        const matchesSearch = searchTerm === '' ||
          cf.note?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTipo = filterTipo === 'tutti' || cf.tipo === filterTipo;
        const matchesMeseTabella = filterMeseTabella === 'tutti' || getMeseFromDate(cf.dataPagamento) === filterMeseTabella;
        const matchesAnnoTabella = filterAnnoTabella === 'tutti' || getAnnoFromDate(cf.dataPagamento) === filterAnnoTabella;
        // Movimenti standalone non hanno stato fatturazione, considerali sempre "Nessuno"
        const matchesStatoTabella = filterStatoTabella === 'tutti' || filterStatoTabella === 'Nessuno';
        return matchesSearch && matchesTipo && matchesMeseTabella && matchesAnnoTabella && matchesStatoTabella;
      }

      // Gestione movimenti con fattura
      const matchesSearch = searchTerm === '' ||
        inv.nomeProgetto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.spesa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cf.note?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo = filterTipo === 'tutti' || inv.tipo === filterTipo;
      const matchesMeseTabella = filterMeseTabella === 'tutti' || getMeseFromDate(cf.dataPagamento) === filterMeseTabella;
      const matchesAnnoTabella = filterAnnoTabella === 'tutti' || getAnnoFromDate(cf.dataPagamento) === filterAnnoTabella;
      // Usa lo stato del cashflow record se presente, altrimenti della fattura
      const stato = cf.statoFatturazione || inv.statoFatturazione;
      const matchesStatoTabella = filterStatoTabella === 'tutti' || stato === filterStatoTabella;
      return matchesSearch && matchesTipo && matchesMeseTabella && matchesAnnoTabella && matchesStatoTabella;
    });
  }, [cashflowWithInvoices, searchTerm, filterTipo, filterMeseTabella, filterAnnoTabella, filterStatoTabella]);

  // Ordina records per tabella (ordinamento per mese usa data di pagamento)
  const sortedRecords = useMemo(() => {
    return [...recordsPerTabella].sort((a, b) => {
      const invA = a.invoice;
      const invB = b.invoice;

      let comparison = 0;
      switch (sortColumn) {
        case 'mese':
          // Ordina per data di pagamento
          comparison = (a.dataPagamento || '').localeCompare(b.dataPagamento || '');
          break;
        case 'progetto':
          comparison = (invA?.nomeProgetto || '').localeCompare(invB?.nomeProgetto || '');
          break;
        case 'spesa':
          comparison = (invA?.spesa || '').localeCompare(invB?.spesa || '');
          break;
        case 'tipo':
          const tipoA = invA?.tipo || a.tipo || '';
          const tipoB = invB?.tipo || b.tipo || '';
          comparison = tipoA.localeCompare(tipoB);
          break;
        case 'stato':
          const statoA = a.statoFatturazione || invA?.statoFatturazione || 'Nessuno';
          const statoB = b.statoFatturazione || invB?.statoFatturazione || 'Nessuno';
          comparison = statoA.localeCompare(statoB);
          break;
        case 'totale':
          // Considera il segno: uscite negative, entrate positive
          const tipoEffettivoA = invA?.tipo || a.tipo || 'Entrata';
          const tipoEffettivoB = invB?.tipo || b.tipo || 'Entrata';
          const valA = tipoEffettivoA === 'Uscita' ? -getImportoEffettivo(a) : getImportoEffettivo(a);
          const valB = tipoEffettivoB === 'Uscita' ? -getImportoEffettivo(b) : getImportoEffettivo(b);
          comparison = valA - valB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [recordsPerTabella, sortColumn, sortDirection]);

  // Calcola totali (usa importo personalizzato se presente, altrimenti flusso + iva)
  const totals = useMemo(() => {
    const entrate = recordsForDashboard.filter(cf => {
      // Per movimenti standalone usa cf.tipo, per fatture usa invoice.tipo
      const tipo = cf.invoice?.tipo || cf.tipo;
      return tipo === 'Entrata';
    });
    const uscite = recordsForDashboard.filter(cf => {
      // Per movimenti standalone usa cf.tipo, per fatture usa invoice.tipo
      const tipo = cf.invoice?.tipo || cf.tipo;
      return tipo === 'Uscita';
    });

    const totaleEntrate = entrate.reduce((acc, cf) => acc + getImportoEffettivo(cf), 0);
    const totaleUscite = uscite.reduce((acc, cf) => acc + getImportoEffettivo(cf), 0);

    return {
      entrate: totaleEntrate,
      uscite: totaleUscite,
      saldo: totaleEntrate - totaleUscite,
      countEntrate: entrate.length,
      countUscite: uscite.length,
    };
  }, [recordsForDashboard]);

  // Saldo iniziale e saldo in banca per l'anno selezionato
  const currentBankBalance = useMemo(() => {
    if (filterAnno === 'tutti') return undefined;
    return getBankBalance(filterAnno);
  }, [filterAnno, getBankBalance]);

  const saldoInBanca = useMemo(() => {
    if (filterAnno === 'tutti') return 0;

    const saldoIniziale = currentBankBalance?.saldoIniziale || 0;

    // Create a filtered list similar to recordsForDashboard but with cumulative month logic
    let filtered = cashflowWithInvoices;

    // Filter by year
    if (filterAnno !== 'tutti') {
      filtered = filtered.filter(cf => getAnnoFromDate(cf.dataPagamento) === filterAnno);
    }

    // Filter by month (cumulative - include all months up to selected month)
    if (filterMese !== 'tutti') {
      filtered = filtered.filter(cf => {
        const meseRecord = getMeseFromDate(cf.dataPagamento);
        if (!meseRecord) return false;
        const meseRecordIndex = MESI_FULL.indexOf(meseRecord);
        const meseSelezionatoIndex = MESI_FULL.indexOf(filterMese);
        return meseRecordIndex <= meseSelezionatoIndex;
      });
    }

    // Filter by vistaStato
    if (vistaStato === 'effettivo') {
      filtered = filtered.filter(cf => {
        // Usa lo stato del cashflow record se presente, altrimenti della fattura
        const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
        return stato === 'Effettivo';
      });
    } else if (vistaStato === 'stimato') {
      filtered = filtered.filter(cf => {
        // Usa lo stato del cashflow record se presente, altrimenti della fattura
        const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
        return stato === 'Stimato';
      });
    }

    // Calculate saldo using the same logic as totals
    const entrate = filtered.filter(cf => {
      const tipo = cf.invoice?.tipo || cf.tipo;
      return tipo === 'Entrata';
    });
    const uscite = filtered.filter(cf => {
      const tipo = cf.invoice?.tipo || cf.tipo;
      return tipo === 'Uscita';
    });

    const totaleEntrate = entrate.reduce((acc, cf) => acc + getImportoEffettivo(cf), 0);
    const totaleUscite = uscite.reduce((acc, cf) => acc + getImportoEffettivo(cf), 0);
    const saldoMovimenti = totaleEntrate - totaleUscite;

    return saldoIniziale + saldoMovimenti;
  }, [currentBankBalance, filterAnno, filterMese, vistaStato, cashflowWithInvoices]);

  // Conteggio per stato (basato sulla DATA DI PAGAMENTO)
  const countByStato = useMemo(() => {
    let baseFiltered = cashflowWithInvoices;
    if (filterAnno !== 'tutti') {
      baseFiltered = baseFiltered.filter(cf => getAnnoFromDate(cf.dataPagamento) === filterAnno);
    }
    if (filterMese !== 'tutti') {
      baseFiltered = baseFiltered.filter(cf => getMeseFromDate(cf.dataPagamento) === filterMese);
    }
    return {
      effettive: baseFiltered.filter(cf => {
        // Usa lo stato del cashflow record se presente, altrimenti della fattura
        const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
        return stato === 'Effettivo';
      }).length,
      stimate: baseFiltered.filter(cf => {
        // Usa lo stato del cashflow record se presente, altrimenti della fattura
        const stato = cf.statoFatturazione || cf.invoice?.statoFatturazione;
        return stato === 'Stimato';
      }).length,
    };
  }, [cashflowWithInvoices, filterAnno, filterMese]);

  // Dati per grafico mensile (basato sulla DATA DI PAGAMENTO)
  const chartData = useMemo(() => {
    const monthlyData: { [key: string]: { entrate: number; uscite: number } } = {};

    MESI_ABR.forEach(m => {
      monthlyData[m] = { entrate: 0, uscite: 0 };
    });

    recordsForDashboard.forEach(cf => {
      const inv = cf.invoice;
      const meseIndex = getMeseIndexFromDate(cf.dataPagamento);
      if (inv && meseIndex !== -1) {
        const meseAbr = MESI_ABR[meseIndex];
        const totale = getImportoEffettivo(cf);
        if (inv.tipo === 'Entrata') {
          monthlyData[meseAbr].entrate += totale;
        } else {
          monthlyData[meseAbr].uscite += totale;
        }
      }
    });

    return MESI_ABR.map(m => ({
      month: m,
      entrate: monthlyData[m].entrate,
      uscite: monthlyData[m].uscite,
    }));
  }, [recordsForDashboard]);

  // Anni disponibili dalle fatture
  const anniDisponibiliFatture = useMemo(() => {
    const anni = invoices.map(i => i.anno).filter((a): a is number => Boolean(a));
    const uniqueAnni = [...new Set(anni)];
    return uniqueAnni.sort((a, b) => b - a);
  }, [invoices]);

  // Fatture disponibili per selezione (tutte le fatture - permettiamo pagamenti multipli)
  const invoicesDisponibili = useMemo(() => {
    let filtered = invoices;

    // Filtra per tipo
    if (invoiceFilterTipo !== 'tutti') {
      filtered = filtered.filter(inv => inv.tipo === invoiceFilterTipo);
    }

    // Filtra per anno
    if (invoiceFilterAnno !== 'tutti') {
      filtered = filtered.filter(inv => inv.anno === invoiceFilterAnno);
    }

    // Filtra per ricerca testuale
    if (invoiceSearchTerm) {
      const search = invoiceSearchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.id.toLowerCase().includes(search) ||
        (inv.nomeProgetto || '').toLowerCase().includes(search) ||
        (inv.spesa || '').toLowerCase().includes(search) ||
        (inv.note || '').toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [invoices, invoiceFilterTipo, invoiceFilterAnno, invoiceSearchTerm]);

  // Modal handlers
  const openNewModal = () => {
    setEditingRecord(null);
    setFormInvoiceId('');
    // Imposta data di oggi come default (formato YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    setFormDataPagamento(today);
    setFormImporto('');
    setFormNote('');
    setFormStatoFatturazione('Effettivo');
    // Reset filtri fatture
    setInvoiceSearchTerm('');
    setInvoiceFilterTipo('tutti');
    setInvoiceFilterAnno('tutti');
    setShowModal(true);
  };

  const openEditModal = (record: CashflowRecord & { invoice?: Invoice }) => {
    setEditingRecord(record);
    setFormInvoiceId(record.invoiceId || '');
    setFormDataPagamento(record.dataPagamento || '');

    // Se c'è un importo personalizzato, mostralo
    if (record.importo !== undefined && record.importo !== null) {
      setFormImporto(record.importo.toString());
    } else if (record.invoice) {
      // Altrimenti mostra il totale fattura se c'è una fattura
      const totale = (record.invoice.flusso || 0) + (record.invoice.iva || 0);
      setFormImporto(totale.toString());
    } else {
      // Movimento standalone senza importo personalizzato (raro ma possibile)
      setFormImporto('0');
    }

    setFormNote(record.note || '');
    // Leggi lo stato dal cashflow record, se non presente usa quello della fattura
    setFormStatoFatturazione(record.statoFatturazione || record.invoice?.statoFatturazione || 'Nessuno');

    // Per movimenti standalone, imposta il tipo
    if (!record.invoiceId) {
      setFormTipoStandalone(record.tipo || 'Entrata');
    }

    // Reset filtri fatture per facilitare la ricerca
    setInvoiceSearchTerm('');
    setInvoiceFilterTipo('tutti');
    setInvoiceFilterAnno('tutti');

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setFormStatoFatturazione('Effettivo');
    // Reset filtri fatture
    setInvoiceSearchTerm('');
    setInvoiceFilterTipo('tutti');
    setInvoiceFilterAnno('tutti');
  };

  // Quando cambia la fattura selezionata, pre-popola l'importo e lo stato
  const handleInvoiceChange = (invoiceId: string) => {
    setFormInvoiceId(invoiceId);
    if (invoiceId) {
      const inv = invoices.find(i => i.id === invoiceId);
      if (inv) {
        const totale = (inv.flusso || 0) + (inv.iva || 0);
        setFormImporto(totale.toString());
        setFormStatoFatturazione(inv.statoFatturazione || 'Effettivo');
        setFormNote(inv.note || '');
      }
    } else {
      setFormImporto('');
      setFormStatoFatturazione('Effettivo');
      setFormNote('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const importoValue = parseFloat(formImporto) || 0;
    const hasInvoice = formInvoiceId && formInvoiceId.trim() !== '';
    const invoice = hasInvoice ? invoices.find(i => i.id === formInvoiceId) : undefined;

    // Validazione: se è selezionata una fattura, deve esistere
    if (hasInvoice && !invoice) {
      alert(`Errore: La fattura con ID "${formInvoiceId}" non esiste. Seleziona una fattura valida o crea un movimento standalone.`);
      console.error('Invoice not found:', formInvoiceId);
      return;
    }

    let recordData: any;

    if (hasInvoice && invoice) {
      // Movimento con fattura
      const totaleInvoice = (invoice.flusso || 0) + (invoice.iva || 0);
      // Quando si modifica un record esistente, salva sempre l'importo se fornito
      // Quando si crea un nuovo record, salva undefined se uguale al totale fattura
      const importoToSave = editingRecord
        ? importoValue // Salva sempre quando in edit
        : (Math.abs(importoValue - totaleInvoice) < 0.01 ? undefined : importoValue);

      recordData = {
        invoiceId: formInvoiceId,
        dataPagamento: formDataPagamento || undefined,
        importo: importoToSave,
        note: formNote || undefined,
        statoFatturazione: formStatoFatturazione, // Salva lo stato nel cashflow record
      };
    } else {
      // Movimento standalone (senza fattura)
      recordData = {
        invoiceId: null,
        dataPagamento: formDataPagamento || undefined,
        importo: Math.abs(importoValue), // Per standalone l'importo è sempre obbligatorio e positivo
        note: formNote || undefined,
        tipo: formTipoStandalone, // Usa il tipo selezionato nel form
        statoFatturazione: formStatoFatturazione // Usa lo stato selezionato nel form
      };
    }

    console.log('💾 Saving cashflow record:', recordData);

    let result;
    if (editingRecord) {
      const success = await updateCashflowRecord(editingRecord.id, recordData);
      if (!success) {
        alert('Errore durante l\'aggiornamento del movimento. Controlla la console per i dettagli.');
        console.error('Failed to update cashflow record:', editingRecord.id, recordData);
        return;
      }
    } else {
      result = await addCashflowRecord(recordData);
      if (!result) {
        alert('Errore durante il salvataggio del movimento. Controlla la console per i dettagli.');
        console.error('Failed to add cashflow record:', recordData);
        return;
      }
      console.log('✅ Cashflow record saved:', result);
    }

    closeModal();
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmDialog({ type: 'single', id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmDialog) return;

    if (deleteConfirmDialog.type === 'single' && deleteConfirmDialog.id) {
      await deleteCashflowRecord(deleteConfirmDialog.id);
    } else if (deleteConfirmDialog.type === 'bulk') {
      for (const id of selectedIds) {
        await deleteCashflowRecord(id);
      }
      setSelectedIds(new Set());
    }

    setDeleteConfirmDialog(null);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRecords.map(r => r.id)));
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmDialog({ type: 'bulk', count: selectedIds.size });
  };

  // Bank balance modal handlers
  const openBankBalanceModal = () => {
    if (filterAnno !== 'tutti') {
      setBankBalanceInput(currentBankBalance?.saldoIniziale?.toString() || '');
      setShowBankBalanceModal(true);
    }
  };

  const closeBankBalanceModal = () => {
    setShowBankBalanceModal(false);
    setBankBalanceInput('');
  };

  const handleSaveBankBalance = async () => {
    if (filterAnno === 'tutti') return;
    const value = parseFloat(bankBalanceInput) || 0;
    await setBankBalance(filterAnno, value);
    closeBankBalanceModal();
  };

  // Trova fattura selezionata per preview
  const selectedInvoice = useMemo(() => {
    return invoices.find(inv => inv.id === formInvoiceId);
  }, [formInvoiceId, invoices]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-page-title text-dark dark:text-white">Flusso di Cassa</h1>
          <p className="text-page-subtitle text-gray-500 dark:text-gray-400 mt-1">Monitora entrate, uscite e liquidità</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          Aggiungi Movimento
        </button>
      </div>

      {/* Filtri Anno e Stato */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Selettore Anno */}
        <div className="bg-white dark:bg-dark-card rounded-lg p-2 flex items-center shadow-sm border border-gray-200 dark:border-dark-border">
          <Calendar size={16} className="text-gray-500 dark:text-gray-400 ml-2" />
          <select
            value={filterAnno === 'tutti' ? 'tutti' : filterAnno}
            onChange={(e) => setFilterAnno(e.target.value === 'tutti' ? 'tutti' : parseInt(e.target.value))}
            className="pl-3 pr-8 py-2 bg-transparent border-none font-medium text-dark dark:text-white text-sm focus:ring-0 focus:outline-none cursor-pointer"
          >
            <option value="tutti">Tutti gli anni</option>
            {anniDisponibili.map(anno => (
              <option key={anno} value={anno}>{anno}</option>
            ))}
          </select>
        </div>

        {/* Selettore Mese */}
        <div className="bg-white dark:bg-dark-card rounded-lg p-2 flex items-center shadow-sm border border-gray-200 dark:border-dark-border">
          <Calendar size={16} className="text-gray-500 dark:text-gray-400 ml-2" />
          <select
            value={filterMese}
            onChange={(e) => setFilterMese(e.target.value)}
            className="pl-3 pr-8 py-2 bg-transparent border-none font-medium text-dark dark:text-white text-sm focus:ring-0 focus:outline-none cursor-pointer"
          >
            <option value="tutti">Tutti i mesi</option>
            {MESI_FULL.map(mese => (
              <option key={mese} value={mese}>{mese}</option>
            ))}
          </select>
        </div>

        {/* Toggle Vista Stato */}
        <div className="bg-white dark:bg-dark-card rounded-lg p-2 inline-flex gap-1 shadow-sm border border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setVistaStato('tutti')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              vistaStato === 'tutti'
                ? 'bg-dark dark:bg-white text-white dark:text-dark'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'
            }`}
          >
            Tutti ({countByStato.effettive + countByStato.stimate})
          </button>
          <button
            onClick={() => setVistaStato('effettivo')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              vistaStato === 'effettivo'
                ? 'bg-green-600 dark:bg-green-500 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'
            }`}
          >
            Effettivo ({countByStato.effettive})
          </button>
          <button
            onClick={() => setVistaStato('stimato')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              vistaStato === 'stimato'
                ? 'bg-primary text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'
            }`}
          >
            Stimato ({countByStato.stimate})
          </button>
        </div>

        {/* Reset filtri */}
        <button
          onClick={resetAllFilters}
          className="bg-white dark:bg-dark-card rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-dark-border transition-colors flex items-center gap-2 shadow-sm border border-gray-200 dark:border-dark-border"
          title="Reset tutti i filtri"
        >
          <RotateCcw size={16} className="text-gray-500 dark:text-gray-400 ml-2" />
          <span className="px-3 py-2 font-medium text-dark dark:text-white text-sm">Reset</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-secondary shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle size={16} className="text-secondary" />
            <h3 className="text-card-title">
              Entrate Totali {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettive' : 'Stimate'})`}
            </h3>
          </div>
          <p className="text-kpi-value text-dark dark:text-white">{formatCurrency(totals.entrate)}</p>
          <p className="text-small mt-1">{totals.countEntrate} voci</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-red-600 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle size={16} className="text-red-600" />
            <h3 className="text-card-title">
              Uscite Totali {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettive' : 'Stimate'})`}
            </h3>
          </div>
          <p className="text-kpi-value text-dark dark:text-white">{formatCurrency(totals.uscite)}</p>
          <p className="text-small mt-1">{totals.countUscite} voci</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-primary shadow-sm">
          <h3 className="text-card-title mb-1">
            Saldo Netto {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettivo' : 'Stimato'})`}
          </h3>
          <p className={`text-kpi-value ${totals.saldo >= 0 ? 'text-secondary' : 'text-red-600'}`}>
            {formatCurrency(totals.saldo)}
          </p>
          <p className="text-small mt-1">Entrate - Uscite</p>
        </div>
        {/* Saldo in Banca - visibile solo quando è selezionato un anno specifico */}
        <div className={`bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-accent ${filterAnno === 'tutti' ? 'opacity-50' : ''} shadow-sm`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-accent" />
              <h3 className="text-card-title">Saldo in Banca</h3>
            </div>
            {filterAnno !== 'tutti' && (
              <button
                onClick={openBankBalanceModal}
                className="p-1 text-gray-500 hover:text-accent transition-colors"
                title="Modifica saldo iniziale"
              >
                <Settings size={14} />
              </button>
            )}
          </div>
          {filterAnno === 'tutti' ? (
            <>
              <p className="text-kpi-value text-gray-500 dark:text-gray-400">-</p>
              <p className="text-small mt-1">Seleziona un anno</p>
            </>
          ) : (
            <>
              <p className={`text-kpi-value ${saldoInBanca >= 0 ? 'text-accent' : 'text-red-600'}`}>
                {formatCurrency(saldoInBanca)}
              </p>
              <p className="text-small mt-1">
                Iniziale: {formatCurrency(currentBankBalance?.saldoIniziale || 0)}
              </p>
            </>
          )}
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-gray-400 dark:border-gray-500 shadow-sm">
          <h3 className="text-card-title mb-3">Riepilogo per Stato</h3>
          <div className="flex justify-around">
            <div className="text-center px-4">
              <p className="text-kpi-small text-secondary">{countByStato.effettive}</p>
              <p className="text-small">Effettive</p>
            </div>
            <div className="w-px bg-gray-200 dark:bg-dark-border self-stretch"></div>
            <div className="text-center px-4">
              <p className="text-kpi-small text-primary">{countByStato.stimate}</p>
              <p className="text-small">Stimate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-dark-card p-6 rounded-lg" shadow-sm>
        <h3 className="text-section-title text-dark dark:text-white mb-6">Andamento Mensile</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={0}>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 12 }}
                tickFormatter={(value) => {
                  const thousands = Math.round(value / 1000);
                  // Aggiungi punto per migliaia anche nei k
                  const formatted = thousands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                  return `${formatted}k €`;
                }}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderRadius: '12px', border: 'none', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Bar dataKey="entrate" name="Entrate" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="uscite" name="Uscite" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-8 mt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            Entrate
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            Uscite
          </div>
        </div>
      </div>

      {/* Tabella Movimenti */}
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <div>
            {/* Header tabella con ricerca e filtri */}
            <div className="p-4 border-b border-gray-200 dark:border-dark-border flex gap-4 items-center justify-between">
              <h3 className="text-section-title text-dark dark:text-white whitespace-nowrap">Dettaglio Movimenti</h3>
              <div className="flex gap-3 items-center flex-nowrap">
            {/* Ricerca */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Cerca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-48 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              />
            </div>
            {/* Filtro Tipo */}
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as 'tutti' | 'Entrata' | 'Uscita')}
              className="pl-3 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            >
              <option value="tutti">Tutti i tipi</option>
              <option value="Entrata">Entrate</option>
              <option value="Uscita">Uscite</option>
            </select>
            {/* Filtro Anno */}
            <select
              value={filterAnnoTabella === 'tutti' ? 'tutti' : filterAnnoTabella}
              onChange={(e) => setFilterAnnoTabella(e.target.value === 'tutti' ? 'tutti' : parseInt(e.target.value))}
              className="pl-3 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            >
              <option value="tutti">Tutti gli anni</option>
              {anniDisponibili.map(anno => (
                <option key={anno} value={anno}>{anno}</option>
              ))}
            </select>
            {/* Filtro Mese */}
            <select
              value={filterMeseTabella}
              onChange={(e) => setFilterMeseTabella(e.target.value)}
              className="pl-3 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            >
              <option value="tutti">Tutti i mesi</option>
              {MESI_FULL.map(mese => (
                <option key={mese} value={mese}>{mese}</option>
              ))}
            </select>
            {/* Filtro Stato */}
            <select
              value={filterStatoTabella}
              onChange={(e) => setFilterStatoTabella(e.target.value as 'tutti' | 'Stimato' | 'Effettivo' | 'Nessuno')}
              className="pl-3 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="Stimato">Stimato</option>
              <option value="Effettivo">Effettivo</option>
              <option value="Nessuno">Nessuno</option>
            </select>
          </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="p-4">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border-2 border-primary/30 dark:border-primary/40 rounded-xl p-5 flex items-center justify-between shadow-lg animate-fade-in backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 dark:bg-primary/30 rounded-full flex items-center justify-center">
                    <Check size={20} className="text-primary dark:text-primary" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-dark dark:text-white">
                      {selectedIds.size} {selectedIds.size === 1 ? 'movimento selezionato' : 'movimenti selezionati'}
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
            </div>
          )}

          {/* Tabella */}
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-3 py-4 w-10">
                  <div className="flex items-center justify-center">
                    <label className="inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === sortedRecords.length && sortedRecords.length > 0}
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
                <th className="px-3 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-50 dark:bg-dark-bg w-24" onClick={() => handleSort('mese')}>
                  <div className="flex items-center gap-1">Data <SortIcon column="mese" /></div>
                </th>
                <th className="px-3 py-4 whitespace-nowrap w-24">ID Fatt.</th>
                <th className="px-3 py-4 cursor-pointer hover:bg-gray-50 dark:bg-dark-bg w-40" onClick={() => handleSort('progetto')}>
                  <div className="flex items-center gap-1">Progetto <SortIcon column="progetto" /></div>
                </th>
                <th className="px-3 py-4 cursor-pointer hover:bg-gray-50 dark:bg-dark-bg w-20" onClick={() => handleSort('spesa')}>
                  <div className="flex items-center gap-1">Spesa <SortIcon column="spesa" /></div>
                </th>
                <th className="px-3 py-4 w-48">Note</th>
                <th className="px-3 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-50 dark:bg-dark-bg w-28" onClick={() => handleSort('tipo')}>
                  <div className="flex items-center gap-1">Tipo <SortIcon column="tipo" /></div>
                </th>
                <th className="px-3 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-50 dark:bg-dark-bg w-28" onClick={() => handleSort('stato')}>
                  <div className="flex items-center gap-1">Stato <SortIcon column="stato" /></div>
                </th>
                <th className="px-3 py-4 whitespace-nowrap text-right cursor-pointer hover:bg-gray-50 dark:bg-dark-bg w-24" onClick={() => handleSort('totale')}>
                  <div className="flex items-center gap-1 justify-end">Totale <SortIcon column="totale" /></div>
                </th>
                <th className="px-3 py-4 whitespace-nowrap text-right w-20">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
              {sortedRecords.map((record) => {
                const inv = record.invoice;
                const totale = getImportoEffettivo(record);

                // Movimento standalone (senza fattura)
                if (!inv) {
                  const tipo = record.tipo || 'Entrata';
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center">
                          <label className="inline-flex items-center cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(record.id)}
                              onChange={() => toggleSelect(record.id)}
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
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(record.dataPagamento)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-400 italic">
                        Standalone
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[5rem]">-</td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[12rem]" data-tooltip={record.note || undefined}>{record.note || '-'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-md text-white ${
                          tipo === 'Entrata'
                            ? 'bg-secondary'
                            : 'bg-red-600'
                        }`}>
                          {tipo}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-md text-white ${
                          record.statoFatturazione === 'Effettivo'
                            ? 'bg-secondary'
                            : record.statoFatturazione === 'Stimato'
                            ? 'bg-primary'
                            : 'bg-gray-500'
                        }`}>
                          {record.statoFatturazione || 'Nessuno'}
                        </span>
                      </td>
                      <td className={`px-3 py-3 whitespace-nowrap text-sm font-bold text-right ${
                        tipo === 'Entrata' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {tipo === 'Entrata' ? '+' : '-'}{formatCurrency(totale)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEditModal(record)}
                            className="p-1 text-gray-500 hover:text-dark transition-colors"
                            title="Modifica"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                            title="Elimina"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Movimento con fattura
                const totaleFattura = (inv.flusso || 0) + (inv.iva || 0);
                const isParziale = record.importo !== undefined && record.importo !== null && Math.abs(record.importo - totaleFattura) > 0.01;
                return (
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center">
                        <label className="inline-flex items-center cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleSelect(record.id)}
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
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(record.dataPagamento)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-primary">
                      {formatInvoiceNumber(inv.id, inv.anno)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[10rem]" data-tooltip={inv.nomeProgetto || undefined}>{inv.nomeProgetto || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[5rem]" data-tooltip={inv.spesa && inv.tipoSpesa ? `${inv.spesa} - ${inv.tipoSpesa}` : inv.spesa || inv.tipoSpesa || undefined}>{inv.spesa || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[12rem]" data-tooltip={record.note || inv.note || undefined}>{record.note || inv.note || '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md text-white ${
                        inv.tipo === 'Entrata'
                          ? 'bg-secondary'
                          : 'bg-red-600'
                      }`}>
                        {inv.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md text-white ${
                        (record.statoFatturazione || inv.statoFatturazione) === 'Effettivo'
                          ? 'bg-secondary'
                          : (record.statoFatturazione || inv.statoFatturazione) === 'Stimato'
                          ? 'bg-primary'
                          : 'bg-gray-500'
                      }`}>
                        {record.statoFatturazione || inv.statoFatturazione}
                      </span>
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap text-sm font-bold text-right ${
                      inv.tipo === 'Entrata' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                    }`}>
                      <div className="flex items-center justify-end gap-1">
                        {isParziale && <span className="text-xs text-gray-500 dark:text-gray-400" title={`Totale fattura: ${formatCurrency(totaleFattura)}`}>*</span>}
                        {inv.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(totale)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditModal(record)}
                          className="p-1 text-gray-500 hover:text-dark transition-colors"
                          title="Modifica"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedRecords.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Nessun movimento trovato. Aggiungi un movimento collegandolo a una fattura.
            </div>
          )}

          {/* Footer con conteggio */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 dark:bg-gray-800/30 text-sm text-gray-500 dark:text-gray-400">
            {sortedRecords.length} movimenti visualizzati
          </div>
          </div>
        </div>
      </div>

      {/* Modal Aggiungi/Modifica Movimento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-dark dark:text-white">
                {editingRecord ? 'Modifica Movimento' : 'Nuovo Movimento'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Selezione Fattura */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Fattura di Riferimento *
                </label>
                {editingRecord && editingRecord.invoiceId && (
                  <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                    💡 Puoi modificare il collegamento alla fattura selezionandone un'altra dal menu
                  </div>
                )}

                {/* Filtri per ricerca fatture */}
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg space-y-2">
                    {/* Campo ricerca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
                      <input
                        type="text"
                        placeholder="Cerca per ID, progetto, categoria..."
                        value={invoiceSearchTerm}
                        onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                      />
                    </div>

                    {/* Filtri rapidi */}
                    <div className="flex gap-2">
                      <select
                        value={invoiceFilterTipo}
                        onChange={(e) => setInvoiceFilterTipo(e.target.value as 'tutti' | 'Entrata' | 'Uscita')}
                        className="flex-1 pl-3 pr-8 py-1.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                      >
                        <option value="tutti">Tutti i tipi</option>
                        <option value="Entrata">Entrate</option>
                        <option value="Uscita">Uscite</option>
                      </select>
                      <select
                        value={invoiceFilterAnno}
                        onChange={(e) => setInvoiceFilterAnno(e.target.value === 'tutti' ? 'tutti' : parseInt(e.target.value))}
                        className="flex-1 pl-3 pr-8 py-1.5 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                      >
                        <option value="tutti">Tutti gli anni</option>
                        {anniDisponibiliFatture.map(anno => (
                          <option key={anno} value={anno}>{anno}</option>
                        ))}
                      </select>
                    </div>

                    {/* Contatore risultati */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {invoicesDisponibili.length} {invoicesDisponibili.length === 1 ? 'fattura trovata' : 'fatture trovate'}
                    </div>
                </div>

                <select
                  value={formInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                >
                  <option value="">Nessuna fattura (movimento standalone)</option>
                  {invoicesDisponibili.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {formatInvoiceNumber(inv.id, inv.anno)} | {formatInvoiceDate(inv.data)} | {inv.nomeProgetto || inv.spesa || 'N/A'} ({inv.tipo}) - {formatCurrency((inv.flusso || 0) + (inv.iva || 0))}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview Fattura Selezionata */}
              {selectedInvoice && (
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Dati dalla fattura: <span className="text-dark dark:text-white">{formatInvoiceNumber(selectedInvoice.id, selectedInvoice.anno)}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500 dark:text-gray-400">Data Emissione:</span> {formatInvoiceDate(selectedInvoice.data)}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">Tipo:</span> {selectedInvoice.tipo}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">Progetto:</span> {selectedInvoice.nomeProgetto || '-'}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">Stato:</span> {selectedInvoice.statoFatturazione}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">Netto:</span> {formatCurrency(selectedInvoice.flusso || 0)}</div>
                    <div><span className="text-gray-500 dark:text-gray-400">IVA:</span> {formatCurrency(selectedInvoice.iva || 0)}</div>
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Totale Fattura:</span>{' '}
                      <span className={`font-bold ${selectedInvoice.tipo === 'Entrata' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {formatCurrency((selectedInvoice.flusso || 0) + (selectedInvoice.iva || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Data Pagamento (opzionale)
                </label>
                <input
                  type="date"
                  value={formDataPagamento}
                  onChange={(e) => setFormDataPagamento(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                />
              </div>

              {/* Importo */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Importo Movimento *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formImporto}
                    onChange={(e) => setFormImporto(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                    placeholder="0,00"
                  />
                </div>
                {formInvoiceId && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Modifica se il pagamento è parziale (es. solo IVA o solo netto)
                  </p>
                )}
              </div>

              {/* Tipo (solo per movimenti standalone) */}
              {!formInvoiceId && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Tipo Movimento *
                  </label>
                  <select
                    value={formTipoStandalone}
                    onChange={(e) => setFormTipoStandalone(e.target.value as 'Entrata' | 'Uscita')}
                    className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                  >
                    <option value="Entrata">Entrata</option>
                    <option value="Uscita">Uscita</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Seleziona se è un'entrata o un'uscita
                  </p>
                </div>
              )}

              {/* Stato del Movimento */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Stato del Movimento *
                </label>
                <select
                  value={formStatoFatturazione}
                  onChange={(e) => setFormStatoFatturazione(e.target.value as 'Stimato' | 'Effettivo' | 'Nessuno')}
                  className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                >
                  <option value="Stimato">Stimato</option>
                  <option value="Effettivo">Effettivo</option>
                  <option value="Nessuno">Nessuno</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Stato del flusso di cassa (indipendente dalla fattura collegata)
                </p>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Note (opzionale)
                </label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={3}
                  className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                  placeholder="Note aggiuntive sul movimento..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 pl-4 pr-12 py-2 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 pl-4 pr-12 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-all"
                >
                  {editingRecord ? 'Salva Modifiche' : 'Aggiungi Movimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Saldo Iniziale Banca */}
      {showBankBalanceModal && filterAnno !== 'tutti' && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-dark dark:text-white">Saldo Iniziale {filterAnno}</h2>
                <p className="text-sm text-gray-500 mt-1">Inserisci il saldo in banca ad inizio anno</p>
              </div>
              <button onClick={closeBankBalanceModal} className="text-gray-500 hover:text-dark dark:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Saldo Iniziale (EUR)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    value={bankBalanceInput}
                    onChange={(e) => setBankBalanceInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Questo valore rappresenta il saldo del conto corrente al 1° gennaio {filterAnno}
                </p>
              </div>

              {/* Preview calcolo */}
              <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Anteprima saldo:</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Saldo iniziale:</span>
                  <span className="font-medium text-dark dark:text-white">{formatCurrency(parseFloat(bankBalanceInput) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Saldo netto movimenti:</span>
                  <span className={`font-medium ${totals.saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {totals.saldo >= 0 ? '+' : ''}{formatCurrency(totals.saldo)}
                  </span>
                </div>
                <div className="border-t border-gray-200 dark:border-dark-border pt-2 flex justify-between">
                  <span className="font-medium text-gray-500 dark:text-gray-400">Saldo in banca:</span>
                  <span className={`font-bold ${((parseFloat(bankBalanceInput) || 0) + totals.saldo) >= 0 ? 'text-primary' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency((parseFloat(bankBalanceInput) || 0) + totals.saldo)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBankBalanceModal}
                  className="flex-1 px-6 py-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveBankBalance}
                  className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-dark dark:text-white mb-3">
              {deleteConfirmDialog.type === 'single' ? 'Elimina movimento' : 'Elimina movimenti'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {deleteConfirmDialog.type === 'single'
                ? 'Sei sicuro di voler eliminare questo movimento?'
                : `Sei sicuro di voler eliminare ${deleteConfirmDialog.count} movimenti selezionati?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmDialog(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-dark dark:text-white rounded-lg hover:opacity-90 transition-all font-medium"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:opacity-90 transition-all font-medium"
              >
                SI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
