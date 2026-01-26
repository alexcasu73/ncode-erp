import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { Invoice, Deal, DealStage } from '../types';
import { Plus, Download, Upload, Filter, ArrowUpCircle, ArrowDownCircle, Search, Calendar, Eye, Edit2, Trash2, X, Check, ChevronUp, ChevronDown, ChevronsUpDown, RotateCcw, Copy } from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { exportInvoicesToExcel, importInvoicesFromExcel } from '../lib/import-export';

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

// Helper per formattare ID fattura: "Fattura_123/2026" -> "N. 123/2026"
const formatInvoiceId = (id: string, anno: number): string => {
  const numero = id.replace('Fattura_', '');

  // Se il numero contiene già l'anno (es. "NCO-IN-123/2026"), usa quello
  if (numero.includes('/')) {
    // Rimuovi il prefisso aziendale (es. "NCO-IN-001/2025" -> "IN-001/2025")
    const withoutCompanyPrefix = numero.replace(/^[A-Z0-9]+-/, '');
    return withoutCompanyPrefix;
  }

  // Altrimenti, se è solo un numero o un UUID, aggiungi l'anno
  // Per UUID molto lunghi, mostra solo le prime 8 cifre
  if (numero.length > 10) {
    return `${numero.substring(0, 8)}.../${anno}`;
  }

  return `${numero}/${anno}`;
};

export const Invoicing: React.FC = () => {
  const { invoices, deals, cashflowRecords, loading, addInvoice, updateInvoice, deleteInvoice, addCashflowRecord } = useData();
  const { companyId } = useAuth();
  const { canEdit, canDelete, canImport, isViewer, loading: roleLoading } = useUserRole();
  const [searchTerm, setSearchTerm] = useState(() => {
    return localStorage.getItem('invoicing_searchTerm') || '';
  });
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
  const [filterAnnoTabella, setFilterAnnoTabella] = useState<number | 'tutti'>(() => {
    const saved = localStorage.getItem('invoicing_filterAnnoTabella');
    return saved ? (saved === 'tutti' ? 'tutti' : parseInt(saved)) : 'tutti';
  });
  const [filterSenzaCashflow, setFilterSenzaCashflow] = useState<boolean>(() => {
    const saved = localStorage.getItem('invoicing_filterSenzaCashflow');
    return saved === 'true';
  });
  const [filterConScadenza, setFilterConScadenza] = useState<boolean>(() => {
    const saved = localStorage.getItem('invoicing_filterConScadenza');
    return saved === 'true';
  });
  const [bilancioCollapsed, setBilancioCollapsed] = useState(() => {
    return localStorage.getItem('invoicing_bilancioCollapsed') === 'true';
  });
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Refs for horizontal scroll sync
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const topScrollContentRef = useRef<HTMLDivElement>(null);

  // Sync scroll between top scrollbar and table
  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const topScroll = topScrollRef.current;
    const topScrollContent = topScrollContentRef.current;

    if (!tableScroll || !topScroll || !topScrollContent) return;

    // Set the width of the fake scroll content to match table scroll width
    const syncWidth = () => {
      topScrollContent.style.width = `${tableScroll.scrollWidth}px`;
    };

    // Sync scroll from table to top
    const onTableScroll = () => {
      topScroll.scrollLeft = tableScroll.scrollLeft;
    };

    // Sync scroll from top to table
    const onTopScroll = () => {
      tableScroll.scrollLeft = topScroll.scrollLeft;
    };

    syncWidth();
    tableScroll.addEventListener('scroll', onTableScroll);
    topScroll.addEventListener('scroll', onTopScroll);

    // Re-sync width on window resize
    window.addEventListener('resize', syncWidth);

    return () => {
      tableScroll.removeEventListener('scroll', onTableScroll);
      topScroll.removeEventListener('scroll', onTopScroll);
      window.removeEventListener('resize', syncWidth);
    };
  }, [invoices.length]); // Re-sync when table content changes

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

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterAnnoTabella', String(filterAnnoTabella));
  }, [filterAnnoTabella]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterSenzaCashflow', String(filterSenzaCashflow));
  }, [filterSenzaCashflow]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_filterConScadenza', String(filterConScadenza));
  }, [filterConScadenza]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_searchTerm', searchTerm);
  }, [searchTerm]);

  React.useEffect(() => {
    localStorage.setItem('invoicing_bilancioCollapsed', String(bilancioCollapsed));
  }, [bilancioCollapsed]);

  // Reset tutti i filtri
  const resetAllFilters = () => {
    setFilterAnno('tutti');
    setFilterMese('tutti');
    setVistaStato('tutti');
    setSearchTerm('');
    setFilterTipo('tutti');
    setFilterStato('tutti');
    setFilterMeseTabella('tutti');
    setFilterAnnoTabella('tutti');
    setFilterSenzaCashflow(false);
    setFilterConScadenza(false);
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
      filtered = filtered.filter(i => i.anno == filterAnno);
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
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    type: 'single' | 'bulk';
    id?: string;
    count?: number;
  } | null>(null);
  const [bulkCashflowDialog, setBulkCashflowDialog] = useState<{
    type: 'confirm' | 'error' | 'success';
    invoicesStimato?: Invoice[];
    invoicesWithCashflow?: Invoice[];
    invoicesEffettivo?: Invoice[];
    created?: number;
  } | null>(null);
  const [bulkDuplicateDialog, setBulkDuplicateDialog] = useState<{
    type: 'confirm' | 'success';
    invoices?: Invoice[];
    duplicated?: number;
  } | null>(null);

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

      // Normalize invoice status: treat empty string, null, undefined as "Nessuno"
      const invoiceStatus = inv.statoFatturazione || 'Nessuno';
      const matchesStato = filterStato === 'tutti' || invoiceStatus === filterStato;

      const matchesMeseTabella = filterMeseTabella === 'tutti' || inv.mese === filterMeseTabella;
      // Use loose equality to handle potential type mismatches (number vs string)
      const matchesAnnoTabella = filterAnnoTabella === 'tutti' || inv.anno == filterAnnoTabella;

      // Filtra fatture senza cashflow associato
      const hasCashflow = cashflowRecords.some(cf => cf.invoiceId === inv.id);
      const matchesSenzaCashflow = !filterSenzaCashflow || !hasCashflow;

      // Filtra fatture con scadenza (verifica anche stringhe vuote)
      const hasScadenza = inv.dataScadenza !== undefined && inv.dataScadenza !== null && inv.dataScadenza !== '';
      const matchesConScadenza = !filterConScadenza || hasScadenza;

      return matchesSearch && matchesTipo && matchesStato && matchesMeseTabella && matchesAnnoTabella && matchesSenzaCashflow && matchesConScadenza;
    });
  }, [invoices, cashflowRecords, searchTerm, filterTipo, filterStato, filterMeseTabella, filterAnnoTabella, filterSenzaCashflow, filterConScadenza]);

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
          // Considera il segno: Uscite = negative, Entrate = positive
          const flussoA = a.tipo === 'Uscita' ? -(a.flusso || 0) : (a.flusso || 0);
          const flussoB = b.tipo === 'Uscita' ? -(b.flusso || 0) : (b.flusso || 0);
          comparison = flussoA - flussoB;
          break;
        case 'totale':
          // Considera il segno: Uscite = negative, Entrate = positive
          const totaleA = a.tipo === 'Uscita' ? -(a.flusso || 0) - (a.iva || 0) : (a.flusso || 0) + (a.iva || 0);
          const totaleB = b.tipo === 'Uscita' ? -(b.flusso || 0) - (b.iva || 0) : (b.flusso || 0) + (b.iva || 0);
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

  const handleDelete = (id: string) => {
    setDeleteConfirmDialog({ type: 'single', id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmDialog) return;

    if (deleteConfirmDialog.type === 'single' && deleteConfirmDialog.id) {
      await deleteInvoice(deleteConfirmDialog.id);
    } else if (deleteConfirmDialog.type === 'bulk') {
      // Pre-check all selected invoices for cashflow associations
      const linkedIds: string[] = [];
      const freeIds: string[] = [];

      for (const id of selectedIds) {
        if (cashflowRecords.some(cf => cf.invoiceId === id)) {
          linkedIds.push(id);
        } else {
          freeIds.push(id);
        }
      }

      // Ask once for all linked invoices
      let cascadeDelete = false;
      if (linkedIds.length > 0) {
        const linkedInvoices = invoices.filter(inv => linkedIds.includes(inv.id));
        const dettagli = linkedInvoices.map(inv => {
          const cfCount = cashflowRecords.filter(cf => cf.invoiceId === inv.id).length;
          return `- ${formatInvoiceId(inv.id, inv.anno)} — ${inv.nomeProgetto} (${cfCount} flusso/i)`;
        }).join('\n');

        cascadeDelete = confirm(`${linkedIds.length} fattura/e hanno flussi di cassa associati:\n\n${dettagli}\n\nVuoi eliminare anche i flussi di cassa associati?`);
      }

      // Delete free invoices
      for (const id of freeIds) {
        await deleteInvoice(id);
      }

      // Delete linked invoices (with cascade if confirmed)
      if (cascadeDelete) {
        for (const id of linkedIds) {
          await deleteInvoice(id, true);
        }
      }

      setSelectedIds(cascadeDelete ? new Set() : new Set(linkedIds));
    }

    setDeleteConfirmDialog(null);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedInvoices.map(i => i.id)));
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

  const handleBulkDuplicate = () => {
    if (selectedIds.size === 0) return;

    const selectedInvoices = sortedInvoices.filter(inv => selectedIds.has(inv.id));

    // Show confirmation dialog
    setBulkDuplicateDialog({
      type: 'confirm',
      invoices: selectedInvoices,
    });
  };

  const confirmBulkDuplicate = async () => {
    if (!bulkDuplicateDialog || bulkDuplicateDialog.type !== 'confirm') return;

    const { invoices: selectedInvoices } = bulkDuplicateDialog;
    if (!selectedInvoices) return;

    console.log('🔵 [Bulk Duplicate] Starting duplication for invoices:', selectedInvoices.length);

    let duplicated = 0;
    for (const invoice of selectedInvoices) {
      const anno = invoice.anno;

      // Trova il numero più alto per quest'anno
      const fattureAnno = invoices.filter(inv => inv.anno === anno);
      let maxNumero = 0;

      fattureAnno.forEach(inv => {
        const match = inv.id.match(/Fattura_(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumero) maxNumero = num;
        }
      });

      const nuovoNumero = maxNumero + 1;
      const newId = `Fattura_${nuovoNumero}/${anno}`;

      // Crea la fattura duplicata
      const duplicatedInvoice: Omit<Invoice, 'id'> = {
        ...invoice,
        id: newId,
      };

      console.log('🔵 [Bulk Duplicate] Duplicating invoice:', invoice.id, '→', newId);
      const result = await addInvoice(duplicatedInvoice as Omit<Invoice, 'id'>);

      if (result) {
        duplicated++;
        console.log('✅ [Bulk Duplicate] Duplicated successfully');
      } else {
        console.error('❌ [Bulk Duplicate] Failed to duplicate invoice:', invoice.id);
      }
    }

    // Show success dialog
    setBulkDuplicateDialog({
      type: 'success',
      duplicated,
      invoices: selectedInvoices,
    });
    setSelectedIds(new Set());
  };

  const handleBulkCreateCashflow = () => {
    if (selectedIds.size === 0) return;

    const selectedInvoices = sortedInvoices.filter(inv => selectedIds.has(inv.id));

    // Separa per stato e presenza di cashflow
    const invoicesWithCashflow = selectedInvoices.filter(inv =>
      cashflowRecords.some(cf => cf.invoiceId === inv.id)
    );
    const invoicesEffettivo = selectedInvoices.filter(inv =>
      !cashflowRecords.some(cf => cf.invoiceId === inv.id) && inv.statoFatturazione === 'Effettivo'
    );
    const invoicesStimato = selectedInvoices.filter(inv =>
      !cashflowRecords.some(cf => cf.invoiceId === inv.id) && inv.statoFatturazione === 'Stimato'
    );

    if (invoicesStimato.length === 0) {
      // Show error dialog
      setBulkCashflowDialog({
        type: 'error',
        invoicesWithCashflow,
        invoicesEffettivo,
      });
      return;
    }

    // Show confirmation dialog
    setBulkCashflowDialog({
      type: 'confirm',
      invoicesStimato,
      invoicesWithCashflow,
      invoicesEffettivo,
    });
  };

  const confirmBulkCreateCashflow = async () => {
    if (!bulkCashflowDialog || bulkCashflowDialog.type !== 'confirm') return;

    const { invoicesStimato } = bulkCashflowDialog;
    if (!invoicesStimato) return;

    console.log('🔵 [Bulk Cashflow] Starting creation for invoices:', invoicesStimato.length);

    // Crea flussi di cassa
    let created = 0;
    for (const invoice of invoicesStimato) {
      const newCashflow: Omit<CashflowRecord, 'id'> = {
        invoiceId: invoice.id,
        statoFatturazione: 'Stimato',
        dataPagamento: invoice.data as string, // Usa la data della fattura
      };

      console.log('🔵 [Bulk Cashflow] Creating cashflow for invoice:', invoice.id, newCashflow);
      const result = await addCashflowRecord(newCashflow);
      console.log('🔵 [Bulk Cashflow] Result:', result);
      if (result) {
        created++;
        console.log('✅ [Bulk Cashflow] Created successfully, count:', created);
      } else {
        console.error('❌ [Bulk Cashflow] Failed to create for invoice:', invoice.id);
      }
    }

    console.log('🔵 [Bulk Cashflow] Total created:', created, 'out of', invoicesStimato.length);

    // Show success dialog
    setBulkCashflowDialog({
      type: 'success',
      created,
      invoicesStimato,
    });
    setSelectedIds(new Set());
  };

  // Export invoices to Excel
  const handleExport = () => {
    const dataToExport = filteredInvoices.length > 0 ? filteredInvoices : invoices;
    exportInvoicesToExcel(dataToExport, `fatture_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Import invoices from Excel
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportErrors([]);

    try {
      const { invoices: importedInvoices, errors } = await importInvoicesFromExcel(file);

      if (errors.length > 0) {
        setImportErrors(errors);
      }

      // Add imported invoices to database
      let successCount = 0;
      let errorCount = 0;

      for (const invoice of importedInvoices) {
        try {
          let invoiceId: string;

          // Se l'invoice ha già un ID valido, usalo
          if (invoice.id && invoice.id.startsWith('Fattura_')) {
            invoiceId = invoice.id;

            // Check if ID already exists
            const existingInvoice = invoices.find(inv => inv.id === invoiceId);
            if (existingInvoice) {
              // Skip duplicate ID
              errorCount++;
              console.error(`ID duplicato ${invoice.id}, riga saltata`);
              continue;
            }
          } else {
            // Genera numero progressivo per l'anno della fattura
            const anno = invoice.anno || new Date().getFullYear();

            // Trova il numero più alto per quest'anno (incluse le fatture già importate in questo batch)
            const fattureAnno = [...invoices, ...importedInvoices.slice(0, importedInvoices.indexOf(invoice))]
              .filter(inv => inv.anno === anno);

            let maxNumero = 0;
            fattureAnno.forEach(inv => {
              const match = inv.id?.match(/Fattura_(\d+)/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumero) maxNumero = num;
              }
            });

            const nuovoNumero = maxNumero + 1;
            invoiceId = `Fattura_${nuovoNumero}/${anno}`;
          }

          await addInvoice({ ...invoice, id: invoiceId } as Invoice);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`Errore importazione fattura:`, err);
        }
      }

      const message = `Import completato!\n✅ Fatture importate: ${successCount}\n${errorCount > 0 ? `❌ Errori: ${errorCount}\n` : ''}${errors.length > 0 ? `⚠️ Righe scartate (validazione): ${errors.length}` : ''}`;
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
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '15px' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-page-title text-dark dark:text-white">Fatturazione</h1>
          <p className="text-page-subtitle mt-1">Gestione entrate e uscite</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={invoices.length === 0}
            className="bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border text-dark dark:text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Esporta in Excel"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Esporta</span>
          </button>

          {/* Import Button - Only for admin and manager */}
          {canImport && (
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
          )}

          {/* Add New Button - Hidden for viewers */}
          {canEdit && (
            <button
              onClick={() => { setEditingInvoice(null); setShowModal(true); }}
              className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nuova Voce</span>
            </button>
          )}
        </div>
      </div>

      {/* Selettore Anno e Toggle Vista Stato */}
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
            {MESI.map(mese => (
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
            Tutti ({totals.countEffettive + totals.countStimate})
          </button>
          <button
            onClick={() => setVistaStato('effettivo')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              vistaStato === 'effettivo'
                ? 'bg-green-600 dark:bg-green-500 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'
            }`}
          >
            Effettivo ({totals.countEffettive})
          </button>
          <button
            onClick={() => setVistaStato('stimato')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              vistaStato === 'stimato'
                ? 'bg-primary text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'
            }`}
          >
            Stimato ({totals.countStimate})
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-secondary shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle size={16} className="text-secondary" />
            <h3 className="text-card-title">
              Entrate {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettive' : 'Stimate'})`}
            </h3>
          </div>
          <p className="text-base sm:text-lg md:text-xl xl:text-2xl font-bold text-dark dark:text-white whitespace-nowrap">{formatCurrency(activeData.entrate)}</p>
          <p className="text-small mt-1">{activeData.countEntrate} voci</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-red-600 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle size={16} className="text-red-600" />
            <h3 className="text-card-title">
              Uscite {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettive' : 'Stimate'})`}
            </h3>
          </div>
          <p className="text-base sm:text-lg md:text-xl xl:text-2xl font-bold text-dark dark:text-white whitespace-nowrap">{formatCurrency(activeData.uscite)}</p>
          <p className="text-small mt-1">{activeData.countUscite} voci</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-primary shadow-sm">
          <h3 className="text-card-title mb-1">
            Margine {vistaStato !== 'tutti' && `(${vistaStato === 'effettivo' ? 'Effettivo' : 'Stimato'})`}
          </h3>
          <p className={`text-base sm:text-lg md:text-xl xl:text-2xl font-bold whitespace-nowrap ${activeData.margine >= 0 ? 'text-secondary' : 'text-red-600'}`}>
            {formatCurrency(activeData.margine)}
          </p>
          <p className="text-xs mt-1 truncate">IVA: {formatCurrency(activeData.ivaBalance)}</p>
        </div>
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-gray-400 dark:border-gray-500 shadow-sm">
          <h3 className="text-card-title mb-3">Riepilogo per Stato</h3>
          <div className="flex justify-around items-center gap-2">
            <div className="text-center flex-1 min-w-0">
              <p className="text-base sm:text-lg md:text-xl font-bold text-secondary">{totals.countEffettive}</p>
              <p className="text-small">Effettive</p>
            </div>
            <div className="w-px bg-gray-200 dark:bg-dark-border h-12"></div>
            <div className="text-center flex-1 min-w-0">
              <p className="text-base sm:text-lg md:text-xl font-bold text-primary">{totals.countStimate}</p>
              <p className="text-small">Stimate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confronto Effettivo vs Stimato */}
      {vistaStato === 'tutti' && (
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border">
          <button
            onClick={() => setBilancioCollapsed(!bilancioCollapsed)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50/50 dark:hover:bg-dark-bg/50 transition-colors rounded-lg"
          >
            <h3 className="text-section-title text-dark dark:text-white">Confronto Bilancio: Effettivo vs Stimato</h3>
            <ChevronDown
              size={20}
              className={`text-gray-400 transition-transform duration-200 ${bilancioCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
          {!bilancioCollapsed && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Colonna Effettivo */}
                <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50/30 dark:bg-green-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full"></div>
                    <h4 className="font-bold text-green-700 dark:text-green-400">Effettivo (Confermato)</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Entrate:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(totals.effettivo.entrate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Uscite:</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">-{formatCurrency(totals.effettivo.uscite)}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-dark-border pt-2 flex justify-between">
                      <span className="font-bold text-gray-500 dark:text-gray-400">Margine:</span>
                      <span className={`font-bold ${totals.effettivo.margine >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(totals.effettivo.margine)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Saldo IVA:</span>
                      <span className="text-gray-500 dark:text-gray-400">{formatCurrency(totals.effettivo.ivaBalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Colonna Stimato */}
                <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4 bg-gray-50/30 dark:bg-gray-800/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <h4 className="font-bold text-dark dark:text-white">Stimato</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Entrate:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(totals.stimato.entrate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Uscite:</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">-{formatCurrency(totals.stimato.uscite)}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-dark-border pt-2 flex justify-between">
                      <span className="font-bold text-gray-500 dark:text-gray-400">Margine:</span>
                      <span className={`font-bold ${totals.stimato.margine >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(totals.stimato.margine)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Saldo IVA:</span>
                      <span className="text-gray-500 dark:text-gray-400">{formatCurrency(totals.stimato.ivaBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Totale Combinato */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <span className="text-body text-gray-500 dark:text-gray-400">Bilancio Totale (Effettivo + Stimato):</span>
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
                      <p className={`text-body font-bold ${totals.tutti.margine >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(totals.tutti.margine)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-dark-card rounded-lg p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <div className="flex flex-col gap-4">
          <h3 className="text-section-title text-dark dark:text-white">Dettaglio Fatture</h3>
          <div className="flex gap-3 items-center flex-wrap">
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
              onChange={(e) => setFilterTipo(e.target.value as any)}
              className="pl-3 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            >
              <option value="tutti">Tutti i tipi</option>
              <option value="Entrata">Entrate</option>
              <option value="Uscita">Uscite</option>
            </select>
            {/* Filtro Stato */}
            <select
              value={filterStato}
              onChange={(e) => setFilterStato(e.target.value as any)}
              className="pl-3 pr-8 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="Stimato">Stimato</option>
              <option value="Effettivo">Effettivo</option>
              <option value="Nessuno">Nessuno</option>
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
              {MESI.map(mese => (
                <option key={mese} value={mese}>{mese}</option>
              ))}
            </select>
            {/* Filtro Senza Cashflow */}
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-gray-800/30 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
              <input
                type="checkbox"
                checked={filterSenzaCashflow}
                onChange={(e) => setFilterSenzaCashflow(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-4 h-4 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/50 peer-focus:ring-2 peer-focus:ring-primary/20">
                <Check
                  size={12}
                  className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                  strokeWidth={3}
                />
              </div>
              <span className="text-sm text-dark dark:text-white whitespace-nowrap">Senza flusso</span>
            </label>
            {/* Filtro Con Scadenza */}
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg bg-white dark:bg-gray-800/30 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
              <input
                type="checkbox"
                checked={filterConScadenza}
                onChange={(e) => setFilterConScadenza(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-4 h-4 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/50 peer-focus:ring-2 peer-focus:ring-primary/20">
                <Check
                  size={12}
                  className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                  strokeWidth={3}
                />
              </div>
              <span className="text-sm text-dark dark:text-white whitespace-nowrap">Con scadenza</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar - Hidden for viewers */}
      {selectedIds.size > 0 && !isViewer && (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border-2 border-primary/30 dark:border-primary/40 rounded-xl p-5 flex items-center justify-between shadow-lg animate-fade-in backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 dark:bg-primary/30 rounded-full flex items-center justify-center">
              <Check size={20} className="text-primary dark:text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-dark dark:text-white">
                {selectedIds.size} {selectedIds.size === 1 ? 'fattura selezionata' : 'fatture selezionate'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Scegli un'azione da eseguire
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
            {canEdit && (
              <button
                onClick={handleBulkCreateCashflow}
                className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <ArrowUpCircle size={16} />
                Crea Flussi di Cassa
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleBulkDuplicate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Copy size={16} />
                Duplica
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Trash2 size={16} />
                Elimina {selectedIds.size > 1 ? 'tutti' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-dark-card rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-dark-border relative">
        <style>{`
          .horizontal-scrollbar::-webkit-scrollbar {
            -webkit-appearance: none;
            height: 12px;
          }
          .horizontal-scrollbar::-webkit-scrollbar-track {
            background: #f3f4f6;
            border-radius: 6px;
          }
          .horizontal-scrollbar::-webkit-scrollbar-thumb {
            background: #9ca3af;
            border-radius: 6px;
            border: 2px solid #f3f4f6;
          }
          .horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #6b7280;
          }
          .dark .horizontal-scrollbar::-webkit-scrollbar-track {
            background: #1f2937;
          }
          .dark .horizontal-scrollbar::-webkit-scrollbar-thumb {
            background: #6b7280;
            border-color: #1f2937;
          }
          .dark .horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* Table with scroll */}
        <div
          ref={tableScrollRef}
          className="hide-scrollbar overflow-x-scroll"
        >
          <table className="w-full" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {canDelete && (
                  <th className="px-6 py-4">
                    <div className="flex items-center justify-center">
                      <label className="inline-flex items-center cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === sortedInvoices.length && sortedInvoices.length > 0}
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
                )}
                <th
                  className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    Id Fattura
                    {sortColumn === 'id' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('tipo')}
                >
                  <div className="flex items-center gap-1">
                    Tipo
                    {sortColumn === 'tipo' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('data')}
                >
                  <div className="flex items-center gap-1">
                    Data
                    {sortColumn === 'data' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('progetto')}
                >
                  <div className="flex items-center gap-1">
                    Progetto / Categoria
                    {sortColumn === 'progetto' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th className="px-6 py-4 whitespace-nowrap">Descrizione</th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('stato')}
                >
                  <div className="flex items-center gap-1">
                    Stato
                    {sortColumn === 'stato' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-right cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('flusso')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Flusso
                    {sortColumn === 'flusso' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th className="px-6 py-4 whitespace-nowrap text-right">IVA</th>
                <th
                  className="px-6 py-4 text-right cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  onClick={() => handleSort('totale')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Totale
                    {sortColumn === 'totale' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : <ChevronsUpDown size={14} className="text-gray-300 dark:text-gray-600" />}
                  </div>
                </th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
              {sortedInvoices.map((inv) => (
                <tr key={inv.id} className={`hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors ${inv.tipo === 'Uscita' ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''}`}>
                  {canDelete && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <label className="inline-flex items-center cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(inv.id)}
                            onChange={() => toggleSelect(inv.id)}
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
                  )}
                  <td className="px-6 py-4 text-sm text-dark dark:text-white font-semibold">
                    {formatInvoiceId(inv.id, inv.anno)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {inv.tipo === 'Entrata' ? (
                      <ArrowUpCircle size={20} className="text-green-500" />
                    ) : (
                      <ArrowDownCircle size={20} className="text-orange-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(inv.data)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {inv.tipo === 'Entrata' ? (
                      <span className="font-medium text-dark dark:text-white">{inv.nomeProgetto || '-'}</span>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-medium text-dark dark:text-white">{inv.spesa || '-'}</span>
                        {inv.tipoSpesa && (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-border text-gray-600 dark:text-gray-400 text-xs rounded">
                            {inv.tipoSpesa}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate" data-tooltip={inv.note || undefined}>
                    {inv.note || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-md text-white ${
                      inv.statoFatturazione === 'Effettivo'
                        ? 'bg-secondary'
                        : inv.statoFatturazione === 'Stimato'
                        ? 'bg-primary'
                        : 'bg-gray-500'
                    }`}>
                      {inv.statoFatturazione || 'Nessuno'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${inv.tipo === 'Uscita' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                    {inv.tipo === 'Uscita' ? '-' : '+'}{formatCurrency(inv.flusso || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {formatCurrency(inv.iva || 0)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${inv.tipo === 'Uscita' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                    {inv.tipo === 'Uscita' ? '-' : '+'}{formatCurrency((inv.flusso || 0) + (inv.iva || 0))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => { setEditingInvoice(inv); setShowModal(true); }}
                          className="text-gray-500 hover:text-blue-500"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {!canEdit && !canDelete && (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedInvoices.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nessuna voce trovata
            </div>
          )}
        </div>

        {/* Bottom Scrollbar - Always visible at bottom */}
        <div
          ref={topScrollRef}
          className="horizontal-scrollbar overflow-x-scroll sticky bottom-0 z-10 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border"
          style={{ height: '20px' }}
        >
          <div ref={topScrollContentRef} style={{ height: '1px' }}></div>
        </div>
      </div>

      {/* Modal per aggiungere/modificare */}
      {showModal && (
        <InvoiceModal
          invoice={editingInvoice}
          deals={deals}
          invoices={invoices}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editingInvoice) {
              await updateInvoice(editingInvoice.id, data);
            } else {
              await addInvoice(data as Omit<Invoice, 'id'>);
            }
            setShowModal(false);
          }}
          onSaveAndCreateCashflow={async (data) => {
            let invoiceId: string;

            if (editingInvoice) {
              // Modifica fattura esistente
              await updateInvoice(editingInvoice.id, data);
              invoiceId = editingInvoice.id;
            } else {
              // Crea nuova fattura
              const newInvoice = await addInvoice(data as Omit<Invoice, 'id'>);
              if (!newInvoice) {
                alert('Errore durante la creazione della fattura');
                return;
              }
              invoiceId = newInvoice.id;
            }

            // Crea il cashflow collegato
            const newCashflow: Omit<CashflowRecord, 'id'> = {
              invoiceId: invoiceId,
              statoFatturazione: 'Stimato',
              dataPagamento: data.data as string,
            };

            console.log('🔵 [Invoicing] Creating cashflow for invoice:', invoiceId, newCashflow);
            const result = await addCashflowRecord(newCashflow);

            if (result) {
              console.log('✅ [Invoicing] Cashflow created successfully');
            } else {
              console.error('❌ [Invoicing] Failed to create cashflow');
              alert('Fattura salvata ma errore durante la creazione del flusso di cassa');
            }

            setShowModal(false);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-dark dark:text-white mb-3">
              {deleteConfirmDialog.type === 'single' ? 'Elimina fattura' : 'Elimina fatture'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {deleteConfirmDialog.type === 'single'
                ? 'Sei sicuro di voler eliminare questa fattura?'
                : `Sei sicuro di voler eliminare ${deleteConfirmDialog.count} fatture selezionate?`}
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

      {/* Bulk Cashflow Creation Dialog */}
      {bulkCashflowDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
            {/* Error Dialog */}
            {bulkCashflowDialog.type === 'error' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <X size={24} className="text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark dark:text-white">
                    Nessuna fattura può essere processata
                  </h3>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Puoi creare flussi di cassa solo da fatture in stato <strong>Stimato</strong> senza flusso già associato.
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                    {bulkCashflowDialog.invoicesWithCashflow && bulkCashflowDialog.invoicesWithCashflow.length > 0 && (
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          {bulkCashflowDialog.invoicesWithCashflow.length} {bulkCashflowDialog.invoicesWithCashflow.length === 1 ? 'ha' : 'hanno'} già un flusso di cassa
                        </span>
                      </li>
                    )}
                    {bulkCashflowDialog.invoicesEffettivo && bulkCashflowDialog.invoicesEffettivo.length > 0 && (
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500">•</span>
                        <span>
                          {bulkCashflowDialog.invoicesEffettivo.length} {bulkCashflowDialog.invoicesEffettivo.length === 1 ? 'è' : 'sono'} in stato Effettivo
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setBulkCashflowDialog(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-dark dark:text-white rounded-lg hover:opacity-90 transition-all font-medium"
                  >
                    Chiudi
                  </button>
                </div>
              </>
            )}

            {/* Confirmation Dialog */}
            {bulkCashflowDialog.type === 'confirm' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-secondary/20 dark:bg-secondary/30 rounded-full flex items-center justify-center">
                    <ArrowUpCircle size={24} className="text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark dark:text-white">
                    Crea Flussi di Cassa
                  </h3>
                </div>
                <div className="mb-6">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-3">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                      <Check size={16} className="flex-shrink-0" />
                      <span>
                        {bulkCashflowDialog.invoicesStimato?.length === 1 ? 'Verrà creato' : 'Verranno creati'} <strong>{bulkCashflowDialog.invoicesStimato?.length}</strong> {bulkCashflowDialog.invoicesStimato?.length === 1 ? 'flusso di cassa' : 'flussi di cassa'} {bulkCashflowDialog.invoicesStimato?.length === 1 ? 'dalla fattura' : 'dalle fatture'} in stato <strong>Stimato</strong>
                      </span>
                    </p>
                  </div>
                  {((bulkCashflowDialog.invoicesWithCashflow && bulkCashflowDialog.invoicesWithCashflow.length > 0) ||
                    (bulkCashflowDialog.invoicesEffettivo && bulkCashflowDialog.invoicesEffettivo.length > 0)) && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                          {((bulkCashflowDialog.invoicesWithCashflow?.length || 0) + (bulkCashflowDialog.invoicesEffettivo?.length || 0))}{' '}
                          {((bulkCashflowDialog.invoicesWithCashflow?.length || 0) + (bulkCashflowDialog.invoicesEffettivo?.length || 0)) === 1 ? 'fattura verrà ignorata' : 'fatture verranno ignorate'}:
                        </span>
                      </p>
                      <ul className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
                        {bulkCashflowDialog.invoicesWithCashflow && bulkCashflowDialog.invoicesWithCashflow.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>
                              {bulkCashflowDialog.invoicesWithCashflow.length} {bulkCashflowDialog.invoicesWithCashflow.length === 1 ? 'ha' : 'hanno'} già un flusso di cassa
                            </span>
                          </li>
                        )}
                        {bulkCashflowDialog.invoicesEffettivo && bulkCashflowDialog.invoicesEffettivo.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span>•</span>
                            <span>
                              {bulkCashflowDialog.invoicesEffettivo.length} {bulkCashflowDialog.invoicesEffettivo.length === 1 ? 'è' : 'sono'} in stato Effettivo (non processabile)
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setBulkCashflowDialog(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-dark dark:text-white rounded-lg hover:opacity-90 transition-all font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={confirmBulkCreateCashflow}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg transition-all font-medium"
                  >
                    Conferma
                  </button>
                </div>
              </>
            )}

            {/* Success Dialog */}
            {bulkCashflowDialog.type === 'success' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check size={24} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark dark:text-white">
                    Operazione completata
                  </h3>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Creati <strong>{bulkCashflowDialog.created}</strong> flussi di cassa da <strong>{bulkCashflowDialog.invoicesStimato?.length}</strong> fatture in stato Stimato.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setBulkCashflowDialog(null)}
                    className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg transition-all font-medium"
                  >
                    Chiudi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Duplicate Dialog */}
      {bulkDuplicateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
            {/* Confirmation Dialog */}
            {bulkDuplicateDialog.type === 'confirm' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Copy size={24} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark dark:text-white">
                    Duplica Fatture
                  </h3>
                </div>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Duplicare <strong>{bulkDuplicateDialog.invoices?.length}</strong> {bulkDuplicateDialog.invoices?.length === 1 ? 'fattura' : 'fatture'}?
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {bulkDuplicateDialog.invoices?.length === 1 ? 'La fattura verrà duplicata' : 'Le fatture verranno duplicate'} con nuovi ID progressivi mantenendo tutti i dati originali.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setBulkDuplicateDialog(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-dark dark:text-white rounded-lg hover:opacity-90 transition-all font-medium"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={confirmBulkDuplicate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
                  >
                    Conferma
                  </button>
                </div>
              </>
            )}

            {/* Success Dialog */}
            {bulkDuplicateDialog.type === 'success' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check size={24} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark dark:text-white">
                    Duplicazione completata
                  </h3>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Duplicate <strong>{bulkDuplicateDialog.duplicated}</strong> {bulkDuplicateDialog.duplicated === 1 ? 'fattura' : 'fatture'} con successo.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setBulkDuplicateDialog(null)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium"
                  >
                    Chiudi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Modal Component
interface InvoiceModalProps {
  invoice: Invoice | null;
  deals: Deal[];
  invoices: Invoice[];
  onClose: () => void;
  onSave: (data: Partial<Invoice>) => void;
  onSaveAndCreateCashflow?: (data: Partial<Invoice>) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, deals, invoices, onClose, onSave, onSaveAndCreateCashflow }) => {
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
    console.log('🔵 [Invoicing] handleSubmit called', { invoice, formData });

    // Se stiamo modificando una fattura esistente, mantieni l'ID
    if (invoice?.id) {
      console.log('🔵 [Invoicing] Updating existing invoice:', invoice.id);
      onSave({ ...formData, id: invoice.id });
      return;
    }

    // Per nuove fatture, genera numero progressivo
    const anno = formData.anno || new Date().getFullYear();
    console.log('🔵 [Invoicing] Creating new invoice for year:', anno);

    // Trova il numero più alto per quest'anno
    const fattureAnno = invoices.filter(inv => inv.anno === anno);
    console.log('🔵 [Invoicing] Existing invoices for year:', fattureAnno.length);
    let maxNumero = 0;

    fattureAnno.forEach(inv => {
      // Estrai numero da ID come "Fattura_123/2026" o "Fattura_123"
      const match = inv.id.match(/Fattura_(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumero) maxNumero = num;
      }
    });

    const nuovoNumero = maxNumero + 1;
    const id = `Fattura_${nuovoNumero}/${anno}`;
    console.log('✅ [Invoicing] Generated new invoice ID:', id);

    onSave({ ...formData, id });
  };

  const handleSubmitWithCashflow = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onSaveAndCreateCashflow) return;

    console.log('🔵 [Invoicing] handleSubmitWithCashflow called', { invoice, formData });

    // Se stiamo modificando una fattura esistente, mantieni l'ID
    if (invoice?.id) {
      console.log('🔵 [Invoicing] Updating existing invoice with cashflow:', invoice.id);
      onSaveAndCreateCashflow({ ...formData, id: invoice.id });
      return;
    }

    // Per nuove fatture, genera numero progressivo
    const anno = formData.anno || new Date().getFullYear();
    console.log('🔵 [Invoicing] Creating new invoice with cashflow for year:', anno);

    // Trova il numero più alto per quest'anno
    const fattureAnno = invoices.filter(inv => inv.anno === anno);
    let maxNumero = 0;

    fattureAnno.forEach(inv => {
      const match = inv.id.match(/Fattura_(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumero) maxNumero = num;
      }
    });

    const nuovoNumero = maxNumero + 1;
    const id = `Fattura_${nuovoNumero}/${anno}`;
    console.log('✅ [Invoicing] Generated new invoice ID with cashflow:', id);

    onSaveAndCreateCashflow({ ...formData, id });
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

      // Clear dataScadenza when status changes to "Effettivo"
      if (field === 'statoFatturazione' && value === 'Effettivo') {
        updated.dataScadenza = undefined;
      }

      return updated;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-dark dark:text-white">
            {invoice ? 'Modifica Voce' : 'Nuova Voce'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => updateField('tipo', 'Entrata')}
              className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                formData.tipo === 'Entrata'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-2 border-green-500 dark:border-green-600'
                  : 'bg-gray-50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 border-2 border-transparent dark:border-dark-border'
              }`}
            >
              <ArrowUpCircle size={20} />
              Entrata
            </button>
            <button
              type="button"
              onClick={() => updateField('tipo', 'Uscita')}
              className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                formData.tipo === 'Uscita'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-2 border-orange-500 dark:border-orange-600'
                  : 'bg-gray-50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400 border-2 border-transparent dark:border-dark-border'
              }`}
            >
              <ArrowDownCircle size={20} />
              Uscita
            </button>
          </div>

          {/* Data e Stato */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Data</label>
              <input
                type="date"
                value={formData.data ? new Date(formData.data).toISOString().split('T')[0] : ''}
                onChange={(e) => updateField('data', e.target.value)}
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Stato Fatturazione</label>
              <select
                value={formData.statoFatturazione || 'Nessuno'}
                onChange={(e) => updateField('statoFatturazione', e.target.value)}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              >
                <option value="Stimato">Stimato</option>
                <option value="Effettivo">Effettivo</option>
                <option value="Nessuno">Nessuno</option>
              </select>
            </div>
          </div>

          {/* Data Scadenza (opzionale) - disabled when status is Effettivo */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Data Scadenza (opzionale)
              {formData.statoFatturazione === 'Effettivo' && (
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 italic">
                  (Non disponibile per fatture effettive)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="date"
                value={formData.dataScadenza ? new Date(formData.dataScadenza).toISOString().split('T')[0] : ''}
                onChange={(e) => updateField('dataScadenza', e.target.value || undefined)}
                disabled={formData.statoFatturazione === 'Effettivo'}
                className={`w-full pl-4 pr-10 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white ${
                  formData.statoFatturazione === 'Effettivo'
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                    : ''
                }`}
              />
              {formData.dataScadenza && formData.statoFatturazione !== 'Effettivo' && (
                <button
                  type="button"
                  onClick={() => updateField('dataScadenza', undefined)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Cancella data scadenza"
                >
                  <X size={16} className="text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>
          </div>

          {/* Progetto (per Entrate) o Categoria (per Uscite) */}
          {formData.tipo === 'Entrata' ? (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Progetto (Opportunità)</label>
              <select
                value={formData.nomeProgetto || ''}
                onChange={(e) => updateField('nomeProgetto', e.target.value)}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              >
                <option value="">Seleziona progetto...</option>
                {availableProjects.map(deal => (
                  <option key={deal.id} value={deal.title}>
                    {deal.title} ({deal.customerName}) - {deal.stage}
                  </option>
                ))}
              </select>
              {availableProjects.length === 0 && (
                <p className="text-xs text-orange-500 dark:text-orange-400 mt-1">
                  Nessuna opportunità in Proposta, Negoziazione o Vinto. Crea prima un'opportunità.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Categoria Spesa</label>
                <select
                  value={formData.spesa || ''}
                  onChange={(e) => updateField('spesa', e.target.value)}
                  className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                >
                  <option value="">Seleziona...</option>
                  {CATEGORIE_SPESA.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo Spesa</label>
                <select
                  value={formData.tipoSpesa || ''}
                  onChange={(e) => updateField('tipoSpesa', e.target.value)}
                  className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
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
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Note / Descrizione</label>
            <input
              type="text"
              value={formData.note || ''}
              onChange={(e) => updateField('note', e.target.value)}
              placeholder="Es: Claude, ChatGPT, Abbonamento mensile..."
              className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
            />
          </div>

          {/* Importi */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Flusso (Netto)</label>
              <input
                type="number"
                step="0.01"
                value={formData.flusso || 0}
                onChange={(e) => updateField('flusso', parseFloat(e.target.value) || 0)}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">% IVA</label>
              <select
                value={formData.percentualeIva || 0}
                onChange={(e) => updateField('percentualeIva', parseInt(e.target.value))}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              >
                <option value={0}>0%</option>
                <option value={4}>4%</option>
                <option value={10}>10%</option>
                <option value={22}>22%</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">IVA</label>
              <input
                type="number"
                step="0.01"
                value={formData.iva || 0}
                onChange={(e) => updateField('iva', parseFloat(e.target.value) || 0)}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-gray-50 dark:bg-gray-800/30 text-dark dark:text-white"
                readOnly
              />
            </div>
          </div>

          {/* Totale */}
          <div className="bg-gray-50 dark:bg-dark-bg p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Totale (Flusso + IVA)</span>
              <span className={`text-2xl font-bold ${formData.tipo === 'Uscita' ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                {formData.tipo === 'Uscita' ? '- ' : ''}{formatCurrency((formData.flusso || 0) + (formData.iva || 0))}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {invoice ? 'Salva' : 'Aggiungi'}
            </button>
            {/* Pulsante "Salva e Crea Flusso" - visibile solo per fatture Stimato */}
            {formData.statoFatturazione === 'Stimato' && onSaveAndCreateCashflow && (
              <button
                type="button"
                onClick={handleSubmitWithCashflow}
                className="flex-1 px-6 py-3 bg-secondary hover:bg-secondary/90 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <ArrowUpCircle size={18} />
                {invoice ? 'Salva e Crea Flusso' : 'Aggiungi e Crea Flusso'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
