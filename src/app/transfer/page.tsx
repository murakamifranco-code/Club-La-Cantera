'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Upload, CheckCircle, Search, Loader2, FileText, AlertTriangle, X, ArrowLeft, Trophy } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function TransferPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-indigo-900"><Loader2 className="animate-spin text-white"/></div>}>
      <TransferContent />
    </Suspense>
  )
}

function TransferContent() {
  const searchParams = useSearchParams()
  const uidFromUrl = searchParams.get('uid')
  // const router = useRouter() // No es necesario si usamos Link

  const [players, setPlayers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [compressing, setCompressing] = useState(false)

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase.from('users').select('id, name').eq('role', 'player').eq('status', 'active').order('name')
      setPlayers(data || [])
      if (uidFromUrl && data) {
          const found = data.find((p: any) => p.id === uidFromUrl)
          if (found) setSelectedPlayer(found)
      }
    }
    fetchPlayers()
  }, [uidFromUrl])

  // Compresión de imagen
  const compressImage = async (imageFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(imageFile)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const MAX_WIDTH = 1000
          const scaleSize = MAX_WIDTH / img.width
          const width = (scaleSize < 1) ? MAX_WIDTH : img.width
          const height = (scaleSize < 1) ? img.height * scaleSize : img.height
          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => {
            if (blob) { resolve(new File([blob], imageFile.name, { type: 'image/jpeg', lastModified: Date.now() })) } 
            else { reject(new Error('Error')) }
          }, 'image/jpeg', 0.7) 
        }
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const originalFile = e.target.files?.[0]
      if (!originalFile) return
      if (originalFile.size > 1 * 1024 * 1024) { alert('⚠ Archivo muy pesado (Máximo 1MB).'); e.target.value = ''; setFile(null); return }
      if (originalFile.type === 'application/pdf') { setFile(originalFile); return }
      if (originalFile.type.startsWith('image/')) {
          setCompressing(true)
          try { const compressed = await compressImage(originalFile); setFile(compressed) } 
          catch (error) { setFile(originalFile) } 
          finally { setCompressing(false) }
      }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlayer || !amount || !file) return alert('Faltan datos')
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${selectedPlayer.id}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
      const { error: dbError } = await supabase.from('pending_payments').insert({
        user_id: selectedPlayer.id, amount: Number(amount), proof_url: publicUrl, status: 'pending'
      })
      if (dbError) throw dbError
      setSuccess(true)
    } catch (error: any) { alert('Error: ' + error.message) } finally { setUploading(false) }
  }

  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

  if (success) return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full animate-in zoom-in duration-300 border-4 border-orange-500">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
          <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase italic">¡Comprobante Enviado!</h2>
          <p className="text-gray-500 mb-6 font-medium">Tu pago está en revisión.</p>
          <div className="space-y-3">
            <button onClick={() => window.location.reload()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition uppercase tracking-wider">Enviar otro</button>
            {uidFromUrl && (
                <Link href="/portal/dashboard" className="block w-full py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition uppercase tracking-wider">
                    Volver al Portal
                </Link>
            )}
          </div>
        </div>
      </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-orange-500 relative overflow-hidden p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-orange-600 rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>
      
      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 overflow-hidden">
        
        {/* HEADER CORREGIDO */}
        <div className="bg-indigo-900 p-4 relative text-white">
            {/* Botón Volver (Z-INDEX 50 para que funcione sí o sí) */}
            {uidFromUrl && (
                <Link 
                  href="/portal/dashboard" 
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-full transition-colors z-50 cursor-pointer"
                >
                    <ArrowLeft size={24} className="text-white drop-shadow-md" />
                </Link>
            )}

            {/* Logo + Texto "La Cantera" */}
            <div className="flex flex-col items-center justify-center pt-2 pb-2">
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-orange-500 overflow-hidden shrink-0">
                        <img src="/logo.png" alt="Escudo" className="h-10 w-10 object-contain rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; document.getElementById('form-fallback')!.style.display = 'flex'; }}/>
                        <div id="form-fallback" className="hidden items-center justify-center text-blue-900"><Trophy size={20} /></div>
                    </div>
                    <div className="text-left">
                         <h1 className="text-xl font-black italic uppercase leading-none">Club La Cantera</h1>
                         <p className="text-xs font-bold text-orange-500 tracking-widest uppercase mt-0.5">Handball</p>
                    </div>
                </div>
                
                <div className="h-0.5 w-12 bg-white/20 rounded-full my-2"></div>
                <h2 className="text-sm font-medium uppercase tracking-widest text-indigo-200">Informar Pago</h2>
            </div>
        </div>
        
        <form onSubmit={handleUpload} className="p-6 space-y-6">
            
            {!uidFromUrl && (
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">¿Quién sos?</label>
                    {!selectedPlayer ? (
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors"/></div>
                            <input type="text" placeholder="Buscar nombre..." className="block w-full pl-10 p-3 border-2 border-gray-100 rounded-xl focus:ring-0 focus:border-orange-500 text-gray-900 bg-gray-50 focus:bg-white transition-all outline-none font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            {searchTerm.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border mt-1 rounded-xl shadow-lg max-h-48 overflow-y-auto">{filteredPlayers.map(p => (<div key={p.id} onClick={() => {setSelectedPlayer(p); setSearchTerm('')}} className="p-3 hover:bg-indigo-50 cursor-pointer text-gray-800 font-medium border-b last:border-0">{p.name}</div>))}</div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-indigo-50 border-2 border-indigo-100 rounded-xl"><span className="font-bold text-indigo-900">{selectedPlayer.name}</span><button type="button" onClick={() => setSelectedPlayer(null)} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-500"><X size={18}/></button></div>
                    )}
                </div>
            )}
            
            {uidFromUrl && selectedPlayer && (
                 <div className="bg-indigo-50 p-4 rounded-xl border-2 border-indigo-100 text-center">
                    <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Reportando para</p>
                    <p className="text-xl font-black text-indigo-900 uppercase italic">{selectedPlayer.name}</p>
                 </div>
            )}

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Monto</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-gray-500 font-bold text-lg group-focus-within:text-orange-500 transition-colors">$</span></div>
                    <input type="number" required min="1" className="block w-full pl-8 p-3 border-2 border-gray-100 rounded-xl focus:ring-0 focus:border-orange-500 text-gray-900 bg-gray-50 focus:bg-white transition-all outline-none font-black text-xl" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Comprobante</label>
                <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition cursor-pointer relative group ${file ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:bg-gray-50 hover:border-indigo-300'}`}>
                    <input type="file" accept="image/*,application/pdf" required className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                    {compressing ? <Loader2 className="animate-spin text-indigo-500"/> : file ? <div className="text-center font-bold text-indigo-600 truncate max-w-[200px]">{file.name}</div> : <div className="text-center text-gray-400 group-hover:text-indigo-500 transition-colors"><Upload size={32} className="mx-auto mb-2"/>Subir PDF o Foto</div>}
                </div>
            </div>

            <button disabled={uploading || compressing || !file} className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black rounded-xl shadow-lg transition transform hover:-translate-y-1 disabled:opacity-50 uppercase tracking-wider">
                {uploading ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin"/> Subiendo...</span> : 'ENVIAR COMPROBANTE'}
            </button>
        </form>
      </div>
    </div>
  )
}