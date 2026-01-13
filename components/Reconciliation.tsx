import React, { useState, useMemo, useRef } from 'react';
import { Upload, FileCheck, AlertCircle, Check, X, RefreshCw, ChevronDown, ChevronUp, Search, Eye, Link2, Trash2, CheckSquare, Square, MinusSquare, FilePlus, PlusCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { parseBankStatementExcel, formatPeriodo, type ParsedBankStatement, type ParsedTransaction } from '../lib/excel-parser';
import { suggestMatch, quickMatch, type MatchSuggestion } from '../lib/reconciliation-ai';
import type { BankTransaction, ReconciliationSession, Invoice, CashflowRecord, CashflowWithInvoice, SideBySideRow, DifferenceReport } from '../types';
import { formatCurrency } from '../lib/currency';

// Format date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Format invoice ID: "Fattura_xyz" -> "xyz/anno"
const formatInvoiceId = (id: string, anno: number): string => {
  const numero = id.replace('Fattura_', '');
  return `${numero}/${anno}`;
};

// Transaction row component
const TransactionRow: React.FC<{
  transaction: BankTransaction;
  invoices: Invoice[];
  onConfirm: (invoiceId: string) => void;
  onIgnore: () => void;
  onManualMatch: () => void;
  onRunAI: () => void;
  isProcessing: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCreateInvoice: () => void;
  onCreateCashflow: () => void;
  disabled?: boolean;
}> = ({ transaction, invoices, onConfirm, onIgnore, onManualMatch, onRunAI, isProcessing, isSelected, onToggleSelect, onCreateInvoice, onCreateCashflow, disabled = false }) => {
  const [expanded, setExpanded] = useState(false);

  const matchedInvoice = transaction.matchedInvoiceId
    ? invoices.find(inv => inv.id === transaction.matchedInvoiceId)
    : null;

  const getStatusColor = () => {
    switch (transaction.matchStatus) {
      case 'matched': return 'bg-green-100 text-green-800';
      case 'ignored': return 'bg-slate-50 text-slate-500';
      case 'manual': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusLabel = () => {
    switch (transaction.matchStatus) {
      case 'matched': return 'Riconciliato';
      case 'ignored': return 'Ignorato';
      case 'manual': return 'Manuale';
      default: return 'Da verificare';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`border-b border-slate-200 last:border-b-0 ${isSelected ? 'bg-primary/5' : ''}`}>
      <div
        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${expanded ? 'bg-slate-50' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              disabled={disabled}
              className="text-slate-500 hover:text-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSelected ? (
                <CheckSquare size={18} className="text-primary" />
              ) : (
                <Square size={18} />
              )}
            </button>
            <div className="w-24 text-sm text-slate-500">{formatDate(transaction.data)}</div>
            <div className="flex-1">
              <div className="font-medium text-dark text-sm truncate max-w-md">
                {transaction.descrizione || transaction.causale || 'Movimento senza descrizione'}
              </div>
              {transaction.causale && transaction.descrizione && (
                <div className="text-xs text-slate-500">{transaction.causale}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`text-right font-semibold ${transaction.tipo === 'Entrata' ? 'text-green-600' : 'text-red-600'}`}>
              {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
            </div>

            {transaction.matchStatus === 'pending' && transaction.matchConfidence !== undefined && (
              <div className={`text-sm font-medium ${getConfidenceColor(transaction.matchConfidence)}`}>
                {transaction.matchConfidence}%
              </div>
            )}

            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {getStatusLabel()}
            </span>

            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-slate-50">
          <div className="bg-white rounded-lg p-4" shadow-card>
            {/* Transaction details */}
            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <div className="text-xs font-medium text-slate-500 mb-2">DETTAGLI TRANSAZIONE</div>
              <div className="space-y-1">
                {transaction.descrizione && (
                  <div className="text-sm text-dark">
                    <span className="font-medium">Descrizione:</span> {transaction.descrizione}
                  </div>
                )}
                {transaction.causale && (
                  <div className="text-sm text-dark">
                    <span className="font-medium">Causale:</span> {transaction.causale}
                  </div>
                )}
                {transaction.dataValuta && (
                  <div className="text-sm text-slate-500">
                    <span className="font-medium">Data Valuta:</span> {formatDate(transaction.dataValuta)}
                  </div>
                )}
                {transaction.saldo !== undefined && (
                  <div className="text-sm text-slate-500">
                    <span className="font-medium">Saldo dopo operazione:</span> {formatCurrency(transaction.saldo)}
                  </div>
                )}
              </div>
            </div>

            {/* Match info */}
            {transaction.matchReason && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">{transaction.matchReason}</div>
                </div>
              </div>
            )}

            {/* Matched invoice */}
            {matchedInvoice && (
              <div className="mb-4 p-3 border-2 border-green-500 bg-white rounded-lg" shadow-card>
                <div className="flex items-center gap-2 mb-2">
                  <Link2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-dark">FATTURA ABBINATA</span>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-dark">
                    <span className="font-semibold">{formatInvoiceId(matchedInvoice.id, matchedInvoice.anno)}</span>
                    <span className="mx-2 text-slate-500">•</span>
                    <span className="font-medium">{matchedInvoice.nomeProgetto || matchedInvoice.spesa || 'N/A'}</span>
                    <span className="mx-2 text-slate-500">•</span>
                    <span className="font-semibold text-green-600">{formatCurrency((matchedInvoice.flusso || 0) + (matchedInvoice.iva || 0))}</span>
                  </div>
                  {matchedInvoice.note && (
                    <div className="text-sm text-dark bg-slate-50 rounded p-2 border border-slate-200">
                      <span className="font-medium text-dark">Descrizione:</span> {matchedInvoice.note}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {transaction.matchStatus === 'pending' && (
              <div className="flex items-center gap-2 flex-wrap">
                {transaction.matchedInvoiceId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onConfirm(transaction.matchedInvoiceId!); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Check size={14} />
                    Conferma
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onManualMatch(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Link2 size={14} />
                  Abbina Manualmente
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRunAI(); }}
                  disabled={isProcessing || disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                  Analizza AI
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onIgnore(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={14} />
                  Ignora
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                <button
                  onClick={(e) => { e.stopPropagation(); onCreateInvoice(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FilePlus size={14} />
                  Crea Fattura
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onCreateCashflow(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusCircle size={14} />
                  Crea Movimento
                </button>
              </div>
            )}

            {transaction.matchStatus !== 'pending' && (
              <button
                onClick={(e) => { e.stopPropagation(); onManualMatch(); }}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} />
                Modifica Abbinamento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Manual match modal
const ManualMatchModal: React.FC<{
  transaction: BankTransaction;
  invoices: Invoice[];
  cashflowRecords: CashflowRecord[];
  onMatch: (invoiceId: string) => void;
  onClose: () => void;
}> = ({ transaction, invoices, cashflowRecords, onMatch, onClose }) => {
  const [search, setSearch] = useState('');
  const [showPaid, setShowPaid] = useState(false);

  // Calcola stato pagamento per ogni fattura
  const paymentStatus = useMemo(() => {
    const statusMap = new Map<string, { totalePagato: number; percentuale: number; status: 'non_pagato' | 'parziale' | 'pagato' }>();

    invoices.forEach(invoice => {
      const totaleFattura = (invoice.flusso || 0) + (invoice.iva || 0);
      const pagamenti = cashflowRecords.filter(cf => cf.invoiceId === invoice.id);
      const totalePagato = pagamenti.reduce((sum, cf) => {
        return sum + (cf.importo !== undefined ? cf.importo : totaleFattura);
      }, 0);

      const percentuale = totaleFattura > 0 ? (totalePagato / totaleFattura) * 100 : 0;
      let status: 'non_pagato' | 'parziale' | 'pagato';

      if (totalePagato === 0) {
        status = 'non_pagato';
      } else if (totalePagato >= totaleFattura - 0.01) { // Tolleranza di 1 centesimo
        status = 'pagato';
      } else {
        status = 'parziale';
      }

      statusMap.set(invoice.id, { totalePagato, percentuale, status });
    });

    return statusMap;
  }, [invoices, cashflowRecords]);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.tipo === transaction.tipo)
      .filter(inv => {
        // Filtra per stato pagamento se non vogliamo vedere le pagate
        if (!showPaid) {
          const status = paymentStatus.get(inv.id);
          if (status?.status === 'pagato') return false;
        }

        if (!search) return true;
        const searchLower = search.toLowerCase();
        const totale = (inv.flusso || 0) + (inv.iva || 0);
        return (
          inv.id.toLowerCase().includes(searchLower) ||
          (inv.nomeProgetto || '').toLowerCase().includes(searchLower) ||
          (inv.spesa || '').toLowerCase().includes(searchLower) ||
          totale.toString().includes(search)
        );
      });
  }, [invoices, transaction.tipo, search, showPaid, paymentStatus]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl" shadow-card
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-dark">Abbina Transazione</h3>
          <p className="text-sm text-slate-500 mt-1">
            {formatDate(transaction.data)} | {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
          </p>
          <p className="text-sm text-slate-500 mt-1">{transaction.descrizione}</p>
        </div>

        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per ID, progetto, importo..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={e => setShowPaid(e.target.checked)}
              className="w-4 h-4 text-primary border-slate-200 rounded focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-sm text-slate-500">Mostra anche fatture già pagate</span>
          </label>
        </div>

        <div className="overflow-y-auto max-h-96">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Nessuna fattura trovata
            </div>
          ) : (
            filteredInvoices.map(inv => {
              const totale = (inv.flusso || 0) + (inv.iva || 0);
              const paymentInfo = paymentStatus.get(inv.id) || { totalePagato: 0, percentuale: 0, status: 'non_pagato' as const };
              const residuo = totale - paymentInfo.totalePagato;
              const isExactMatch = Math.abs(totale - transaction.importo) < 0.01;
              const isResidualMatch = Math.abs(residuo - transaction.importo) < 0.01;

              return (
                <div
                  key={inv.id}
                  onClick={() => onMatch(inv.id)}
                  className={`p-4 border-b border-slate-200 last:border-b-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                    isExactMatch ? 'bg-green-50' :
                    isResidualMatch ? 'bg-yellow-50' :
                    paymentInfo.status === 'parziale' ? 'bg-yellow-50/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-dark">{formatInvoiceId(inv.id, inv.anno)}</div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          paymentInfo.status === 'pagato'
                            ? 'bg-green-100 text-green-700'
                            : paymentInfo.status === 'parziale'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {paymentInfo.status === 'pagato' ? 'Pagato' : paymentInfo.status === 'parziale' ? `Parziale ${paymentInfo.percentuale.toFixed(0)}%` : 'Non Pagato'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {inv.nomeProgetto || inv.spesa || 'N/A'} | {inv.data instanceof Date ? formatDate(inv.data.toISOString()) : formatDate(inv.data)}
                      </div>
                      {paymentInfo.status === 'parziale' && (
                        <div className="text-xs text-slate-500 mt-1">
                          Pagato: {formatCurrency(paymentInfo.totalePagato)} | Residuo: <span className="font-semibold text-orange-600">{formatCurrency(residuo)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className={`font-semibold ${inv.tipo === 'Entrata' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totale)}
                      </div>
                      {isExactMatch && (
                        <span className="text-xs text-green-600 font-medium">Importo esatto</span>
                      )}
                      {isResidualMatch && paymentInfo.status === 'parziale' && (
                        <span className="text-xs text-yellow-600 font-medium">Residuo esatto</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
};

// Create Invoice Modal - pre-filled from bank transaction
const CreateInvoiceModal: React.FC<{
  transaction: BankTransaction;
  onSave: (invoiceData: Omit<Invoice, 'id'>) => void;
  onClose: () => void;
}> = ({ transaction, onSave, onClose }) => {
  const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  const txDate = new Date(transaction.data);
  const [formData, setFormData] = useState({
    data: transaction.data,
    mese: MESI[txDate.getMonth()],
    anno: txDate.getFullYear(),
    nomeProgetto: '',
    tipo: transaction.tipo as 'Entrata' | 'Uscita',
    statoFatturazione: 'Effettivo' as 'Stimato' | 'Effettivo' | 'Nessuno',
    spesa: '',
    tipoSpesa: '',
    note: transaction.descrizione || transaction.causale || '',
    flusso: transaction.importo,
    iva: 0,
    percentualeIva: 0,
    percentualeFatturazione: 100,
    checked: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" shadow-card
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-dark">Crea Fattura da Transazione</h3>
          <p className="text-sm text-slate-500 mt-1">
            {formatDate(transaction.data)} | {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'Entrata' | 'Uscita' })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="Entrata">Entrata</option>
                <option value="Uscita">Uscita</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Stato *</label>
              <select
                value={formData.statoFatturazione}
                onChange={(e) => setFormData({ ...formData, statoFatturazione: e.target.value as 'Stimato' | 'Effettivo' | 'Nessuno' })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="Effettivo">Effettivo</option>
                <option value="Stimato">Stimato</option>
                <option value="Nessuno">Nessuno</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Progetto</label>
            <input
              type="text"
              value={formData.nomeProgetto}
              onChange={(e) => setFormData({ ...formData, nomeProgetto: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Nome progetto..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Categoria Spesa</label>
              <input
                type="text"
                value={formData.spesa}
                onChange={(e) => setFormData({ ...formData, spesa: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Es: Utenze, Tools..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Tipo Spesa</label>
              <input
                type="text"
                value={formData.tipoSpesa}
                onChange={(e) => setFormData({ ...formData, tipoSpesa: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Es: Costi per servizi..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Importo Netto *</label>
              <input
                type="number"
                step="0.01"
                value={formData.flusso}
                onChange={(e) => setFormData({ ...formData, flusso: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">IVA</label>
              <input
                type="number"
                step="0.01"
                value={formData.iva}
                onChange={(e) => setFormData({ ...formData, iva: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
            >
              Crea Fattura e Riconcilia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Create Cashflow Modal - pre-filled from bank transaction
const CreateCashflowModal: React.FC<{
  transaction: BankTransaction;
  onSave: (data: { dataPagamento: string; importo: number; tipo: 'Entrata' | 'Uscita'; descrizione: string; categoria?: string; note?: string }) => void;
  onClose: () => void;
}> = ({ transaction, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    dataPagamento: transaction.data,
    importo: transaction.importo,
    tipo: transaction.tipo as 'Entrata' | 'Uscita',
    descrizione: transaction.descrizione || transaction.causale || '',
    categoria: '',
    note: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" shadow-card
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-semibold text-dark">Crea Movimento da Transazione</h3>
          <p className="text-sm text-slate-500 mt-1">
            {formatDate(transaction.data)} | {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Data *</label>
              <input
                type="date"
                value={formData.dataPagamento}
                onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'Entrata' | 'Uscita' })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="Entrata">Entrata</option>
                <option value="Uscita">Uscita</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Descrizione *</label>
            <input
              type="text"
              value={formData.descrizione}
              onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
              required
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Descrizione movimento..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Importo *</label>
              <input
                type="number"
                step="0.01"
                value={formData.importo}
                onChange={(e) => setFormData({ ...formData, importo: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Categoria</label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Es: Banca, Altro..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Note aggiuntive..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Crea Movimento e Riconcilia
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ====== HELPER FUNCTIONS FOR COMPARISON VIEWS ======

// Filtra cashflow nel periodo della sessione
function getCashflowsInPeriod(
  cashflowRecords: CashflowRecord[],
  invoices: Invoice[],
  periodoDal?: string,
  periodoAl?: string
): CashflowWithInvoice[] {
  if (!periodoDal || !periodoAl) return [];

  const dalDate = new Date(periodoDal);
  const alDate = new Date(periodoAl);

  return cashflowRecords
    .filter(cf => {
      if (!cf.dataPagamento) return false;
      const paymentDate = new Date(cf.dataPagamento);
      return paymentDate >= dalDate && paymentDate <= alDate;
    })
    .map(cf => ({
      ...cf,
      invoice: cf.invoiceId ? invoices.find(inv => inv.id === cf.invoiceId) : undefined
    }));
}

// Identifica voci non abbinate
interface UnmatchedData {
  unmatchedBankTransactions: BankTransaction[];
  unmatchedCashflows: CashflowWithInvoice[];
}

function getUnmatchedData(
  bankTransactions: BankTransaction[],
  cashflowRecords: CashflowRecord[],
  invoices: Invoice[],
  session: ReconciliationSession
): UnmatchedData {
  // Filter cashflows in period
  const cashflowsInPeriod = getCashflowsInPeriod(
    cashflowRecords,
    invoices,
    session.periodoDal,
    session.periodoAl
  );

  // Unmatched bank transactions (pending status)
  const unmatchedBankTransactions = bankTransactions.filter(
    tx => tx.matchStatus === 'pending'
  );

  // Unmatched cashflows (no bank transaction reference)
  const matchedCashflowIds = new Set(
    bankTransactions
      .filter(tx => tx.matchedCashflowId && tx.matchStatus !== 'ignored')
      .map(tx => tx.matchedCashflowId!)
  );

  const unmatchedCashflows = cashflowsInPeriod.filter(
    cf => !matchedCashflowIds.has(cf.id)
  );

  return { unmatchedBankTransactions, unmatchedCashflows };
}

// Crea righe per vista affiancata
function getSideBySideData(
  bankTransactions: BankTransaction[],
  cashflowRecords: CashflowRecord[],
  invoices: Invoice[],
  session: ReconciliationSession
): SideBySideRow[] {
  const cashflowsInPeriod = getCashflowsInPeriod(
    cashflowRecords,
    invoices,
    session.periodoDal,
    session.periodoAl
  );

  const rows: SideBySideRow[] = [];
  const processedCashflowIds = new Set<string>();

  // Process bank transactions with matches
  for (const tx of bankTransactions) {
    if (tx.matchedCashflowId) {
      const cf = cashflowsInPeriod.find(c => c.id === tx.matchedCashflowId);
      if (cf) {
        rows.push({
          bankTransaction: tx,
          cashflow: cf,
          matchStatus: 'matched',
          confidence: tx.matchConfidence
        });
        processedCashflowIds.add(cf.id);
      } else {
        rows.push({
          bankTransaction: tx,
          matchStatus: 'bankOnly'
        });
      }
    } else if (tx.matchStatus === 'pending') {
      rows.push({
        bankTransaction: tx,
        matchStatus: 'unmatched'
      });
    } else if (tx.matchStatus === 'ignored') {
      // Skip ignored transactions
      continue;
    } else {
      rows.push({
        bankTransaction: tx,
        matchStatus: 'bankOnly'
      });
    }
  }

  // Add unmatched cashflows
  for (const cf of cashflowsInPeriod) {
    if (!processedCashflowIds.has(cf.id)) {
      rows.push({
        cashflow: cf,
        matchStatus: 'cashflowOnly'
      });
    }
  }

  // Sort by date
  rows.sort((a, b) => {
    const dateA = a.bankTransaction?.data || a.cashflow?.dataPagamento || '';
    const dateB = b.bankTransaction?.data || b.cashflow?.dataPagamento || '';
    return dateB.localeCompare(dateA);
  });

  return rows;
}

// Interfaccia per anomalie
interface Anomaly {
  invoiceId: string;
  invoice: Invoice;
  cashflowAmount: number;
  bankTransactionAmount?: number;
  type: 'no_bank_transaction' | 'amount_mismatch';
  message: string;
}

// Genera report con totali
function generateDifferenceReport(
  bankTransactions: BankTransaction[],
  cashflowRecords: CashflowRecord[],
  invoices: Invoice[],
  session: ReconciliationSession
): DifferenceReport & { anomalies: Anomaly[] } {
  const cashflowsInPeriod = getCashflowsInPeriod(
    cashflowRecords,
    invoices,
    session.periodoDal,
    session.periodoAl
  );

  // Calculate bank totals
  const bankEntrate = bankTransactions
    .filter(tx => tx.tipo === 'Entrata' && tx.matchStatus !== 'ignored')
    .reduce((sum, tx) => sum + tx.importo, 0);

  const bankUscite = bankTransactions
    .filter(tx => tx.tipo === 'Uscita' && tx.matchStatus !== 'ignored')
    .reduce((sum, tx) => sum + tx.importo, 0);

  // Calculate cashflow totals
  const cashflowEntrate = cashflowsInPeriod
    .filter(cf => (cf.tipo || cf.invoice?.tipo) === 'Entrata')
    .reduce((sum, cf) => sum + (cf.importo ||
      ((cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0))), 0);

  const cashflowUscite = cashflowsInPeriod
    .filter(cf => (cf.tipo || cf.invoice?.tipo) === 'Uscita')
    .reduce((sum, cf) => sum + (cf.importo ||
      ((cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0))), 0);

  // Calculate matching stats
  const matchedCount = bankTransactions.filter(
    tx => tx.matchStatus === 'matched' || tx.matchStatus === 'manual'
  ).length;

  const unmatchedBankCount = bankTransactions.filter(
    tx => tx.matchStatus === 'pending'
  ).length;

  const matchedCashflowIds = new Set(
    bankTransactions
      .filter(tx => tx.matchedCashflowId && tx.matchStatus !== 'ignored')
      .map(tx => tx.matchedCashflowId!)
  );

  const unmatchedCashflowCount = cashflowsInPeriod.filter(
    cf => !matchedCashflowIds.has(cf.id)
  ).length;

  const totalTransactions = bankTransactions.length + cashflowsInPeriod.length;
  const reconciliationPercentage = totalTransactions > 0
    ? (matchedCount / totalTransactions) * 100
    : 0;

  // Rileva anomalie: cashflow nel periodo ma senza transazione bancaria matchata
  const anomalies: Anomaly[] = [];

  cashflowsInPeriod.forEach(cf => {
    if (!cf.invoiceId) return; // Skip standalone cashflow

    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
    if (!invoice) return;

    const totaleFattura = (invoice.flusso || 0) + (invoice.iva || 0);
    const cashflowAmount = cf.importo !== undefined ? cf.importo : totaleFattura;

    // Cerca se esiste una transazione bancaria matchata a questa fattura nel periodo
    const matchedBankTx = bankTransactions.find(tx =>
      tx.matchedInvoiceId === invoice.id && tx.matchStatus !== 'ignored'
    );

    if (!matchedBankTx) {
      // Cashflow registrato ma nessuna transazione bancaria
      anomalies.push({
        invoiceId: invoice.id,
        invoice,
        cashflowAmount,
        type: 'no_bank_transaction',
        message: `Movimento registrato (${formatCurrency(cashflowAmount)}) ma nessuna transazione bancaria trovata nel periodo`
      });
    } else if (Math.abs(matchedBankTx.importo - cashflowAmount) > 0.01) {
      // Importo cashflow diverso da importo bancario
      anomalies.push({
        invoiceId: invoice.id,
        invoice,
        cashflowAmount,
        bankTransactionAmount: matchedBankTx.importo,
        type: 'amount_mismatch',
        message: `Discrepanza: registrato ${formatCurrency(cashflowAmount)} ma nella banca ${formatCurrency(matchedBankTx.importo)}`
      });
    }
  });

  return {
    totalBankEntrate: bankEntrate,
    totalBankUscite: bankUscite,
    totalBankNet: bankEntrate - bankUscite,
    totalCashflowEntrate: cashflowEntrate,
    totalCashflowUscite: cashflowUscite,
    totalCashflowNet: cashflowEntrate - cashflowUscite,
    differenceEntrate: bankEntrate - cashflowEntrate,
    differenceUscite: bankUscite - cashflowUscite,
    differenceNet: (bankEntrate - bankUscite) - (cashflowEntrate - cashflowUscite),
    matchedCount,
    unmatchedBankCount,
    unmatchedCashflowCount,
    reconciliationPercentage,
    anomalies
  };
}

// ====== END HELPER FUNCTIONS ======

// ====== COMPARISON VIEW COMPONENTS ======

// Component 1: Voci Mancanti
interface UnmatchedViewProps {
  unmatchedBankTransactions: BankTransaction[];
  unmatchedCashflows: CashflowWithInvoice[];
}

const UnmatchedView: React.FC<UnmatchedViewProps> = ({ unmatchedBankTransactions, unmatchedCashflows }) => {
  const totalBankAmount = unmatchedBankTransactions.reduce((sum, tx) =>
    sum + (tx.tipo === 'Entrata' ? tx.importo : -tx.importo), 0
  );

  const totalCashflowAmount = unmatchedCashflows.reduce((sum, cf) => {
    const amount = cf.importo || ((cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0));
    const tipo = cf.tipo || cf.invoice?.tipo;
    return sum + (tipo === 'Entrata' ? amount : -amount);
  }, 0);

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Transazioni Bancarie Non Abbinate */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6" shadow-card>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-dark">Transazioni Bancarie Non Abbinate</h3>
          <p className="text-sm text-slate-500 mt-1">Totale: {formatCurrency(totalBankAmount)}</p>
        </div>

        <div className="space-y-3">
          {unmatchedBankTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-2" />
              <p>Tutte le transazioni bancarie sono state riconciliate</p>
            </div>
          ) : (
            unmatchedBankTransactions.map(tx => (
              <div key={tx.id} className="border border-red-200 bg-red-50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-dark">{tx.descrizione}</p>
                    <p className="text-sm text-slate-500">{new Date(tx.data).toLocaleDateString('it-IT')}</p>
                    {tx.causale && (
                      <p className="text-xs text-slate-500 mt-1">{tx.causale}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <span className={`text-lg font-semibold ${
                      tx.tipo === 'Entrata' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(tx.importo)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Non riconciliata
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Flussi di Cassa Non Abbinati */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6" shadow-card>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-dark">Flussi di Cassa Non Abbinati</h3>
          <p className="text-sm text-slate-500 mt-1">Totale: {formatCurrency(totalCashflowAmount)}</p>
        </div>

        <div className="space-y-3">
          {unmatchedCashflows.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-2" />
              <p>Tutti i flussi di cassa sono stati riconciliati</p>
            </div>
          ) : (
            unmatchedCashflows.map(cf => {
              const amount = cf.importo || ((cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0));
              const tipo = cf.tipo || cf.invoice?.tipo;
              const descrizione = cf.descrizione || cf.invoice?.nomeProgetto || cf.invoice?.spesa || 'N/D';

              return (
                <div key={cf.id} className="border border-red-200 bg-red-50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-dark">{descrizione}</p>
                      {cf.dataPagamento && (
                        <p className="text-sm text-slate-500">{new Date(cf.dataPagamento).toLocaleDateString('it-IT')}</p>
                      )}
                      {cf.invoice && (
                        <p className="text-xs text-slate-500 mt-1">Da Fattura: {formatInvoiceId(cf.invoice.id, cf.invoice.anno)}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span className={`text-lg font-semibold ${
                        tipo === 'Entrata' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tipo === 'Entrata' ? '+' : '-'}{formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Non abbinata
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// Component 2: Vista Affiancata
interface SideBySideViewProps {
  rows: SideBySideRow[];
}

const SideBySideView: React.FC<SideBySideViewProps> = ({ rows }) => {
  const getMatchStatusColor = (status: string, confidence?: number) => {
    if (status === 'matched') {
      if (!confidence) return 'bg-green-100 text-green-700';
      if (confidence > 80) return 'bg-green-100 text-green-700';
      if (confidence > 50) return 'bg-yellow-100 text-yellow-700';
      return 'bg-orange-100 text-orange-700';
    }
    if (status === 'unmatched') return 'bg-red-100 text-red-700';
    return 'bg-slate-50 text-slate-500';
  };

  const getMatchStatusLabel = (status: string) => {
    switch (status) {
      case 'matched': return 'Abbinato';
      case 'unmatched': return 'Non abbinato';
      case 'bankOnly': return 'Solo Banca';
      case 'cashflowOnly': return 'Solo Cashflow';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200" shadow-card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500">Data</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500">Descrizione Banca</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-500">Importo Banca</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-500">Match</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-500">Importo Cashflow</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-500">Descrizione Cashflow</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-500">Stato</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nessun dato disponibile
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const bankAmount = row.bankTransaction?.importo;
                const bankTipo = row.bankTransaction?.tipo;

                const cashflowAmount = row.cashflow ? (
                  row.cashflow.importo || ((row.cashflow.invoice?.flusso || 0) + (row.cashflow.invoice?.iva || 0))
                ) : undefined;
                const cashflowTipo = row.cashflow?.tipo || row.cashflow?.invoice?.tipo;

                return (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {row.bankTransaction?.data
                        ? new Date(row.bankTransaction.data).toLocaleDateString('it-IT')
                        : row.cashflow?.dataPagamento
                          ? new Date(row.cashflow.dataPagamento).toLocaleDateString('it-IT')
                          : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.bankTransaction ? (
                        <div>
                          <div className="text-dark font-medium">
                            {row.bankTransaction.descrizione || '-'}
                          </div>
                          {row.bankTransaction.causale && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {row.bankTransaction.causale}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {bankAmount !== undefined ? (
                        <span className={bankTipo === 'Entrata' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {bankTipo === 'Entrata' ? '+' : '-'}{formatCurrency(bankAmount)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.matchStatus === 'matched' ? (
                        <div className="flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-600" />
                          {row.confidence && (
                            <span className="ml-1 text-xs text-slate-500">{row.confidence}%</span>
                          )}
                        </div>
                      ) : row.matchStatus === 'unmatched' ? (
                        <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {cashflowAmount !== undefined ? (
                        <span className={cashflowTipo === 'Entrata' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {cashflowTipo === 'Entrata' ? '+' : '-'}{formatCurrency(cashflowAmount)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.cashflow ? (
                        <div>
                          <div className="text-dark font-medium">
                            {row.cashflow.invoice?.nomeProgetto || row.cashflow.invoice?.spesa || row.cashflow.descrizione || '-'}
                          </div>
                          {(row.cashflow.invoice?.note || row.cashflow.note) && (
                            <div className="text-xs text-slate-500 mt-0.5">
                              {row.cashflow.invoice?.note || row.cashflow.note}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getMatchStatusColor(row.matchStatus, row.confidence)}`}>
                        {getMatchStatusLabel(row.matchStatus)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component 3: Report Differenze
interface ReportViewProps {
  report: DifferenceReport;
}

const ReportView: React.FC<ReportViewProps> = ({ report }) => {
  const hasDifference = (diff: number) => Math.abs(diff) > 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Percentuale Riconciliazione</h3>
            <FileCheck className="w-5 h-5 opacity-75" />
          </div>
          <p className="text-3xl font-bold">{report.reconciliationPercentage.toFixed(1)}%</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Transazioni Abbinate</h3>
            <Check className="w-5 h-5 opacity-75" />
          </div>
          <p className="text-3xl font-bold">{report.matchedCount}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Voci Non Abbinate</h3>
            <AlertCircle className="w-5 h-5 opacity-75" />
          </div>
          <p className="text-3xl font-bold">{report.unmatchedBankCount + report.unmatchedCashflowCount}</p>
          <p className="text-xs opacity-75 mt-1">Banca: {report.unmatchedBankCount} | Cashflow: {report.unmatchedCashflowCount}</p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" shadow-card>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-dark">Confronto Totali</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-500">Categoria</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-500">Banca</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-500">Registrato</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-500">Differenza</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="px-6 py-4 text-sm font-medium text-dark">Entrate Totali</td>
                <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">
                  {formatCurrency(report.totalBankEntrate)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">
                  {formatCurrency(report.totalCashflowEntrate)}
                </td>
                <td className={`px-6 py-4 text-sm text-right font-medium ${
                  hasDifference(report.differenceEntrate) ? 'text-red-600' : 'text-slate-500'
                }`}>
                  {report.differenceEntrate >= 0 ? '+' : ''}{formatCurrency(report.differenceEntrate)}
                  {hasDifference(report.differenceEntrate) && (
                    <AlertCircle className="w-4 h-4 inline ml-1" />
                  )}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="px-6 py-4 text-sm font-medium text-dark">Uscite Totali</td>
                <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                  {formatCurrency(report.totalBankUscite)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                  {formatCurrency(report.totalCashflowUscite)}
                </td>
                <td className={`px-6 py-4 text-sm text-right font-medium ${
                  hasDifference(report.differenceUscite) ? 'text-red-600' : 'text-slate-500'
                }`}>
                  {report.differenceUscite >= 0 ? '+' : ''}{formatCurrency(report.differenceUscite)}
                  {hasDifference(report.differenceUscite) && (
                    <AlertCircle className="w-4 h-4 inline ml-1" />
                  )}
                </td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-6 py-4 text-sm text-dark">Saldo Netto</td>
                <td className={`px-6 py-4 text-sm text-right ${
                  report.totalBankNet >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(report.totalBankNet)}
                </td>
                <td className={`px-6 py-4 text-sm text-right ${
                  report.totalCashflowNet >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(report.totalCashflowNet)}
                </td>
                <td className={`px-6 py-4 text-sm text-right ${
                  hasDifference(report.differenceNet) ? 'text-red-600' : 'text-slate-500'
                }`}>
                  {report.differenceNet >= 0 ? '+' : ''}{formatCurrency(report.differenceNet)}
                  {hasDifference(report.differenceNet) && (
                    <AlertCircle className="w-4 h-4 inline ml-1" />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomalies Section */}
      {report.anomalies && report.anomalies.length > 0 && (
        <div className="bg-red-50 rounded-2xl border border-red-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-red-200 bg-red-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Anomalie Rilevate ({report.anomalies.length})</h3>
            </div>
            <p className="text-sm text-red-700 mt-1">Discrepanze tra importi registrati e transazioni bancarie</p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {report.anomalies.map((anomaly, idx) => (
                <div key={idx} className="bg-white border border-red-200 rounded-xl p-4" shadow-card>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-dark">
                          {formatInvoiceId(anomaly.invoice.id, anomaly.invoice.anno)}
                        </span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                          {anomaly.type === 'no_bank_transaction' ? 'Transazione Mancante' : 'Importo Discrepante'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mb-1">
                        {anomaly.invoice.nomeProgetto || anomaly.invoice.spesa || 'N/A'}
                      </div>
                      <div className="text-sm text-red-600 font-medium">
                        {anomaly.message}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-xs text-slate-500 mb-1">Registrato</div>
                      <div className="text-lg font-bold text-dark">
                        {formatCurrency(anomaly.cashflowAmount)}
                      </div>
                      {anomaly.bankTransactionAmount !== undefined && (
                        <>
                          <div className="text-xs text-slate-500 mt-2 mb-1">Banca</div>
                          <div className="text-lg font-bold text-red-600">
                            {formatCurrency(anomaly.bankTransactionAmount)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ====== END COMPARISON VIEW COMPONENTS ======

export const Reconciliation: React.FC = () => {
  const { invoices, cashflowRecords, reconciliationSessions, bankTransactions, addReconciliationSession, addBankTransaction, updateBankTransaction, updateReconciliationSession, deleteBankTransaction, deleteReconciliationSession, addInvoice, addCashflowRecord } = useData();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(() => {
    return localStorage.getItem('reconciliation_selectedSession');
  });
  const [filter, setFilter] = useState<'all' | 'pending' | 'matched' | 'ignored'>(() => {
    const saved = localStorage.getItem('reconciliation_filter');
    return (saved as 'all' | 'pending' | 'matched' | 'ignored') || 'all';
  });
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [manualMatchTransaction, setManualMatchTransaction] = useState<BankTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [createInvoiceTransaction, setCreateInvoiceTransaction] = useState<BankTransaction | null>(null);
  const [createCashflowTransaction, setCreateCashflowTransaction] = useState<BankTransaction | null>(null);
  const [comparisonView, setComparisonView] = useState<'transactions' | 'unmatched' | 'sidebyside' | 'report'>(() => {
    const saved = localStorage.getItem('reconciliation_comparisonView');
    return (saved as 'transactions' | 'unmatched' | 'sidebyside' | 'report') || 'transactions';
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist state to localStorage
  React.useEffect(() => {
    if (selectedSession) {
      localStorage.setItem('reconciliation_selectedSession', selectedSession);
    } else {
      localStorage.removeItem('reconciliation_selectedSession');
    }
  }, [selectedSession]);

  // Deseleziona sessioni chiuse al caricamento
  React.useEffect(() => {
    if (selectedSession) {
      const session = reconciliationSessions.find(s => s.id === selectedSession);
      if (session?.status === 'closed') {
        setSelectedSession(null);
      }
    }
  }, [reconciliationSessions, selectedSession]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_filter', filter);
  }, [filter]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_comparisonView', comparisonView);
  }, [comparisonView]);

  // Current session transactions
  const sessionTransactions = useMemo(() => {
    if (!selectedSession) return [];
    return bankTransactions.filter(tx => tx.sessionId === selectedSession);
  }, [bankTransactions, selectedSession]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return sessionTransactions.filter(tx => {
      if (filter === 'all') return true;
      if (filter === 'pending') return tx.matchStatus === 'pending';
      if (filter === 'matched') return tx.matchStatus === 'matched' || tx.matchStatus === 'manual';
      if (filter === 'ignored') return tx.matchStatus === 'ignored';
      return true;
    });
  }, [sessionTransactions, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = sessionTransactions.length;
    const pending = sessionTransactions.filter(tx => tx.matchStatus === 'pending').length;
    const matched = sessionTransactions.filter(tx => tx.matchStatus === 'matched' || tx.matchStatus === 'manual').length;
    const ignored = sessionTransactions.filter(tx => tx.matchStatus === 'ignored').length;
    return { total, pending, matched, ignored };
  }, [sessionTransactions]);

  // Current session
  const currentSession = useMemo(() => {
    return reconciliationSessions.find(s => s.id === selectedSession);
  }, [reconciliationSessions, selectedSession]);

  // Comparison data (lazy computed only when needed)
  const unmatchedData = useMemo(() => {
    if (comparisonView !== 'unmatched' || !currentSession) return { unmatchedBankTransactions: [], unmatchedCashflows: [] };
    return getUnmatchedData(sessionTransactions, cashflowRecords, invoices, currentSession);
  }, [comparisonView, currentSession, sessionTransactions, cashflowRecords, invoices]);

  const sideBySideData = useMemo(() => {
    if (comparisonView !== 'sidebyside' || !currentSession) return [];
    return getSideBySideData(sessionTransactions, cashflowRecords, invoices, currentSession);
  }, [comparisonView, currentSession, sessionTransactions, cashflowRecords, invoices]);

  const reportData = useMemo(() => {
    if (comparisonView !== 'report' || !currentSession) {
      return {
        totalBankEntrate: 0,
        totalBankUscite: 0,
        totalBankNet: 0,
        totalCashflowEntrate: 0,
        totalCashflowUscite: 0,
        totalCashflowNet: 0,
        differenceEntrate: 0,
        differenceUscite: 0,
        differenceNet: 0,
        matchedCount: 0,
        unmatchedBankCount: 0,
        unmatchedCashflowCount: 0,
        reconciliationPercentage: 0,
        anomalies: []
      };
    }
    return generateDifferenceReport(sessionTransactions, cashflowRecords, invoices, currentSession);
  }, [comparisonView, currentSession, sessionTransactions, cashflowRecords, invoices]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File selected:', file?.name);
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      console.log('Parsing file...');
      const parsed = await parseBankStatementExcel(file);
      console.log('Parsed result:', parsed);

      // Create session
      const sessionId = crypto.randomUUID();
      const session: ReconciliationSession = {
        id: sessionId,
        fileName: file.name,
        uploadDate: new Date().toISOString(),
        periodo: formatPeriodo(parsed.periodoDal, parsed.periodoAl),
        numeroConto: parsed.numeroConto,
        saldoIniziale: parsed.saldoIniziale,
        saldoFinale: parsed.saldoFinale,
        totalTransactions: parsed.transactions.length,
        matchedCount: 0,
        pendingCount: parsed.transactions.length,
        ignoredCount: 0,
        status: 'open',
        periodoDal: parsed.periodoDal,
        periodoAl: parsed.periodoAl
      };

      console.log('Adding session:', session);
      const addedSession = await addReconciliationSession(session);
      console.log('Session added:', addedSession);

      // Create bank transactions with quick matching
      for (const tx of parsed.transactions) {
        const bankTx: BankTransaction = {
          id: crypto.randomUUID(),
          sessionId,
          data: tx.data,
          dataValuta: tx.dataValuta,
          causale: tx.causale,
          descrizione: tx.descrizione,
          importo: tx.importo,
          tipo: tx.tipo,
          saldo: tx.saldo,
          matchStatus: 'pending'
        };

        // Try quick match first
        const quickMatchResult = quickMatch(bankTx, invoices, cashflowRecords);
        if (quickMatchResult) {
          bankTx.matchedInvoiceId = quickMatchResult.invoiceId || undefined;
          bankTx.matchedCashflowId = quickMatchResult.cashflowId || undefined;
          bankTx.matchConfidence = quickMatchResult.confidence;
          bankTx.matchReason = quickMatchResult.reason;
        }

        await addBankTransaction(bankTx);
      }

      setSelectedSession(sessionId);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento del file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Confirm match
  const handleConfirmMatch = async (transactionId: string, invoiceId: string) => {
    const tx = bankTransactions.find(t => t.id === transactionId);
    if (!tx) return;

    await updateBankTransaction(transactionId, {
      matchStatus: 'matched',
      matchedInvoiceId: invoiceId
    });

    // Update session counts
    if (currentSession) {
      await updateReconciliationSession(currentSession.id, {
        matchedCount: currentSession.matchedCount + 1,
        pendingCount: Math.max(0, currentSession.pendingCount - 1)
      });
    }
  };

  // Ignore transaction
  const handleIgnore = async (transactionId: string) => {
    await updateBankTransaction(transactionId, {
      matchStatus: 'ignored',
      matchReason: 'Ignorato manualmente'
    });

    if (currentSession) {
      await updateReconciliationSession(currentSession.id, {
        ignoredCount: currentSession.ignoredCount + 1,
        pendingCount: Math.max(0, currentSession.pendingCount - 1)
      });
    }
  };

  // Run AI analysis on single transaction
  const handleRunAI = async (transactionId: string) => {
    const tx = bankTransactions.find(t => t.id === transactionId);
    if (!tx) return;

    setIsProcessingAI(true);
    try {
      const suggestion = await suggestMatch(tx, invoices, cashflowRecords);
      await updateBankTransaction(transactionId, {
        matchedInvoiceId: suggestion.invoiceId || undefined,
        matchedCashflowId: suggestion.cashflowId || undefined,
        matchConfidence: suggestion.confidence,
        matchReason: suggestion.reason
      });
    } catch (err) {
      console.error('AI matching error:', err);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Manual match
  const handleManualMatch = async (transactionId: string, invoiceId: string) => {
    await updateBankTransaction(transactionId, {
      matchStatus: 'manual',
      matchedInvoiceId: invoiceId,
      matchReason: 'Abbinamento manuale'
    });

    if (currentSession) {
      const tx = bankTransactions.find(t => t.id === transactionId);
      if (tx?.matchStatus === 'pending') {
        await updateReconciliationSession(currentSession.id, {
          matchedCount: currentSession.matchedCount + 1,
          pendingCount: Math.max(0, currentSession.pendingCount - 1)
        });
      }
    }

    setManualMatchTransaction(null);
  };

  // Run AI on all pending
  const handleRunAIAll = async () => {
    const pending = sessionTransactions.filter(tx => tx.matchStatus === 'pending');
    if (pending.length === 0) return;

    setIsProcessingAI(true);
    setAiProgress({ current: 0, total: pending.length });

    try {
      for (let i = 0; i < pending.length; i++) {
        const tx = pending[i];
        const suggestion = await suggestMatch(tx, invoices, cashflowRecords);
        await updateBankTransaction(tx.id, {
          matchedInvoiceId: suggestion.invoiceId || undefined,
          matchedCashflowId: suggestion.cashflowId || undefined,
          matchConfidence: suggestion.confidence,
          matchReason: suggestion.reason
        });
        setAiProgress({ current: i + 1, total: pending.length });

        // Small delay to avoid rate limiting
        if (i < pending.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      console.error('AI batch matching error:', err);
    } finally {
      setIsProcessingAI(false);
      setAiProgress({ current: 0, total: 0 });
    }
  };

  // Funzioni per selezione bulk
  const handleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
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
    if (!confirm(`Sei sicuro di voler eliminare ${selectedIds.size} ${selectedIds.size === 1 ? 'transazione' : 'transazioni'}?`)) return;

    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteBankTransaction(id);
      }
      // Update session counts
      if (currentSession) {
        const deletedTxs = sessionTransactions.filter(tx => selectedIds.has(tx.id));
        const matchedDeleted = deletedTxs.filter(tx => tx.matchStatus === 'matched' || tx.matchStatus === 'manual').length;
        const pendingDeleted = deletedTxs.filter(tx => tx.matchStatus === 'pending').length;
        const ignoredDeleted = deletedTxs.filter(tx => tx.matchStatus === 'ignored').length;

        await updateReconciliationSession(currentSession.id, {
          totalTransactions: currentSession.totalTransactions - selectedIds.size,
          matchedCount: Math.max(0, currentSession.matchedCount - matchedDeleted),
          pendingCount: Math.max(0, currentSession.pendingCount - pendingDeleted),
          ignoredCount: Math.max(0, currentSession.ignoredCount - ignoredDeleted)
        });
      }
      setSelectedIds(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!currentSession) return;
    if (!confirm(`Sei sicuro di voler eliminare l'intera sessione "${currentSession.periodo || currentSession.fileName}"? Verranno eliminate anche tutte le transazioni associate.`)) return;

    setIsDeleting(true);
    try {
      await deleteReconciliationSession(currentSession.id);
      setSelectedSession(null);
      setSelectedIds(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle close/reopen session
  const handleCloseSession = async () => {
    if (!currentSession) return;

    if (currentSession.status === 'closed') {
      // Reopen session
      if (!confirm('Riaprire questa sessione per modifiche?')) {
        return;
      }
      try {
        await updateReconciliationSession(currentSession.id, {
          status: 'open',
          closedDate: undefined
        });
      } catch (err) {
        console.error('Error reopening session:', err);
        setError('Errore durante la riapertura della sessione');
      }
    } else {
      // Close session
      if (!confirm('Chiudere questa sessione? Non sarà più possibile modificare le riconciliazioni.')) {
        return;
      }
      try {
        await updateReconciliationSession(currentSession.id, {
          status: 'closed',
          closedDate: new Date().toISOString()
        });
        // Deseleziona la sessione per svuotare le tabelle
        setSelectedSession(null);
        setSelectedIds(new Set());
      } catch (err) {
        console.error('Error closing session:', err);
        setError('Errore durante la chiusura della sessione');
      }
    }
  };

  const selectionState = filteredTransactions.length === 0
    ? 'none'
    : selectedIds.size === 0
      ? 'none'
      : selectedIds.size === filteredTransactions.length
        ? 'all'
        : 'partial';

  // Handle create invoice from transaction
  const handleCreateInvoice = async (invoiceData: Omit<Invoice, 'id'>, transaction: BankTransaction) => {
    const newInvoice = await addInvoice(invoiceData);
    if (newInvoice) {
      // Auto-match the transaction to the new invoice
      await updateBankTransaction(transaction.id, {
        matchStatus: 'matched',
        matchedInvoiceId: newInvoice.id,
        matchReason: 'Fattura creata da transazione bancaria'
      });
      // Update session counts
      if (currentSession) {
        await updateReconciliationSession(currentSession.id, {
          matchedCount: currentSession.matchedCount + 1,
          pendingCount: Math.max(0, currentSession.pendingCount - 1)
        });
      }
    }
    setCreateInvoiceTransaction(null);
  };

  // Handle create cashflow from transaction
  const handleCreateCashflow = async (cashflowData: { dataPagamento: string; importo: number; tipo: 'Entrata' | 'Uscita'; descrizione: string; categoria?: string; note?: string }, transaction: BankTransaction) => {
    const newCashflow = await addCashflowRecord({
      dataPagamento: cashflowData.dataPagamento,
      importo: cashflowData.importo,
      tipo: cashflowData.tipo,
      descrizione: cashflowData.descrizione,
      categoria: cashflowData.categoria,
      note: cashflowData.note
    });
    if (newCashflow) {
      // Auto-match the transaction to the new cashflow
      await updateBankTransaction(transaction.id, {
        matchStatus: 'matched',
        matchedCashflowId: newCashflow.id,
        matchReason: 'Movimento creato da transazione bancaria'
      });
      // Update session counts
      if (currentSession) {
        await updateReconciliationSession(currentSession.id, {
          matchedCount: currentSession.matchedCount + 1,
          pendingCount: Math.max(0, currentSession.pendingCount - 1)
        });
      }
    }
    setCreateCashflowTransaction(null);
  };

  return (
    <div className="p-0">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-dark">Riconciliazione Bancaria</h1>
          <p className="text-slate-500 mt-1">Carica l'estratto conto e riconcilia le transazioni con Claude AI</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            {isUploading ? 'Caricamento...' : 'Carica Estratto Conto'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600" />
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Session selector */}
      {reconciliationSessions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {reconciliationSessions.map(session => (
              <button
                key={session.id}
                onClick={() => setSelectedSession(session.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl border transition-colors relative ${
                  selectedSession === session.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{session.periodo || session.fileName}</div>
                  {session.status === 'closed' && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      selectedSession === session.id
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-50 text-slate-500'
                    }`}>
                      Chiusa
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-75 mt-0.5">
                  {session.matchedCount}/{session.totalTransactions} riconciliati
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      {selectedSession && currentSession ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4" shadow-card>
              <div className="text-slate-500 text-sm mb-1">Totale Transazioni</div>
              <div className="text-2xl font-bold text-dark">{stats.total}</div>
            </div>
            <div className="bg-white rounded-2xl p-4" shadow-card>
              <div className="text-yellow-600 text-sm mb-1">Da Verificare</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-2xl p-4" shadow-card>
              <div className="text-green-600 text-sm mb-1">Riconciliati</div>
              <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
            </div>
            <div className="bg-white rounded-2xl p-4" shadow-card>
              <div className="text-slate-500 text-sm mb-1">Ignorati</div>
              <div className="text-2xl font-bold text-slate-500">{stats.ignored}</div>
            </div>
          </div>

          {/* Session status and actions */}
          {currentSession.status === 'closed' && (
            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <FileCheck size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-medium text-dark">Sessione Chiusa</div>
                  <div className="text-sm text-slate-500">
                    {currentSession.closedDate && `Chiusa il ${formatDate(currentSession.closedDate)}`}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseSession}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <RefreshCw size={16} />
                Riapri Sessione
              </button>
            </div>
          )}

          {currentSession.status !== 'closed' && (
            <div className="mb-6 flex justify-end">
              <button
                onClick={handleCloseSession}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <FileCheck size={16} />
                Chiudi Sessione
              </button>
            </div>
          )}

          {/* Session info */}
          {(currentSession.saldoIniziale !== undefined || currentSession.saldoFinale !== undefined) && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 flex flex-wrap gap-6">
              {currentSession.numeroConto && (
                <div>
                  <div className="text-xs text-blue-600 mb-1">Conto</div>
                  <div className="font-medium text-blue-900">{currentSession.numeroConto}</div>
                </div>
              )}
              {currentSession.saldoIniziale !== undefined && (
                <div>
                  <div className="text-xs text-blue-600 mb-1">Saldo Iniziale</div>
                  <div className="font-medium text-blue-900">{formatCurrency(currentSession.saldoIniziale)}</div>
                </div>
              )}
              {currentSession.saldoFinale !== undefined && (
                <div>
                  <div className="text-xs text-blue-600 mb-1">Saldo Finale</div>
                  <div className="font-medium text-blue-900">{formatCurrency(currentSession.saldoFinale)}</div>
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mb-6 border-b border-slate-200 bg-white" shadow-card>
            <button
              onClick={() => setComparisonView('transactions')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'transactions'
                  ? 'border-blue-600 text-dark bg-blue-50'
                  : 'border-transparent text-slate-500 hover:text-dark hover:bg-slate-50'
              }`}
            >
              Transazioni
            </button>
            <button
              onClick={() => setComparisonView('unmatched')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'unmatched'
                  ? 'border-blue-600 text-dark bg-blue-50'
                  : 'border-transparent text-slate-500 hover:text-dark hover:bg-slate-50'
              }`}
            >
              Voci Mancanti
            </button>
            <button
              onClick={() => setComparisonView('sidebyside')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'sidebyside'
                  ? 'border-blue-600 text-dark bg-blue-50'
                  : 'border-transparent text-slate-500 hover:text-dark hover:bg-slate-50'
              }`}
            >
              Vista Affiancata
            </button>
            <button
              onClick={() => setComparisonView('report')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'report'
                  ? 'border-blue-600 text-dark bg-blue-50'
                  : 'border-transparent text-slate-500 hover:text-dark hover:bg-slate-50'
              }`}
            >
              Report Differenze
            </button>
          </div>

          {/* Filters and actions - only show for transactions view */}
          {comparisonView === 'transactions' && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Select all button */}
              <button
                onClick={handleSelectAll}
                disabled={currentSession.status === 'closed'}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectionState === 'all' ? (
                  <CheckSquare size={16} className="text-primary" />
                ) : selectionState === 'partial' ? (
                  <MinusSquare size={16} className="text-primary" />
                ) : (
                  <Square size={16} />
                )}
                {selectionState === 'all' ? 'Deseleziona' : 'Seleziona tutti'}
              </button>

              {/* Filter buttons */}
              {(['all', 'pending', 'matched', 'ignored'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelectedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {f === 'all' && 'Tutti'}
                  {f === 'pending' && `Da verificare (${stats.pending})`}
                  {f === 'matched' && `Riconciliati (${stats.matched})`}
                  {f === 'ignored' && `Ignorati (${stats.ignored})`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk delete button */}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting || currentSession.status === 'closed'}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Eliminazione...' : `Elimina (${selectedIds.size})`}
                </button>
              )}

              {/* Delete session button */}
              <button
                onClick={handleDeleteSession}
                disabled={isDeleting || currentSession.status === 'closed'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-500 rounded-lg font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} />
                Elimina Sessione
              </button>

              {stats.pending > 0 && (
                <button
                  onClick={handleRunAIAll}
                  disabled={isProcessingAI || currentSession.status === 'closed'}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={16} className={isProcessingAI ? 'animate-spin' : ''} />
                  {isProcessingAI
                    ? `Analisi AI ${aiProgress.current}/${aiProgress.total}...`
                    : `Analizza Tutti con AI (${stats.pending})`
                  }
                </button>
              )}
            </div>
          </div>
          )}

          {/* Conditional View Rendering */}
          {comparisonView === 'transactions' && (
            <div className="bg-white rounded-2xl overflow-hidden" shadow-card>
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  {filter === 'all'
                    ? 'Nessuna transazione in questa sessione'
                    : `Nessuna transazione ${filter === 'pending' ? 'da verificare' : filter === 'matched' ? 'riconciliata' : 'ignorata'}`
                  }
                </div>
              ) : (
                filteredTransactions.map(tx => (
                  <TransactionRow
                    key={tx.id}
                    transaction={tx}
                    invoices={invoices}
                    onConfirm={(invoiceId) => handleConfirmMatch(tx.id, invoiceId)}
                    onIgnore={() => handleIgnore(tx.id)}
                    onManualMatch={() => setManualMatchTransaction(tx)}
                    onRunAI={() => handleRunAI(tx.id)}
                    isProcessing={isProcessingAI}
                    isSelected={selectedIds.has(tx.id)}
                    onToggleSelect={() => handleToggleSelect(tx.id)}
                    onCreateInvoice={() => setCreateInvoiceTransaction(tx)}
                    onCreateCashflow={() => setCreateCashflowTransaction(tx)}
                    disabled={currentSession.status === 'closed'}
                  />
                ))
              )}
            </div>
          )}

          {comparisonView === 'unmatched' && (
            <UnmatchedView
              unmatchedBankTransactions={unmatchedData.unmatchedBankTransactions}
              unmatchedCashflows={unmatchedData.unmatchedCashflows}
            />
          )}

          {comparisonView === 'sidebyside' && (
            <SideBySideView rows={sideBySideData} />
          )}

          {comparisonView === 'report' && (
            <ReportView report={reportData} />
          )}
        </>
      ) : (
        // Empty state
        <div className="bg-white rounded-2xl p-12 text-center" shadow-card>
          <FileCheck size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-dark mb-2">Nessun estratto conto caricato</h3>
          <p className="text-slate-500 mb-6">
            Carica un file Excel (.xlsx) con le transazioni bancarie per iniziare la riconciliazione
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            <Upload size={20} />
            Carica Estratto Conto
          </button>
        </div>
      )}

      {/* Manual match modal */}
      {manualMatchTransaction && (
        <ManualMatchModal
          transaction={manualMatchTransaction}
          invoices={invoices}
          cashflowRecords={cashflowRecords}
          onMatch={(invoiceId) => handleManualMatch(manualMatchTransaction.id, invoiceId)}
          onClose={() => setManualMatchTransaction(null)}
        />
      )}

      {/* Create Invoice Modal */}
      {createInvoiceTransaction && (
        <CreateInvoiceModal
          transaction={createInvoiceTransaction}
          onSave={(invoiceData) => handleCreateInvoice(invoiceData, createInvoiceTransaction)}
          onClose={() => setCreateInvoiceTransaction(null)}
        />
      )}

      {/* Create Cashflow Modal */}
      {createCashflowTransaction && (
        <CreateCashflowModal
          transaction={createCashflowTransaction}
          onSave={(cashflowData) => handleCreateCashflow(cashflowData, createCashflowTransaction)}
          onClose={() => setCreateCashflowTransaction(null)}
        />
      )}
    </div>
  );
};
