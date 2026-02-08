'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Check, X, Eye, Loader2, Calendar, FileText, AlertTriangle, CheckCircle, XCircle, ExternalLink, CreditCard } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function InboxPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // ESTADOS MODAL VISOR
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image')

  const [processing, setProcessing] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, type: 'approve' | 'reject', item: any } | null>(null)
  const [notification, setNotification] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' })

  const fetchReviews = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      // CAMBIO: Se agregaron payer_name y payer_cuil a la consulta relacional con users
      .select('*, users(name, email, payer_name, payer_cuil)')
      .eq('status', 'pending')
      .order('date', { ascending: false })
    
    setReviews(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchReviews() }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ show: true, type, message })
      setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000)
  }

  const handleRequestAction = (item: any, type: 'approve' | 'reject') => {
      setConfirmModal({ show: true, type, item })
  }

  const openPreview = (url: string) => {
      if (!url) return
      const isPdf = url.toLowerCase().includes('.pdf')
      setFileType(isPdf ? 'pdf' : 'image')
      setPreviewUrl(url)
  }

  const executeAction = async () => {
      if (!confirmModal) return
      setProcessing(true)
      const { type, item } = confirmModal

      try {
          if (type === 'approve') {
              // 1. OBTENER DATOS FRESCOS PARA CÁLCULO DE CATEGORÍA
              const { data: userData } = await supabase
                  .from('users')
                  .select('birth_date')
                  .eq('id', item.user_id)
                  .single()

              const birthYear = userData?.birth_date ? parseISO(userData.birth_date).getFullYear() : 0
              const currentYear = new Date().getFullYear()
              const age = currentYear - birthYear
              
              let calculatedCategory = 'Mayores'
              if (age < 13) calculatedCategory = 'Infantiles'
              else if (age <= 14) calculatedCategory = 'Menores'
              else if (age <= 16) calculatedCategory = 'Cadetes'
              else if (age <= 18) calculatedCategory = 'Juveniles'

              // 2. APROBAR E INYECTAR SNAPSHOT
              const { error: updateError } = await supabase
                  .from('payments')
                  .update({ 
                    status: 'approved',
                    category_snapshot: calculatedCategory 
                  })
                  .eq('id', item.id)

              if (updateError) throw updateError
              
              showToast(`¡Pago de ${item.users?.name} aprobado!`, 'success')

          } else {
              // Rechazar
              const { error: rejectError } = await supabase
                  .from('payments')
                  .update({ status: 'rejected' })
                  .eq('id', item.id)
              
              if (rejectError) throw rejectError
              showToast('Comprobante rechazado.', 'error')
          }

          setReviews(reviews.filter(r => r.id !== item.id))
          setConfirmModal(null)

      } catch (error: any) {
          console.error(error)
          showToast('Error: ' + error.message, 'error')
      } finally {
          setProcessing(false)
      }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>

  return (
    <div className="space-y-6 relative min-h-screen text-left">
      <h1 className="text-3xl font-black text-gray-800 uppercase italic">Bandeja de Entrada</h1>
      <p className="text-gray-500 font-medium">Comprobantes pendientes de revisión.</p>

      {reviews.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border-2 border-dashed border-gray-300">
            <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3"><Check size={24}/></div>
            <h3 className="text-lg font-bold text-gray-900">¡Todo al día!</h3>
            <p className="text-gray-500">No hay comprobantes pendientes.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => {
                // LÓGICA PARA PROCESAR MÚLTIPLES PAGADORES
                const payerNames = review.users?.payer_name ? review.users.payer_name.split(' / ') : [];
                const payerCuils = review.users?.payer_cuil ? review.users.payer_cuil.split(' / ') : [];

                return (
                <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition text-left">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-gray-900">{review.users?.name || 'Usuario desconocido'}</h3>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-bold">
                                <Calendar size={12}/> {format(parseISO(review.date), 'dd/MM HH:mm')}
                            </p>
                        </div>
                        <span className="bg-blue-100 text-blue-700 text-xs font-black px-2 py-1 rounded-md">
                            ${review.amount.toLocaleString()}
                        </span>
                    </div>

                    {/* SECCIÓN PAGADORES: Se visualiza uno por fila si existen */}
                    {payerNames.length > 0 && (
                      <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 space-y-1">
                        <p className="text-[10px] font-black text-indigo-700 uppercase tracking-tight flex items-center gap-1.5 mb-1">
                          <CreditCard size={12}/> Pagadores registrados:
                        </p>
                        {payerNames.map((name: string, idx: number) => (
                          <div key={idx} className="text-[9px] font-bold text-indigo-600 border-l-2 border-indigo-200 pl-2 ml-1">
                            <span className="uppercase">{name}</span>
                            <span className="text-indigo-400 block">CUIL: {payerCuils[idx] || 'Sin CUIL'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-4 flex-1 flex items-center justify-center bg-white">
                        {review.proof_url ? (
                            <button 
                                onClick={() => openPreview(review.proof_url)}
                                className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors bg-gray-50 px-4 py-2 rounded-lg border hover:border-indigo-300"
                            >
                                <FileText size={16}/> Ver Comprobante
                            </button>
                        ) : (
                            <span className="text-xs text-gray-400 italic">Sin archivo adjunto</span>
                        )}
                    </div>

                    <div className="p-3 grid grid-cols-2 gap-3 border-t bg-gray-50">
                        <button 
                            onClick={() => handleRequestAction(review, 'reject')}
                            className="flex items-center justify-center gap-2 py-2 text-red-600 font-bold hover:bg-red-100 rounded-lg transition text-sm"
                        >
                            <X size={18}/> Rechazar
                        </button>
                        <button 
                            onClick={() => handleRequestAction(review, 'approve')}
                            className="flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition text-sm"
                        >
                            <Check size={18}/> Aprobar
                        </button>
                    </div>
                </div>
                )
            })}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 text-left">
                <div className="flex flex-col items-center text-center">
                    <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${confirmModal.type === 'approve' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {confirmModal.type === 'approve' ? <CheckCircle size={32}/> : <AlertTriangle size={32}/>}
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2 uppercase italic">{confirmModal.type === 'approve' ? '¿Aprobar Pago?' : '¿Rechazar?'}</h3>
                    <p className="text-gray-500 text-sm mb-6 font-medium">
                        {confirmModal.type === 'approve' 
                            ? `Se acreditarán $${confirmModal.item.amount.toLocaleString()} a ${confirmModal.item.users?.name}.`
                            : `El comprobante será marcado como rechazado.`
                        }
                    </p>
                    <div className="grid grid-cols-2 gap-3 w-full text-left">
                        <button disabled={processing} onClick={() => setConfirmModal(null)} className="py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">Cancelar</button>
                        <button disabled={processing} onClick={executeAction} className={`py-3 px-4 text-white font-bold rounded-xl shadow-lg transition flex justify-center items-center gap-2 ${confirmModal.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                            {processing ? <Loader2 className="animate-spin"/> : (confirmModal.type === 'approve' ? 'Sí, Aprobar' : 'Sí, Rechazar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL VISOR */}
      {previewUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm text-left" onClick={() => setPreviewUrl(null)}>
              <div 
                  className={`relative bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-left ${fileType === 'pdf' ? 'w-full max-w-4xl h-[80vh]' : 'w-auto max-w-5xl h-auto'}`} 
                  onClick={e => e.stopPropagation()}
              >
                  <div className="p-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center shrink-0 text-left">
                       <div className="flex items-center gap-3 text-left">
                          <h3 className="font-bold text-gray-800 text-sm uppercase">Comprobante</h3>
                          <a href={previewUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs font-bold bg-indigo-50 px-2 py-1 rounded">
                             <ExternalLink size={12}/> Abrir original
                          </a>
                       </div>
                      <button onClick={() => setPreviewUrl(null)} className="p-1.5 text-gray-600 hover:bg-gray-300 hover:text-black rounded-full transition">
                          <X size={20}/>
                      </button>
                  </div>
                  <div className="flex-1 bg-gray-200 relative flex items-center justify-center p-2 overflow-auto text-left">
                      {fileType === 'image' ? (
                          <img 
                            src={previewUrl} 
                            alt="Comprobante" 
                            className="max-w-full max-h-[80vh] object-contain rounded shadow-sm bg-white" 
                          />
                      ) : (
                          <iframe 
                            src={previewUrl} 
                            className="w-full h-full border-0 rounded bg-white shadow-sm" 
                            title="Comprobante"
                          />
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* TOAST */}
      {notification.show && (
            <div className="fixed bottom-8 right-8 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 border-l-8 bg-white border-green-500 text-left">
                <div className={`${notification.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{notification.type === 'success' ? <CheckCircle size={28} /> : <XCircle size={28} />}</div>
                <div className="text-left"><h4 className={`font-black uppercase text-xs tracking-wider ${notification.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{notification.type === 'success' ? '¡Éxito!' : 'Atención'}</h4><p className="font-bold text-gray-800 text-sm">{notification.message}</p></div>
            </div>
      )}
    </div>
  )
}