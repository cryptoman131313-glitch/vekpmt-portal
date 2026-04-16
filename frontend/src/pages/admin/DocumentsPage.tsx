import { useEffect, useState, useRef } from 'react'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight, Plus, Trash2, Download, FileText, Wrench } from 'lucide-react'
import { companyInitials } from '../../utils/helpers'

async function downloadStaffDoc(docId: string) {
  try {
    const { data } = await api.post(`/documents/${docId}/download-link`)
    if (data?.url) window.location.href = data.url
  } catch (err: any) {
    toast.error(err.response?.data?.error || 'Не удалось скачать')
  }
}

interface Client { id: string; company_name: string; contact_name: string }
interface Equipment { id: string; model: string; serial_number: string }
interface Document { id: string; title: string; filename: string; filesize: number; doc_type: string; equipment_id: string | null; created_at: string; uploaded_by_name: string }
interface DocType { id: string; name: string }

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ'
  return (bytes / 1024 / 1024).toFixed(1) + ' МБ'
}

export default function DocumentsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<Record<string, Equipment[]>>({})
  const [docs, setDocs] = useState<Record<string, Document[]>>({})
  const [docTypes, setDocTypes] = useState<DocType[]>([])

  // Форма загрузки
  const [showUpload, setShowUpload] = useState<{ clientId: string; equipmentId: string | null } | null>(null)
  const [uploadForm, setUploadForm] = useState({ title: '', doc_type: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const cachedClients = getCache('doc_clients')
    if (cachedClients) setClients(cachedClients)
    api.get('/documents/clients').then(r => { setCache('doc_clients', r.data); setClients(r.data) }).catch(() => {})

    const cachedTypes = getCache('document_types')
    if (cachedTypes) setDocTypes(cachedTypes)
    api.get('/settings/document_types').then(r => { setCache('document_types', r.data); setDocTypes(r.data || []) }).catch(() => {})
  }, [])

  const loadClient = async (clientId: string) => {
    const cachedDocs = getCache(`docs_${clientId}`)
    if (cachedDocs) setDocs(prev => ({ ...prev, [clientId]: cachedDocs }))

    const [eqRes, docsRes] = await Promise.all([
      equipment[clientId] ? Promise.resolve({ data: equipment[clientId] }) : api.get(`/clients/${clientId}/equipment`),
      api.get(`/documents/client/${clientId}`)
    ])
    setEquipment(e => ({ ...e, [clientId]: eqRes.data }))
    setCache(`docs_${clientId}`, docsRes.data)
    setDocs(prev => ({ ...prev, [clientId]: docsRes.data }))
  }

  const toggle = (clientId: string) => {
    if (expanded === clientId) { setExpanded(null); return }
    setExpanded(clientId)
    loadClient(clientId)
  }

  const openUpload = (clientId: string, equipmentId: string | null) => {
    setShowUpload({ clientId, equipmentId })
    setUploadForm({ title: '', doc_type: docTypes[0]?.id || '' })
    setUploadFile(null)
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.title.trim() || !showUpload) {
      toast.error('Выберите файл и введите название'); return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('client_id', showUpload.clientId)
      fd.append('title', uploadForm.title)
      fd.append('doc_type', uploadForm.doc_type)
      if (showUpload.equipmentId) fd.append('equipment_id', showUpload.equipmentId)
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Документ загружен')
      setShowUpload(null)
      loadClient(showUpload.clientId)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка загрузки')
    } finally { setUploading(false) }
  }

  const handleDelete = async (docId: string, clientId: string) => {
    if (!confirm('Удалить документ?')) return
    try {
      await api.delete(`/documents/${docId}`)
      toast.success('Удалено')
      loadClient(clientId)
    } catch { toast.error('Ошибка') }
  }

  const clientDocs = (clientId: string, equipmentId: string | null) =>
    (docs[clientId] || []).filter(d => d.equipment_id === equipmentId)

  const getDocTypeName = (id: string) => docTypes.find(t => t.id === id)?.name || id

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#18181B] mb-6">Документация</h1>

      <div className="space-y-2">
        {clients.length === 0 && (
          <div className="card py-10 text-center text-[#A1A1AA] text-sm">Клиентов нет</div>
        )}
        {clients.map(client => (
          <div key={client.id} className="card">
            {/* Клиент */}
            <div className="flex items-center gap-3 p-4 cursor-pointer select-none"
              onClick={() => toggle(client.id)}>
              <div className="text-[#A1A1AA]">
                {expanded === client.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="w-9 h-9 rounded-full bg-[#003399] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {companyInitials(client.company_name)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[#18181B]">{client.company_name}</div>
                <div className="text-xs text-[#A1A1AA]">{client.contact_name}</div>
              </div>
            </div>

            {/* Содержимое клиента */}
            {expanded === client.id && (
              <div className="border-t border-[#F4F4F5]">

                {/* Оборудование */}
                {(equipment[client.id] || []).map((eq, idx) => (
                  <div key={eq.id} className="border-b border-[#F4F4F5] last:border-b-0">
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-[#F0F4FF] border-b border-[#E0E7FF]"
                      style={{ borderLeft: `3px solid #003399` }}>
                      <Wrench size={14} className="text-[#003399] flex-shrink-0" />
                      <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wide flex-1">
                        {eq.model}{eq.serial_number && ` — ${eq.serial_number}`}
                      </span>
                      <div className="relative group cursor-default inline-flex mr-1">
                        <div className="w-4 h-4 rounded-full bg-[#A1A1AA] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">?</div>
                        <div className="absolute bottom-6 right-0 z-20 hidden group-hover:block bg-[#18181B] text-white text-xs rounded-lg px-3 py-2 w-56 leading-relaxed shadow-xl whitespace-normal">
                          Прикрепите паспорт, инструкцию или другой документ к этому оборудованию
                        </div>
                      </div>
                      <button onClick={() => openUpload(client.id, eq.id)}
                        className="btn btn-secondary py-1 px-2.5 text-xs gap-1">
                        <Plus size={13} /> Добавить
                      </button>
                    </div>
                    {/* Документы оборудования */}
                    {clientDocs(client.id, eq.id).length > 0 && (
                      <div className="px-5 py-2 space-y-1.5">
                        {clientDocs(client.id, eq.id).map(doc => (
                          <DocRow key={doc.id} doc={doc} clientId={client.id}
                            getTypeName={getDocTypeName}
                            onDelete={handleDelete} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Общие документы клиента */}
                <div>
                  <div className="flex items-center gap-3 px-5 py-2.5 bg-[#F4F4F5] border-b border-[#E4E4E7]">
                    <FileText size={14} className="text-[#71717A] flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wide flex-1">Общие документы</span>
                    <div className="relative group cursor-default inline-flex mr-1">
                      <div className="w-4 h-4 rounded-full bg-[#A1A1AA] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">?</div>
                      <div className="absolute bottom-6 right-0 z-20 hidden group-hover:block bg-[#18181B] text-white text-xs rounded-lg px-3 py-2 w-56 leading-relaxed shadow-xl whitespace-normal">
                        Документы без привязки к оборудованию: договоры, счета, акты и прочее
                      </div>
                    </div>
                    <button onClick={() => openUpload(client.id, null)}
                      className="btn btn-secondary py-1 px-2.5 text-xs gap-1">
                      <Plus size={13} /> Добавить
                    </button>
                  </div>
                  {clientDocs(client.id, null).length > 0 && (
                    <div className="px-5 py-2 space-y-1.5">
                      {clientDocs(client.id, null).map(doc => (
                        <DocRow key={doc.id} doc={doc} clientId={client.id}
                          getTypeName={getDocTypeName}
                          onDelete={handleDelete} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Модалка загрузки */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] text-lg mb-5">Загрузить документ</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Название <span className="text-[#CC0033]">*</span></label>
                <input className="form-control" autoComplete="off" placeholder="Паспорт оборудования A-160"
                  value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Тип документа</label>
                <select className="form-control" value={uploadForm.doc_type}
                  onChange={e => setUploadForm(f => ({ ...f, doc_type: e.target.value }))}>
                  {docTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Файл <span className="text-[#CC0033]">*</span></label>
                <div
                  className="border-2 border-dashed border-[#E4E4E7] rounded-lg p-4 text-center cursor-pointer hover:border-[#003399] transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  {uploadFile ? (
                    <div className="text-sm text-[#18181B] font-medium">{uploadFile.name}
                      <span className="text-[#A1A1AA] font-normal ml-2">({formatSize(uploadFile.size)})</span>
                    </div>
                  ) : (
                    <div className="text-sm text-[#A1A1AA]">Нажмите чтобы выбрать файл</div>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowUpload(null)} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleUpload} disabled={uploading} className="btn btn-primary flex-[2] justify-center disabled:opacity-60">
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocRow({ doc, clientId, getTypeName, onDelete }: {
  doc: Document; clientId: string
  getTypeName: (id: string) => string
  onDelete: (id: string, clientId: string) => void
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[#F4F4F5] group">
      <FileText size={14} className="text-[#A1A1AA] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[#18181B] font-medium">{doc.title}</span>
        <span className="text-xs text-[#A1A1AA] ml-2">{getTypeName(doc.doc_type)}</span>
        <span className="text-xs text-[#A1A1AA] ml-2">{formatSize(doc.filesize)}</span>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
        <button onClick={() => downloadStaffDoc(doc.id)}
          className="btn btn-secondary p-1.5"><Download size={13} /></button>
        <button onClick={() => onDelete(doc.id, clientId)}
          className="btn btn-danger p-1.5"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}
