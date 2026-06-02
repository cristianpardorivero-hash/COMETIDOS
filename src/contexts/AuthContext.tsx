import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, loginWithCustomToken } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for customToken in URL (for ClaveÚnica flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customToken = params.get('customToken');
    if (customToken) {
      setLoading(true);
      loginWithCustomToken(customToken)
        .then(() => {
          // Clear URL params after successful login
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((error) => {
          console.error('Error signing in with custom token:', error);
          setLoading(false);
        });
    }
  }, []);

  // Listen for success message from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from authorized domains: AI Studio preview, localhost, or production domain
      const origin = event.origin;
      const isAllowed = 
        origin.endsWith('.run.app') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('cometidos.hospitalcurepto.gob.cl') ||
        origin.includes('cometidos.hospitaldecurepto.gob.cl') ||
        origin === window.location.origin;

      if (!isAllowed) {
        return;
      }
      if (event.data?.type === 'CLAVEUNICA_AUTH_SUCCESS' && event.data?.customToken) {
        setLoading(true);
        loginWithCustomToken(event.data.customToken)
          .then(() => {
            console.log('Successfully authenticated via ClaveÚnica popup');
          })
          .catch((error) => {
            console.error('Error signing in with custom token from popup:', error);
            setLoading(false);
          });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchProfile = async (uid: string) => {
    let docRef = doc(db, 'users', uid);
    let docSnap = await getDoc(docRef);
    
    // If not found by UID, try by email (pending user created by admin)
    if (!docSnap.exists() && auth.currentUser?.email) {
      const emailRef = doc(db, 'users', auth.currentUser.email.toLowerCase().trim());
      const emailSnap = await getDoc(emailRef);
      
      if (emailSnap.exists()) {
        const data = emailSnap.data();
        // Migrate data to real UID
        const newProfile = {
          ...data,
          uid: uid,
          isPending: false, // No longer pending
        };
        await setDoc(docRef, newProfile);
        try {
          await deleteDoc(emailRef);
        } catch (e) {
          console.warn("Could not delete legacy email-id doc, this is fine if rules prevent it", e);
        }
        setProfile(newProfile as UserProfile);
        return;
      }
    }

    if (docSnap.exists()) {
      let data = docSnap.data() as any;
      
      // Migrate rol to roles
      if (data.rol && !data.roles) {
        data.roles = [data.rol];
      }
      if (!data.roles) {
        data.roles = ['Funcionario'];
      }

      // Auto-assign high roles for the specified admin email
      if (auth.currentUser?.email === 'cristianpardorivero@gmail.com' && !data.roles.includes('Administrador')) {
        data.roles.push('Administrador');
        updateDoc(docRef, { roles: data.roles });
      }

      setProfile(data as UserProfile);
    } else {
      setProfile(null); 
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
