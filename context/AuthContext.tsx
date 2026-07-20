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
import { hostToBrand } from '@/lib/brand'
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

const WELCOME_MESSAGE_COACHING = `Bienvenue sur l'app TC Connect 👋

Ravi de vous compter parmi nous ! Vous retrouverez ici votre planning, vos documents, la boutique et la messagerie.

💡 Astuce : pour une vraie expérience d'application (et recevoir les notifications), installez TC Connect sur votre écran d'accueil en vous rendant sur votre Profil.

Bonne découverte, et à très vite ! 🙌`

// Espace Enezo : ni planning ni documents (masqués de cette navigation) — on ne cite que
// ce à quoi le client a réellement accès.
const WELCOME_MESSAGE_ENEZO = `Bienvenue sur votre espace Enezo 👋

Ravi de vous compter parmi nous ! Vous retrouverez ici le suivi de vos projets et contrats, la boutique d'applications, et la messagerie pour échanger directement avec nous.

💡 Astuce : pour une vraie expérience d'application (et recevoir les notifications), installez Enezo sur votre écran d'accueil en vous rendant sur votre Profil.

Bonne découverte, et à très vite ! 🙌`

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let profileUnsub: (() => void) | null = null

    // Filet de sécurité : ne JAMAIS rester bloqué sur le spinner si l'auth ou Firestore
    // ne répond pas (réseau mobile, WebChannel bloqué, persistance IndexedDB iOS…).
    // Au pire, on affiche l'app après ce délai (redirige vers /login si pas de session).
    const safety = setTimeout(() => { setLoading(false) }, 8000)

    const authUnsub = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user)

        if (profileUnsub) { profileUnsub(); profileUnsub = null }

        if (user) {
          profileUnsub = onSnapshot(
            doc(db, 'users', user.uid),
            (snap) => {
              setUserProfile(snap.exists() ? { id: snap.id, ...snap.data() } as User : null)
              setLoading(false)
            },
            (err) => {
              // Lecture du profil impossible (permissions, réseau) → on débloque quand même l'app.
              console.error('[auth] profile snapshot error', err)
              setLoading(false)
            }
          )
        } else {
          setUserProfile(null)
          setLoading(false)
        }
      },
      (err) => {
        console.error('[auth] onAuthStateChanged error', err)
        setLoading(false)
      }
    )

    return () => { clearTimeout(safety); authUnsub(); if (profileUnsub) profileUnsub() }
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
        if (c.prenom || c.nom) userData.display_name = `${c.nom ?? ''} ${c.prenom ?? ''}`.trim()
        if (c.telephone) userData.phone_number = c.telephone
        if (c.dateNaissance) userData.date_naissance = c.dateNaissance
        if (c.adresse) userData.adresse_postale = c.adresse
        if (c.ville) userData.ville_adresse = c.ville
        if (c.codePostal) userData.code_postale_adresse = c.codePostal
        if (c.profession) userData.profession = c.profession
        userData.linkedClientId = clientSnap.docs[0].id
        // Propage l'espace/marque du client vers le compte (source lue par BrandContext).
        if (Array.isArray(c.marques) && c.marques.length) { userData.marques = c.marques; userData.marque = c.marques[0] }
        else if (c.marque) { userData.marques = [c.marque]; userData.marque = c.marque }
      }
    } catch {}

    // Aucune marque héritée d'une fiche client → on retient celle du DOMAINE d'inscription.
    // Sans ça, un compte créé sur app.enezo.fr retombe sur le défaut coaching : navbar
    // « TC Connect », logo coaching, et périmètre de nav coaching au lieu d'Enezo.
    if (!userData.marques && typeof window !== 'undefined') {
      const domainBrand = hostToBrand(window.location.hostname)
      if (domainBrand) { userData.marques = [domainBrand]; userData.marque = domainBrand }
    }

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

      // Notification push aux admins (l'entrée in-app est déjà créée ci-dessus)
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          title: 'Nouveau compte créé',
          body: `${displayName} (${email}) vient de créer un compte.`,
          url: '/clients',
        }),
      }).catch(() => {})

      // Message de bienvenue automatique dans la messagerie (apparaît comme envoyé par le coach)
      const adminIds = adminSnap.docs.map((d) => d.id)
      if (adminIds.length > 0) {
        const discRef = await addDoc(collection(db, 'messagerie'), {
          objet_message: 'Bienvenue 👋',
          service: 'Bienvenue',
          date_create: serverTimestamp(),
          date_last_message: serverTimestamp(),
          participants_ids: [user.uid, ...adminIds],
          non_lus_ids: [user.uid],
          archives_par: [],
        })
        await addDoc(collection(db, 'messagerie', discRef.id, 'messages_messagerie'), {
          ref_user: doc(db, 'usersapp', adminIds[0]),
          message_text: userData.marque === 'enezo' ? WELCOME_MESSAGE_ENEZO : WELCOME_MESSAGE_COACHING,
          date_create: serverTimestamp(),
          document_image_list: [],
          document_pdf_list: [],
          document_video_list: [],
        })
      }
    } catch {}
  }, [])

  const logout = useCallback(async () => {
    // Détache l'abonnement push de cet appareil du compte qui se déconnecte,
    // sinon l'ancien compte continue de recevoir les notifications sur ce téléphone.
    const uid = auth.currentUser?.uid
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
      }
      if (uid) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid }),
        })
      }
    } catch { /* ne jamais bloquer la déconnexion */ }
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    ) : (
      children
    )}
  </AuthContext.Provider>
)
}

export const useAuth = () => useContext(AuthContext)