import { useState, useEffect } from 'react';
import { getNegocios, getActividades, type Negocio, type Actividad } from '@/lib/db';
import { getReportInsights, type ReportInsight } from '@/lib/groq';
import jsPDF from 'jspdf';

function formatCLP(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-CL')}`;
}

const STAGES = ['Prospección', 'Calificación', 'Propuesta', 'Negociación', 'Cierre'];
const STAGE_COLORS: Record<string, string> = {
  Prospección: 'bg-slate-300',
  Calificación: 'bg-blue-300',
  Propuesta: 'bg-primary/40',
  Negociación: 'bg-orange-300',
  Cierre: 'bg-green-400',
};

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<ReportInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    async function load() {
      const [n, a] = await Promise.all([getNegocios(), getActividades()]);
      if (n.ok) setNegocios(n.data);
      if (a.ok) setActividades(a.data);
      setLoading(false);
    }
    load();
  }, []);

  const inRange = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  };

  const negociosFiltrados = negocios.filter(n => inRange(n.fecha_cierre || n.created_at));
  const actividadesFiltradas = actividades.filter(a => inRange(a.fecha_hora || a.created_at));

  const exportNegocios = () => {
    const rows = negociosFiltrados.map(n => ({
      Nombre: n.nombre, Empresa: n.empresa_nombre ?? '', Etapa: n.etapa,
      Valor: n.valor ?? 0, Probabilidad: n.probabilidad ?? 0,
      Riesgo: n.riesgo ? 'Sí' : 'No', 'Fecha Cierre': n.fecha_cierre ?? '', Creado: n.created_at,
    }));
    downloadCSV('negocios.csv', toCSV(rows));
  };

  const exportActividades = () => {
    const rows = actividadesFiltradas.map(a => ({
      Título: a.titulo, Tipo: a.tipo, Prioridad: a.prioridad,
      Completada: a.completada ? 'Sí' : 'No', 'Fecha/Hora': a.fecha_hora ?? '',
      Relacionado: a.relacionado ?? '',
    }));
    downloadCSV('actividades.csv', toCSV(rows));
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const col = pageW - margin * 2;
    let y = margin;

    const dateLabel = dateFrom || dateTo
      ? ` (${dateFrom || '…'} — ${dateTo || '…'})`
      : ` (${new Date().toLocaleDateString('es-CL')})`;

    // Header
    doc.setFillColor(99, 60, 219);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Pudu CRM — Reporte de Pipeline' + dateLabel, margin, 14);
    y = 30;

    // KPIs
    doc.setTextColor(30, 30, 50);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN EJECUTIVO', margin, y); y += 6;

    const kpiData = [
      ['Tasa de Conversión', `${tasaConversion}%`],
      ['Pipeline Total', formatCLP(totalPipeline)],
      ['Pipeline Esperado (ponderado)', formatCLP(Math.round(pipelineEsperado))],
      ['Deals Ganados (Cierre)', String(cerrados.length)],
      ['En Riesgo', String(enRiesgo)],
      ['Total Actividades', String(actTotal)],
      ['Actividades Completadas', `${actCompleted} (${actPct}%)`],
    ];

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const halfCol = col / 2;
    kpiData.forEach(([label, value], i) => {
      const x = margin + (i % 2 === 0 ? 0 : halfCol + 5);
      if (i % 2 === 0 && i > 0) y += 8;
      doc.setTextColor(120, 120, 140);
      doc.text(label, x, y);
      doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
      doc.text(value, x + halfCol - 10, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });
    y += 14;

    // Funnel
    doc.setDrawColor(220, 220, 230);
    doc.line(margin, y, pageW - margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50);
    doc.text('EMBUDO DE CONVERSIÓN', margin, y); y += 7;

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    funnelData.forEach(stage => {
      const barW = maxCount > 0 ? Math.max((stage.count / maxCount) * (col - 50), stage.count > 0 ? 4 : 0) : 0;
      doc.setFillColor(180, 160, 240);
      doc.roundedRect(margin + 45, y - 4, barW, 6, 1, 1, 'F');
      doc.setTextColor(100, 100, 120);
      doc.text(stage.label, margin, y);
      doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
      doc.text(String(stage.count), margin + 43, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 9;
    });
    y += 6;

    // Top deals
    doc.line(margin, y, pageW - margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50);
    doc.text('TOP NEGOCIOS POR VALOR', margin, y); y += 7;

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 140); doc.setFont('helvetica', 'bold');
    doc.text('#', margin, y);
    doc.text('Nombre', margin + 10, y);
    doc.text('Empresa', margin + 90, y);
    doc.text('Etapa', margin + 130, y);
    doc.text('Valor', pageW - margin, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(220, 220, 230); doc.line(margin, y, pageW - margin, y); y += 5;

    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 50);
    topDeals.forEach((deal, i) => {
      doc.text(String(i + 1), margin, y);
      doc.text(deal.nombre.slice(0, 35), margin + 10, y);
      doc.text((deal.empresa_nombre ?? '—').slice(0, 20), margin + 90, y);
      doc.text(deal.etapa, margin + 130, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(99, 60, 219);
      doc.text(formatCLP(deal.valor ?? 0), pageW - margin, y, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 50);
      y += 7;
    });
    y += 6;

    // Activities by type
    doc.line(margin, y, pageW - margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50);
    doc.text('ACTIVIDADES POR TIPO', margin, y); y += 7;

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    (['llamada', 'reunion', 'email', 'tarea'] as const).forEach(tipo => {
      const count = actividadesFiltradas.filter(a => a.tipo === tipo).length;
      doc.setTextColor(100, 100, 120);
      doc.text(tipo.charAt(0).toUpperCase() + tipo.slice(1), margin, y);
      doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
      doc.text(String(count), margin + 60, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 7;
    });

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8); doc.setTextColor(160, 160, 180);
    doc.text('Generado por Pudu CRM · ' + new Date().toLocaleString('es-CL'), margin, pageH - 8);

    doc.save(`reporte-pudu-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const generateInsights = async () => {
    setInsightsLoading(true);
    setInsights([]);
    const stats = [
      `Pipeline total: ${formatCLP(totalPipeline)} | Deals activos: ${negocios.length} | Tasa conversión: ${tasaConversion}%`,
      `En riesgo: ${enRiesgo} | Pipeline esperado (ponderado): ${formatCLP(Math.round(pipelineEsperado))}`,
      `Embudo: ${STAGES.map(s => `${s}(${negocios.filter(n => n.etapa === s).length})`).join(', ')}`,
      `Actividades: ${actividades.length} total, ${actividades.filter(a => a.completada).length} completadas`,
      `Top deal: ${negocios.sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))[0]?.nombre ?? 'N/A'} (${formatCLP(negocios[0]?.valor ?? 0)})`,
    ].join('\n');
    const result = await getReportInsights(stats);
    setInsights(result);
    setInsightsLoading(false);
  };

  // KPIs (usa datos filtrados por rango de fecha)
  const totalPipeline = negociosFiltrados.reduce((s, n) => s + (n.valor ?? 0), 0);
  const cerrados = negociosFiltrados.filter(n => n.etapa === 'Cierre');
  const tasaConversion = negociosFiltrados.length > 0 ? Math.round(cerrados.length / negociosFiltrados.length * 100) : 0;
  const pipelineEsperado = negociosFiltrados.reduce((s, n) => s + (n.valor ?? 0) * (n.probabilidad ?? 0) / 100, 0);
  const enRiesgo = negociosFiltrados.filter(n => n.riesgo).length;

  // Funnel
  const funnelData = STAGES.map(s => ({ label: s, count: negociosFiltrados.filter(n => n.etapa === s).length, color: STAGE_COLORS[s] }));
  const maxCount = Math.max(...funnelData.map(f => f.count), 1);

  // Revenue by month (last 6 months, based on fecha_cierre of Cierre deals)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', ''),
      isCurrent: d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(),
    };
  });

  const revenueByMonth = months.map(m => ({
    ...m,
    value: negociosFiltrados
      .filter(n => {
        const dateStr = n.fecha_cierre || n.created_at;
        const d = new Date(dateStr);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      })
      .reduce((s, n) => s + (n.valor ?? 0), 0),
  }));
  const maxRevenue = Math.max(...revenueByMonth.map(m => m.value), 1);

  // Top deals by valor
  const topDeals = [...negociosFiltrados].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0)).slice(0, 5);

  // Activities stats
  const actTotal = actividadesFiltradas.length;
  const actCompleted = actividadesFiltradas.filter(a => a.completada).length;
  const actPct = actTotal > 0 ? Math.round(actCompleted / actTotal * 100) : 0;

  const kpis = [
    { icon: 'conversion_path', label: 'Tasa Conversión', value: loading ? '...' : `${tasaConversion}%`, sub: `${cerrados.length} de ${negociosFiltrados.length} deals` },
    { icon: 'attach_money', label: 'Pipeline Total', value: loading ? '...' : formatCLP(totalPipeline), sub: 'Valor bruto acumulado' },
    { icon: 'emoji_events', label: 'Deals Ganados', value: loading ? '...' : String(cerrados.length), sub: 'Etapa Cierre' },
    { icon: 'warning', label: 'En Riesgo', value: loading ? '...' : String(enRiesgo), sub: 'Negocios marcados en riesgo' },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Analytics</span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Reportes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Inteligencia operativa del pipeline</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-[#1e1a2e] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-xs text-slate-400">—</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-[#1e1a2e] text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-slate-400 hover:text-slate-600 px-2">✕</button>
          )}
          <button onClick={exportNegocios} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            <span className="material-symbols-outlined text-sm">download</span>
            Negocios CSV
          </button>
          <button onClick={exportActividades} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            <span className="material-symbols-outlined text-sm">download</span>
            Actividades CSV
          </button>
          <button onClick={exportPDF} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-40">
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl text-primary">{kpi.icon}</span>
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">{kpi.value}</p>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{kpi.label}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Funnel + Top Deals */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
        {/* Funnel */}
        <div className="xl:col-span-3 bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5">Embudo de Conversión</h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {funnelData.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-28 text-right flex-shrink-0">{stage.label}</span>
                  <div className="flex-1 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-lg flex items-center px-3 transition-all`}
                      style={{ width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0)}%` }}
                    >
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{stage.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Deals */}
        <div className="xl:col-span-2 bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5">Top Negocios por Valor</h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
          ) : topDeals.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topDeals.map((deal, i) => (
                <div key={deal.id} className="flex items-center gap-3">
                  <div className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${i === 0 ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{deal.nombre}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{deal.empresa_nombre ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-primary">{formatCLP(deal.valor ?? 0)}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{deal.etapa}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue by month + Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="xl:col-span-2 bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Pipeline por Mes</h3>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full">Últimos 6 meses</span>
          </div>
          {loading ? (
            <div className="flex items-end gap-3 h-32">{[1,2,3,4,5,6].map(i => <div key={i} className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-t-lg animate-pulse h-full" />)}</div>
          ) : (
            <div className="flex items-end gap-3 h-36">
              {revenueByMonth.map((m) => {
                const pct = maxRevenue > 0 ? Math.max((m.value / maxRevenue) * 100, m.value > 0 ? 4 : 0) : 0;
                return (
                  <div key={`${m.year}-${m.month}`} className="flex flex-col items-center gap-2 flex-1">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{m.value > 0 ? formatCLP(m.value) : ''}</p>
                    <div className="w-full flex items-end" style={{ height: '100px' }}>
                      <div
                        className={`w-full rounded-t-lg transition-all ${m.isCurrent ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                        style={{ height: `${pct}%`, minHeight: m.value > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className={`text-[11px] font-bold capitalize ${m.isCurrent ? 'text-primary' : 'text-slate-400'}`}>{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activities summary */}
        <div className="bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-5">Actividades</h3>
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-3xl font-black text-primary">{actPct}%</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">Tasa de completado</p>
              </div>

              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${actPct}%` }} />
              </div>

              <div className="space-y-2 pt-2">
                {[
                  { label: 'Total actividades', value: actTotal, color: 'text-slate-700' },
                  { label: 'Completadas', value: actCompleted, color: 'text-green-600' },
                  { label: 'Pendientes', value: actTotal - actCompleted, color: 'text-orange-500' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
                    <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Por tipo</p>
                {(['llamada', 'reunion', 'email', 'tarea'] as const).map(tipo => {
                  const count = actividadesFiltradas.filter(a => a.tipo === tipo).length;
                  return (
                    <div key={tipo} className="flex items-center justify-between py-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{tipo}</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline esperado summary */}
      {!loading && negocios.length > 0 && (
        <div className="mt-4 bg-primary/5 border border-primary/10 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Pipeline Esperado (ponderado)</p>
            <p className="text-2xl font-black text-primary">{formatCLP(Math.round(pipelineEsperado))}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Pipeline Bruto</p>
            <p className="text-2xl font-black text-slate-700 dark:text-slate-300">{formatCLP(totalPipeline)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ratio</p>
            <p className="text-2xl font-black text-slate-700 dark:text-slate-300">
              {totalPipeline > 0 ? Math.round(pipelineEsperado / totalPipeline * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {!loading && negocios.length > 0 && (
        <div className="mt-4 bg-white dark:bg-[#1e1a2e] rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-sm text-white">auto_awesome</span>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">AI Insights</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Análisis del pipeline con inteligencia artificial</p>
              </div>
            </div>
            <button
              onClick={generateInsights}
              disabled={insightsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
            >
              {insightsLoading
                ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Analizando...</>
                : <><span className="material-symbols-outlined text-sm">auto_awesome</span>Generar Insights</>
              }
            </button>
          </div>

          {insights.length === 0 && !insightsLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-200 mb-3">insights</span>
              <p className="text-sm text-slate-400 font-medium">Haz clic en "Generar Insights" para analizar tu pipeline con IA</p>
            </div>
          )}

          {insights.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {insights.map((insight, i) => {
                const colors = {
                  success: 'bg-green-50 border-green-100 text-green-600',
                  warning: 'bg-orange-50 border-orange-100 text-orange-600',
                  alert:   'bg-red-50 border-red-100 text-red-600',
                  info:    'bg-blue-50 border-blue-100 text-blue-600',
                };
                const cls = colors[insight.tipo] ?? colors.info;
                return (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${cls.split(' ').slice(0,2).join(' ')}`}>
                    <span className={`material-symbols-outlined text-xl flex-shrink-0 mt-0.5 ${cls.split(' ')[2]}`}>{insight.icon}</span>
                    <div>
                      <p className={`text-xs font-black mb-1 ${cls.split(' ')[2]}`}>{insight.titulo}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{insight.descripcion}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
