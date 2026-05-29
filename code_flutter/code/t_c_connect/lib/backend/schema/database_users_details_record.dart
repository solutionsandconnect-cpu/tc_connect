import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class DatabaseUsersDetailsRecord extends FirestoreRecord {
  DatabaseUsersDetailsRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "categorie_prestation" field.
  String? _categoriePrestation;
  String get categoriePrestation => _categoriePrestation ?? '';
  bool hasCategoriePrestation() => _categoriePrestation != null;

  // "type_suivi" field.
  String? _typeSuivi;
  String get typeSuivi => _typeSuivi ?? '';
  bool hasTypeSuivi() => _typeSuivi != null;

  // "resume_suivi" field.
  String? _resumeSuivi;
  String get resumeSuivi => _resumeSuivi ?? '';
  bool hasResumeSuivi() => _resumeSuivi != null;

  // "objectifs" field.
  String? _objectifs;
  String get objectifs => _objectifs ?? '';
  bool hasObjectifs() => _objectifs != null;

  // "date_debut" field.
  DateTime? _dateDebut;
  DateTime? get dateDebut => _dateDebut;
  bool hasDateDebut() => _dateDebut != null;

  // "date_fin" field.
  DateTime? _dateFin;
  DateTime? get dateFin => _dateFin;
  bool hasDateFin() => _dateFin != null;

  // "indications" field.
  String? _indications;
  String get indications => _indications ?? '';
  bool hasIndications() => _indications != null;

  // "arret_suivi" field.
  String? _arretSuivi;
  String get arretSuivi => _arretSuivi ?? '';
  bool hasArretSuivi() => _arretSuivi != null;

  // "etat" field.
  String? _etat;
  String get etat => _etat ?? '';
  bool hasEtat() => _etat != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "refUsers" field.
  DocumentReference? _refUsers;
  DocumentReference? get refUsers => _refUsers;
  bool hasRefUsers() => _refUsers != null;

  // "titre_abo" field.
  String? _titreAbo;
  String get titreAbo => _titreAbo ?? '';
  bool hasTitreAbo() => _titreAbo != null;

  // "num_suivi" field.
  int? _numSuivi;
  int get numSuivi => _numSuivi ?? 0;
  bool hasNumSuivi() => _numSuivi != null;

  void _initializeFields() {
    _categoriePrestation = snapshotData['categorie_prestation'] as String?;
    _typeSuivi = snapshotData['type_suivi'] as String?;
    _resumeSuivi = snapshotData['resume_suivi'] as String?;
    _objectifs = snapshotData['objectifs'] as String?;
    _dateDebut = snapshotData['date_debut'] as DateTime?;
    _dateFin = snapshotData['date_fin'] as DateTime?;
    _indications = snapshotData['indications'] as String?;
    _arretSuivi = snapshotData['arret_suivi'] as String?;
    _etat = snapshotData['etat'] as String?;
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _refUsers = snapshotData['refUsers'] as DocumentReference?;
    _titreAbo = snapshotData['titre_abo'] as String?;
    _numSuivi = castToType<int>(snapshotData['num_suivi']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('database_users_details');

  static Stream<DatabaseUsersDetailsRecord> getDocument(
          DocumentReference ref) =>
      ref.snapshots().map((s) => DatabaseUsersDetailsRecord.fromSnapshot(s));

  static Future<DatabaseUsersDetailsRecord> getDocumentOnce(
          DocumentReference ref) =>
      ref.get().then((s) => DatabaseUsersDetailsRecord.fromSnapshot(s));

  static DatabaseUsersDetailsRecord fromSnapshot(DocumentSnapshot snapshot) =>
      DatabaseUsersDetailsRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static DatabaseUsersDetailsRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      DatabaseUsersDetailsRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'DatabaseUsersDetailsRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is DatabaseUsersDetailsRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createDatabaseUsersDetailsRecordData({
  String? categoriePrestation,
  String? typeSuivi,
  String? resumeSuivi,
  String? objectifs,
  DateTime? dateDebut,
  DateTime? dateFin,
  String? indications,
  String? arretSuivi,
  String? etat,
  DateTime? dateCreate,
  DocumentReference? refUsers,
  String? titreAbo,
  int? numSuivi,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'categorie_prestation': categoriePrestation,
      'type_suivi': typeSuivi,
      'resume_suivi': resumeSuivi,
      'objectifs': objectifs,
      'date_debut': dateDebut,
      'date_fin': dateFin,
      'indications': indications,
      'arret_suivi': arretSuivi,
      'etat': etat,
      'date_create': dateCreate,
      'refUsers': refUsers,
      'titre_abo': titreAbo,
      'num_suivi': numSuivi,
    }.withoutNulls,
  );

  return firestoreData;
}

class DatabaseUsersDetailsRecordDocumentEquality
    implements Equality<DatabaseUsersDetailsRecord> {
  const DatabaseUsersDetailsRecordDocumentEquality();

  @override
  bool equals(DatabaseUsersDetailsRecord? e1, DatabaseUsersDetailsRecord? e2) {
    return e1?.categoriePrestation == e2?.categoriePrestation &&
        e1?.typeSuivi == e2?.typeSuivi &&
        e1?.resumeSuivi == e2?.resumeSuivi &&
        e1?.objectifs == e2?.objectifs &&
        e1?.dateDebut == e2?.dateDebut &&
        e1?.dateFin == e2?.dateFin &&
        e1?.indications == e2?.indications &&
        e1?.arretSuivi == e2?.arretSuivi &&
        e1?.etat == e2?.etat &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.refUsers == e2?.refUsers &&
        e1?.titreAbo == e2?.titreAbo &&
        e1?.numSuivi == e2?.numSuivi;
  }

  @override
  int hash(DatabaseUsersDetailsRecord? e) => const ListEquality().hash([
        e?.categoriePrestation,
        e?.typeSuivi,
        e?.resumeSuivi,
        e?.objectifs,
        e?.dateDebut,
        e?.dateFin,
        e?.indications,
        e?.arretSuivi,
        e?.etat,
        e?.dateCreate,
        e?.refUsers,
        e?.titreAbo,
        e?.numSuivi
      ]);

  @override
  bool isValidKey(Object? o) => o is DatabaseUsersDetailsRecord;
}
