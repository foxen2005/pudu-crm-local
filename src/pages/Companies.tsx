import { useState } from 'react';
import { NuevaEmpresaModal } from '@/components/modals/NuevaEmpresaModal';

type CompanyStatus = 'Cliente' | 'Prospecto' | 'Inactiva';

interface Company {
  id: string;
  initials: string;
  name: string;
  website: string;
  sector: string;
  contactos: number;
  negocios: number;
  pipeline: string;
  status: CompanyStatus;
}

const companies: Company[] = [
  {
    id: '1',
    initials: 'TP',
    name: 'Tech Patagonia SpA',
    website: 'techpatagonia.cl',
    sector: 'Tecnología',
    contactos: 3,
    negocios: 2,
    pipeline: '$8.4M',
    status: 'Prospecto',
  },
  {
    id: '2',
    initials: 'AM',
    name: 'Antofagasta Minerals',
    website: 'antmin.cl',
    sector: 'Minería',
    contactos: 7,
    negocios: 4,
    pipeline: '$42M',
    status: 'Cliente',
  },
  {
    id: '3',
    initials: 'CT',
    name: 'Viña Concha y Toro',
    website: 'conchaytoro.cl',
    sector: 'Agro',
    contactos: 2,
    negocios: 1,
    pipeline: '$0',
    status: 'Inactiva',
  },
  {
    id: '4',
    initials: 'CE',
    name: 'Cencosud S.A.',
    website: 'cencosud.cl',
    sector: 'Retail',
    contactos: 12,
    negocios: 5,
    pipeline: '$24M',
    status: 'Cliente',
  },
  {
    id: '5',
    initials: 'TS',
    name: 'Transportes del Sur',
    website: 'transpSur.cl',
    sector: 'Logística',
    contactos: 4,
    negocios: 3,
    pipeline: '$12.5M',
    status: 'Cliente',
  },
];

const statusColors: Record<CompanyStatus, string> = {
  Cliente: 'bg-orange-50 text-orange-700 border-orange-100',
  Prospecto: 'bg-blue-50 text-blue-700 border-blue-100',
  Inactiva: 'bg-slate-100 text-slate-600 border-slate-200',
};

const filterTabs = ['Todos', 'Clientes', 'Prospectos', 'Inactivas'] as const;
type FilterTab = (typeof filterTabs)[number];

export default function Companies() {
  const [activeTab, setActiveTab] = useState<FilterTab>('Todos');
  const [selectedId, setSelectedId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = companies.filter((c) => {
    if (activeTab === 'Todos') return true;
    if (activeTab === 'Clientes') return c.status === 'Cliente';
    if (activeTab === 'Prospectos') return c.status === 'Prospecto';
    if (activeTab === 'Inactivas') return c.status === 'Inactiva';
    return true;
  });

  const activeCompany = companies.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="">
      {/* Page header */}
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">
          Directorio de Empresas
        </span>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Empresas</h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon="domain" label="Total Empresas" value="34" />
        <StatCard icon="verified" label="Clientes Activos" value="18" color="text-orange-600" />
        <StatCard icon="trending_up" label="Pipeline Total" value="$145.2M" color="text-primary" />
      </div>

      <div className="relative">
        <div className="space-y-5">
          {/* Filters + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center p-1 bg-slate-200/50 rounded-lg">
              {filterTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-1.5 rounded-md text-xs font-bold transition-all ${
                    activeTab === tab
                      ? 'bg-white shadow-sm text-primary'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-all">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filtrar
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-sm">add_business</span>
                Nueva Empresa
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-6 w-12">
                    <input
                      type="checkbox"
                      className="rounded text-primary focus:ring-primary/30 border-slate-300"
                    />
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Empresa
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Sector
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Contactos
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Negocios Activos
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    isSelected={company.id === selectedId}
                    onSelect={() =>
                      setSelectedId(company.id === selectedId ? '' : company.id)
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <CompanyDetail company={activeCompany} onClose={() => setSelectedId('')} />

      {/* Modal */}
      <NuevaEmpresaModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = 'text-slate-900',
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-xl text-primary">{icon}</span>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function CompanyRow({
  company,
  isSelected,
  onSelect,
}: {
  company: Company;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`transition-colors cursor-pointer group ${
        isSelected
          ? 'bg-primary/5 border-l-4 border-l-primary'
          : 'hover:bg-primary/[0.02]'
      }`}
    >
      <td className="py-4 px-6">
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          className="rounded text-primary focus:ring-primary/30 border-slate-300"
        />
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
            {company.initials}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{company.name}</p>
            <p className="text-[11px] text-slate-400">{company.website}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="text-xs font-medium text-slate-600">{company.sector}</span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-slate-400">group</span>
          <span className="text-xs font-bold text-slate-700">{company.contactos}</span>
        </div>
      </td>
      <td className="py-4 px-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-slate-400">account_tree</span>
            <span className="text-xs font-bold text-slate-700">{company.negocios} negocios</span>
          </div>
          <p className="text-[11px] font-bold text-primary mt-0.5 pl-5">{company.pipeline}</p>
        </div>
      </td>
      <td className="py-4 px-4">
        <button
          onClick={(e) => e.stopPropagation()}
          className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
        </button>
      </td>
    </tr>
  );
}

function CompanyDetail({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const open = !!company;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[1px]"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-4 right-4 bottom-20 w-[22rem] bg-white rounded-2xl shadow-2xl shadow-black/15 z-50 flex flex-col overflow-y-auto transition-all duration-300 ease-out border border-slate-100/80 ${
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Close */}
        <div className="flex justify-end px-4 pt-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {company && (
          <div className="px-6 pb-6 space-y-4">
            {/* Header card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-start mb-5">
                <div className="size-20 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
                  <span className="text-2xl font-black text-primary">{company.initials}</span>
                </div>
                <div className="flex gap-2">
                  <button className="size-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button className="size-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="text-xl font-black text-slate-900">{company.name}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[company.status]}`}
                  >
                    {company.status}
                  </span>
                  <span className="text-[11px] text-slate-400">{company.sector}</span>
                </div>
              </div>

              {/* Website */}
              <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors mb-5">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">language</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">
                    Sitio web
                  </p>
                  <a
                    href={`https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {company.website}
                  </a>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Contactos
                  </p>
                  <p className="text-lg font-black text-slate-800">{company.contactos}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Negocios
                  </p>
                  <p className="text-lg font-black text-slate-800">{company.negocios}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Pipeline
                  </p>
                  <p className="text-base font-black text-primary">{company.pipeline}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all">
                  <span className="material-symbols-outlined text-sm">group</span>
                  Ver Contactos
                </button>
                <button className="w-full py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                  <span className="material-symbols-outlined text-sm">account_tree</span>
                  Ver Negocios
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
