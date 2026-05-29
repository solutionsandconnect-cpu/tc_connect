import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class JoueursRecord extends FirestoreRecord {
  JoueursRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "equiperef" field.
  DocumentReference? _equiperef;
  DocumentReference? get equiperef => _equiperef;
  bool hasEquiperef() => _equiperef != null;

  // "iduserref" field.
  DocumentReference? _iduserref;
  DocumentReference? get iduserref => _iduserref;
  bool hasIduserref() => _iduserref != null;

  // "create_date" field.
  DateTime? _createDate;
  DateTime? get createDate => _createDate;
  bool hasCreateDate() => _createDate != null;

  // "type" field.
  String? _type;
  String get type => _type ?? '';
  bool hasType() => _type != null;

  // "type_staff" field.
  String? _typeStaff;
  String get typeStaff => _typeStaff ?? '';
  bool hasTypeStaff() => _typeStaff != null;

  // "mail_joueur" field.
  String? _mailJoueur;
  String get mailJoueur => _mailJoueur ?? '';
  bool hasMailJoueur() => _mailJoueur != null;

  // "prenom_joueur" field.
  String? _prenomJoueur;
  String get prenomJoueur => _prenomJoueur ?? '';
  bool hasPrenomJoueur() => _prenomJoueur != null;

  // "nom_joueur" field.
  String? _nomJoueur;
  String get nomJoueur => _nomJoueur ?? '';
  bool hasNomJoueur() => _nomJoueur != null;

  // "date_naissance" field.
  DateTime? _dateNaissance;
  DateTime? get dateNaissance => _dateNaissance;
  bool hasDateNaissance() => _dateNaissance != null;

  void _initializeFields() {
    _equiperef = snapshotData['equiperef'] as DocumentReference?;
    _iduserref = snapshotData['iduserref'] as DocumentReference?;
    _createDate = snapshotData['create_date'] as DateTime?;
    _type = snapshotData['type'] as String?;
    _typeStaff = snapshotData['type_staff'] as String?;
    _mailJoueur = snapshotData['mail_joueur'] as String?;
    _prenomJoueur = snapshotData['prenom_joueur'] as String?;
    _nomJoueur = snapshotData['nom_joueur'] as String?;
    _dateNaissance = snapshotData['date_naissance'] as DateTime?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('joueurs');

  static Stream<JoueursRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => JoueursRecord.fromSnapshot(s));

  static Future<JoueursRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => JoueursRecord.fromSnapshot(s));

  static JoueursRecord fromSnapshot(DocumentSnapshot snapshot) =>
      JoueursRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static JoueursRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      JoueursRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'JoueursRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is JoueursRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createJoueursRecordData({
  DocumentReference? equiperef,
  DocumentReference? iduserref,
  DateTime? createDate,
  String? type,
  String? typeStaff,
  String? mailJoueur,
  String? prenomJoueur,
  String? nomJoueur,
  DateTime? dateNaissance,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'equiperef': equiperef,
      'iduserref': iduserref,
      'create_date': createDate,
      'type': type,
      'type_staff': typeStaff,
      'mail_joueur': mailJoueur,
      'prenom_joueur': prenomJoueur,
      'nom_joueur': nomJoueur,
      'date_naissance': dateNaissance,
    }.withoutNulls,
  );

  return firestoreData;
}

class JoueursRecordDocumentEquality implements Equality<JoueursRecord> {
  const JoueursRecordDocumentEquality();

  @override
  bool equals(JoueursRecord? e1, JoueursRecord? e2) {
    return e1?.equiperef == e2?.equiperef &&
        e1?.iduserref == e2?.iduserref &&
        e1?.createDate == e2?.createDate &&
        e1?.type == e2?.type &&
        e1?.typeStaff == e2?.typeStaff &&
        e1?.mailJoueur == e2?.mailJoueur &&
        e1?.prenomJoueur == e2?.prenomJoueur &&
        e1?.nomJoueur == e2?.nomJoueur &&
        e1?.dateNaissance == e2?.dateNaissance;
  }

  @override
  int hash(JoueursRecord? e) => const ListEquality().hash([
        e?.equiperef,
        e?.iduserref,
        e?.createDate,
        e?.type,
        e?.typeStaff,
        e?.mailJoueur,
        e?.prenomJoueur,
        e?.nomJoueur,
        e?.dateNaissance
      ]);

  @override
  bool isValidKey(Object? o) => o is JoueursRecord;
}
