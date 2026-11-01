import React from 'react';
import {
  MapPin,
  Users,
  GitBranch,
  Scale,
  Coins,
  FileSignature,
  Database,
} from 'lucide-react';
import { ProjectState } from '../types';

export type ActiveModule =
  | 'parcels'
  | 'heirs'
  | 'optimization'
  | 'equalization'
  | 'notary'
  | 'archive';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  project: ProjectState;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  project,
}) => {
  const navItems = [
    {
      id: 'parcels' as ActiveModule,
      label: 'Parsel & Harita',
      icon: MapPin,
      sublabel: 'Google Hibrit & Alt KML',
      badge: project.parcels.length > 0 ? String(project.parcels.length) : undefined,
    },
    {
      id: 'heirs' as ActiveModule,
      label: 'Veraset & Malikler',
      icon: Users,
      sublabel: 'Kademeli Hisse Matrisi',
      badge: project.heirs.length > 0 ? String(project.heirs.length) : undefined,
    },
    {
      id: 'optimization' as ActiveModule,
      label: 'Taksim & AI',
      icon: Scale,
      sublabel: 'Müstakil / Ortaklı Mod',
      badge:
        project.scenarios.pure_independent || project.scenarios.sibling_consolidation
          ? 'Aktif'
          : undefined,
    },
    {
      id: 'equalization' as ActiveModule,
      label: 'İvaz Denkleştirme',
      icon: Coins,
      sublabel: 'Sıfır Toplamlı Bakiye',
      badge:
        (project.scenarios.pure_independent?.equalizationItems.length ||
          project.scenarios.sibling_consolidation?.equalizationItems.length || 0) > 0
          ? 'İvazlı'
          : undefined,
    },
    {
      id: 'notary' as ActiveModule,
      label: 'Noter & Protokol',
      icon: FileSignature,
      sublabel: 'Şarta Bağlı Taslaklar',
    },
    {
      id: 'archive' as ActiveModule,
      label: 'Arşiv & Yedek (.ZIP)',
      icon: Database,
      sublabel: 'Kalıcı Yerel Depolama',
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 no-print select-none">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Miras Taksim Yönetimi
        </div>
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
          {project.projectName || 'Miras Taksim Projesi'}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-900 font-semibold dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200/60 dark:border-blue-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                  }`}
                />
                <div className="truncate">
                  <div className="leading-tight">{item.label}</div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded text-slate-500 font-medium ${
                    isActive ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer stats summary */}
      <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
        <div className="flex justify-between">
          <span>Toplam Alan:</span>
          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
            {project.parcels.reduce((a, b) => a + (Number(b.alanM2) || 0), 0).toLocaleString('tr-TR')} m²
          </span>
        </div>
        <div className="flex justify-between">
          <span>Toplam Değer:</span>
          <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
            {project.parcels.reduce((a, b) => a + (Number(b.toplamDegerTL) || 0), 0).toLocaleString('tr-TR')} TL
          </span>
        </div>
      </div>
    </aside>
  );
};
