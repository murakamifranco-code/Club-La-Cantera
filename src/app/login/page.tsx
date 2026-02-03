'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, Trophy } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/admin/dashboard')
    } catch (error: any) {
      alert('Error: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-orange-500 relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-orange-600 rounded-full mix-blend-overlay filter blur-[100px] opacity-40"></div>

      <div className="relative w-full max-w-md p-8 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 mx-4">
        
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4 relative">
             <div className="h-28 w-28 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-orange-500 overflow-hidden relative z-10">
                <img 
                    src="/logo.png" 
                    alt="Escudo Club" 
                    // AQUÍ ESTÁ EL CAMBIO: Agregué 'rounded-full' al final
                    className="h-24 w-24 object-contain rounded-full"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        document.getElementById('fallback-icon')!.style.display = 'flex';
                    }}
                />
                <div id="fallback-icon" className="hidden absolute inset-0 items-center justify-center text-blue-900">
                    <Trophy size={40} />
                </div>
             </div>
             
             <div className="absolute -bottom-2 w-20 h-4 bg-black/20 blur-md rounded-full"></div>
          </div>
          
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">
            Club <span className="text-orange-600">Handball</span>
          </h1>
          <p className="text-xs font-bold text-blue-900 mt-1 tracking-widest uppercase">
            Sistema de Gestión 2026
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Usuario</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              </div>
              <input
                type="email"
                required
                className="block w-full pl-10 pr-3 py-3 border-2 border-gray-100 rounded-xl focus:ring-0 focus:border-orange-500 text-gray-900 bg-gray-50 focus:bg-white transition-all outline-none font-medium"
                placeholder="admin@club.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
              </div>
              <input
                type="password"
                required
                className="block w-full pl-10 pr-3 py-3 border-2 border-gray-100 rounded-xl focus:ring-0 focus:border-orange-500 text-gray-900 bg-gray-50 focus:bg-white transition-all outline-none font-medium"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transform hover:-translate-y-1 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin h-5 w-5"/> Cargando...
                </span>
            ) : (
                "Ingresar"
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
             Panel Administrativo &bull; Temp 2026
            </p>
        </div>
      </div>
    </div>
  )
}