import React, { useState, useMemo, useRef } from 'react';
import { Upload, FileCheck, AlertCircle, Check, X, RefreshCw, ChevronDown, ChevronUp, Search, Eye, Link2, Trash2, FilePlus, PlusCircle, StopCircle } from 'lucide-react';
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
  // Se il numero contiene già l'anno (es. "180/2026"), non duplicarlo
  if (numero.includes('/')) {
    return numero;
  }
  return `${numero}/${anno}`;
};

// Transaction row component
const TransactionRow: React.FC<{
  transaction: BankTransaction;
  invoices: Invoice[];
  cashflowRecords: CashflowRecord[];
  bankTransactions: BankTransaction[];
  onConfirm: (invoiceId: string) => void;
  onConfirmCashflow: (cashflowId: string) => void;
  onIgnore: () => void;
  onManualMatch: () => void;
  onUnmatch: () => void;
  onRunAI: () => void;
  isProcessing: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCreateInvoice: () => void;
  onCreateCashflow: () => void;
  disabled?: boolean;
}> = ({ transaction, invoices, cashflowRecords, bankTransactions, onConfirm, onConfirmCashflow, onIgnore, onManualMatch, onUnmatch, onRunAI, isProcessing, isSelected, onToggleSelect, onCreateInvoice, onCreateCashflow, disabled = false }) => {
  const [expanded, setExpanded] = useState(false);

  // Find matched cashflow first (priority)
  const matchedCashflow = transaction.matchedCashflowId
    ? cashflowRecords.find(cf => cf.id === transaction.matchedCashflowId)
    : null;

  // Find matched invoice (could be from cashflow or direct)
  const matchedInvoice = matchedCashflow?.invoiceId
    ? invoices.find(inv => inv.id === matchedCashflow.invoiceId)
    : transaction.matchedInvoiceId
      ? invoices.find(inv => inv.id === transaction.matchedInvoiceId)
      : null;

  const getStatusColor = () => {
    switch (transaction.matchStatus) {
      case 'matched': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
      case 'ignored': return 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
      case 'manual': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400';
      default: return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400';
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

  const getMatchReasonStyle = (confidence: number | undefined) => {
    if (confidence === undefined || confidence >= 80) {
      // High confidence or matched - blue/info style
      return {
        container: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800',
        icon: 'text-blue-600 dark:text-blue-400',
        text: 'text-blue-800 dark:text-blue-300'
      };
    } else if (confidence >= 50) {
      // Medium confidence - yellow/warning style
      return {
        container: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
        icon: 'text-yellow-600 dark:text-yellow-400',
        text: 'text-yellow-800 dark:text-yellow-300'
      };
    } else {
      // Low confidence - red/error style
      return {
        container: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
        text: 'text-red-800 dark:text-red-300'
      };
    }
  };

  return (
    <div className={`border-b border-gray-200 dark:border-dark-border last:border-b-0 ${isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
      <div
        className={`p-4 hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors cursor-pointer ${expanded ? 'bg-gray-50 dark:bg-dark-bg' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center justify-center w-8">
              <label className="inline-flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
                  disabled={disabled}
                  className="sr-only peer"
                />
                <div className="relative w-4 h-4 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/50 peer-focus:ring-2 peer-focus:ring-primary/20 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed">
                  <Check
                    size={12}
                    className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                    strokeWidth={3}
                  />
                </div>
              </label>
            </div>
            <div className="w-24 text-sm text-gray-500 dark:text-gray-400">{formatDate(transaction.data)}</div>
            <div className="flex-1">
              <div className="font-medium text-dark dark:text-white text-sm truncate max-w-md">
                {transaction.descrizione || transaction.causale || 'Movimento senza descrizione'}
              </div>
              {transaction.causale && transaction.descrizione && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.causale}</div>
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
        <div className="px-4 pb-4 bg-gray-50 dark:bg-dark-bg">
          <div className="bg-white dark:bg-dark-card rounded-lg p-4 shadow-sm border border-gray-200 dark:border-dark-border">
            {/* Transaction details */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-bg rounded-lg">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">DETTAGLI TRANSAZIONE</div>
              <div className="space-y-1">
                {transaction.descrizione && (
                  <div className="text-sm text-dark dark:text-white">
                    <span className="font-medium">Descrizione:</span> {transaction.descrizione}
                  </div>
                )}
                {transaction.causale && (
                  <div className="text-sm text-dark dark:text-white">
                    <span className="font-medium">Causale:</span> {transaction.causale}
                  </div>
                )}
                {transaction.dataValuta && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Data Valuta:</span> {formatDate(transaction.dataValuta)}
                  </div>
                )}
                {transaction.saldo !== undefined && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Saldo dopo operazione:</span> {formatCurrency(transaction.saldo)}
                  </div>
                )}
              </div>
            </div>

            {/* Match info */}
            {transaction.matchReason && (() => {
              const style = getMatchReasonStyle(transaction.matchConfidence);

              // Extract cashflow ID from reason (e.g., "CF-0123" or "movimento CF-0123")
              const cfIdMatch = transaction.matchReason.match(/CF-\d+/i);
              const suggestedCashflowId = cfIdMatch ? cfIdMatch[0] : null;
              const suggestedCashflow = suggestedCashflowId ? cashflowRecords.find(cf => cf.id === suggestedCashflowId) : null;
              const suggestedInvoice = suggestedCashflow?.invoiceId ? invoices.find(inv => inv.id === suggestedCashflow.invoiceId) : null;

              const showSuggestedCashflow = transaction.matchStatus === 'pending' && suggestedCashflow;

              return (
                <div className={`mb-4 p-3 rounded-lg ${style.container}`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className={`${style.icon} mt-0.5 flex-shrink-0`} />
                    <div className="flex-1">
                      <div className={`text-sm ${style.text}`}>
                        {transaction.matchReason}
                      </div>
                      {transaction.matchConfidence !== undefined && (
                        <div className={`text-xs font-semibold mt-1 ${getConfidenceColor(transaction.matchConfidence)}`}>
                          Affidabilità: {transaction.matchConfidence}%
                        </div>
                      )}

                      {/* Show suggested cashflow when confidence is low */}
                      {showSuggestedCashflow && (
                        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Movimento confrontato:
                          </div>
                          <div className="bg-white dark:bg-dark-card rounded p-2 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">ID:</span>
                              <span className="font-mono font-semibold text-gray-900 dark:text-white">{suggestedCashflow.id}</span>
                            </div>
                            {suggestedCashflow.dataPagamento && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Data:</span>
                                <span className="text-gray-900 dark:text-white">{suggestedCashflow.dataPagamento}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Importo:</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {suggestedCashflow.tipo === 'Entrata' ? '+' : '-'}€{(suggestedCashflow.importo || (suggestedInvoice ? (suggestedInvoice.flusso || 0) + (suggestedInvoice.iva || 0) : 0)).toFixed(2)}
                              </span>
                            </div>
                            {(suggestedCashflow.note || suggestedInvoice?.note) && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Note:</span>
                                <span className="text-gray-900 dark:text-white text-right max-w-[200px] truncate">
                                  {suggestedCashflow.note || suggestedInvoice?.note}
                                </span>
                              </div>
                            )}
                            {suggestedInvoice && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Progetto:</span>
                                <span className="text-gray-900 dark:text-white text-right max-w-[200px] truncate">
                                  {suggestedInvoice.nomeProgetto || suggestedInvoice.spesa || 'N/A'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Show possible cashflows for manual review when pending and no specific cashflow matched */}
            {transaction.matchStatus === 'pending' && !matchedCashflow && !matchedInvoice && (() => {
              // Skip if we already showed a suggested cashflow above
              const cfIdMatch = transaction.matchReason?.match(/CF-\d+/i);
              const alreadyShowedCashflow = cfIdMatch && cashflowRecords.find(cf => cf.id === cfIdMatch[0]);
              if (alreadyShowedCashflow) return null;
              // Find possible cashflow candidates based on amount and date
              const txAmount = Math.abs(transaction.importo || 0);
              const txDate = new Date(transaction.data);

              // Get unmatched cashflows
              const matchedCashflowIds = new Set(
                bankTransactions
                  .filter(tx => tx.matchedCashflowId && tx.matchStatus !== 'ignored')
                  .map(tx => tx.matchedCashflowId!)
              );

              const matchedInvoiceIds = new Set(
                bankTransactions
                  .filter(tx => tx.matchedInvoiceId && tx.matchStatus !== 'ignored')
                  .map(tx => tx.matchedInvoiceId!)
              );

              const unmatchedCashflows = cashflowRecords.filter(
                cf => !matchedCashflowIds.has(cf.id) && (!cf.invoiceId || !matchedInvoiceIds.has(cf.invoiceId))
              );

              // Find candidates by amount similarity (within 10% or 10 euro)
              const candidates = unmatchedCashflows
                .map(cf => {
                  const invoice = cf.invoiceId ? invoices.find(inv => inv.id === cf.invoiceId) : null;
                  const cfAmount = cf.importo || (invoice ? (invoice.flusso || 0) + (invoice.iva || 0) : 0);
                  const amountDiff = Math.abs(cfAmount - txAmount);
                  const amountDiffPercent = (amountDiff / txAmount) * 100;

                  // Date difference in days
                  const cfDate = new Date(cf.dataPagamento);
                  const dateDiff = Math.abs((cfDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

                  return {
                    cashflow: cf,
                    invoice,
                    amountDiff,
                    amountDiffPercent,
                    dateDiff,
                    score: (amountDiffPercent < 1 ? 100 : 100 - amountDiffPercent) + (dateDiff < 3 ? 50 : 0)
                  };
                })
                .filter(c => c.amountDiffPercent < 10 || c.amountDiff < 10)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3); // Show top 3 candidates

              if (candidates.length === 0) return null;

              return (
                <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                        Verifica manuale richiesta
                      </div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-400">
                        {candidates.length === 1 ? 'Trovato 1 possibile movimento' : `Trovati ${candidates.length} possibili movimenti`} di cassa:
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {candidates.map((candidate, idx) => (
                      <div key={candidate.cashflow.id} className="bg-white dark:bg-dark-card rounded p-3 border border-yellow-200 dark:border-yellow-800">
                        <div className="space-y-1 text-xs mb-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">ID:</span>
                            <span className="font-mono font-semibold text-gray-900 dark:text-white">{candidate.cashflow.id}</span>
                          </div>
                          {candidate.cashflow.dataPagamento && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Data:</span>
                              <span className="text-gray-900 dark:text-white">
                                {candidate.cashflow.dataPagamento}
                                {candidate.dateDiff > 0 && (
                                  <span className="ml-1 text-gray-500 dark:text-gray-400">
                                    ({Math.round(candidate.dateDiff)}gg diff.)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Importo:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {candidate.cashflow.tipo === 'Entrata' ? '+' : '-'}€{(candidate.cashflow.importo || (candidate.invoice ? (candidate.invoice.flusso || 0) + (candidate.invoice.iva || 0) : 0)).toFixed(2)}
                              {candidate.amountDiff > 0.01 && (
                                <span className="ml-1 text-gray-500 dark:text-gray-400">
                                  (diff. €{candidate.amountDiff.toFixed(2)})
                                </span>
                              )}
                            </span>
                          </div>
                          {(candidate.cashflow.note || candidate.invoice?.note) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Note:</span>
                              <span className="text-gray-900 dark:text-white text-right max-w-[200px] truncate">
                                {candidate.cashflow.note || candidate.invoice?.note}
                              </span>
                            </div>
                          )}
                          {candidate.invoice && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Progetto:</span>
                              <span className="text-gray-900 dark:text-white text-right max-w-[200px] truncate">
                                {candidate.invoice.nomeProgetto || candidate.invoice.spesa || 'N/A'}
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirmCashflow(candidate.cashflow.id);
                          }}
                          disabled={disabled}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check size={14} />
                          Abbina a questo movimento
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Matched cashflow (priority) */}
            {matchedCashflow && (
              <div className="mb-4 p-4 border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <Link2 size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-green-900 dark:text-green-300">MOVIMENTO DI CASSA ABBINATO</span>
                </div>
                <div className="bg-white dark:bg-dark-card rounded-lg p-3 space-y-2 border border-gray-200 dark:border-dark-border">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-bold text-green-700 dark:text-green-400">{matchedCashflow.id}</span>
                    <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">|</span>
                    <span className="text-gray-700 dark:text-gray-300 dark:text-gray-600">{matchedCashflow.dataPagamento ? formatDate(matchedCashflow.dataPagamento) : 'N/D'}</span>
                    <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">|</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">
                      {(matchedCashflow.importo || ((matchedInvoice?.flusso || 0) + (matchedInvoice?.iva || 0))).toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                  {(matchedCashflow.note || matchedCashflow.descrizione) && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-dark-border">
                      <span className="font-medium text-gray-500 dark:text-gray-400">Note:</span> {matchedCashflow.note || matchedCashflow.descrizione}
                    </div>
                  )}
                  {matchedInvoice && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-dark-border">
                      <span className="font-medium">Rif. Fattura:</span> {formatInvoiceId(matchedInvoice.id, matchedInvoice.anno)} - {matchedInvoice.nomeProgetto || matchedInvoice.spesa || 'N/A'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Matched invoice only (when no cashflow) */}
            {!matchedCashflow && matchedInvoice && (
              <div className="mb-4 p-3 border-2 border-green-500 dark:border-green-600 bg-white dark:bg-dark-card rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 size={16} className="text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-dark dark:text-white">FATTURA ABBINATA</span>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-dark dark:text-white">
                    <span className="font-semibold">{formatInvoiceId(matchedInvoice.id, matchedInvoice.anno)}</span>
                    <span className="mx-2 text-gray-500 dark:text-gray-400">•</span>
                    <span className="font-medium">{matchedInvoice.nomeProgetto || matchedInvoice.spesa || 'N/A'}</span>
                    <span className="mx-2 text-gray-500 dark:text-gray-400">•</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency((matchedInvoice.flusso || 0) + (matchedInvoice.iva || 0))}</span>
                  </div>
                  {matchedInvoice.note && (
                    <div className="text-sm text-dark dark:text-white bg-gray-50 dark:bg-dark-bg rounded p-2 border border-gray-200 dark:border-dark-border">
                      <span className="font-medium text-dark dark:text-white">Descrizione:</span> {matchedInvoice.note}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Link2 size={14} />
                  Abbina Manualmente
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRunAI(); }}
                  disabled={isProcessing || disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={isProcessing ? 'animate-spin' : ''} />
                  Analizza AI
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onIgnore(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onManualMatch(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} />
                  Modifica Abbinamento
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onUnmatch(); }}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X size={14} />
                  Rimuovi Abbinamento
                </button>
              </div>
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

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.tipo === transaction.tipo)
      .filter(inv => {
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
  }, [invoices, transaction.tipo, search]);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-dark-border flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-dark dark:text-white">Abbina Transazione</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatDate(transaction.data)} | {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{transaction.descrizione}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per ID, progetto, importo..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-dark dark:text-white"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Nessuna fattura trovata
            </div>
          ) : (
            filteredInvoices.map(inv => {
              const totale = (inv.flusso || 0) + (inv.iva || 0);
              const isExactMatch = Math.abs(totale - transaction.importo) < 0.01;

              return (
                <div
                  key={inv.id}
                  onClick={() => onMatch(inv.id)}
                  className={`p-4 border-b border-gray-200 dark:border-dark-border last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
                    isExactMatch ? 'bg-green-50 dark:bg-green-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-dark dark:text-white">{formatInvoiceId(inv.id, inv.anno)}</div>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {inv.nomeProgetto || inv.spesa || 'N/A'} | {inv.data instanceof Date ? formatDate(inv.data.toISOString()) : formatDate(inv.data)}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`font-semibold ${inv.tipo === 'Entrata' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(totale)}
                      </div>
                      {isExactMatch && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Importo esatto</span>
                      )}
                    </div>
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
    nomeProgetto: transaction.descrizione || transaction.causale || '',
    tipo: transaction.tipo as 'Entrata' | 'Uscita',
    statoFatturazione: 'Effettivo' as 'Stimato' | 'Effettivo' | 'Nessuno',
    spesa: '',
    tipoSpesa: '',
    note: transaction.descrizione || transaction.causale || '',
    flusso: Math.abs(transaction.importo), // Use absolute value for amount
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
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-dark-border">
          <h3 className="text-xl font-semibold text-dark dark:text-white">Crea Fattura da Transazione</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(transaction.data)} | {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'Entrata' | 'Uscita' })}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              >
                <option value="Entrata">Entrata</option>
                <option value="Uscita">Uscita</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Stato *</label>
              <select
                value={formData.statoFatturazione}
                onChange={(e) => setFormData({ ...formData, statoFatturazione: e.target.value as 'Stimato' | 'Effettivo' | 'Nessuno' })}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              >
                <option value="Effettivo">Effettivo</option>
                <option value="Stimato">Stimato</option>
                <option value="Nessuno">Nessuno</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Progetto</label>
            <input
              type="text"
              value={formData.nomeProgetto}
              onChange={(e) => setFormData({ ...formData, nomeProgetto: e.target.value })}
              className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Nome progetto..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Categoria Spesa</label>
              <input
                type="text"
                value={formData.spesa}
                onChange={(e) => setFormData({ ...formData, spesa: e.target.value })}
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Es: Utenze, Tools..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo Spesa</label>
              <input
                type="text"
                value={formData.tipoSpesa}
                onChange={(e) => setFormData({ ...formData, tipoSpesa: e.target.value })}
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Es: Costi per servizi..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Importo Netto *</label>
              <input
                type="number"
                step="0.01"
                value={formData.flusso}
                onChange={(e) => setFormData({ ...formData, flusso: parseFloat(e.target.value) || 0 })}
                required
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">IVA</label>
              <input
                type="number"
                step="0.01"
                value={formData.iva}
                onChange={(e) => setFormData({ ...formData, iva: parseFloat(e.target.value) || 0 })}
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Note aggiuntive..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all"
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
    importo: Math.abs(transaction.importo), // Use absolute value for amount
    tipo: transaction.tipo as 'Entrata' | 'Uscita',
    descrizione: '', // Leave empty - user will fill it in
    categoria: '',
    note: transaction.descrizione || transaction.causale || '' // Bank transaction description goes in notes
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark-card rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-dark-border">
          <h3 className="text-xl font-semibold text-dark dark:text-white">Crea Movimento da Transazione</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(transaction.data)} | {transaction.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(transaction.importo)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Data *</label>
              <input
                type="date"
                value={formData.dataPagamento}
                onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                required
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'Entrata' | 'Uscita' })}
                className="w-full pl-4 pr-12 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              >
                <option value="Entrata">Entrata</option>
                <option value="Uscita">Uscita</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Descrizione *</label>
            <input
              type="text"
              value={formData.descrizione}
              onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
              required
              className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Descrizione movimento..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Importo *</label>
              <input
                type="number"
                step="0.01"
                value={formData.importo}
                onChange={(e) => setFormData({ ...formData, importo: parseFloat(e.target.value) || 0 })}
                required
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Categoria</label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Es: Banca, Altro..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Note</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={2}
              className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none bg-white dark:bg-gray-800/30 text-dark dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Note aggiuntive..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all"
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

  // Unmatched bank transactions (pending status without any match)
  const unmatchedBankTransactions = bankTransactions.filter(
    tx => tx.matchStatus === 'pending' && !tx.matchedInvoiceId && !tx.matchedCashflowId
  );

  // Unmatched cashflows (no bank transaction reference)
  const matchedCashflowIds = new Set(
    bankTransactions
      .filter(tx => tx.matchedCashflowId && tx.matchStatus !== 'ignored')
      .map(tx => tx.matchedCashflowId!)
  );

  // Also include cashflows whose invoices are matched
  const matchedInvoiceIds = new Set(
    bankTransactions
      .filter(tx => tx.matchedInvoiceId && tx.matchStatus !== 'ignored')
      .map(tx => tx.matchedInvoiceId!)
  );

  const unmatchedCashflows = cashflowsInPeriod.filter(
    cf => !matchedCashflowIds.has(cf.id) && (!cf.invoiceId || !matchedInvoiceIds.has(cf.invoiceId))
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
    tx => tx.matchStatus === 'pending' && !tx.matchedInvoiceId && !tx.matchedCashflowId
  ).length;

  const matchedCashflowIds = new Set(
    bankTransactions
      .filter(tx => tx.matchedCashflowId && tx.matchStatus !== 'ignored')
      .map(tx => tx.matchedCashflowId!)
  );

  // Also include cashflows whose invoices are matched
  const matchedInvoiceIds = new Set(
    bankTransactions
      .filter(tx => tx.matchedInvoiceId && tx.matchStatus !== 'ignored')
      .map(tx => tx.matchedInvoiceId!)
  );

  const unmatchedCashflowCount = cashflowsInPeriod.filter(
    cf => !matchedCashflowIds.has(cf.id) && (!cf.invoiceId || !matchedInvoiceIds.has(cf.invoiceId))
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
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Transazioni Bancarie Non Abbinate</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Totale: {formatCurrency(totalBankAmount)}</p>
        </div>

        <div className="space-y-3">
          {unmatchedBankTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Check className="w-12 h-12 mx-auto mb-2" />
              <p>Tutte le transazioni bancarie sono state riconciliate</p>
            </div>
          ) : (
            unmatchedBankTransactions.map(tx => (
              <div key={tx.id} className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-dark dark:text-white">{tx.descrizione}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(tx.data).toLocaleDateString('it-IT')}</p>
                    {tx.causale && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tx.causale}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <span className={`text-lg font-semibold ${
                      tx.tipo === 'Entrata' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {tx.tipo === 'Entrata' ? '+' : '-'}{formatCurrency(tx.importo)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
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
      <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Flussi di Cassa Non Abbinati</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Totale: {formatCurrency(totalCashflowAmount)}</p>
        </div>

        <div className="space-y-3">
          {unmatchedCashflows.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Check className="w-12 h-12 mx-auto mb-2" />
              <p>Tutti i flussi di cassa sono stati riconciliati</p>
            </div>
          ) : (
            unmatchedCashflows.map(cf => {
              const amount = cf.importo || ((cf.invoice?.flusso || 0) + (cf.invoice?.iva || 0));
              const tipo = cf.tipo || cf.invoice?.tipo;
              const descrizione = cf.descrizione || cf.invoice?.nomeProgetto || cf.invoice?.spesa || 'N/D';

              return (
                <div key={cf.id} className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-dark dark:text-white">{descrizione}</p>
                      {cf.dataPagamento && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(cf.dataPagamento).toLocaleDateString('it-IT')}</p>
                      )}
                      {cf.invoice && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Da Fattura: {formatInvoiceId(cf.invoice.id, cf.invoice.anno)}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span className={`text-lg font-semibold ${
                        tipo === 'Entrata' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tipo === 'Entrata' ? '+' : '-'}{formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
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
      if (!confidence) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      if (confidence > 80) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      if (confidence > 50) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
    }
    if (status === 'unmatched') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    return 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
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
    <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-bg">
            <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="px-6 py-4 whitespace-nowrap">Data</th>
              <th className="px-6 py-4 whitespace-nowrap">Descrizione Banca</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Importo Banca</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Match</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Importo Cashflow</th>
              <th className="px-6 py-4 whitespace-nowrap">Descrizione Cashflow</th>
              <th className="px-6 py-4 whitespace-nowrap text-center">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {row.bankTransaction?.data
                        ? new Date(row.bankTransaction.data).toLocaleDateString('it-IT')
                        : row.cashflow?.dataPagamento
                          ? new Date(row.cashflow.dataPagamento).toLocaleDateString('it-IT')
                          : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {row.bankTransaction ? (
                        <div>
                          <div className="text-dark dark:text-white font-medium">
                            {row.bankTransaction.descrizione || '-'}
                          </div>
                          {row.bankTransaction.causale && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {row.bankTransaction.causale}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {bankAmount !== undefined ? (
                        <span className={bankTipo === 'Entrata' ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                          {bankTipo === 'Entrata' ? '+' : '-'}{formatCurrency(bankAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {row.matchStatus === 'matched' ? (
                        <div className="flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                          {row.confidence && (
                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">{row.confidence}%</span>
                          )}
                        </div>
                      ) : row.matchStatus === 'unmatched' ? (
                        <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mx-auto" />
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {cashflowAmount !== undefined ? (
                        <span className={cashflowTipo === 'Entrata' ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                          {cashflowTipo === 'Entrata' ? '+' : '-'}{formatCurrency(cashflowAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {row.cashflow ? (
                        <div>
                          <div className="text-dark dark:text-white font-medium">
                            {row.cashflow.invoice?.nomeProgetto || row.cashflow.invoice?.spesa || row.cashflow.descrizione || '-'}
                          </div>
                          {(row.cashflow.invoice?.note || row.cashflow.note) && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {row.cashflow.invoice?.note || row.cashflow.note}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-accent shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck size={16} className="text-accent" />
            <h3 className="text-card-title">Percentuale Riconciliazione</h3>
          </div>
          <p className="text-kpi-value text-dark dark:text-white">{report.reconciliationPercentage.toFixed(1)}%</p>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-secondary shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Check size={16} className="text-secondary" />
            <h3 className="text-card-title">Transazioni Abbinate</h3>
          </div>
          <p className="text-kpi-value text-dark dark:text-white">{report.matchedCount}</p>
        </div>

        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border-l-4 border-primary shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-primary" />
            <h3 className="text-card-title">Voci Non Abbinate</h3>
          </div>
          <p className="text-kpi-value text-dark dark:text-white">{report.unmatchedBankCount + report.unmatchedCashflowCount}</p>
          <p className="text-small mt-1">Banca: {report.unmatchedBankCount} | Cashflow: {report.unmatchedCashflowCount}</p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 className="text-section-title text-dark dark:text-white">Confronto Totali</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-bg">
              <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4 whitespace-nowrap">Categoria</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Banca</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Registrato</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Differenza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
              <tr className="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark dark:text-white">Entrate Totali</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400 font-medium">
                  {formatCurrency(report.totalBankEntrate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400 font-medium">
                  {formatCurrency(report.totalCashflowEntrate)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  hasDifference(report.differenceEntrate) ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {report.differenceEntrate >= 0 ? '+' : ''}{formatCurrency(report.differenceEntrate)}
                  {hasDifference(report.differenceEntrate) && (
                    <AlertCircle className="w-4 h-4 inline ml-1" />
                  )}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark dark:text-white">Uscite Totali</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400 font-medium">
                  {formatCurrency(report.totalBankUscite)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400 font-medium">
                  {formatCurrency(report.totalCashflowUscite)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  hasDifference(report.differenceUscite) ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {report.differenceUscite >= 0 ? '+' : ''}{formatCurrency(report.differenceUscite)}
                  {hasDifference(report.differenceUscite) && (
                    <AlertCircle className="w-4 h-4 inline ml-1" />
                  )}
                </td>
              </tr>
              <tr className="bg-gray-50 dark:bg-dark-bg font-semibold">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-dark dark:text-white">Saldo Netto</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                  report.totalBankNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(report.totalBankNet)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                  report.totalCashflowNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(report.totalCashflowNet)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                  hasDifference(report.differenceNet) ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
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
        <div className="bg-white dark:bg-dark-card rounded-xl border-l-4 border-red-600 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="text-section-title text-dark dark:text-white">Anomalie Rilevate ({report.anomalies.length})</h3>
            </div>
            <p className="text-small mt-1">Discrepanze tra importi registrati e transazioni bancarie</p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {report.anomalies.map((anomaly, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-dark dark:text-white">
                          {formatInvoiceId(anomaly.invoice.id, anomaly.invoice.anno)}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium rounded-md text-white bg-red-600 dark:bg-red-500">
                          {anomaly.type === 'no_bank_transaction' ? 'Transazione Mancante' : 'Importo Discrepante'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        {anomaly.invoice.nomeProgetto || anomaly.invoice.spesa || 'N/A'}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {anomaly.message}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-small mb-1">Registrato</div>
                      <div className="text-kpi-small text-dark dark:text-white">
                        {formatCurrency(anomaly.cashflowAmount)}
                      </div>
                      {anomaly.bankTransactionAmount !== undefined && (
                        <>
                          <div className="text-small mt-2 mb-1">Banca</div>
                          <div className="text-kpi-small text-red-600 dark:text-red-400">
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
  const { invoices, cashflowRecords, reconciliationSessions, bankTransactions, addReconciliationSession, addBankTransaction, updateBankTransaction, updateReconciliationSession, deleteBankTransaction, deleteReconciliationSession, clearAllReconciliationSessions, addInvoice, addCashflowRecord, aiProcessing, setAiProcessing, stopAiProcessing, refreshData } = useData();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(() => {
    return localStorage.getItem('reconciliation_selectedSession');
  });
  const [filter, setFilter] = useState<'all' | 'pending' | 'matched' | 'ignored'>(() => {
    const saved = localStorage.getItem('reconciliation_filter');
    return (saved as 'all' | 'pending' | 'matched' | 'ignored') || 'all';
  });
  const [isStoppingAI, setIsStoppingAI] = useState(false);
  const [manualMatchTransaction, setManualMatchTransaction] = useState<BankTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [createInvoiceTransaction, setCreateInvoiceTransaction] = useState<BankTransaction | null>(null);
  const [createCashflowTransaction, setCreateCashflowTransaction] = useState<BankTransaction | null>(null);
  const [comparisonView, setComparisonView] = useState<'transactions' | 'unmatched' | 'sidebyside' | 'report'>(() => {
    const saved = localStorage.getItem('reconciliation_comparisonView');
    return (saved as 'transactions' | 'unmatched' | 'sidebyside' | 'report') || 'transactions';
  });
  const [aiMatchingEnabled, setAiMatchingEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('reconciliation_aiMatchingEnabled');
    return saved === null ? false : saved === 'true'; // Default: DISABILITATA per sicurezza costi
  });

  // Check if AI keys are configured
  const checkAIKeysConfigured = () => {
    const savedSettings = localStorage.getItem('ai_settings');
    if (!savedSettings) return false;
    try {
      const parsed = JSON.parse(savedSettings);
      return (parsed.anthropicApiKey && parsed.anthropicApiKey.length > 0) ||
             (parsed.openaiApiKey && parsed.openaiApiKey.length > 0);
    } catch {
      return false;
    }
  };
  const [selectedAiProvider, setSelectedAiProvider] = useState<'anthropic' | 'openai'>(() => {
    const saved = localStorage.getItem('reconciliation_selectedAiProvider');
    // Try to load from AI settings
    if (!saved) {
      const aiSettings = localStorage.getItem('ai_settings');
      if (aiSettings) {
        try {
          const parsed = JSON.parse(aiSettings);
          return parsed.defaultProvider || 'anthropic';
        } catch {
          return 'anthropic';
        }
      }
    }
    return (saved as 'anthropic' | 'openai') || 'anthropic';
  });

  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
    const saved = localStorage.getItem('reconciliation_selectedAiModel');
    return saved || (selectedAiProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022');
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopAIProcessingRef = useRef<boolean>(false);

  // Persist state to localStorage
  React.useEffect(() => {
    if (selectedSession) {
      localStorage.setItem('reconciliation_selectedSession', selectedSession);
    } else {
      localStorage.removeItem('reconciliation_selectedSession');
    }
  }, [selectedSession]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_filter', filter);
  }, [filter]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_comparisonView', comparisonView);
  }, [comparisonView]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_aiMatchingEnabled', String(aiMatchingEnabled));
  }, [aiMatchingEnabled]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_selectedAiProvider', selectedAiProvider);
  }, [selectedAiProvider]);

  React.useEffect(() => {
    localStorage.setItem('reconciliation_selectedAiModel', selectedAiModel);
  }, [selectedAiModel]);

  // Sync aiProcessing.shouldStop with stopAIProcessingRef
  React.useEffect(() => {
    stopAIProcessingRef.current = aiProcessing.shouldStop;
  }, [aiProcessing.shouldStop]);

  // Get AI model details
  const getAiModelInfo = (modelId: string) => {
    // Anthropic models
    if (modelId === 'claude-3-5-haiku-20241022') {
      return { id: modelId, name: 'Haiku 3.5', cost: '~15¢/100 tx', description: 'Veloce ed economico' };
    }
    if (modelId === 'claude-3-5-sonnet-20241022') {
      return { id: modelId, name: 'Sonnet 3.5', cost: '~$1.50/100 tx', description: 'Bilanciato, alta qualità' };
    }
    if (modelId === 'claude-sonnet-4-20250514') {
      return { id: modelId, name: 'Sonnet 4', cost: '~$3/100 tx', description: 'Più recente e performante' };
    }
    if (modelId === 'claude-3-opus-20240229') {
      return { id: modelId, name: 'Opus 3', cost: '~$7.50/100 tx', description: 'Altissima qualità' };
    }
    if (modelId === 'claude-opus-4-5-20251101') {
      return { id: modelId, name: 'Opus 4.5', cost: '~$15/100 tx', description: 'Massima qualità assoluta' };
    }

    // OpenAI models
    if (modelId === 'gpt-4o-mini') {
      return { id: modelId, name: 'GPT-4o Mini', cost: '~$0.05/100 tx', description: 'Velocissimo ed economico' };
    }
    if (modelId === 'gpt-4o') {
      return { id: modelId, name: 'GPT-4o', cost: '~$0.50/100 tx', description: 'Veloce e potente' };
    }
    if (modelId === 'gpt-4-turbo') {
      return { id: modelId, name: 'GPT-4 Turbo', cost: '~$2/100 tx', description: 'Alta qualità' };
    }
    if (modelId === 'gpt-3.5-turbo') {
      return { id: modelId, name: 'GPT-3.5 Turbo', cost: '~$0.15/100 tx', description: 'Economico e veloce' };
    }

    // Fallback
    return { id: modelId, name: modelId, cost: 'N/A', description: 'Modello sconosciuto' };
  };

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

      // Show parsing statistics if any rows had problems
      if (parsed.parsingStats) {
        const { totalRows, skippedNoDate, skippedInvalidDate, skippedZeroAmount } = parsed.parsingStats;
        const totalProblematic = skippedNoDate + skippedInvalidDate + skippedZeroAmount;
        if (totalProblematic > 0) {
          const details: string[] = [];
          if (skippedNoDate > 0) details.push(`${skippedNoDate} senza data`);
          if (skippedInvalidDate > 0) details.push(`${skippedInvalidDate} con data invalida`);
          if (skippedZeroAmount > 0) details.push(`${skippedZeroAmount} con importo zero`);

          alert(`Importate ${parsed.transactions.length} transazioni.\n\n⚠️ Righe con problemi (${totalProblematic}) messe in "Ignorati":\n${details.join(', ')}\n\nControlla la descrizione per i dettagli.`);
        }
      }

      // Calculate counts based on hasErrors flag
      const ignoredCount = parsed.transactions.filter(tx => tx.hasErrors).length;
      const pendingCount = parsed.transactions.length - ignoredCount;

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
        pendingCount: pendingCount,
        ignoredCount: ignoredCount,
        status: 'open',
        periodoDal: parsed.periodoDal,
        periodoAl: parsed.periodoAl
      };

      console.log('Adding session:', session);
      const addedSession = await addReconciliationSession(session);
      console.log('Session added:', addedSession);

      // Select session immediately so transactions appear as they're added
      setSelectedSession(sessionId);

      // Check if AI keys are configured before starting AI processing
      const canUseAI = aiMatchingEnabled && checkAIKeysConfigured();

      if (aiMatchingEnabled && !checkAIKeysConfigured()) {
        setError('⚠️ AI Matching è abilitato ma le API keys non sono configurate. Le transazioni verranno importate senza matching automatico. Configura le chiavi nelle Impostazioni.');
      }

      // Create bank transactions with AI matching (if enabled AND keys configured)
      if (canUseAI) {
        setAiProcessing({
          isProcessing: true,
          sessionId,
          current: 0,
          total: parsed.transactions.length,
          shouldStop: false
        });
        stopAIProcessingRef.current = false; // Reset ref
        setIsStoppingAI(false);
      }
      let matchedCount = 0;

      // Track matched cashflows to prevent duplicates
      const matchedCashflowIds = new Set<string>();

      let shouldStop = false;

      for (let i = 0; i < parsed.transactions.length && !shouldStop; i++) {
        // Check if user wants to stop - use ref for most up-to-date value
        shouldStop = stopAIProcessingRef.current;
        if (shouldStop) {
          console.log(`⏹️⏹️⏹️ AI processing STOPPED by user at ${i}/${parsed.transactions.length}`);
          console.log(`Breaking out of loop NOW`);
          break;
        }

        const tx = parsed.transactions[i];
        console.log(`📊 Processing transaction ${i + 1}/${parsed.transactions.length} ${canUseAI ? 'with AI' : 'without AI'}`);
        if (canUseAI) {
          // Only update progress, don't touch other fields
          setAiProcessing({ current: i + 1 });
        }

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
          matchStatus: tx.hasErrors ? 'ignored' : 'pending'
        };

        // Try automatic matching with AI (only if enabled, keys configured, and no errors)
        if (canUseAI && !tx.hasErrors) {
        try {
          console.log(`[AI Match ${i+1}/${parsed.transactions.length}] Analyzing transaction:`, {
            descrizione: tx.descrizione,
            importo: tx.importo,
            tipo: tx.tipo,
            data: tx.data
          });
          console.log(`Available invoices: ${invoices.length}, cashflow records: ${cashflowRecords.length}`);
          console.log(`Sample cashflow IDs:`, cashflowRecords.slice(0, 5).map(cf => cf.id));

          // Filter out cashflows already used in this batch
          const availableCashflows = cashflowRecords.filter(cf => !matchedCashflowIds.has(cf.id));
          console.log(`Available cashflows after filtering used ones: ${availableCashflows.length}/${cashflowRecords.length}`);

          const modelInfo = getAiModelInfo(selectedAiModel);
          console.log(`🤖 Using AI model: ${modelInfo.name} (${modelInfo.id})`);
          const aiMatchResult = await suggestMatch(bankTx, invoices, availableCashflows, modelInfo.id);

          console.log(`[AI Match Result]`, {
            confidence: aiMatchResult.confidence,
            cashflowId: aiMatchResult.cashflowId,
            invoiceId: aiMatchResult.invoiceId,
            reason: aiMatchResult.reason
          });

          // Show why it's not auto-matching
          if (aiMatchResult.confidence < 80) {
            console.log(`⚠️ Not auto-matching: confidence ${aiMatchResult.confidence}% is below threshold (80%)`);
            console.log(`Reason: "${aiMatchResult.reason}"`);
          } else if (!aiMatchResult.cashflowId && !aiMatchResult.invoiceId) {
            console.log(`⚠️ Not auto-matching: AI didn't find any match (both cashflowId and invoiceId are null)`);
            console.log(`Reason: "${aiMatchResult.reason}"`);
          }

          // ALWAYS save AI confidence and reason (even if confidence is low)
          bankTx.matchConfidence = aiMatchResult.confidence;
          bankTx.matchReason = aiMatchResult.reason;

          // Auto-match if confidence is high enough
          if (aiMatchResult.confidence >= 80) {
            if (aiMatchResult.cashflowId) {
              // Check if this cashflow is already matched to prevent duplicates
              if (matchedCashflowIds.has(aiMatchResult.cashflowId)) {
                console.log(`⚠️ Cashflow ${aiMatchResult.cashflowId} already matched to another transaction, leaving as pending`);
                bankTx.matchReason = `${aiMatchResult.reason} (Movimento già abbinato ad altra transazione)`;
              } else {
                // Verify cashflow exists
                const cashflowExists = cashflowRecords.some(cf => cf.id === aiMatchResult.cashflowId);
                console.log(`Cashflow ${aiMatchResult.cashflowId} exists: ${cashflowExists}`);
                if (!cashflowExists) {
                  console.error(`❌ AI returned cashflow ID ${aiMatchResult.cashflowId} but it doesn't exist in database!`);
                  console.log(`Available cashflow IDs for tipo ${tx.tipo}:`, cashflowRecords.filter(cf => {
                    const invoice = invoices.find(inv => inv.id === cf.invoiceId);
                    return (cf.tipo || invoice?.tipo) === tx.tipo;
                  }).slice(0, 5).map(cf => cf.id));
                }
                if (cashflowExists) {
                  bankTx.matchedCashflowId = aiMatchResult.cashflowId;
                  bankTx.matchedInvoiceId = aiMatchResult.invoiceId || undefined;
                  bankTx.matchStatus = 'matched';
                  matchedCount++;
                  matchedCashflowIds.add(aiMatchResult.cashflowId);
                  console.log(`✅ Transaction matched to cashflow ${aiMatchResult.cashflowId}`);
                }
              }
            } else if (aiMatchResult.invoiceId) {
              // Fallback to invoice-only match
              const invoiceExists = invoices.some(inv => inv.id === aiMatchResult.invoiceId);
              console.log(`Invoice ${aiMatchResult.invoiceId} exists: ${invoiceExists}`);
              if (invoiceExists) {
                bankTx.matchedInvoiceId = aiMatchResult.invoiceId;
                bankTx.matchStatus = 'matched';
                matchedCount++;
                console.log(`✅ Transaction matched to invoice ${aiMatchResult.invoiceId}`);
              }
            }
          } else {
            console.log(`⚠️ Confidence too low (${aiMatchResult.confidence}%), not auto-matching but saving reason`);
          }
        } catch (aiError) {
          console.error('❌ AI matching error for transaction:', tx.id, aiError);
          const errorMessage = aiError instanceof Error ? aiError.message : 'Errore sconosciuto';

          // Check if this is a FATAL error that should stop processing
          const isFatalError = errorMessage.toLowerCase().includes('crediti') ||
                              errorMessage.toLowerCase().includes('credit') ||
                              errorMessage.toLowerCase().includes('payment') ||
                              errorMessage.toLowerCase().includes('api key') ||
                              errorMessage.toLowerCase().includes('authentication') ||
                              errorMessage.toLowerCase().includes('unauthorized');

          if (isFatalError) {
            console.error('❌ FATAL ERROR - Stopping AI processing');
            setError(`🛑 ERRORE CRITICO - Elaborazione interrotta: ${errorMessage}`);
            // Stop processing immediately for fatal errors
            shouldStop = true;
            break;
          } else {
            // For non-fatal errors (timeout, network glitches), show warning but continue
            setError(`⚠️ Errore AI durante l'elaborazione della transazione ${i + 1}: ${errorMessage}`);
            // Continue without matching if AI fails
          }
        }
        } else {
          console.log(`⏭️ AI matching disabled, skipping AI analysis for transaction ${i + 1}`);
        }

        // CRITICAL: Check if a fatal error occurred and stop immediately
        if (shouldStop) {
          console.log(`⏹️ AI processing stopped (fatal error), skipping remaining transactions`);
          break;
        }

        // Save the transaction (even if user clicked stop - we need to save the current one)
        await addBankTransaction(bankTx);

        // Check after saving if user wants to stop
        shouldStop = stopAIProcessingRef.current;
        if (shouldStop) {
          console.log(`⏹️ AI processing stopped by user after saving transaction ${i + 1}`);
          break;
        }

        // Small delay to avoid rate limiting
        if (i < parsed.transactions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
          // Check one more time after delay - use ref
          shouldStop = stopAIProcessingRef.current;
        }
      }

      // Final check to ensure we stopped
      if (shouldStop) {
        console.log(`🛑 Loop exited due to user stop request`);
      }

      console.log(`✅ Loop completed. Matched: ${matchedCount}, Total: ${parsed.transactions.length}`);
      console.log(`Was stopped by user? ${stopAIProcessingRef.current}`);

      // Update session with final counts
      await updateReconciliationSession(sessionId, {
        matchedCount,
        pendingCount: parsed.transactions.length - matchedCount
      });

      setAiProcessing({
        isProcessing: false,
        sessionId: null,
        current: 0,
        total: 0,
        shouldStop: false
      });
      setIsStoppingAI(false);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento del file');
    } finally {
      setIsUploading(false);
      setAiProcessing({
        isProcessing: false,
        sessionId: null,
        current: 0,
        total: 0,
        shouldStop: false
      });
      setIsStoppingAI(false);
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

  // Confirm cashflow match
  const handleConfirmCashflow = async (transactionId: string, cashflowId: string) => {
    const tx = bankTransactions.find(t => t.id === transactionId);
    if (!tx) return;

    await updateBankTransaction(transactionId, {
      matchStatus: 'matched',
      matchedCashflowId: cashflowId,
      matchReason: 'Abbinato manualmente'
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
    // Check if AI keys are configured
    if (!checkAIKeysConfigured()) {
      setError('⚠️ Configura le API keys nelle Impostazioni prima di usare l\'AI matching');
      return;
    }

    const tx = bankTransactions.find(t => t.id === transactionId);
    if (!tx) return;

    try {
      // Refresh data to ensure we have latest cashflows from database
      console.log(`[Single AI Match] Refreshing data from database...`);
      await refreshData();
      console.log(`[Single AI Match] Data refreshed. Now have ${invoices.length} invoices, ${cashflowRecords.length} cashflow records`);

      const modelInfo = getAiModelInfo(selectedAiModel);
      console.log(`[Single AI Match] Analyzing transaction:`, {
        id: tx.id,
        descrizione: tx.descrizione,
        importo: tx.importo,
        tipo: tx.tipo,
        data: tx.data
      });
      console.log(`[Single AI Match] Available data: ${invoices.length} invoices, ${cashflowRecords.length} cashflow records`);

      const suggestion = await suggestMatch(tx, invoices, cashflowRecords, modelInfo.id);
      console.log(`[Single AI Match Result]`, suggestion);

      // Auto-match if confidence is high enough (>=80%)
      let newMatchStatus: 'pending' | 'matched' = tx.matchStatus;
      if (suggestion.confidence >= 80 && (suggestion.cashflowId || suggestion.invoiceId)) {
        newMatchStatus = 'matched';
        console.log(`✅ Auto-matching with confidence ${suggestion.confidence}%`);
      } else {
        console.log(`⚠️ Not auto-matching: confidence ${suggestion.confidence}% (threshold: 80%)`);
      }

      await updateBankTransaction(transactionId, {
        matchedInvoiceId: suggestion.invoiceId || undefined,
        matchedCashflowId: suggestion.cashflowId || undefined,
        matchConfidence: suggestion.confidence,
        matchReason: suggestion.reason,
        matchStatus: newMatchStatus
      });

      // Update session counts if status changed from pending to matched
      if (currentSession && tx.matchStatus === 'pending' && newMatchStatus === 'matched') {
        await updateReconciliationSession(currentSession.id, {
          matchedCount: currentSession.matchedCount + 1,
          pendingCount: Math.max(0, currentSession.pendingCount - 1)
        });
      }
    } catch (err) {
      console.error('AI matching error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`⚠️ Errore durante l'abbinamento AI: ${errorMessage}`);
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

  // Unmatch transaction - remove matching and set back to pending
  const handleUnmatch = async (transactionId: string) => {
    const tx = bankTransactions.find(t => t.id === transactionId);
    if (!tx) return;

    if (!confirm('Sei sicuro di voler rimuovere l\'abbinamento? La transazione tornerà in "Da verificare".')) return;

    await updateBankTransaction(transactionId, {
      matchStatus: 'pending',
      matchedInvoiceId: undefined,
      matchedCashflowId: undefined,
      matchConfidence: undefined,
      matchReason: undefined
    });

    // Update session counts
    if (currentSession && (tx.matchStatus === 'matched' || tx.matchStatus === 'manual')) {
      await updateReconciliationSession(currentSession.id, {
        matchedCount: Math.max(0, currentSession.matchedCount - 1),
        pendingCount: currentSession.pendingCount + 1
      });
    }
  };

  // Run AI on all pending
  const handleRunAIAll = async () => {
    // Check if AI keys are configured
    if (!checkAIKeysConfigured()) {
      setError('⚠️ Configura le API keys nelle Impostazioni prima di usare l\'AI matching');
      return;
    }

    const pending = sessionTransactions.filter(tx => tx.matchStatus === 'pending');
    if (pending.length === 0) return;

    setAiProcessing({
      isProcessing: true,
      sessionId: currentSession?.id || null,
      current: 0,
      total: pending.length,
      shouldStop: false
    });
    stopAIProcessingRef.current = false; // Reset ref

    try {
      // Refresh data to ensure we have latest cashflows from database
      console.log(`[Batch AI Match] Refreshing data from database...`);
      await refreshData();
      console.log(`[Batch AI Match] Data refreshed. Now have ${invoices.length} invoices, ${cashflowRecords.length} cashflow records`);

      const modelInfo = getAiModelInfo(selectedAiModel);
      const usedCashflowIds = new Set<string>(); // Track used cashflows

      for (let i = 0; i < pending.length; i++) {
        // Check if user wants to stop - use ref for most up-to-date value
        if (stopAIProcessingRef.current) {
          console.log(`⏹️ AI processing stopped by user at ${i}/${pending.length}`);
          break;
        }

        const tx = pending[i];

        // Update progress (don't touch shouldStop, let stopAiProcessing control it)
        setAiProcessing({
          current: i + 1,
          total: pending.length
        });

        // Filter out cashflows already used in this batch
        const availableCashflows = cashflowRecords.filter(cf => !usedCashflowIds.has(cf.id));
        console.log(`[Batch AI Match ${i+1}/${pending.length}] Available cashflows: ${availableCashflows.length}/${cashflowRecords.length}`);

        const suggestion = await suggestMatch(tx, invoices, availableCashflows, modelInfo.id);

        // Check again after AI call - use ref
        if (stopAIProcessingRef.current) {
          console.log(`⏹️ AI processing stopped by user after AI call`);
          break;
        }

        // Auto-match if confidence is high enough (>=80%)
        let newMatchStatus: 'pending' | 'matched' = 'pending';
        if (suggestion.confidence >= 80 && (suggestion.cashflowId || suggestion.invoiceId)) {
          newMatchStatus = 'matched';
          console.log(`[Batch AI Match] ✅ Auto-matching transaction ${i+1}/${pending.length} with confidence ${suggestion.confidence}%`);
        } else {
          console.log(`[Batch AI Match] ⚠️ Not auto-matching transaction ${i+1}/${pending.length}: confidence ${suggestion.confidence}%`);
        }

        await updateBankTransaction(tx.id, {
          matchedInvoiceId: suggestion.invoiceId || undefined,
          matchedCashflowId: suggestion.cashflowId || undefined,
          matchConfidence: suggestion.confidence,
          matchReason: suggestion.reason,
          matchStatus: newMatchStatus
        });

        // Mark cashflow as used if matched
        if (suggestion.cashflowId) {
          usedCashflowIds.add(suggestion.cashflowId);
          console.log(`[Batch AI Match] Cashflow ${suggestion.cashflowId} marked as used`);
        }

        // Small delay to avoid rate limiting
        if (i < pending.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Check one more time after delay - use ref
        if (stopAIProcessingRef.current) {
          console.log(`⏹️ AI processing stopped by user after delay`);
          break;
        }
      }

      // Update session counts after batch processing
      if (currentSession) {
        // Refresh transactions to get updated counts
        const updatedTransactions = await fetchBankTransactions(currentSession.id);
        const matchedCount = updatedTransactions.filter(tx => tx.matchStatus === 'matched' || tx.matchStatus === 'manual').length;
        const pendingCount = updatedTransactions.filter(tx => tx.matchStatus === 'pending').length;
        const ignoredCount = updatedTransactions.filter(tx => tx.matchStatus === 'ignored').length;

        await updateReconciliationSession(currentSession.id, {
          matchedCount,
          pendingCount,
          ignoredCount
        });
        console.log(`[Batch AI Match] Session stats updated: ${matchedCount} matched, ${pendingCount} pending, ${ignoredCount} ignored`);
      }
    } catch (err) {
      console.error('AI batch matching error:', err);
    } finally {
      setAiProcessing({
        isProcessing: false,
        sessionId: null,
        current: 0,
        total: 0,
        shouldStop: false
      });
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

  const handleClearAllSessions = async () => {
    if (!confirm(`Sei sicuro di voler eliminare TUTTE le riconciliazioni? Questa azione non può essere annullata.`)) return;

    setIsDeleting(true);
    try {
      await clearAllReconciliationSessions();
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
        // Deselect session, clear selections and localStorage
        localStorage.removeItem('reconciliation_selectedSession');
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
      // Create a cashflow record automatically for this invoice (without importo, reads from invoice)
      await addCashflowRecord({
        invoiceId: newInvoice.id,
        dataPagamento: transaction.data,
        note: `Movimento automatico da riconciliazione - ${transaction.descrizione || transaction.causale || ''}`
      });

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
      <div className="mb-6">
        {/* Title Row */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-dark dark:text-white mb-2">
              Riconciliazione Bancaria
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Riconcilia automaticamente le transazioni bancarie con fatture e movimenti di cassa
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
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
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Upload size={18} />
              )}
              {isUploading ? 'Importazione...' : 'Carica Estratto Conto'}
            </button>

            {/* Clear all sessions button */}
            {reconciliationSessions.length > 0 && (
              <button
                onClick={handleClearAllSessions}
                disabled={isDeleting || aiProcessing.isProcessing || isUploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={18} />
                Svuota Tutto
              </button>
            )}
          </div>
        </div>

        {/* AI Settings Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10 border border-purple-200 dark:border-purple-800/30 rounded-lg">
          {/* AI Toggle with Status Indicator */}
          <div className="flex items-center gap-2.5">
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={aiMatchingEnabled}
                onChange={(e) => setAiMatchingEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              <span className="ms-3 text-sm font-semibold text-dark dark:text-white flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${aiMatchingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                Matching AI
              </span>
            </label>
          </div>

          {/* Vertical Divider */}
          {aiMatchingEnabled && (
            <div className="hidden sm:block h-8 w-px bg-purple-200 dark:bg-purple-700"></div>
          )}

          {/* AI Configuration - Only show when enabled */}
          {aiMatchingEnabled && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              {/* Provider Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium uppercase tracking-wide">
                  Provider:
                </span>
                <select
                  value={selectedAiProvider}
                  onChange={(e) => {
                    const newProvider = e.target.value as 'anthropic' | 'openai';
                    setSelectedAiProvider(newProvider);
                    setSelectedAiModel(newProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022');
                  }}
                  className="text-sm font-semibold text-dark dark:text-white bg-white/50 dark:bg-gray-800/50 border border-purple-200 dark:border-purple-700 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-colors"
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                </select>
              </div>

              {/* Model Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium uppercase tracking-wide">
                  Modello:
                </span>
                <select
                  value={selectedAiModel}
                  onChange={(e) => setSelectedAiModel(e.target.value)}
                  className="text-sm font-semibold text-dark dark:text-white bg-white/50 dark:bg-gray-800/50 border border-purple-200 dark:border-purple-700 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-colors min-w-[200px]"
                >
                  {selectedAiProvider === 'anthropic' ? (
                    <>
                      <option value="claude-3-5-haiku-20241022">Haiku 3.5 (~15¢/100 tx)</option>
                      <option value="claude-3-5-sonnet-20241022">Sonnet 3.5 (~$1.50/100 tx)</option>
                      <option value="claude-sonnet-4-20250514">Sonnet 4 (~$3/100 tx)</option>
                      <option value="claude-3-opus-20240229">Opus 3 (~$7.50/100 tx)</option>
                      <option value="claude-opus-4-5-20251101">Opus 4.5 (~$15/100 tx)</option>
                    </>
                  ) : (
                    <>
                      <option value="gpt-4o-mini">GPT-4o Mini (~$0.05/100 tx)</option>
                      <option value="gpt-4o">GPT-4o (~$0.50/100 tx)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo (~$2/100 tx)</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (~$0.15/100 tx)</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}

          {/* Info Text when AI is disabled */}
          {!aiMatchingEnabled && (
            <p className="text-sm text-gray-600 dark:text-gray-300 italic flex-1">
              Attiva il matching AI per riconciliare automaticamente le transazioni usando Claude o GPT
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Warning: AI keys not configured */}
      {aiMatchingEnabled && !checkAIKeysConfigured() && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              API Keys non configurate
            </div>
            <div className="text-sm text-yellow-700 dark:text-yellow-400">
              L'AI Matching è abilitato ma nessuna API key è configurata. Vai su <strong>Impostazioni</strong> per configurare le chiavi API di Anthropic Claude o OpenAI.
            </div>
          </div>
          <button onClick={() => setAiMatchingEnabled(false)} className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300">
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
                onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                disabled={aiProcessing.isProcessing || isUploading}
                className={`flex-shrink-0 px-4 py-2.5 rounded-lg border transition-colors relative ${
                  selectedSession === session.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-dark-card text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-border hover:border-primary dark:hover:border-primary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm">{session.periodo || session.fileName}</div>
                  {session.status === 'closed' && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      selectedSession === session.id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400'
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
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 border-t-4 border-gray-300 dark:border-gray-600">
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Totale Transazioni</div>
              <div className="text-2xl font-bold text-dark dark:text-white">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 border-t-4 border-yellow-400">
              <div className="text-yellow-600 dark:text-yellow-400 text-sm mb-1">Da Verificare</div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 border-t-4 border-green-500">
              <div className="text-green-600 dark:text-green-400 text-sm mb-1">Riconciliati</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.matched}</div>
            </div>
            <div className="bg-white dark:bg-dark-card rounded-xl p-4 border-t-4 border-gray-300 dark:border-gray-600">
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Ignorati</div>
              <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">{stats.ignored}</div>
            </div>
          </div>

          {/* Session status and actions */}
          {currentSession.status === 'closed' && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-dark-border rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                  <FileCheck size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-medium text-dark dark:text-white">Sessione Chiusa</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {currentSession.closedDate && `Chiusa il ${formatDate(currentSession.closedDate)}`}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseSession}
                className="flex items-center gap-2 pl-4 pr-12 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all"
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
                disabled={aiProcessing.isProcessing || isUploading}
                className="flex items-center gap-2 pl-4 pr-12 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
              >
                <FileCheck size={16} />
                {aiProcessing.isProcessing || isUploading ? 'Processamento in corso...' : 'Chiudi Sessione'}
              </button>
            </div>
          )}

          {/* Session info */}
          {(currentSession.saldoIniziale !== undefined || currentSession.saldoFinale !== undefined) && (
            <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-4 mb-6 flex flex-wrap gap-6">
              {currentSession.numeroConto && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Conto</div>
                  <div className="font-medium text-dark dark:text-white">{currentSession.numeroConto}</div>
                </div>
              )}
              {currentSession.saldoIniziale !== undefined && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo Iniziale</div>
                  <div className="font-medium text-dark dark:text-white">{formatCurrency(currentSession.saldoIniziale)}</div>
                </div>
              )}
              {currentSession.saldoFinale !== undefined && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo Finale</div>
                  <div className="font-medium text-dark dark:text-white">{formatCurrency(currentSession.saldoFinale)}</div>
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card">
            <button
              onClick={() => setComparisonView('transactions')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'transactions'
                  ? 'border-primary text-dark dark:text-white bg-primary/10 dark:bg-primary/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-bg'
              }`}
            >
              Transazioni
            </button>
            <button
              onClick={() => setComparisonView('unmatched')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'unmatched'
                  ? 'border-primary text-dark dark:text-white bg-primary/10 dark:bg-primary/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-bg'
              }`}
            >
              Voci Mancanti
            </button>
            <button
              onClick={() => setComparisonView('sidebyside')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'sidebyside'
                  ? 'border-primary text-dark dark:text-white bg-primary/10 dark:bg-primary/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-bg'
              }`}
            >
              Vista Affiancata
            </button>
            <button
              onClick={() => setComparisonView('report')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                comparisonView === 'report'
                  ? 'border-primary text-dark dark:text-white bg-primary/10 dark:bg-primary/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-bg'
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
                disabled={currentSession.status === 'closed' || aiProcessing.isProcessing || isUploading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className={`relative w-4 h-4 bg-white dark:bg-gray-700 border-2 transition-all duration-200 rounded-md ${
                  selectionState === 'all' || selectionState === 'partial'
                    ? 'bg-primary border-primary'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selectionState === 'all' ? (
                    <Check
                      size={12}
                      className="absolute inset-0 m-auto text-white"
                      strokeWidth={3}
                    />
                  ) : selectionState === 'partial' ? (
                    <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-0.5 bg-white rounded-full" />
                  ) : null}
                </div>
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
                      : 'bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-bg'
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
                  disabled={isDeleting || aiProcessing.isProcessing || isUploading || currentSession.status === 'closed'}
                  className="flex items-center gap-2 pl-4 pr-12 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                  {aiProcessing.isProcessing || isUploading ? 'Processamento in corso...' : isDeleting ? 'Eliminazione...' : `Elimina (${selectedIds.size})`}
                </button>
              )}

              {/* Delete session button */}
              <button
                onClick={handleDeleteSession}
                disabled={isDeleting || aiProcessing.isProcessing || isUploading || currentSession.status === 'closed'}
                className="flex items-center gap-2 pl-4 pr-12 py-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-500 dark:text-gray-400 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} />
                {aiProcessing.isProcessing || isUploading ? 'Processamento in corso...' : 'Elimina Sessione'}
              </button>

              {stats.pending > 0 && (
                <button
                  onClick={aiProcessing.isProcessing ? stopAiProcessing : handleRunAIAll}
                  disabled={currentSession.status === 'closed'}
                  className={`flex items-center gap-2 pl-4 pr-12 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    aiProcessing.isProcessing
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-accent hover:opacity-90 text-white'
                  }`}
                >
                  {aiProcessing.isProcessing ? (
                    <StopCircle size={16} />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {aiProcessing.isProcessing
                    ? `Termina (${aiProcessing.current}/${aiProcessing.total})`
                    : `Analizza Tutti con AI (${stats.pending})`
                  }
                </button>
              )}
            </div>
          </div>
          )}

          {/* Conditional View Rendering */}
          {comparisonView === 'transactions' && (
            <div className="bg-white dark:bg-dark-card rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-dark-border">
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
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
                    cashflowRecords={cashflowRecords}
                    bankTransactions={bankTransactions}
                    onConfirm={(invoiceId) => handleConfirmMatch(tx.id, invoiceId)}
                    onConfirmCashflow={(cashflowId) => handleConfirmCashflow(tx.id, cashflowId)}
                    onIgnore={() => handleIgnore(tx.id)}
                    onManualMatch={() => setManualMatchTransaction(tx)}
                    onUnmatch={() => handleUnmatch(tx.id)}
                    onRunAI={() => handleRunAI(tx.id)}
                    isProcessing={aiProcessing.isProcessing}
                    isSelected={selectedIds.has(tx.id)}
                    onToggleSelect={() => handleToggleSelect(tx.id)}
                    onCreateInvoice={() => setCreateInvoiceTransaction(tx)}
                    onCreateCashflow={() => setCreateCashflowTransaction(tx)}
                    disabled={currentSession.status === 'closed' || aiProcessing.isProcessing || isUploading}
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
        <div className="bg-white dark:bg-dark-card rounded-lg p-12 text-center shadow-sm border border-gray-200 dark:border-dark-border">
          <FileCheck size={64} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-dark dark:text-white mb-2">Nessun estratto conto caricato</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Carica un file Excel (.xlsx) con le transazioni bancarie per iniziare la riconciliazione
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
          >
            <Upload size={18} />
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
