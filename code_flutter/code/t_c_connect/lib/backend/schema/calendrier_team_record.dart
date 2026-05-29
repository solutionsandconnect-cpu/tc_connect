import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class CalendrierTeamRecord extends FirestoreRecord {
  CalendrierTeamRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "teamref" field.
  DocumentReference? _teamref;
  DocumentReference? get teamref => _teamref;
  bool hasTeamref() => _teamref != null;

  // "date" field.
  DateTime? _date;
  DateTime? get date => _date;
  bool hasDate() => _date != null;

  // "heure_debut" field.
  DateTime? _heureDebut;
  DateTime? get heureDebut => _heureDebut;
  bool hasHeureDebut() => _heureDebut != null;

  // "heure_fin" field.
  DateTime? _heureFin;
  DateTime? get heureFin => _heureFin;
  bool hasHeureFin() => _heureFin != null;

  // "event" field.
  String? _event;
  String get event => _event ?? '';
  bool hasEvent() => _event != null;

  // "create_date" field.
  DateTime? _createDate;
  DateTime? get createDate => _createDate;
  bool hasCreateDate() => _createDate != null;

  void _initializeFields() {
    _teamref = snapshotData['teamref'] as DocumentReference?;
    _date = snapshotData['date'] as DateTime?;
    _heureDebut = snapshotData['heure_debut'] as DateTime?;
    _heureFin = snapshotData['heure_fin'] as DateTime?;
    _event = snapshotData['event'] as String?;
    _createDate = snapshotData['create_date'] as DateTime?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('calendrier_team');

  static Stream<CalendrierTeamRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => CalendrierTeamRecord.fromSnapshot(s));

  static Future<CalendrierTeamRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => CalendrierTeamRecord.fromSnapshot(s));

  static CalendrierTeamRecord fromSnapshot(DocumentSnapshot snapshot) =>
      CalendrierTeamRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static CalendrierTeamRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      CalendrierTeamRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'CalendrierTeamRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is CalendrierTeamRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createCalendrierTeamRecordData({
  DocumentReference? teamref,
  DateTime? date,
  DateTime? heureDebut,
  DateTime? heureFin,
  String? event,
  DateTime? createDate,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'teamref': teamref,
      'date': date,
      'heure_debut': heureDebut,
      'heure_fin': heureFin,
      'event': event,
      'create_date': createDate,
    }.withoutNulls,
  );

  return firestoreData;
}

class CalendrierTeamRecordDocumentEquality
    implements Equality<CalendrierTeamRecord> {
  const CalendrierTeamRecordDocumentEquality();

  @override
  bool equals(CalendrierTeamRecord? e1, CalendrierTeamRecord? e2) {
    return e1?.teamref == e2?.teamref &&
        e1?.date == e2?.date &&
        e1?.heureDebut == e2?.heureDebut &&
        e1?.heureFin == e2?.heureFin &&
        e1?.event == e2?.event &&
        e1?.createDate == e2?.createDate;
  }

  @override
  int hash(CalendrierTeamRecord? e) => const ListEquality().hash([
        e?.teamref,
        e?.date,
        e?.heureDebut,
        e?.heureFin,
        e?.event,
        e?.createDate
      ]);

  @override
  bool isValidKey(Object? o) => o is CalendrierTeamRecord;
}
