import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export const PushNotificationManager: React.FC = () => {
  const { user, profile } = useAuth();
  
  // Guardamos las IDs de cometidos ya notificadas para no repetir
  const notifiedRefs = useRef<Set<string>>(new Set());
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!profile || !user) return;
    
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const unsubs: (() => void)[] = [];
    isInitialMount.current = true;

    // Retrasar la habilitación de notificaciones unos segundos para ignorar la carga inicial
    let allowNotifications = false;
    const timer = setTimeout(() => {
      allowNotifications = true;
    }, 2000);

    const notify = (title: string, body: string, id: string) => {
      if (!allowNotifications) return; // No notificar en carga inicial
      
      const notificationId = `${id}-${title}`;
      if (notifiedRefs.current.has(notificationId)) return;
      
      try {
        new Notification(title, {
          body,
          icon: '/vite.svg',
        });
        notifiedRefs.current.add(notificationId);
      } catch (e) {
        console.error('Error enviando notificación:', e);
      }
    };

    // 1. Notificaciones para Funcionarios (Sus propios cometidos)
    const qFuncionario = query(
      collection(db, 'cometidos'),
      where('funcionarioUid', '==', profile.uid)
    );

    const unsubFuncionario = onSnapshot(qFuncionario, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          notify(
            `Cometido Actualizado`,
            `Tu solicitud a ${data.destino} cambió a: ${data.estado}`,
            `${change.doc.id}-funcionario-${data.estado}`
          );
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'cometidos'));
    
    unsubs.push(unsubFuncionario);

    // 2. Notificaciones para Jefatura
    if (profile.roles?.includes('Jefatura de Servicio')) {
      const qAprobador = query(
        collection(db, 'cometidos'),
        where('estado', '==', 'Pendiente revisión jefatura')
      );

      const unsubAprobador = onSnapshot(qAprobador, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            notify(
              `Nueva solicitud de cometido`,
              `${data.nombreFuncionario} ha solicitado un cometido a ${data.destino}.`,
              `${change.doc.id}-jefatura`
            );
          }
        });
      }, (error) => handleFirestoreError(error, OperationType.GET, 'cometidos'));
      unsubs.push(unsubAprobador);
    }
    
    // 3. Notificaciones para Director
    if (profile.roles?.includes('Director')) {
      const qDirector = query(
        collection(db, 'cometidos'),
        where('estado', '==', 'Pendiente revisión Dirección')
      );

      const unsubDirector = onSnapshot(qDirector, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            notify(
              `Requiere revisión de Dirección`,
              `${data.nombreFuncionario} ha enviado un cometido a ${data.destino} para autorización.`,
              `${change.doc.id}-director`
            );
          }
        });
      }, (error) => handleFirestoreError(error, OperationType.GET, 'cometidos'));
      unsubs.push(unsubDirector);
    }

    return () => {
      clearTimeout(timer);
      unsubs.forEach(unsub => unsub());
    };
  }, [profile, user]);

  return null;
};
