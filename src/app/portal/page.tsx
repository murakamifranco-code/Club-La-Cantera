'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Loader2, User, Lock, LogIn, AlertCircle, LogOut, 
  CreditCard, Shield, UserCircle, Eye, EyeOff, Download, Share // Agregado Share
} from 'lucide-react'

export default function PortalLogin() {
  const router = useRouter()
  
  const [identifier, setIdentifier] = useState('') 
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [detectedRole, setDetectedRole] = useState<string | null>(null)

  // --- LÓGICA DE INSTALACIÓN (ANDROID + IOS) ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIOS, setIsIOS] = useState(false); // Nuevo estado para iPhone

  useEffect(() => {
    const checkSession = async () => {
        try {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
                const user = data.session.user
                setSessionUser(user)
                localStorage.setItem('club_player_id', user.id)
                const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
                setDetectedRole(profile?.role || null)
            }
            setLoading(false)
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }
    checkSession()

    // DETECTAR SI ES IPHONE/IPAD
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isApple);

    // Escuchador para capturar el evento de instalación (Chrome/Android)
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };
  // -----------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let emailToUse = identifier.trim()
      const isDni = /^\d+$/.test(emailToUse)

      if (isDni) {
          const { data: userData } = await supabase.from('users').select('email').eq('dni', emailToUse).maybeSingle()
          if (!userData) throw new Error('No existe usuario con ese DNI.')
          emailToUse = userData.email
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      })

      if (loginError) {
          const { data: socioDb } = await supabase
            .from('users')
            .select('*')
            .eq('email', emailToUse)
            .maybeSingle()

          if (socioDb && socioDb.dni === password) {
              const { data: newAuth, error: signUpError } = await supabase.auth.signUp({
                  email: emailToUse,
                  password: socioDb.dni,
                  options: { data: { name: socioDb.name, role: 'player' } }
              })

              if (signUpError) throw new Error("Error al habilitar cuenta. Contacte al Admin.")
              
              if (newAuth.user) {
                  await supabase.from('users').update({ id: newAuth.user.id }).eq('email', emailToUse)
                  const { error: finalRetry } = await supabase.auth.signInWithPassword({
                    email: emailToUse,
                    password: socioDb.dni
                  })
                  if (!finalRetry) { window.location.reload(); return; }
              }
          }
          throw loginError
      }

      if (data.user) window.location.reload()

    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Contraseña incorrecta.' : err.message)
      setLoading(false)
    }
  }

  const forceLogout = async () => {
      setLoading(true)
      await supabase.auth.signOut()
      localStorage.clear()
      window.location.reload()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-orange-500"><Loader2 className="animate-spin text-white" size={40}/></div>

  if (sessionUser) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-orange-500 p-4 font-sans text-left">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden text-center animate-in zoom-in-95">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-blue-600"></div>
                <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                    <User size={32} />
                </div>
                <h2 className="text-xl font-black text-gray-900 uppercase leading-none">Hola, {sessionUser.email?.split('@')[0]}</h2>
                <div className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4 ${detectedRole === 'admin' ? 'bg-indigo-100 text-indigo-700' : (detectedRole ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}`}>
                    Rol: {detectedRole === 'admin' ? 'Administrador' : (detectedRole === 'player' ? 'Jugador' : 'Sin Asignar')}
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {detectedRole === 'admin' || detectedRole === 'organizer' ? (
                        <button onClick={() => router.push('/admin/dashboard')} className="w-full py-4 bg-indigo-900 text-white font-bold rounded-xl hover:bg-black transition shadow-lg flex items-center justify-center gap-3 uppercase text-sm">
                            <Shield size={18}/> Ir al Panel Admin
                        </button>
                    ) : (
                         <button onClick={() => router.push('/portal/dashboard')} className="w-full py-4 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition shadow-lg flex items-center justify-center gap-3 uppercase text-sm">
                            <UserCircle size={18}/> Ir a Mi Perfil
                        </button>
                    )}
                    <button onClick={forceLogout} className="w-full py-3 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 transition flex items-center justify-center gap-2 uppercase text-xs">
                        <LogOut size={16}/> Cerrar Sesión
                    </button>
                </div>
            </div>
        </div>
      )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-orange-500 p-4 font-sans text-left">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-blue-600"></div>
        <div className="text-center mb-8 mt-2">
            <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-orange-500 shadow-md p-1">
                <img src="/logo.png" alt="Club" className="h-full w-full object-contain rounded-full" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">CLUB LA CANTERA</h1>

            {/* BOTÓN ANDROID / PC */}
            {showInstallBtn && !isIOS && (
              <button 
                onClick={handleInstallClick}
                className="mt-4 px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 mx-auto hover:bg-orange-200 transition-all animate-bounce border border-orange-200"
              >
                <Download size={14} /> Instalar App del Club
              </button>
            )}

            {/* CARTEL AYUDA IPHONE */}
            {isIOS && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-2xl animate-in fade-in zoom-in duration-500">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-tighter leading-tight flex items-center justify-center gap-2">
                   <Share size={14} className="shrink-0" /> Instalá la App: Tocá compartir y "Agregar al inicio"
                </p>
              </div>
            )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg text-sm font-bold animate-in fade-in text-left">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-1 ml-1">Email o DNI</label>
            <div className="relative">
                {/^\d+$/.test(identifier) && identifier.length > 0 ? (
                   <CreditCard className="absolute left-4 top-3.5 text-indigo-600" size={20}/>
                ) : (
                   <User className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                )}
                <input type="text" required className="w-full pl-12 p-3.5 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 focus:ring-0 font-bold text-gray-800 transition-all placeholder-gray-300" placeholder="Ej: 22333444 o tu@email.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase mb-1 ml-1">Contraseña</label>
            <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20}/>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  className="w-full pl-12 pr-12 p-3.5 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 focus:ring-0 font-bold text-gray-800 transition-all placeholder-gray-300" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 transition shadow-lg transform active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide">
            {loading ? <Loader2 className="animate-spin" /> : <>INGRESAR <LogIn size={20}/></>}
          </button>
        </form>
        <div className="mt-8 text-center pt-6 border-t border-gray-100 text-left">
            <p className="text-gray-400 text-sm font-medium mb-2 text-center">¿Sos nuevo en el club?</p>
            <div className="text-center">
              <Link href="/portal/register" className="text-blue-600 font-black hover:text-blue-800 hover:underline uppercase text-sm">Crear mi cuenta de socio</Link>
            </div>
        </div>
      </div>
    </div>
  )
}