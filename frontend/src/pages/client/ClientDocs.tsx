import { useEffect, useState } from 'react'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import { FileText, Download, Wrench } from 'lucide-react'

const EQ_COLORS = [
  { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
  { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' },
  { bg: '#FFF1F2', border: '#F43F5E', text: '#BE123C' },
  { bg: '#F0FDFA', border: '#14B8A6', text: '#0F766E' },
]

interface Document { id: string; title: string; filename: string; filesize: number; doc_type: string; equipment_id: string | null; equipment_model: string; equipment_serial: string; created_at: string }
interface DocType { id: string; name: string }

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ'
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ'
}

export default function ClientDocs() {
  const [docs, setDocs] = useState<Document[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])

  useEffect(() => {
    const cachedDocs = getCache('client_docs')
    if (cachedDocs) setDocs(cachedDocs)
    const cachedTypes = getCache('document_types')
    if (cachedTypes) setDocTypes(cachedTypes)
    Promise.all([
      api.get('/documents/my'),
      api.get('/settings/document_types')
    ]).then(([docsRes, typesRes]) => {
      setCache('client_docs', docsRes.data)
      setCache('document_types', typesRes.data || [])
      setDocs(docsRes.data)
      setDocTypes(typesRes.data || [])
    }).catch(() => {})
  }, [])

  const getTypeName = (id: string) => docTypes.find(t => t.id === id)?.name || id

  const grouped: Record<string, Document[]> = {}
  docs.forEach(d => {
    const key = d.equipment_id || '__general__'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(d)
  })

  const equipmentGroups = Object.entries(grouped).filter(([k]) => k !== '__general__')
  const generalDocs = grouped['__general__'] || []

  if (docs.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#18181B] mb-6">Документация</h1>
        <div className="card py-16 text-center text-[#A1A1AA]">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">Документов пока нет</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#18181B] mb-6">Документация</h1>
      <div className="space-y-4">
        {equipmentGroups.map(([, eqDocs], idx) => {
          const color = EQ_COLORS[idx % EQ_COLORS.length]
          return (
            <div key={eqDocs[0].equipment_id} className="card overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center gap-2.5"
                style={{ background: color.bg, borderColor: color.border, borderLeftWidth: 4, borderLeftStyle: 'solid' }}>
                <Wrench size={15} style={{ color: color.text, flexShrink: 0 }} />
                <div className="font-semibold" style={{ color: color.text }}>
                  {eqDocs[0].equipment_model || 'Оборудование'}
                  {eqDocs[0].equipment_serial && (
                    <span className="font-normal ml-2 text-sm" style={{ color: color.text, opacity: 0.75 }}>
                      — {eqDocs[0].equipment_serial}
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-[#F4F4F5]">
                {eqDocs.map(doc => <DocItem key={doc.id} doc={doc} getTypeName={getTypeName} />)}
              </div>
            </div>
          )
        })}
        {generalDocs.length > 0 && (
          <div className="card">
            <div className="px-5 py-3 border-b border-[#F4F4F5] bg-[#FAFAFA]">
              <div className="font-semibold text-[#18181B]">Общие документы</div>
            </div>
            <div className="divide-y divide-[#F4F4F5]">
              {generalDocs.map(doc => <DocItem key={doc.id} doc={doc} getTypeName={getTypeName} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DocItem({ doc, getTypeName }: { doc: Document; getTypeName: (id: string) => string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <FileText size={16} className="text-[#003399] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#18181B]">{doc.title}</div>
        <div className="text-xs text-[#A1A1AA]">{getTypeName(doc.doc_type)} · {formatSize(doc.filesize)}</div>
      </div>
      <a href={`/api/documents/client-download/${doc.id}`}
        className="btn btn-secondary py-1.5 px-3 text-xs gap-1.5 flex-shrink-0">
        <Download size={13} /> Скачать
      </a>
    </div>
  )
}
