import React from 'react';
import { Bell, X, AlertCircle, Clock } from 'lucide-react';
import { useData } from '../context/DataContext';
import { InvoiceNotification } from '../types';

export const InvoiceNotifications: React.FC = () => {
  const { invoiceNotifications, invoices, dismissNotification } = useData();

  const getInvoiceDetails = (notif: InvoiceNotification) => {
    const invoice = invoices.find(inv => inv.id === notif.invoiceId);
    return invoice;
  };

  const handleDismiss = async (id: string) => {
    await dismissNotification(id);
  };

  if (invoiceNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {invoiceNotifications.map(notif => {
        const invoice = getInvoiceDetails(notif);
        const isDaPagare = notif.tipo === 'da_pagare';
        const isScaduta = notif.tipo === 'scaduta';

        return (
          <div
            key={notif.id}
            className={`p-4 rounded-lg shadow-lg border-2 backdrop-blur-sm ${
              isDaPagare
                ? 'bg-yellow-50/95 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600'
                : 'bg-red-50/95 dark:bg-red-900/30 border-red-400 dark:border-red-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 mt-0.5 ${
                isDaPagare ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isDaPagare ? <Clock size={20} /> : <AlertCircle size={20} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${
                  isDaPagare ? 'text-yellow-800 dark:text-yellow-300' : 'text-red-800 dark:text-red-300'
                }`}>
                  {isDaPagare ? 'Da Pagare Oggi' : 'Fattura Scaduta'}
                </div>

                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                  {invoice ? (
                    <>
                      <div className="font-medium">{invoice.nomeProgetto || invoice.spesa || 'N/D'}</div>
                      <div className="mt-0.5">
                        Scadenza: {new Date(notif.dataScadenza).toLocaleDateString('it-IT')}
                      </div>
                      <div className="mt-0.5">
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
                className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-dark dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
