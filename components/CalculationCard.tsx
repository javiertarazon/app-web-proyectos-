import React from 'react';
import { CalculationItem } from '../types';
import { Sigma, Info } from 'lucide-react';

interface CalculationCardProps {
  item: CalculationItem;
}

const CalculationCard: React.FC<CalculationCardProps> = ({ item }) => {
  return (
    <div className={`p-4 rounded-xl border ${item.critical ? 'bg-orange-950/20 border-orange-900/50' : 'bg-slate-800/30 border-slate-700/50'} hover:border-eng-500/30 transition-colors group`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-slate-200 font-medium text-sm flex items-center gap-2">
          {item.name}
          {item.critical && <span className="text-[10px] bg-orange-900 text-orange-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Crítico</span>}
        </h4>
        <div className="bg-slate-900 p-1.5 rounded text-slate-400 group-hover:text-eng-400 transition-colors">
          <Sigma className="w-4 h-4" />
        </div>
      </div>
      
      <div className="font-mono text-xl text-white mb-1">
        {item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} 
        <span className="text-slate-400 text-sm ml-1">{item.unit}</span>
      </div>

      <div className="bg-slate-900/50 rounded p-2 mb-2">
        <code className="text-xs text-eng-300 font-mono block overflow-x-auto">
          {item.formula}
        </code>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-slate-400 mt-2">
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <p>{item.description}</p>
      </div>
    </div>
  );
};

export default CalculationCard;
