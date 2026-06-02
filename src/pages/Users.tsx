import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Search, Shield, Activity, MoreHorizontal, MoreVertical, Edit2, Trash2, X, Briefcase, MapPin, ShieldCheck, Info } from 'lucide-react';
import { collection, query, getDocs, orderBy, doc, updateDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, Role } from '../types';

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('nombre'));
      const querySnapshot = await getDocs(q);
      const userList = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      
      // Clean up zombie duplicate users
      const finalUsers: UserProfile[] = [];
      const realEmails = new Set(userList.filter(u => !u.uid.includes('@') && u.email).map(u => u.email.toLowerCase()));
      
      for (const u of userList) {
        if (u.uid.includes('@') && u.email && realEmails.has(u.email.toLowerCase())) {
          // This is a zombie duplicate. Delete it if admin has permission.
          try {
            await deleteDoc(doc(db, 'users', u.uid));
            console.log("Limpiando duplicado zombie:", u.uid);
          } catch (e) {
            console.warn("No se pudo limpiar el duplicado zombie", e);
          }
        } else {
          finalUsers.push(u);
        }
      }
      
      setUsers(finalUsers);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        activo: !user.activo
      });
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const [newUser, setNewUser] = useState<Partial<UserProfile>>({
    nombre: '',
    rut: '',
    email: '',
    servicioId: 'medicina',
    servicioNombre: 'Medicina',
    cargo: '',
    grado: '',
    ley: '',
    planta: '',
    genero: '',
    roles: ['Funcionario'],
    activo: true
  });

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setNewUser({
      nombre: user.nombre || '',
      rut: user.rut || '',
      email: user.email || '',
      servicioId: user.servicioId || 'medicina',
      servicioNombre: user.servicioNombre || 'Medicina',
      cargo: user.cargo || '',
      grado: user.grado || '',
      ley: user.ley || '',
      planta: user.planta || '',
      genero: user.genero || '',
      jefaturaId: user.jefaturaId || '',
      jefaturaNombre: user.jefaturaNombre || '',
      roles: user.roles || ['Funcionario'],
      activo: user.activo ?? true
    });
    setIsModalOpen(true);
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setNewUser({
      nombre: '',
      rut: '',
      email: '',
      servicioId: 'medicina',
      servicioNombre: 'Medicina',
      cargo: '',
      jefaturaId: '',
      jefaturaNombre: '',
      roles: ['Funcionario'],
      activo: true
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        // Edit existing user
        await updateDoc(doc(db, 'users', editingUser.uid), {
          ...newUser
        });
      } else {
        // Create new user
        const userId = newUser.email?.toLowerCase().trim();
        if (!userId) return;
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
          ...newUser,
          uid: userId, // Placeholder until they log in
          isPending: true,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, editingUser ? OperationType.UPDATE : OperationType.CREATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const roles: Role[] = ['Funcionario', 'Jefatura de Servicio', 'Director', 'Personal', 'Finanzas', 'Administrador'];

  const filteredUsers = users.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case 'Administrador': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Director': return 'bg-red-50 text-red-700 border-red-200';
      case 'Finanzas': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Personal': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Jefatura de Servicio': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-500 font-medium mt-1">Administre los funcionarios, roles y permisos del sistema.</p>
        </div>
        <button 
          onClick={handleOpenCreateUser}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-md hover:shadow-slate-300 hover:-translate-y-0.5 active:scale-95"
        >
          <UserPlus size={18} />
          Nuevo Usuario
        </button>
      </motion.div>

      <motion.div variants={itemVariants} className="institutional-card">
         <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-4 bg-slate-50/50">
            <div className="relative flex-1 w-full bg-white rounded-2xl shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                type="text" 
                placeholder="Buscar por nombre, RUT o email..." 
                className="w-full pl-11 pr-4 py-3 bg-transparent outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
               />
            </div>
            <button onClick={fetchUsers} className="p-3 w-full sm:w-auto flex justify-center bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-slate-500 transition-all shadow-sm">
               <Activity size={20} />
            </button>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-black">
                     <th className="px-6 py-4 rounded-tl-2xl">Funcionario</th>
                     <th className="px-6 py-4">Servicio / Cargo</th>
                     <th className="px-6 py-4">Rol en Sistema</th>
                     <th className="px-6 py-4">Estado</th>
                     <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                         <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-900 mx-auto"></div>
                      </td>
                    </tr>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((u, i) => (
                      <motion.tr 
                        key={u.uid} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="hover:bg-slate-50 transition-colors group"
                      >
                        <td className="px-6 py-5 relative">
                           <div 
                             className="cursor-help"
                             onMouseEnter={() => setHoveredUserId(u.uid)}
                             onMouseLeave={() => setHoveredUserId(null)}
                           >
                              <p className="text-sm font-bold text-slate-900">{u.nombre}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                 <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-semibold tracking-tight">{u.rut}</span>
                                 <span className="text-xs text-slate-500 font-medium">{u.email}</span>
                              </div>

                              <AnimatePresence>
                                {hoveredUserId === u.uid && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                    className="absolute left-6 top-full mt-2 z-50 w-72 bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 pointer-events-none ring-1 ring-slate-900/5"
                                  >
                                    <div className="flex flex-col gap-4">
                                      {/* Header with Name and ID */}
                                      <div className="border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3 mb-1">
                                          <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0">
                                            <ShieldCheck size={16} />
                                          </div>
                                          <p className="text-sm font-black text-slate-900 leading-tight">{u.nombre}</p>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-11">{u.rut}</p>
                                      </div>

                                      {/* Detailed Info Grid */}
                                      <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                          <div className="mt-0.5 w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                            <MapPin size={14} />
                                          </div>
                                          <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Servicio / Unidad</p>
                                            <p className="text-xs font-bold text-slate-700">{u.servicioNombre}</p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-start gap-3">
                                          <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                            <Briefcase size={14} />
                                          </div>
                                          <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cargo / Función</p>
                                            <p className="text-xs font-bold text-slate-700">{u.cargo}</p>
                                          </div>
                                        </div>

                                        {u.jefaturaNombre && (
                                          <div className="flex items-start gap-3">
                                            <div className="mt-0.5 w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                              <Shield size={14} />
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Jefatura Directa</p>
                                              <p className="text-xs font-bold text-slate-700">{u.jefaturaNombre}</p>
                                            </div>
                                          </div>
                                        )}

                                        {(u.grado || u.planta) && (
                                          <div className="flex items-start gap-3">
                                            <div className="mt-0.5 w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                              <Info size={14} />
                                            </div>
                                            <div className="flex gap-4">
                                               {u.grado && (
                                                 <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Grado</p>
                                                    <p className="text-xs font-bold text-slate-700">{u.grado}</p>
                                                 </div>
                                               )}
                                               {u.planta && (
                                                 <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Estatuto</p>
                                                    <p className="text-xs font-bold text-slate-700">{u.planta}</p>
                                                 </div>
                                               )}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Assigned Roles Section */}
                                      <div className="pt-4 border-t border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                                          <ShieldCheck size={10} />
                                          Permisos en Sistema
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {u.roles?.map(r => (
                                            <span key={r} className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border border-opacity-30 ${getRoleBadgeColor(r)}`}>
                                              {r}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Arrow */}
                                    <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45"></div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">{u.servicioNombre}</span>
                              <span className="text-xs text-slate-500 font-medium mt-0.5">{u.cargo}</span>
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex flex-wrap gap-1.5">
                              {u.roles?.map(r => (
                                <span key={r} className={`px-2 py-1 rounded text-[9px] uppercase font-bold border tracking-wider shadow-sm ${getRoleBadgeColor(r)}`}>
                                   {r}
                                </span>
                              ))}
                           </div>
                        </td>
                        <td className="px-6 py-5">
                           <button 
                            onClick={() => handleToggleActive(u)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm ${
                             u.activo ? 'bg-emerald-100/50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-red-100/50 text-red-700 border border-red-200 hover:bg-red-100'
                           }`}>
                              {u.activo ? 'Activo' : 'Inactivo'}
                           </button>
                        </td>
                        <td className="px-6 py-5 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleOpenEditUser(u)} className="p-2 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm text-slate-600 hover:text-slate-900 rounded-xl transition-all" title="Editar">
                                <Edit2 size={16} />
                             </button>
                             <button onClick={() => setUserToDelete(u)} className="p-2 hover:bg-red-50 border border-transparent hover:border-red-100 hover:shadow-sm text-slate-400 hover:text-red-600 rounded-xl transition-all" title="Eliminar">
                                <Trash2 size={16} />
                             </button>
                           </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-500 font-medium bg-slate-50/50">
                         No se encontraron funcionarios que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </motion.div>

      {/* Create/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{editingUser ? 'Editar Funcionario' : 'Registrar Nuevo Funcionario'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <input 
                  required
                  type="text"
                  value={newUser.nombre}
                  onChange={e => setNewUser({...newUser, nombre: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all font-medium text-slate-800"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">RUT</label>
                  <input 
                    required
                    type="text"
                    value={newUser.rut}
                    onChange={e => setNewUser({...newUser, rut: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all font-medium text-slate-800"
                    placeholder="12.345.678-9"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Roles Asignados</label>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 border border-slate-200 rounded-2xl shadow-sm">
                    {roles.map(r => (
                      <label key={r} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox"
                            checked={newUser.roles?.includes(r)}
                            onChange={e => {
                              const current = newUser.roles || [];
                              if (e.target.checked) {
                                setNewUser({ ...newUser, roles: [...current, r] });
                              } else {
                                setNewUser({ ...newUser, roles: current.filter(cr => cr !== r) });
                              }
                            }}
                            className="peer w-5 h-5 appearance-none border-2 border-slate-300 rounded focus:ring-0 checked:bg-slate-900 checked:border-slate-900 transition-all"
                          />
                          <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">{r}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Institucional</label>
                <input 
                  required
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  disabled={!!editingUser}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all font-medium text-slate-800 disabled:opacity-60 disabled:bg-slate-100 font-mono"
                  placeholder="usuario@gmail.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Servicio / Unidad</label>
                <select 
                  value={newUser.servicioId}
                  onChange={e => {
                    const s = e.target.selectedOptions[0];
                    setNewUser({...newUser, servicioId: e.target.value, servicioNombre: s.text});
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 transition-all text-sm font-semibold text-slate-800"
                >
                  <option value="direcc">Dirección</option>
                  <option value="medicina">Medicina</option>
                  <option value="urgencias">Urgencias</option>
                  <option value="personal">Personal</option>
                  <option value="finanzas">Finanzas</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo</label>
                <input 
                  required
                  type="text"
                  value={newUser.cargo}
                  onChange={e => setNewUser({...newUser, cargo: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all font-semibold text-slate-800"
                  placeholder="Ej: Enfermero Supervisor"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Grado</label>
                  <input 
                    type="text"
                    value={newUser.grado}
                    onChange={e => setNewUser({...newUser, grado: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 transition-all font-semibold text-slate-800"
                    placeholder="Ej: 15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Género</label>
                  <select 
                    value={newUser.genero}
                    onChange={e => setNewUser({...newUser, genero: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 transition-all font-semibold text-slate-800"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Jefatura Directa (Aprobador)</label>
                <select 
                  value={newUser.jefaturaId}
                  onChange={e => {
                    const s = e.target.selectedOptions[0];
                    setNewUser({...newUser, jefaturaId: e.target.value, jefaturaNombre: s.text});
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:border-slate-900 transition-all text-sm font-semibold text-slate-800"
                >
                  <option value="">Sin jefatura asignada</option>
                  {users.filter(u => u.roles?.some(r => ['Jefatura de Servicio', 'Director', 'Administrador'].includes(r))).map(j => (
                    <option key={j.uid} value={j.uid}>{j.nombre}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 font-medium ml-1">Este usuario recibirá y aprobará los cometidos de este funcionario.</p>
              </div>

              <div className="pt-6 flex gap-3 border-t border-slate-100 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3.5 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-2 px-4 py-3.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
                >
                  {loading ? 'Guardando...' : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center"
          >
            <div className="mx-auto w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
               <Trash2 size={40} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Eliminar Usuario</h3>
            <p className="text-slate-500 text-sm font-medium mb-8">
              ¿Está seguro que desea eliminar a <strong className="text-slate-800">{userToDelete.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-4 py-3.5 rounded-xl font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteUser}
                disabled={loading}
                className="flex-1 px-4 py-3.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 shadow-md shadow-red-200 active:scale-[0.98]"
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Users;
