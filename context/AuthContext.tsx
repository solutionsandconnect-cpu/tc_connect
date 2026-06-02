'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, setDoc, updateDoc, addDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { User } from '@/types'

interface AuthContextType {
  currentUser: FirebaseUser | null
  userProfile: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let profileUnsub: (() => void) | null = null

    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)

      if (profileUnsub) { profileUnsub(); profileUnsub = null }

      if (user) {
        profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          setUserProfile(snap.exists() ? { id: snap.id, ...snap.data() } as User : null)
          setLoading(false)
        })
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => { authUnsub(); if (profileUnsub) profileUnsub() }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    try {
      await updateDoc(doc(db, 'users', user.uid), { last_login: serverTimestamp(), lastLoginAt: serverTimestamp() })
    } catch {}
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)

    const userData: Record<string, any> = {
      uid: user.uid,
      email,
      display_name: '',
      photo_url: '',
      phone_number: '',
      nom: '',
      prenom: '',
      role_app: 'Utilisateur',
      actif: true,
      created_time: serverTimestamp(),
      last_login: serverTimestamp(),
    }

    // Recherche d'un client existant avec le même email
    try {
      const clientSnap = await getDocs(query(collection(db, 'clients'), where('email', '==', email)))
      if (!clientSnap.empty) {
        const c = clientSnap.docs[0].data()
        if (c.prenom) userData.prenom = c.prenom
        if (c.nom) userData.nom = c.nom
        if (c.prenom || c.nom) userData.display_name = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim()
        if (c.telephone) userData.phone_number = c.telephone
        if (c.dateNaissance) userData.date_naissance = c.dateNaissance
        if (c.adresse) userData.adresse_postale = c.adresse
        if (c.ville) userData.ville_adresse = c.ville
        if (c.codePostal) userData.code_postale_adresse = c.codePostal
        if (c.profession) userData.profession = c.profession
        userData.linkedClientId = clientSnap.docs[0].id
      }
    } catch {}

    await setDoc(doc(db, 'users', user.uid), userData)

    // Notify all admins of the new registration
    try {
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role_app', '==', 'Admin')))
      const displayName = (userData.display_name as string) || email
      await Promise.all(adminSnap.docs.map((adminDoc) =>
        addDoc(collection(db, 'Notifications'), {
          refUsers: doc(db, 'users', adminDoc.id),
          type_notification: 'NOUVEAU_COMPTE',
          notification: `Nouveau compte créé : ${displayName} (${email})`,
          etat_notification: 'Non lu',
          date_create: serverTimestamp(),
        })
      ))
    } catch {}
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }, [])

  const value = useMemo(
    () => ({ currentUser, userProfile, loading, login, register, logout, resetPassword }),
    [currentUser, userProfile, loading, login, register, logout, resetPassword]
  )

  return (
  <AuthContext.Provider value={value}>
    {loading ? (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    ) : (
      children
    )}
  </AuthContext.Provider>
)
}

export const useAuth = () => useContext(AuthContext)