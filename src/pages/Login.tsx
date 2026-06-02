import React, { useState, useEffect } from 'react';
import { Hospital, ShieldCheck, UserCheck, HelpCircle, Laptop } from 'lucide-react';
import { loginWithGoogle, loginWithCustomToken } from '../lib/firebase';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const [isDev, setIsDev] = useState(false);
  const [mockName, setMockName] = useState('');
  const [mockRun, setMockRun] = useState('');
  const [errorSim, setErrorSim] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingSim, setLoadingSim] = useState(false);
  const [showMismatchModal, setShowMismatchModal] = useState(false);

  const handleGoogleLogin = async () => {
    setGeneralError('');
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Core Google Auth Error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        setGeneralError('La ventana de Google fue cerrada antes de completar el acceso. Por favor, vuelva a intentarlo.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setGeneralError('Se acumularon múltiples ventanas de acceso. Por favor espere o refresque la página.');
      } else if (err.message) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Ocurrió un error inesperado al intentar ingresar con Google.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const [diagnostics, setDiagnostics] = useState<{
    clientId: string;
    redirectUri: string;
    env: string;
    currentHost: string;
    isHostMismatch: boolean;
    instruction: string;
  } | null>(null);
  const [showDiagLogs, setShowDiagLogs] = useState(false);

  useEffect(() => {
    // Detect if we are in development, localhost or preview environment
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isPreview = host.endsWith('.run.app') && !host.includes('cometidos.hospitalcurepto.gob.cl') && !host.includes('cometidos.hospitaldecurepto.gob.cl');
    const isDevelopmentMode = isLocal || isPreview;
    setIsDev(isDevelopmentMode);

    // Always fetch OIDC diagnostics so that administrators can troubleshoot and align Redirect URIs
    fetch('/api/auth/claveunica/diagnostics')
      .then(res => res.json())
      .then(data => setDiagnostics(data))
      .catch(err => console.error('Error fetching OIDC diagnostics:', err));
  }, []);

  const handleMockLogin = async (runVal: string, nameVal: string) => {
    setErrorSim('');
    setLoadingSim(true);
    try {
      const response = await fetch('/api/auth/claveunica/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: runVal, name: nameVal })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fallo en la simulación de token');
      }
      
      // Complete sign-in with custom token
      await loginWithCustomToken(data.customToken);
    } catch (err: any) {
      console.error(err);
      setErrorSim(err.message || 'Error al conectar con la simulación.');
    } finally {
      setLoadingSim(false);
    }
  };
  return (
    <div className="min-h-screen mesh-bg flex flex-col md:flex-row relative overflow-x-hidden font-sans text-white">
      {/* Background patterns */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-40"></div>
      
      {/* Right Section - Login Card (Appears first on mobile) */}
      <div className="w-full md:w-[450px] lg:w-[600px] p-4 md:p-12 flex items-center justify-center relative z-20 order-1 md:order-2">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-[#050a18]/90 backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-14 border border-white/10 shadow-2xl relative my-4 md:my-8"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <ShieldCheck size={200} className="text-blue-600" />
          </div>
          
          <div className="space-y-8 md:space-y-12 relative z-10">
            <div className="bg-white p-3 rounded-2xl w-16 h-16 flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <Hospital size={32} className="text-blue-600" />
            </div>

            <div className="space-y-2 md:space-y-3">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Acceso Institucional</h2>
              <p className="text-slate-400 text-base md:text-lg font-medium tracking-tight">Uso exclusivo para personal del <span className="text-blue-400 font-bold">Hospital de Curepto</span>.</p>
            </div>

            {generalError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs leading-relaxed text-center"
              >
                <p className="font-semibold text-red-400 mb-0.5">⚠️ Error de Autenticación</p>
                <p>{generalError}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                className="w-full group relative cursor-pointer"
                disabled={loadingGoogle}
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-sky-400 rounded-[1.5rem] blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                <div className="relative flex items-center justify-center gap-5 px-8 py-5 md:py-6 bg-white rounded-[1.5rem] text-slate-900 font-black text-lg hover:bg-slate-50 transition-all active:scale-[0.98]">
                  {loadingGoogle ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-slate-900"></div>
                  ) : (
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/02-google-logo-color.png" 
                      className="w-6 h-6 md:w-7 md:h-7" 
                      alt="Google" 
                    />
                  )}
                  <span>{loadingGoogle ? 'Conectando...' : 'Continuar con Google'}</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setGeneralError('');
                  if (diagnostics?.isHostMismatch) {
                    setShowMismatchModal(true);
                  } else {
                    const width = 600;
                    const height = 700;
                    const left = window.screen.width / 2 - width / 2;
                    const top = window.screen.height / 2 - height / 2;
                    const popup = window.open(
                      '/api/auth/claveunica',
                      'claveunica_login',
                      `width=${width},height=${height},left=${left},top=${top},status=no,location=no,toolbar=no,menubar=no`
                    );
                    if (!popup) {
                      // Fallback to direct navigation if popup is blocked
                      window.location.href = '/api/auth/claveunica';
                    }
                  }
                }}
                className="w-full group relative cursor-pointer"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-400 rounded-[1.5rem] blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
                <div className="relative flex items-center justify-center gap-5 px-8 py-5 md:py-6 bg-secondary-900 rounded-[1.5rem] text-white font-black text-lg hover:bg-secondary-800 transition-all active:scale-[0.98] border border-white/10">
                  <img 
                    src="https://claveunica.gob.cl/assets/img/logo-cluev-icon.svg" 
                    className="w-8 h-8" 
                    alt="ClaveÚnica" 
                  />
                  <span>Ingresar con ClaveÚnica</span>
                </div>
              </button>
            </div>

            {isDev && (
              <div className="mt-6 p-6 rounded-2xl bg-slate-900/60 border border-yellow-500/20 shadow-lg space-y-4 relative">
                <div className="flex items-center gap-2 text-yellow-400">
                  <Laptop size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider">Módulo Sandbox (Desarrollo)</span>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed">
                  Estás en el entorno de pruebas. Dado que ClaveÚnica requiere validar el dominio de redirección registrado en el portal de gobierno, usa estas simulaciones rápidas para testear el sistema libremente:
                </p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleMockLogin('15.987.456-3', 'Dr. Cristian Pardo')}
                    disabled={loadingSim}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-white/5 hover:border-blue-500/30 text-xs font-semibold hover:bg-slate-800/80 transition-all text-blue-300 cursor-pointer text-left"
                  >
                    <span>Director (Cristian Pardo)</span>
                    <span className="text-[10px] text-slate-500 font-mono">15.987.456-3</span>
                  </button>

                  <button
                    onClick={() => handleMockLogin('12.345.678-9', 'Juan Pérez')}
                    disabled={loadingSim}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-white/5 hover:border-emerald-500/30 text-xs font-semibold hover:bg-slate-800/80 transition-all text-emerald-300 cursor-pointer text-left"
                  >
                    <span>Jefatura (Juan Pérez)</span>
                    <span className="text-[10px] text-slate-500 font-mono">12.345.678-9</span>
                  </button>

                  <button
                    onClick={() => handleMockLogin('18.765.432-1', 'María González')}
                    disabled={loadingSim}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl border border-white/5 hover:border-cyan-500/30 text-xs font-semibold hover:bg-slate-800/80 transition-all text-cyan-300 cursor-pointer text-left"
                  >
                    <span>Funcionario (María González)</span>
                    <span className="text-[10px] text-slate-500 font-mono">18.765.432-1</span>
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <span className="text-[10px] text-slate-500 block">Presiona cualquier perfil para ingresar simulando el flujo oficial.</span>
                </div>

                {loadingSim && (
                  <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-[11px] text-slate-400">Generando acceso seguro...</p>
                    </div>
                  </div>
                )}

                {errorSim && (
                  <p className="text-xs text-red-400 font-medium text-center">{errorSim}</p>
                )}
              </div>
            )}

            {/* Diagnostics block relocated globally */}
            {diagnostics && (
              <div className="mt-2 p-5 rounded-2xl bg-slate-900/40 border border-white/5 space-y-3 text-left">
                <button
                  type="button"
                  onClick={() => setShowDiagLogs(!showDiagLogs)}
                  className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400 hover:text-white font-bold transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${diagnostics.isHostMismatch ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    Soporte TI - Conexión ClaveÚnica
                  </span>
                  <span>{showDiagLogs ? 'Ocultar' : 'Ver Ajustes'}</span>
                </button>
                
                {showDiagLogs && (
                  <div className="rounded-xl bg-black/40 p-4 font-mono text-[10px] space-y-2 border border-white/5">
                    <div className="flex justify-between border-b border-white/5 pb-1 gap-2">
                      <span className="text-slate-500 shrink-0">CLIENT ID:</span>
                      <span className="text-slate-350 break-all text-right">{diagnostics.clientId}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1 gap-2">
                      <span className="text-slate-500 shrink-0">REDIRECT:</span>
                      <span className="text-blue-400 break-all text-right">{diagnostics.redirectUri}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1 gap-2">
                      <span className="text-slate-500 shrink-0">HOST ACTUAL:</span>
                      <span className="text-yellow-400 break-all text-right">{diagnostics.currentHost}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1 gap-2">
                      <span className="text-slate-500 shrink-0">AMBIENTE:</span>
                      <span className="text-purple-400 uppercase text-right">{diagnostics.env}</span>
                    </div>
                    <div className="text-[10px] text-slate-300 leading-relaxed font-sans mt-2 pt-1 border-t border-white/5">
                      <p className="font-semibold text-amber-300 flex items-center gap-1 mb-1">
                        {diagnostics.isHostMismatch ? '⚠️ Ajuste Requerido' : '✅ Enlace Recomendado'}
                      </p>
                      <p>{diagnostics.instruction}</p>
                      <div className="mt-3 p-2 bg-blue-500/10 rounded border border-blue-500/10 text-slate-200">
                        <span className="font-bold block text-blue-300 mb-0.5">Solución para administradores:</span>
                        Este Redirect URI debe coincidir <strong>exactamente</strong> (carácter por carácter) con el registrado en su panel de administración de ClaveÚnica. Si registró una URL distinta, puede sobreescribirla configurando <code>CLAVEUNICA_REDIRECT_URI</code> en su archivo de configuración <code>.env</code>.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="h-px w-full bg-white/5"></div>

            <div className="bg-blue-600/20 p-6 md:p-8 rounded-[2rem] border border-blue-400/20 shadow-xl">
              <div className="flex gap-3 md:gap-4">
                <ShieldCheck className="shrink-0 text-blue-400" size={20} />
                <p className="text-[10px] md:text-[12px] text-slate-300 font-medium leading-relaxed italic">
                  "Acceso restringido bajo Ley 19.628. La autenticación digital garantiza la protección de datos sensibles institucionales."
                </p>
              </div>
            </div>

            <p className="text-center text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pt-4">
              BRAVOINNOVA INTELLIGENCE © {new Date().getFullYear()}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Left Section - Hero (Appears second on mobile) */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-20 relative z-10 bg-gradient-to-br from-black/0 to-blue-900/5 min-h-[40vh] md:min-h-screen order-2 md:order-1">
        <div className="md:max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-widest mb-6 md:mb-10"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
            Gestión Institucional
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-7xl md:text-[8rem] lg:text-[10rem] xl:text-[12rem] font-black tracking-tighter leading-[0.8] flex flex-col"
          >
            <span className="text-white selection:bg-blue-600 selection:text-white">GESTIÓN</span>
            <span className="text-blue-600/80">COMETIDOS</span>
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 md:mt-16 max-w-xl"
          >
            <p className="text-base md:text-2xl text-slate-500 font-medium leading-tight">
              Hospital de Curepto: Plataforma avanzada para el seguimiento administrativo bajo estándares de eficiencia institucional.
            </p>
            <div className="hidden md:block h-px w-32 bg-blue-600/50 mt-8 md:mt-16"></div>
          </motion.div>
        </div>

        {/* Stats Footer - Hidden or simplified on mobile */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-3 gap-8 mt-12 md:mt-24 border-t border-white/5 pt-8"
        >
          <div>
            <p className="text-xl md:text-5xl font-black text-white/50 tracking-tighter">19.628</p>
            <p className="text-[8px] md:text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-2">Protección</p>
          </div>
          <div>
            <p className="text-xl md:text-5xl font-black text-white/50 tracking-tighter">MINSAL</p>
            <p className="text-[8px] md:text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-2">Protocolo</p>
          </div>
          <div>
            <p className="text-xl md:text-5xl font-black text-white/50 tracking-tighter">V.3.1</p>
            <p className="text-[8px] md:text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-2">System</p>
          </div>
        </motion.div>
      </div>

      {/* OIDC Host Mismatch Dialogue Modal */}
      {showMismatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg bg-[#050a18] border border-yellow-500/30 rounded-[2rem] p-8 md:p-10 shadow-2xl relative"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-2xl shrink-0">
                <Laptop size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Discrepancia de Redirección</h3>
                <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Configuración de OIDC</p>
              </div>
            </div>

            <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed">
              <p>
                ClaveÚnica requiere que la URL de redirección coincida <strong>exactamente</strong> en su consola de administración. Como estás accediendo desde un entorno virtual o de pruebas temporal, ClaveÚnica rechazará la conexión con un error.
              </p>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Redirect URI para registrar en ClaveÚnica:</p>
                <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg">
                  <code className="text-blue-300 text-xs break-all select-all font-mono">
                    {diagnostics?.redirectUri}
                  </code>
                  <button
                    onClick={() => {
                      if (diagnostics?.redirectUri) {
                        navigator.clipboard.writeText(diagnostics.redirectUri);
                        alert("¡Dirección copiada exitosamente al portapapeles!");
                      }
                    }}
                    className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-white bg-blue-600 rounded-lg hover:bg-blue-500 active:scale-95 transition-all cursor-pointer"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-600/10 border border-blue-500/10 text-slate-300 text-[11px]">
                <p className="font-semibold text-blue-400 mb-1">💡 Alternativa Directa:</p>
                <p>
                  Para omitir este requisito de red en desarrollo, utiliza nuestra <strong>Simulación Sandbox</strong> haciendo clic en el botón inferior. Iniciará sesión inmediatamente con un perfil simulado de alta jerarquía.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => {
                  setShowMismatchModal(false);
                  handleMockLogin('15.987.456-3', 'Dr. Cristian Pardo');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
              >
                <UserCheck size={16} />
                Usar Simulación
              </button>

              <button
                onClick={() => {
                  setShowMismatchModal(false);
                  const width = 600;
                  const height = 700;
                  const left = window.screen.width / 2 - width / 2;
                  const top = window.screen.height / 2 - height / 2;
                  const popup = window.open(
                    '/api/auth/claveunica',
                    'claveunica_login',
                    `width=${width},height=${height},left=${left},top=${top},status=no,location=no,toolbar=no,menubar=no`
                  );
                  if (!popup) {
                    window.location.href = '/api/auth/claveunica';
                  }
                }}
                className="px-5 py-3.5 bg-slate-800 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-755 hover:text-white active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Continuar de todos modos
              </button>
            </div>

            <button
              onClick={() => setShowMismatchModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-350 p-2 cursor-pointer transition-colors"
            >
              ✕
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Login;
