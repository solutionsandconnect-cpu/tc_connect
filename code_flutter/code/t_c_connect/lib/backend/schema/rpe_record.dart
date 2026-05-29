import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class RpeRecord extends FirestoreRecord {
  RpeRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "joueurref" field.
  DocumentReference? _joueurref;
  DocumentReference? get joueurref => _joueurref;
  bool hasJoueurref() => _joueurref != null;

  // "date" field.
  DateTime? _date;
  DateTime? get date => _date;
  bool hasDate() => _date != null;

  // "rpe" field.
  int? _rpe;
  int get rpe => _rpe ?? 0;
  bool hasRpe() => _rpe != null;

  // "temps" field.
  int? _temps;
  int get temps => _temps ?? 0;
  bool hasTemps() => _temps != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "charge_entrainement" field.
  double? _chargeEntrainement;
  double get chargeEntrainement => _chargeEntrainement ?? 0.0;
  bool hasChargeEntrainement() => _chargeEntrainement != null;

  // "charge_aigue" field.
  double? _chargeAigue;
  double get chargeAigue => _chargeAigue ?? 0.0;
  bool hasChargeAigue() => _chargeAigue != null;

  // "charge_chronique" field.
  double? _chargeChronique;
  double get chargeChronique => _chargeChronique ?? 0.0;
  bool hasChargeChronique() => _chargeChronique != null;

  // "rcac" field.
  double? _rcac;
  double get rcac => _rcac ?? 0.0;
  bool hasRcac() => _rcac != null;

  void _initializeFields() {
    _joueurref = snapshotData['joueurref'] as DocumentReference?;
    _date = snapshotData['date'] as DateTime?;
    _rpe = castToType<int>(snapshotData['rpe']);
    _temps = castToType<int>(snapshotData['temps']);
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _chargeEntrainement =
        castToType<double>(snapshotData['charge_entrainement']);
    _chargeAigue = castToType<double>(snapshotData['charge_aigue']);
    _chargeChronique = castToType<double>(snapshotData['charge_chronique']);
    _rcac = castToType<double>(snapshotData['rcac']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('rpe');

  static Stream<RpeRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => RpeRecord.fromSnapshot(s));

  static Future<RpeRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => RpeRecord.fromSnapshot(s));

  static RpeRecord fromSnapshot(DocumentSnapshot snapshot) => RpeRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static RpeRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      RpeRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'RpeRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is RpeRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createRpeRecordData({
  DocumentReference? joueurref,
  DateTime? date,
  int? rpe,
  int? temps,
  DateTime? dateCreate,
  double? chargeEntrainement,
  double? chargeAigue,
  double? chargeChronique,
  double? rcac,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'joueurref': joueurref,
      'date': date,
      'rpe': rpe,
      'temps': temps,
      'date_create': dateCreate,
      'charge_entrainement': chargeEntrainement,
      'charge_aigue': chargeAigue,
      'charge_chronique': chargeChronique,
      'rcac': rcac,
    }.withoutNulls,
  );

  return firestoreData;
}

class RpeRecordDocumentEquality implements Equality<RpeRecord> {
  const RpeRecordDocumentEquality();

  @override
  bool equals(RpeRecord? e1, RpeRecord? e2) {
    return e1?.joueurref == e2?.joueurref &&
        e1?.date == e2?.date &&
        e1?.rpe == e2?.rpe &&
        e1?.temps == e2?.temps &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.chargeEntrainement == e2?.chargeEntrainement &&
        e1?.chargeAigue == e2?.chargeAigue &&
        e1?.chargeChronique == e2?.chargeChronique &&
        e1?.rcac == e2?.rcac;
  }

  @override
  int hash(RpeRecord? e) => const ListEquality().hash([
        e?.joueurref,
        e?.date,
        e?.rpe,
        e?.temps,
        e?.dateCreate,
        e?.chargeEntrainement,
        e?.chargeAigue,
        e?.chargeChronique,
        e?.rcac
      ]);

  @override
  bool isValidKey(Object? o) => o is RpeRecord;
}
