import React from 'react';
import { Bell, X, AlertCircle, Clock } from 'lucide-react';
import { useData } from '../context/DataContext';
import { InvoiceNotification } from '../types';

interface InvoiceNotificationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceNotifications: React.FC<InvoiceNotificationsProps> = ({ isOpen, onClose }) => {
  const { invoiceNotifications, invoices, dismissNotification } = useData();

  const getInvoiceDetails = (notif: InvoiceNotification) => {
    const invoice = invoices.find(inv => inv.id === notif.invoiceId);
    return invoice;
  };

  const handleDismiss = async (id: string) => {
    await dismissNotification(id);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Notifications Panel */}
      <div className="fixed top-20 right-4 z-50 w-full max-w-sm">
        <div className="bg-white dark:bg-dark-card rounded-lg shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-primary" />
              <h3 className="font-semibold text-dark dark:text-white">
                Notifiche ({invoiceNotifications.length})
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[70vh] overflow-y-auto">
            {invoiceNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nessuna notifica</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-dark-border">
                {invoiceNotifications.map(notif => {
        const invoice = getInvoiceDetails(notif);
        const isDaPagare = notif.tipo === 'da_pagare';
        const isScaduta = notif.tipo === 'scaduta';

        return (
          <div
            key={notif.id}
            className={`p-4 ${
              isDaPagare
                ? 'bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20'
                : 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20'
            } transition-colors`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 mt-0.5 ${
                isDaPagare ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isDaPagare ? <Clock size={18} /> : <AlertCircle size={18} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-xs ${
                  isDaPagare ? 'text-yellow-800 dark:text-yellow-300' : 'text-red-800 dark:text-red-300'
                }`}>
                  {isDaPagare ? 'Da Pagare Oggi' : 'Fattura Scaduta'}
                </div>

                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-0.5">
                  {invoice ? (
                    <>
                      <div className="font-medium text-dark dark:text-white">
                        {invoice.nomeProgetto || invoice.spesa || 'N/D'}
                      </div>
                      {invoice.note && (
                        <div className="text-gray-600 dark:text-gray-400 italic text-[11px] mt-0.5">
                          {invoice.note}
                        </div>
                      )}
                      <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${invoice.tipo === 'Entrata' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        {invoice.tipo} - {invoice.spesa}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        Scadenza: {new Date(notif.dataScadenza).toLocaleDateString('it-IT')}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 font-medium">
                        Importo: €{((invoice.flusso || 0) + (invoice.iva || 0)).toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <div>Fattura {notif.invoiceId}</div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDismiss(notif.id)}
                className="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-dark dark:hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
