import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Deal, DealStage } from '../types';
import { Plus, Calendar, DollarSign, Edit2, Trash2, X, Check, GripVertical, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../lib/currency';

export const Deals: React.FC = () => {
  const { deals, customers, loading, addDeal, updateDeal, deleteDeal } = useData();
  const stages = Object.values(DealStage);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [preselectedStage, setPreselectedStage] = useState<DealStage | null>(null);

  // Drag state
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  // Calcola totali pipeline
  const pipelineTotals = useMemo(() => {
    const totalValue = deals.reduce((acc, d) => acc + (d.value || 0), 0);
    const weightedValue = deals.reduce((acc, d) => acc + ((d.value || 0) * (d.probability || 0) / 100), 0);
    const wonValue = deals.filter(d => d.stage === DealStage.WON).reduce((acc, d) => acc + (d.value || 0), 0);

    return { totalValue, weightedValue, wonValue };
  }, [deals]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Caricamento...</div>;
  }

  const getStageColor = (stage: DealStage) => {
    switch (stage) {
      case DealStage.LEAD: return 'border-t-4 border-gray-400';
      case DealStage.QUALIFICATION: return 'border-t-4 border-yellow-400';
      case DealStage.PROPOSAL: return 'border-t-4 border-purple-400';
      case DealStage.NEGOTIATION: return 'border-t-4 border-blue-400';
      case DealStage.WON: return 'border-t-4 border-green-500';
      case DealStage.LOST: return 'border-t-4 border-red-400';
      default: return 'border-t-4 border-light';
    }
  };

  const getStageHeaderColor = (stage: DealStage) => {
    switch (stage) {
      case DealStage.LEAD: return 'bg-gray-50 text-gray-500';
      case DealStage.QUALIFICATION: return 'bg-yellow-100 text-yellow-700';
      case DealStage.PROPOSAL: return 'bg-purple-100 text-purple-700';
      case DealStage.NEGOTIATION: return 'bg-blue-100 text-blue-700';
      case DealStage.WON: return 'bg-green-100 text-green-700';
      case DealStage.LOST: return 'bg-red-100 text-red-700';
      default: return 'bg-gray-50 text-gray-500';
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', deal.id);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedDeal(null);
    setDragOverStage(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: DealStage) => {
    e.preventDefault();
    setDragOverStage(null);

    if (draggedDeal && draggedDeal.stage !== targetStage) {
      // Update probability based on stage
      let newProbability = draggedDeal.probability;
      switch (targetStage) {
        case DealStage.LEAD: newProbability = 10; break;
        case DealStage.QUALIFICATION: newProbability = 25; break;
        case DealStage.PROPOSAL: newProbability = 50; break;
        case DealStage.NEGOTIATION: newProbability = 75; break;
        case DealStage.WON: newProbability = 100; break;
        case DealStage.LOST: newProbability = 0; break;
      }

      await updateDeal(draggedDeal.id, {
        stage: targetStage,
        probability: newProbability
      });
    }

    setDraggedDeal(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa opportunità?')) {
      await deleteDeal(id);
    }
  };

  const openNewDealModal = (stage?: DealStage) => {
    setEditingDeal(null);
    setPreselectedStage(stage || null);
    setShowModal(true);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in pb-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-page-title text-dark">Opportunità</h1>
          <p className="text-page-subtitle mt-1">Trascina le card per cambiare lo stato</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-white px-4 py-2 rounded-full text-body font-medium text-dark flex items-center gap-2" shadow-sm>
            <TrendingUp size={16} className="text-primary" />
            Pipeline: <span className="font-bold text-primary">{formatCurrency(pipelineTotals.totalValue)}</span>
          </div>
          <div className="bg-green-50 px-4 py-2 rounded-full text-body font-medium text-green-700">
            Vinto: <span className="font-bold">{formatCurrency(pipelineTotals.wonValue)}</span>
          </div>
          <button
            onClick={() => openNewDealModal()}
            className="bg-secondary text-white px-6 py-2 rounded-full text-body font-medium hover:bg-black transition-colors flex items-center gap-2"
          >
            <Plus size={18} className="text-primary"/>
            Nuova Opportunità
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4 h-full">
          {stages.map((stage) => {
            const stageDeals = deals.filter(d => d.stage === stage);
            const stageValue = stageDeals.reduce((acc, curr) => acc + (curr.value || 0), 0);
            const isDropTarget = dragOverStage === stage;

            return (
              <div
                key={stage}
                className="w-72 flex-shrink-0 flex flex-col h-full"
              >
                {/* Stage Header */}
                <div className={`flex justify-between items-center mb-3 px-3 py-2 rounded-xl ${getStageHeaderColor(stage)}`}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{stage}</h3>
                    <span className="bg-white/50 text-xs px-2 py-0.5 rounded-full font-semibold" shadow-sm>
                      {stageDeals.length}
                    </span>
                  </div>
                  <span className="text-xs font-semibold">{formatCurrency(stageValue)}</span>
                </div>

                {/* Drop Zone */}
                <div
                  className={`flex-1 rounded-2xl p-2 space-y-2 overflow-y-auto min-h-[400px] transition-all duration-200 ${
                    isDropTarget
                      ? 'bg-primary/10 border-2 border-dashed border-primary'
                      : 'bg-gray-50/50 border-2 border-transparent'
                  }`}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white p-4 rounded-xl hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${getStageColor(stage)} ${
                        draggedDeal?.id === deal.id ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Drag Handle & Actions */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1">
                          <GripVertical size={14} className="text-gray-300" />
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            {deal.customerName}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDeal(deal);
                              setPreselectedStage(null);
                              setShowModal(true);
                            }}
                            className="text-gray-300 hover:text-blue-500 p-1"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(deal.id);
                            }}
                            className="text-gray-300 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Deal Title */}
                      <h4 className="font-bold text-dark text-base mb-3 leading-snug">{deal.title}</h4>

                      {/* Deal Info */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-light">
                        <div className="flex items-center gap-1 text-gray-500 text-sm font-bold">
                          <DollarSign size={14} className="text-primary" />
                          {formatCurrency(deal.value || 0)}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <Calendar size={12} />
                          {deal.expectedClose ? new Date(deal.expectedClose).toLocaleDateString('it-IT', {
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </div>
                      </div>

                      {/* Probability Bar */}
                      {deal.probability !== undefined && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Probabilità</span>
                            <span className="font-semibold">{deal.probability}%</span>
                          </div>
                          <div className="w-full bg-gray-50 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                deal.probability >= 75 ? 'bg-green-500' :
                                deal.probability >= 50 ? 'bg-blue-500' :
                                deal.probability >= 25 ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Deal Button */}
                  <button
                    onClick={() => openNewDealModal(stage)}
                    className="w-full py-3 border-2 border-dashed border-light rounded-xl text-gray-500 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Plus size={16} /> Aggiungi
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <DealModal
          deal={editingDeal}
          preselectedStage={preselectedStage}
          customers={customers}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editingDeal) {
              await updateDeal(editingDeal.id, data);
            } else {
              await addDeal(data as Omit<Deal, 'id'>);
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

// Modal Component
interface DealModalProps {
  deal: Deal | null;
  preselectedStage: DealStage | null;
  customers: { id: string; name: string; company: string }[];
  onClose: () => void;
  onSave: (data: Partial<Deal>) => void;
}

const DealModal: React.FC<DealModalProps> = ({ deal, preselectedStage, customers, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Deal>>(() => {
    if (deal) {
      return { ...deal };
    }
    return {
      title: '',
      customerName: '',
      value: 0,
      stage: preselectedStage || DealStage.LEAD,
      probability: preselectedStage ? getProbabilityForStage(preselectedStage) : 10,
      expectedClose: new Date().toISOString().split('T')[0]
    };
  });

  function getProbabilityForStage(stage: DealStage): number {
    switch (stage) {
      case DealStage.LEAD: return 10;
      case DealStage.QUALIFICATION: return 25;
      case DealStage.PROPOSAL: return 50;
      case DealStage.NEGOTIATION: return 75;
      case DealStage.WON: return 100;
      case DealStage.LOST: return 0;
      default: return 10;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const updateField = (field: keyof Deal, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-update probability when stage changes
      if (field === 'stage') {
        updated.probability = getProbabilityForStage(value as DealStage);
      }

      return updated;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" shadow-sm>
        <div className="p-6 border-b border-light flex justify-between items-center">
          <h2 className="text-xl font-bold text-dark">
            {deal ? 'Modifica Opportunità' : 'Nuova Opportunità'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-dark">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Titolo */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Titolo Opportunità *</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Es: Licenza Enterprise, Consulenza Q1..."
              className="w-full px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Cliente *</label>
            <select
              value={formData.customerName || ''}
              onChange={(e) => updateField('customerName', e.target.value)}
              className="w-full px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              required
            >
              <option value="">Seleziona cliente...</option>
              {customers.map(c => (
                <option key={c.id} value={c.company || c.name}>
                  {c.company} {c.name ? `(${c.name})` : ''}
                </option>
              ))}
              <option value="__new__">+ Altro (inserisci manualmente)</option>
            </select>
            {formData.customerName === '__new__' && (
              <input
                type="text"
                onChange={(e) => updateField('customerName', e.target.value)}
                placeholder="Nome cliente..."
                className="w-full mt-2 px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                required
              />
            )}
          </div>

          {/* Valore e Data Chiusura */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Valore (€) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.value || 0}
                onChange={(e) => updateField('value', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Data Chiusura Prevista</label>
              <input
                type="date"
                value={formData.expectedClose ? formData.expectedClose.split('T')[0] : ''}
                onChange={(e) => updateField('expectedClose', e.target.value)}
                className="w-full px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Stato e Probabilità */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Stato</label>
              <select
                value={formData.stage || DealStage.LEAD}
                onChange={(e) => updateField('stage', e.target.value as DealStage)}
                className="w-full px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {Object.values(DealStage).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Probabilità (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.probability || 0}
                onChange={(e) => updateField('probability', parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border border-light rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Valore Ponderato */}
          <div className="bg-gray-50 p-4 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Valore Ponderato</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(((formData.value || 0) * (formData.probability || 0)) / 100)}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Valore × Probabilità = contributo alla pipeline
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-light rounded-xl font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-secondary text-white rounded-xl font-medium hover:bg-black transition-colors flex items-center justify-center gap-2"
            >
              <Check size={18} />
              {deal ? 'Salva Modifiche' : 'Crea Opportunità'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
