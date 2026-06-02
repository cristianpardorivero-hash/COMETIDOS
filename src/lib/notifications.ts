import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Notificacion } from '../types';

export const sendNotification = async (
  usuarioUid: string,
  titulo: string,
  mensaje: string,
  link?: string
) => {
  try {
    const docRef = doc(collection(db, 'notificaciones'));
    const notificacion: Notificacion = {
      id: docRef.id,
      usuarioUid,
      titulo,
      mensaje,
      leida: false,
      link,
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, notificacion);
  } catch (error) {
    console.error("Error sending notification:", error);
    // Don't throw, notifications are non-critical
  }
};
