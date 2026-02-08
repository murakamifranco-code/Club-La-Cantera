'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { Users, Info, Loader2, Search, CheckCircle, AlertTriangle, MinusCircle, PlusCircle, Trash2, History, X, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function AdminFees() {
  const [activeTab, setActiveTab] = useState<'massive' | 'manual'>('massive')
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState<{ show: boolean, type: 'success' | 'error', message: string }>({ show: false, type: 'success', message: '' })

  // --- LÓGICA AUTOMÁTICA DE MES ---
  const date = new Date()
  const monthName = date.toLocaleString('es-ES', { month: 'long' })
  const year = date.getFullYear()
  const automaticConcept = `Cuota ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`

  // --- ESTADOS GENERACIÓN MASIVA ---
  const [massiveAmount, setMassiveAmount] = useState('')
  const [feeBatches, setFeeBatches] = useState<any[]>([])
  const isCurrentMonthGenerated = feeBatches.some(batch => batch.name === automaticConcept)

  // --- MODALES ---
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<{show: boolean, batchName: string | null}>({ show: false, batchName: null })

  // --- ESTADOS AJUSTE MANUAL ---
  const [manualUser, setManualUser] = useState<any>(null)
  const [manualAmount, setManualAmount] = useState('')
  const [manualType, setManualType] = useState<'debt' | 'credit'>('debt')
  const [manualNote, setManualNote] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    fetchFeeBatches()
  }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ show: true, type, message })
      setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 3000)
  }

  const fetchFeeBatches = async () => {
      const { data } = await supabase
        .from('payments')
        .select('proof_url, date, amount')
        .eq('method', 'cuota')
        .order('date', { ascending: false })
        .limit(200)

      if (data) {
          const uniqueBatches = new Map()
          data.forEach(item => {
              if (!uniqueBatches.has(item.proof_url)) {
                  uniqueBatches.set(item.proof_url, {
                      name: item.proof_url,
                      date: item.date,
                      amount: Math.abs(item.amount)
                  })
              }
          })
          setFeeBatches(Array.from(uniqueBatches.values()))
      }
  }

  // 1. GENERAR CUOTA MASIVA
  const executeMassiveGeneration = async () => {
      setLoading(true)
      setShowConfirmModal(false)

      try {
          if (isCurrentMonthGenerated) {
              throw new Error(`La ${automaticConcept} ya fue generada.`)
          }

          // MODIFICADO: Ahora traemos también la 'category' actual del socio
          const { data: players, error: playersError } = await supabase
              .from('users')
              .select('id, account_balance, category')
              .eq('role', 'player')
              .eq('status', 'active')
          
          if (playersError) throw playersError
          if (!players || players.length === 0) throw new Error("No hay jugadores activos.")

          const amount = parseFloat(massiveAmount)
          
          const records = players.map(p => ({
              user_id: p.id,
              amount: -amount,
              method: 'cuota',
              date: new Date().toISOString(),
              status: 'completed',
              proof_url: automaticConcept,
              category_snapshot: p.category // MODIFICADO: Se guarda la categoría en el snapshot
          }))

          const { error: insertError } = await supabase.from('payments').insert(records)
          if (insertError) throw insertError

          for (const p of players) {
              const currentBalance = p.account_balance || 0
              await supabase.from('users').update({ 
                  account_balance: currentBalance - amount 
              }).eq('id', p.id)
          }

          showToast(`¡Éxito! ${automaticConcept} generada a ${players.length} socios.`, 'success')
          setMassiveAmount('')
          fetchFeeBatches()

      } catch (error: any) {
          showToast(error.message, 'error')
      } finally {
          setLoading(false)
      }
  }

  // 2. DESHACER LOTE
  const executeDeleteBatch = async () => {
      const batchName = showDeleteModal.batchName
      if (!batchName) return

      setLoading(true)
      setShowDeleteModal({ show: false, batchName: null })

      try {
          const { error: deleteError } = await supabase
            .from('payments')
            .delete()
            .eq('method', 'cuota')
            .eq('proof_url', batchName)

          if (deleteError) throw deleteError

          showToast(`Lote "${batchName}" eliminado y saldos restaurados.`, 'success')
          fetchFeeBatches()

      } catch (error: any) {
          showToast('Error al deshacer: ' + error.message, 'error')
      } finally {
          setLoading(false)
      }
  }

  // --- LÓGICA MANUAL ---
  const handleSearch = async (term: string) => {
    setSearchTerm(term)
    if (term.length < 3) { setSearchResults([]); return }
    // MODIFICADO: Ahora busca por 'cuil' en lugar de 'dni'
    const { data } = await supabase.from('users').select('id, name, cuil, account_balance').eq('role', 'player').or(`name.ilike.%${term}%,cuil.ilike.%${term}%`).limit(5)
    setSearchResults(data || [])
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!manualUser || !manualAmount) return
      setLoading(true)
      try {
          const amountVal = parseFloat(manualAmount)
          const finalAmount = manualType === 'debt' ? -amountVal : amountVal
          
          const { error: insertError } = await supabase.from('payments').insert({
              user_id: manualUser.id,
              amount: finalAmount,
              method: 'adjustment',
              date: new Date().toISOString(),
              status: 'completed',
              notes: manualNote,
              proof_url: null
          })

          if (insertError) throw insertError

          const currentBalance = manualUser.account_balance || 0
          const { error: updateError } = await supabase.from('users').update({ 
              account_balance: currentBalance + finalAmount 
          }).eq('id', manualUser.id)
          
          if (updateError) throw updateError

          showToast(`Ajuste aplicado a ${manualUser.name}`, 'success')
          setManualUser(null); setManualAmount(''); setManualNote(''); setSearchTerm(''); setSearchResults([])
      } catch (error: any) { showToast(error.message, 'error') } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 min-h-screen pb-10 font-sans text-left">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
            Gestión de Cuotas
        </h1>
        <p className="text-gray-500 mt-1">
            Control total de la facturación del club.
        </p>
      </div>

      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit border border-gray-200">
          <button onClick={() => setActiveTab('massive')} className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'massive' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>Generación Masiva</button>
          <button onClick={() => setActiveTab('manual')} className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === 'manual' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>Ajuste Individual</button>
      </div>

      {activeTab === 'massive' ? (
          <div className="space-y-8 animate-in fade-in">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-3xl relative overflow-hidden text-left">
                  <div className="flex items-center gap-4 mb-6 p-4 bg-red-50 text-red-800 rounded-lg border border-red-100">
                      <div className="bg-white p-2 rounded-full shadow-sm"><Users size={20} className="text-red-500"/></div>
                      <div>
                          <h3 className="font-bold text-sm uppercase">Cuota Mensual Automática</h3>
                          <p className="text-xs mt-1">Se generará deuda en <span className="text-red-600 font-bold">ROJO</span> a todos los activos para el mes actual.</p>
                      </div>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); setShowConfirmModal(true) }} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Monto ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-gray-400 font-bold text-lg">$</span>
                                <input 
                                    type="number" required min="1" 
                                    disabled={isCurrentMonthGenerated}
                                    className="w-full pl-9 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 transition-all" 
                                    placeholder="0" value={massiveAmount} onChange={e => setMassiveAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Concepto (Automático)</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3.5 text-gray-400" size={18}/>
                                <input 
                                    type="text" disabled 
                                    className="w-full pl-10 p-3 border border-gray-300 rounded-lg bg-gray-100 font-bold text-gray-700 cursor-not-allowed" 
                                    value={automaticConcept}
                                />
                            </div>
                        </div>
                      </div>
                      
                      {isCurrentMonthGenerated ? (
                          <div className="w-full py-3 bg-green-50 text-green-700 font-bold rounded-lg text-center border border-green-200 flex items-center justify-center gap-2 animate-in fade-in">
                              <CheckCircle size={20}/> La cuota de este mes ya fue generada.
                          </div>
                      ) : (
                          <button disabled={loading || !massiveAmount} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed font-black uppercase text-sm">
                              {loading ? <Loader2 className="animate-spin"/> : 'Confirmar y Generar'}
                          </button>
                      )}
                  </form>
              </div>

              <div className="max-w-3xl">
                  <h3 className="font-bold text-gray-800 text-sm uppercase mb-4 flex items-center gap-2"><History size={18}/> Historial de Lotes</h3>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {feeBatches.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm font-medium">No hay historial de cuotas recientes.</div>
                      ) : (
                          <div className="divide-y divide-gray-100">
                              {feeBatches.map((batch, index) => (
                                  <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                                      <div className="flex items-center gap-4">
                                          <div className="h-10 w-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center font-bold text-xs border border-gray-200 uppercase">
                                              {format(parseISO(batch.date), 'MMM', { locale: es })}
                                          </div>
                                          <div>
                                              <p className="font-bold text-gray-900 text-sm">{batch.name}</p>
                                              <p className="text-xs text-gray-500">
                                                  Generada el {format(parseISO(batch.date), 'dd/MM/yyyy', { locale: es })} • <span className="text-red-600 font-bold">${batch.amount.toLocaleString()}</span>
                                              </p>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => setShowDeleteModal({ show: true, batchName: batch.name })}
                                          disabled={loading}
                                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 rounded-lg text-xs font-bold transition shadow-sm"
                                      >
                                          <Trash2 size={14}/> Eliminar
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      ) : (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-3xl animate-in fade-in text-left">
              <div className="flex items-center gap-4 mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                  <div className="bg-white p-2 rounded-full shadow-sm"><Info size={20} className="text-blue-500"/></div>
                  <div>
                      <h3 className="font-bold text-sm uppercase">Ajuste Manual</h3>
                      <p className="text-xs mt-1">Usalo para casos puntuales. Aparecerá en <span className="text-blue-600 font-bold">AZUL</span>.</p>
                  </div>
              </div>

              <div className="space-y-6">
                {!manualUser ? (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Buscar Jugador</label>
                        <div className="relative"><Search className="absolute left-3 top-3.5 text-gray-400" size={18}/><input type="text" className="w-full pl-10 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900" placeholder="Nombre o CUIL..." value={searchTerm} onChange={e => handleSearch(e.target.value)}/></div>
                        {searchResults.length > 0 && (
                            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden shadow-lg">{searchResults.map(u => (
                                <div key={u.id} onClick={() => {setManualUser(u); setSearchTerm(''); setSearchResults([])}} className="p-3 bg-white hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between items-center group text-left"><span className="font-medium text-gray-800 group-hover:text-indigo-700 transition">{u.name}</span><span className={`text-xs font-bold px-2 py-0.5 rounded ${u.account_balance < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>${u.account_balance}</span></div>
                            ))}</div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 border border-indigo-200 rounded-lg flex justify-between items-center bg-indigo-50">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{manualUser.name.charAt(0)}</div>
                            <div><p className="font-bold text-gray-900 text-sm">{manualUser.name}</p><p className={`text-xs font-semibold ${manualUser.account_balance < 0 ? 'text-red-500' : 'text-green-600'}`}>Saldo actual: ${manualUser.account_balance}</p></div>
                        </div>
                        <button onClick={() => setManualUser(null)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline">Cambiar Jugador</button>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setManualType('debt')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${manualType === 'debt' ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500' : 'border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:text-red-400'}`}><MinusCircle size={24}/> <span className="font-bold text-xs uppercase">Generar Deuda</span></button>
                    <button type="button" onClick={() => setManualType('credit')} className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${manualType === 'credit' ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500' : 'border-gray-200 bg-white text-gray-400 hover:border-green-200 hover:text-green-400'}`}><PlusCircle size={24}/> <span className="font-bold text-xs uppercase">Bonificación</span></button>
                </div>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Monto</label><div className="relative"><span className="absolute left-3 top-3.5 text-gray-400 font-bold text-lg">$</span><input type="number" required min="1" className="w-full pl-9 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-lg text-gray-900" value={manualAmount} onChange={e => setManualAmount(e.target.value)}/></div></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Motivo</label><input type="text" required placeholder={manualType === 'debt' ? 'Ej: Camiseta' : 'Ej: Descuento'} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-900" value={manualNote} onChange={e => setManualNote(e.target.value)}/></div>
                    </div>
                    <button disabled={loading || !manualUser} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm font-black uppercase text-sm">{loading ? <Loader2 className="animate-spin"/> : 'Aplicar Ajuste'}</button>
                </form>
              </div>
          </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in text-left">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full animate-in zoom-in-95 relative overflow-hidden">
                <div className="flex flex-col items-center text-center">
                    <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4"><AlertTriangle size={32}/></div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¿Confirmás la Cuota?</h3>
                    <p className="text-gray-500 text-sm mb-6">
                        Vas a generar una deuda de <strong className="text-gray-900">${massiveAmount}</strong> a TODOS los socios activos bajo el concepto:
                        <br/><span className="bg-gray-100 text-gray-800 px-2 py-1 rounded mt-2 inline-block font-medium">{automaticConcept}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <button onClick={() => setShowConfirmModal(false)} className="py-2.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                        <button onClick={executeMassiveGeneration} className="py-2.5 px-4 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition flex justify-center">{loading ? <Loader2 className="animate-spin"/> : 'Confirmar'}</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {showDeleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in text-left">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full animate-in zoom-in-95 relative overflow-hidden">
                <div className="flex flex-col items-center text-center">
                    <div className="h-16 w-16 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mb-4"><Trash2 size={32}/></div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">¿Eliminar Lote?</h3>
                    <p className="text-gray-500 text-sm mb-6">
                        Estás por borrar el lote <strong>"{showDeleteModal.batchName}"</strong>.
                        <br/><span className="text-red-600 font-bold block mt-2">Se devolverá el dinero a los socios.</span>
                    </p>
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <button onClick={() => setShowDeleteModal({show: false, batchName: null})} className="py-2.5 px-4 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                        <button onClick={executeDeleteBatch} className="py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition flex justify-center">{loading ? <Loader2 className="animate-spin"/> : 'Eliminar'}</button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {notification.show && (
            <div className={`fixed bottom-8 right-8 z-[60] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 border-l-4 ${notification.type === 'success' ? 'bg-white border-green-500' : 'bg-white border-red-500'} text-left`}>
                {notification.type === 'success' ? <CheckCircle size={24} className="text-green-500"/> : <AlertTriangle size={24} className="text-red-500"/>}
                <div><h4 className="font-bold text-sm text-gray-900">{notification.type === 'success' ? '¡Hecho!' : 'Error'}</h4><p className="text-gray-500 text-xs">{notification.message}</p></div>
            </div>
      )}
    </div>
  )
}