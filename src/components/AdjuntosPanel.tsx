import { useState, useEffect, useRef } from 'react';
import { getAdjuntos, subirAdjunto, eliminarAdjunto, type Adjunto } from '@/lib/db';

const MIME_ICONS: Record<string, string> = {
  'application/pdf': 'picture_as_pdf',
  'image/': 'image',
  'video/': 'videocam',
  'audio/': 'audiotrack',
  'application/zip': 'folder_zip',
  'application/x-rar': 'folder_zip',
  'application/msword': 'description',
  'application/vnd.openxmlformats-officedocument.wordprocessingml': 'description',
  'application/vnd.ms-excel': 'table_chart',
  'application/vnd.openxmlformats-officedocument.spreadsheetml': 'table_chart',
};

function mimeIcon(mime: string | null): string {
  if (!mime) return 'attach_file';
  for (const [k, v] of Object.entries(MIME_ICONS)) {
    if (mime.startsWith(k)) return v;
  }
  return 'attach_file';
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdjuntosPanel({
  entidadTipo,
  entidadId,
}: {
  entidadTipo: 'negocio' | 'contacto';
  entidadId: string;
}) {
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setAdjuntos(await getAdjuntos(entidadTipo, entidadId));
    setLoading(false);
  };

  useEffect(() => { load(); }, [entidadTipo, entidadId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      await subirAdjunto(entidadTipo, entidadId, file);
    }
    await load();
    setUploading(false);
  };

  const handleDelete = async (adj: Adjunto) => {
    if (!window.confirm(`¿Eliminar "${adj.nombre}"?`)) return;
    await eliminarAdjunto(adj.id, adj.url);
    setAdjuntos(prev => prev.filter(a => a.id !== adj.id));
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
        ) : (
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">upload_file</span>
        )}
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {uploading ? 'Subiendo archivos...' : 'Arrastra archivos o haz clic para subir'}
        </p>
        <p className="text-[10px] text-slate-400">PDF, imágenes, documentos, etc.</p>
      </div>

      {/* File list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : adjuntos.length === 0 ? (
        <div className="text-center py-6">
          <span className="material-symbols-outlined text-3xl text-slate-200 dark:text-slate-700 block mb-1">folder_open</span>
          <p className="text-xs text-slate-400">Sin archivos adjuntos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {adjuntos.map(adj => (
            <div
              key={adj.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-lg text-primary">{mimeIcon(adj.mime_type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{adj.nombre}</p>
                <p className="text-[10px] text-slate-400">
                  {formatBytes(adj.size)}
                  {adj.size && ' · '}
                  {new Date(adj.created_at).toLocaleDateString('es-CL')}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <a
                  href={adj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                  title="Descargar"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                </a>
                <button
                  onClick={() => handleDelete(adj)}
                  className="size-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
