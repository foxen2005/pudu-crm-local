import { useState } from 'react';

const contacts = [
  {
    id: '1',
    initials: 'JV',
    name: 'Javier Valenzuela',
    email: 'javier.v@empresa.cl',
    status: 'Prospecto',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-100',
    company: 'Tech Patagonia SpA',
    value: '$2.450.000',
    selected: false,
    active: false,
  },
  {
    id: '2',
    initials: 'IA',
    name: 'Isabel Allende',
    email: 'i.allende@miningcorp.cl',
    status: 'Cliente Activo',
    statusColor: 'bg-orange-50 text-orange-700 border-orange-100',
    company: 'Antofagasta Minerals',
    value: '$12.800.000',
    selected: true,
    active: true,
    role: 'Chief Procurement Officer',
    vip: true,
    lastCall: 'Hace 2 días',
    pipeline: 'Cierre Q4',
    phone: '+56 9 8234 1102',
    alerts: [
      { color: 'border-l-orange-500 text-orange-600', label: 'Alerta de Seguimiento', text: 'Enviar propuesta actualizada de licitación antes del Viernes.' },
      { color: 'border-l-blue-500 text-blue-600', label: 'Próximo Hito', text: 'Reunión de gerencia en Las Condes - 14:00 PM' },
    ],
  },
  {
    id: '3',
    initials: 'RM',
    name: 'Ricardo Müller',
    email: 'rm@vinosdelsur.cl',
    status: 'Inactivo',
    statusColor: 'bg-slate-100 text-slate-600 border-slate-200',
    company: 'Viña Concha y Toro',
    value: '$0',
    selected: false,
    active: false,
  },
  {
    id: '4',
    initials: 'CM',
    name: 'Constanza Morán',
    email: 'connie@retailchile.com',
    status: 'Prospecto',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-100',
    company: 'Cencosud S.A.',
    value: '$5.120.000',
    selected: false,
    active: false,
  },
];

type Contact = typeof contacts[number];

export default function Contacts() {
  const [selected, setSelected] = useState<string>('');
  const activeContact = contacts.find((c) => c.id === selected) ?? null;

  return (
    <div className="">
      {/* Page header */}
      <div className="flex flex-col mb-8">
        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2">
          Directorio de Contactos
        </span>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Contactos</h2>
      </div>

      <div className="relative">
        {/* Table */}
        <div className="space-y-5">
          {/* Filters + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center p-1 bg-slate-200/50 rounded-lg">
              {['Todos', 'Prospectos', 'Clientes'].map((tab) => (
                <button
                  key={tab}
                  className={`px-5 py-1.5 rounded-md text-xs font-bold transition-all ${
                    tab === 'Todos' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-all">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filtrar
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-sm">person_add</span>
                Nuevo Contacto
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-6 w-12">
                    <input type="checkbox" className="rounded text-primary focus:ring-primary/30 border-slate-300" />
                  </th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                  <th className="py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Valor Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    isSelected={c.id === selected}
                    onSelect={() => setSelected(c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Right panel: contact detail — fixed overlay */}
      <ContactDetail contact={activeContact} onClose={() => setSelected('')} />
    </div>
  );
}

function ContactRow({
  contact,
  isSelected,
  onSelect,
}: {
  contact: Contact;
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
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
            {contact.initials}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{contact.name}</p>
            <p className="text-[11px] text-slate-500">{contact.email}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${contact.statusColor}`}>
          {contact.status}
        </span>
      </td>
      <td className="py-4 px-4">
        <p className="text-xs font-medium text-slate-600">{contact.company}</p>
      </td>
      <td className="py-4 px-4 text-right">
        <p className="text-xs font-bold text-slate-900">{contact.value}</p>
      </td>
    </tr>
  );
}

function ContactDetail({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const open = !!contact;
  if (!contact && !open) return null;
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/10 z-40 backdrop-blur-[1px]" onClick={onClose} />
      )}
      <aside
        className={`fixed top-4 right-4 bottom-20 w-[22rem] bg-white rounded-2xl shadow-2xl shadow-black/15 z-50 flex flex-col overflow-y-auto transition-all duration-300 ease-out border border-slate-100/80 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Close button */}
        <div className="flex justify-end px-4 pt-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        {contact && (
        <div className="px-6 pb-6 space-y-4">
      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="size-20 rounded-xl bg-primary/10 flex items-center justify-center shadow-md">
            <span className="text-2xl font-black text-primary">{contact.initials}</span>
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

        <div className="mb-6">
          <h3 className="text-xl font-black text-slate-900">{contact.name}</h3>
          {contact.role && <p className="text-xs font-medium text-slate-500">{contact.role}</p>}
          {contact.vip && (
            <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded w-fit">
              <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              CLIENTE VIP
            </div>
          )}
        </div>

        {(contact.lastCall || contact.pipeline) && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {contact.lastCall && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Última Llamada</p>
                <p className="text-xs font-bold text-slate-700">{contact.lastCall}</p>
              </div>
            )}
            {contact.pipeline && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pipeline</p>
                <p className="text-xs font-bold text-slate-700">{contact.pipeline}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">mail</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Email</p>
              <p className="text-xs font-medium text-slate-700 truncate">{contact.email}</p>
            </div>
          </div>
          {contact.phone && (
            <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">call</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Teléfono</p>
                <p className="text-xs font-medium text-slate-700">{contact.phone}</p>
              </div>
            </div>
          )}
        </div>

        <button className="w-full py-3 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all">
          Agendar Seguimiento
          <span className="material-symbols-outlined text-sm">calendar_today</span>
        </button>
      </div>

      {/* Signal cards */}
      {contact.alerts && contact.alerts.length > 0 && (
        <div className="space-y-3">
          {contact.alerts.map((alert, i) => (
            <div key={i} className={`border-l-4 ${alert.color} bg-white p-4 rounded-r-lg shadow-sm`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${alert.color.includes('orange') ? 'text-orange-600' : 'text-blue-600'}`}>
                {alert.label}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{alert.text}</p>
            </div>
          ))}
        </div>
      )}
        </div>
        )}
      </aside>
    </>
  );
}
