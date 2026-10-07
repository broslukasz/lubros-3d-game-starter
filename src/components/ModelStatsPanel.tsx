import React from 'react';
import { ModelStats } from '../types/three-app.ts';
import { Triangle, Box, Palette, Maximize, ShieldCheck, Ruler, Film } from 'lucide-react';

interface ModelStatsPanelProps {
  stats: ModelStats | null;
}

export const ModelStatsPanel: React.FC<ModelStatsPanelProps> = ({ stats }) => {
  if (!stats) return null;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(num);
  };

  const statCards = [
    {
      label: 'Trójkąty (Poligony)',
      value: formatNumber(stats.triangles),
      icon: <Triangle className="w-4 h-4 text-cyan-400" />,
      hint: stats.triangles > 200000 ? 'Wysoki polycount' : 'Płynne działanie na telefonie',
      hintColor: stats.triangles > 200000 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      label: 'Wierzchołki (Vertices)',
      value: formatNumber(stats.vertices),
      icon: <Box className="w-4 h-4 text-indigo-400" />,
      hint: 'Geometria 3D',
      hintColor: 'text-slate-400',
    },
    {
      label: 'Liczba siatek (Meshes)',
      value: stats.meshesCount,
      icon: <Box className="w-4 h-4 text-purple-400" />,
      hint: `${stats.meshesCount} części w modelu`,
      hintColor: 'text-slate-400',
    },
    {
      label: 'Materiały PBR',
      value: stats.materialsCount,
      icon: <Palette className="w-4 h-4 text-pink-400" />,
      hint: `${stats.texturesCount} tekstur`,
      hintColor: 'text-slate-400',
    },
    {
      label: 'Wysokość modelu',
      value: `${stats.boundingBox.height} m`,
      icon: <Ruler className="w-4 h-4 text-emerald-400" />,
      hint: 'Skala w przestrzeni',
      hintColor: 'text-emerald-400',
    },
    {
      label: 'Animacje szkieletowe',
      value: stats.animationsCount > 0 ? `${stats.animationsCount} ${stats.animationsCount === 1 ? 'klip' : 'klipów'}` : 'Brak (Proceduralne)',
      icon: <Film className={`w-4 h-4 ${stats.animationsCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`} />,
      hint: stats.animationsCount > 0 ? (stats.animationNames && stats.animationNames.length > 0 ? stats.animationNames.slice(0, 2).join(', ') : 'Podpięte pod chód/bieg') : 'Krok proceduralny',
      hintColor: stats.animationsCount > 0 ? 'text-emerald-400' : 'text-slate-400',
    },
  ];

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Parametry Twojego modelu w przestrzeni gry
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Maximize className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Rozmiar: {stats.boundingBox.width}m × {stats.boundingBox.height}m × {stats.boundingBox.depth}m
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {statCards.map((card, i) => (
          <div key={i} className="bg-slate-950/70 rounded-lg p-3 border border-slate-800/80">
            <div className="flex items-center gap-2 mb-1">
              {card.icon}
              <span className="text-[11px] text-slate-400 truncate">{card.label}</span>
            </div>
            <div className="text-base font-bold text-slate-100 font-mono">{card.value}</div>
            <div className={`text-[10px] mt-0.5 truncate ${card.hintColor}`}>{card.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
