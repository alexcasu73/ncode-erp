import React from 'react';
import { MOCK_DEALS } from '../constants';
import { DealStage } from '../types';
import { Plus, MoreHorizontal, Calendar, DollarSign } from 'lucide-react';

export const Deals: React.FC = () => {
  const stages = Object.values(DealStage);

  const getStageColor = (stage: string) => {
    switch (stage) {
        case DealStage.WON: return 'border-t-4 border-primary';
        case DealStage.NEGOTIATION: return 'border-t-4 border-blue-400';
        case DealStage.PROPOSAL: return 'border-t-4 border-purple-400';
        default: return 'border-t-4 border-gray-300';
    }
  }

  return (
    <div className="h-full flex flex-col animate-fade-in pb-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-dark">Deals Pipeline</h1>
          <p className="text-gray-500 mt-1">Track your opportunities</p>
        </div>
        <div className="flex gap-3">
             <div className="bg-white px-4 py-2 rounded-full font-bold text-dark shadow-sm">
                Total Pipeline: <span className="text-green-600">€ 85,500</span>
             </div>
            <button className="bg-dark text-white px-6 py-2 rounded-full font-medium hover:bg-black transition-colors flex items-center gap-2">
                <Plus size={18} className="text-primary"/>
                New Deal
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-4 h-full">
            {stages.map((stage) => {
                const stageDeals = MOCK_DEALS.filter(d => d.stage === stage);
                const stageValue = stageDeals.reduce((acc, curr) => acc + curr.value, 0);

                return (
                    <div key={stage} className="w-80 flex-shrink-0 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-dark">{stage}</h3>
                                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{stageDeals.length}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-500">€ {stageValue.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex-1 bg-gray-100/50 rounded-2xl p-3 space-y-3 overflow-y-auto min-h-[500px]">
                            {stageDeals.map((deal) => (
                                <div key={deal.id} className={`bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer ${getStageColor(stage)}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{deal.customerName}</span>
                                        <button className="text-gray-300 hover:text-dark">
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </div>
                                    <h4 className="font-bold text-dark text-lg mb-3 leading-snug">{deal.title}</h4>
                                    
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                                        <div className="flex items-center gap-1 text-gray-600 text-sm font-semibold">
                                            <DollarSign size={14} className="text-primary" />
                                            {deal.value.toLocaleString()}
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-400 text-xs">
                                            <Calendar size={12} />
                                            {new Date(deal.expectedClose).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                                        </div>
                                    </div>
                                    {deal.probability && (
                                        <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
                                            <div 
                                                className="bg-dark h-1.5 rounded-full" 
                                                style={{ width: `${deal.probability}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            <button className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                                <Plus size={16} /> Add Deal
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};
