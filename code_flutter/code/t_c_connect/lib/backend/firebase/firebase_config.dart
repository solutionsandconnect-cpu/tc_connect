import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

Future initFirebase() async {
  if (kIsWeb) {
    await Firebase.initializeApp(
        options: FirebaseOptions(
            apiKey: "AIzaSyCYFoyAAAegbI7VA98i46TF6WlhjfYMjb8",
            authDomain: "t-c-connect-palw1q.firebaseapp.com",
            projectId: "t-c-connect-palw1q",
            storageBucket: "t-c-connect-palw1q.firebasestorage.app",
            messagingSenderId: "150719745178",
            appId: "1:150719745178:web:f653883ca3902408116323"));
  } else {
    await Firebase.initializeApp();
  }
}
