import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class UsersRecord extends FirestoreRecord {
  UsersRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "email" field.
  String? _email;
  String get email => _email ?? '';
  bool hasEmail() => _email != null;

  // "display_name" field.
  String? _displayName;
  String get displayName => _displayName ?? '';
  bool hasDisplayName() => _displayName != null;

  // "photo_url" field.
  String? _photoUrl;
  String get photoUrl => _photoUrl ?? '';
  bool hasPhotoUrl() => _photoUrl != null;

  // "uid" field.
  String? _uid;
  String get uid => _uid ?? '';
  bool hasUid() => _uid != null;

  // "created_time" field.
  DateTime? _createdTime;
  DateTime? get createdTime => _createdTime;
  bool hasCreatedTime() => _createdTime != null;

  // "phone_number" field.
  String? _phoneNumber;
  String get phoneNumber => _phoneNumber ?? '';
  bool hasPhoneNumber() => _phoneNumber != null;

  // "nom" field.
  String? _nom;
  String get nom => _nom ?? '';
  bool hasNom() => _nom != null;

  // "prenom" field.
  String? _prenom;
  String get prenom => _prenom ?? '';
  bool hasPrenom() => _prenom != null;

  // "actif" field.
  bool? _actif;
  bool get actif => _actif ?? false;
  bool hasActif() => _actif != null;

  // "adresse_postale" field.
  String? _adressePostale;
  String get adressePostale => _adressePostale ?? '';
  bool hasAdressePostale() => _adressePostale != null;

  // "rue_adresse" field.
  String? _rueAdresse;
  String get rueAdresse => _rueAdresse ?? '';
  bool hasRueAdresse() => _rueAdresse != null;

  // "code_postale_adresse" field.
  String? _codePostaleAdresse;
  String get codePostaleAdresse => _codePostaleAdresse ?? '';
  bool hasCodePostaleAdresse() => _codePostaleAdresse != null;

  // "ville_adresse" field.
  String? _villeAdresse;
  String get villeAdresse => _villeAdresse ?? '';
  bool hasVilleAdresse() => _villeAdresse != null;

  // "genre" field.
  String? _genre;
  String get genre => _genre ?? '';
  bool hasGenre() => _genre != null;

  // "type_client" field.
  String? _typeClient;
  String get typeClient => _typeClient ?? '';
  bool hasTypeClient() => _typeClient != null;

  // "etat_client" field.
  String? _etatClient;
  String get etatClient => _etatClient ?? '';
  bool hasEtatClient() => _etatClient != null;

  // "role_app" field.
  RoleApp? _roleApp;
  RoleApp? get roleApp => _roleApp;
  bool hasRoleApp() => _roleApp != null;

  // "last_login" field.
  DateTime? _lastLogin;
  DateTime? get lastLogin => _lastLogin;
  bool hasLastLogin() => _lastLogin != null;

  // "date_naissance" field.
  DateTime? _dateNaissance;
  DateTime? get dateNaissance => _dateNaissance;
  bool hasDateNaissance() => _dateNaissance != null;

  // "decouverte_tc" field.
  String? _decouverteTc;
  String get decouverteTc => _decouverteTc ?? '';
  bool hasDecouverteTc() => _decouverteTc != null;

  // "siret" field.
  String? _siret;
  String get siret => _siret ?? '';
  bool hasSiret() => _siret != null;

  // "infos" field.
  String? _infos;
  String get infos => _infos ?? '';
  bool hasInfos() => _infos != null;

  // "indicatif_tel" field.
  String? _indicatifTel;
  String get indicatifTel => _indicatifTel ?? '';
  bool hasIndicatifTel() => _indicatifTel != null;

  // "nb_km" field.
  double? _nbKm;
  double get nbKm => _nbKm ?? 0.0;
  bool hasNbKm() => _nbKm != null;

  // "temps_route" field.
  String? _tempsRoute;
  String get tempsRoute => _tempsRoute ?? '';
  bool hasTempsRoute() => _tempsRoute != null;

  // "mdp_initial" field.
  String? _mdpInitial;
  String get mdpInitial => _mdpInitial ?? '';
  bool hasMdpInitial() => _mdpInitial != null;

  // "categorie_client" field.
  String? _categorieClient;
  String get categorieClient => _categorieClient ?? '';
  bool hasCategorieClient() => _categorieClient != null;

  // "dernier_changement_etat" field.
  DateTime? _dernierChangementEtat;
  DateTime? get dernierChangementEtat => _dernierChangementEtat;
  bool hasDernierChangementEtat() => _dernierChangementEtat != null;

  void _initializeFields() {
    _email = snapshotData['email'] as String?;
    _displayName = snapshotData['display_name'] as String?;
    _photoUrl = snapshotData['photo_url'] as String?;
    _uid = snapshotData['uid'] as String?;
    _createdTime = snapshotData['created_time'] as DateTime?;
    _phoneNumber = snapshotData['phone_number'] as String?;
    _nom = snapshotData['nom'] as String?;
    _prenom = snapshotData['prenom'] as String?;
    _actif = snapshotData['actif'] as bool?;
    _adressePostale = snapshotData['adresse_postale'] as String?;
    _rueAdresse = snapshotData['rue_adresse'] as String?;
    _codePostaleAdresse = snapshotData['code_postale_adresse'] as String?;
    _villeAdresse = snapshotData['ville_adresse'] as String?;
    _genre = snapshotData['genre'] as String?;
    _typeClient = snapshotData['type_client'] as String?;
    _etatClient = snapshotData['etat_client'] as String?;
    _roleApp = snapshotData['role_app'] is RoleApp
        ? snapshotData['role_app']
        : deserializeEnum<RoleApp>(snapshotData['role_app']);
    _lastLogin = snapshotData['last_login'] as DateTime?;
    _dateNaissance = snapshotData['date_naissance'] as DateTime?;
    _decouverteTc = snapshotData['decouverte_tc'] as String?;
    _siret = snapshotData['siret'] as String?;
    _infos = snapshotData['infos'] as String?;
    _indicatifTel = snapshotData['indicatif_tel'] as String?;
    _nbKm = castToType<double>(snapshotData['nb_km']);
    _tempsRoute = snapshotData['temps_route'] as String?;
    _mdpInitial = snapshotData['mdp_initial'] as String?;
    _categorieClient = snapshotData['categorie_client'] as String?;
    _dernierChangementEtat =
        snapshotData['dernier_changement_etat'] as DateTime?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('users');

  static Stream<UsersRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => UsersRecord.fromSnapshot(s));

  static Future<UsersRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => UsersRecord.fromSnapshot(s));

  static UsersRecord fromSnapshot(DocumentSnapshot snapshot) => UsersRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static UsersRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      UsersRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'UsersRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is UsersRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createUsersRecordData({
  String? email,
  String? displayName,
  String? photoUrl,
  String? uid,
  DateTime? createdTime,
  String? phoneNumber,
  String? nom,
  String? prenom,
  bool? actif,
  String? adressePostale,
  String? rueAdresse,
  String? codePostaleAdresse,
  String? villeAdresse,
  String? genre,
  String? typeClient,
  String? etatClient,
  RoleApp? roleApp,
  DateTime? lastLogin,
  DateTime? dateNaissance,
  String? decouverteTc,
  String? siret,
  String? infos,
  String? indicatifTel,
  double? nbKm,
  String? tempsRoute,
  String? mdpInitial,
  String? categorieClient,
  DateTime? dernierChangementEtat,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'email': email,
      'display_name': displayName,
      'photo_url': photoUrl,
      'uid': uid,
      'created_time': createdTime,
      'phone_number': phoneNumber,
      'nom': nom,
      'prenom': prenom,
      'actif': actif,
      'adresse_postale': adressePostale,
      'rue_adresse': rueAdresse,
      'code_postale_adresse': codePostaleAdresse,
      'ville_adresse': villeAdresse,
      'genre': genre,
      'type_client': typeClient,
      'etat_client': etatClient,
      'role_app': roleApp,
      'last_login': lastLogin,
      'date_naissance': dateNaissance,
      'decouverte_tc': decouverteTc,
      'siret': siret,
      'infos': infos,
      'indicatif_tel': indicatifTel,
      'nb_km': nbKm,
      'temps_route': tempsRoute,
      'mdp_initial': mdpInitial,
      'categorie_client': categorieClient,
      'dernier_changement_etat': dernierChangementEtat,
    }.withoutNulls,
  );

  return firestoreData;
}

class UsersRecordDocumentEquality implements Equality<UsersRecord> {
  const UsersRecordDocumentEquality();

  @override
  bool equals(UsersRecord? e1, UsersRecord? e2) {
    return e1?.email == e2?.email &&
        e1?.displayName == e2?.displayName &&
        e1?.photoUrl == e2?.photoUrl &&
        e1?.uid == e2?.uid &&
        e1?.createdTime == e2?.createdTime &&
        e1?.phoneNumber == e2?.phoneNumber &&
        e1?.nom == e2?.nom &&
        e1?.prenom == e2?.prenom &&
        e1?.actif == e2?.actif &&
        e1?.adressePostale == e2?.adressePostale &&
        e1?.rueAdresse == e2?.rueAdresse &&
        e1?.codePostaleAdresse == e2?.codePostaleAdresse &&
        e1?.villeAdresse == e2?.villeAdresse &&
        e1?.genre == e2?.genre &&
        e1?.typeClient == e2?.typeClient &&
        e1?.etatClient == e2?.etatClient &&
        e1?.roleApp == e2?.roleApp &&
        e1?.lastLogin == e2?.lastLogin &&
        e1?.dateNaissance == e2?.dateNaissance &&
        e1?.decouverteTc == e2?.decouverteTc &&
        e1?.siret == e2?.siret &&
        e1?.infos == e2?.infos &&
        e1?.indicatifTel == e2?.indicatifTel &&
        e1?.nbKm == e2?.nbKm &&
        e1?.tempsRoute == e2?.tempsRoute &&
        e1?.mdpInitial == e2?.mdpInitial &&
        e1?.categorieClient == e2?.categorieClient &&
        e1?.dernierChangementEtat == e2?.dernierChangementEtat;
  }

  @override
  int hash(UsersRecord? e) => const ListEquality().hash([
        e?.email,
        e?.displayName,
        e?.photoUrl,
        e?.uid,
        e?.createdTime,
        e?.phoneNumber,
        e?.nom,
        e?.prenom,
        e?.actif,
        e?.adressePostale,
        e?.rueAdresse,
        e?.codePostaleAdresse,
        e?.villeAdresse,
        e?.genre,
        e?.typeClient,
        e?.etatClient,
        e?.roleApp,
        e?.lastLogin,
        e?.dateNaissance,
        e?.decouverteTc,
        e?.siret,
        e?.infos,
        e?.indicatifTel,
        e?.nbKm,
        e?.tempsRoute,
        e?.mdpInitial,
        e?.categorieClient,
        e?.dernierChangementEtat
      ]);

  @override
  bool isValidKey(Object? o) => o is UsersRecord;
}
