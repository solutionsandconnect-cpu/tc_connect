import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class TeamRecord extends FirestoreRecord {
  TeamRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "userref" field.
  DocumentReference? _userref;
  DocumentReference? get userref => _userref;
  bool hasUserref() => _userref != null;

  // "nom_equipe" field.
  String? _nomEquipe;
  String get nomEquipe => _nomEquipe ?? '';
  bool hasNomEquipe() => _nomEquipe != null;

  // "sport" field.
  String? _sport;
  String get sport => _sport ?? '';
  bool hasSport() => _sport != null;

  // "create_date" field.
  DateTime? _createDate;
  DateTime? get createDate => _createDate;
  bool hasCreateDate() => _createDate != null;

  // "logo" field.
  String? _logo;
  String get logo => _logo ?? '';
  bool hasLogo() => _logo != null;

  void _initializeFields() {
    _userref = snapshotData['userref'] as DocumentReference?;
    _nomEquipe = snapshotData['nom_equipe'] as String?;
    _sport = snapshotData['sport'] as String?;
    _createDate = snapshotData['create_date'] as DateTime?;
    _logo = snapshotData['logo'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('team');

  static Stream<TeamRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => TeamRecord.fromSnapshot(s));

  static Future<TeamRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => TeamRecord.fromSnapshot(s));

  static TeamRecord fromSnapshot(DocumentSnapshot snapshot) => TeamRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static TeamRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      TeamRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'TeamRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is TeamRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createTeamRecordData({
  DocumentReference? userref,
  String? nomEquipe,
  String? sport,
  DateTime? createDate,
  String? logo,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'userref': userref,
      'nom_equipe': nomEquipe,
      'sport': sport,
      'create_date': createDate,
      'logo': logo,
    }.withoutNulls,
  );

  return firestoreData;
}

class TeamRecordDocumentEquality implements Equality<TeamRecord> {
  const TeamRecordDocumentEquality();

  @override
  bool equals(TeamRecord? e1, TeamRecord? e2) {
    return e1?.userref == e2?.userref &&
        e1?.nomEquipe == e2?.nomEquipe &&
        e1?.sport == e2?.sport &&
        e1?.createDate == e2?.createDate &&
        e1?.logo == e2?.logo;
  }

  @override
  int hash(TeamRecord? e) => const ListEquality()
      .hash([e?.userref, e?.nomEquipe, e?.sport, e?.createDate, e?.logo]);

  @override
  bool isValidKey(Object? o) => o is TeamRecord;
}
