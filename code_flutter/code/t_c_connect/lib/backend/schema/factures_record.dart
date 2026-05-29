import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class FacturesRecord extends FirestoreRecord {
  FacturesRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "userId" field.
  DocumentReference? _userId;
  DocumentReference? get userId => _userId;
  bool hasUserId() => _userId != null;

  // "clientId" field.
  DocumentReference? _clientId;
  DocumentReference? get clientId => _clientId;
  bool hasClientId() => _clientId != null;

  // "number" field.
  String? _number;
  String get number => _number ?? '';
  bool hasNumber() => _number != null;

  // "status" field.
  String? _status;
  String get status => _status ?? '';
  bool hasStatus() => _status != null;

  // "total" field.
  double? _total;
  double get total => _total ?? 0.0;
  bool hasTotal() => _total != null;

  // "pdfUrl" field.
  String? _pdfUrl;
  String get pdfUrl => _pdfUrl ?? '';
  bool hasPdfUrl() => _pdfUrl != null;

  // "createAt" field.
  DocumentReference? _createAt;
  DocumentReference? get createAt => _createAt;
  bool hasCreateAt() => _createAt != null;

  void _initializeFields() {
    _userId = snapshotData['userId'] as DocumentReference?;
    _clientId = snapshotData['clientId'] as DocumentReference?;
    _number = snapshotData['number'] as String?;
    _status = snapshotData['status'] as String?;
    _total = castToType<double>(snapshotData['total']);
    _pdfUrl = snapshotData['pdfUrl'] as String?;
    _createAt = snapshotData['createAt'] as DocumentReference?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('factures');

  static Stream<FacturesRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => FacturesRecord.fromSnapshot(s));

  static Future<FacturesRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => FacturesRecord.fromSnapshot(s));

  static FacturesRecord fromSnapshot(DocumentSnapshot snapshot) =>
      FacturesRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static FacturesRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      FacturesRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'FacturesRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is FacturesRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createFacturesRecordData({
  DocumentReference? userId,
  DocumentReference? clientId,
  String? number,
  String? status,
  double? total,
  String? pdfUrl,
  DocumentReference? createAt,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'userId': userId,
      'clientId': clientId,
      'number': number,
      'status': status,
      'total': total,
      'pdfUrl': pdfUrl,
      'createAt': createAt,
    }.withoutNulls,
  );

  return firestoreData;
}

class FacturesRecordDocumentEquality implements Equality<FacturesRecord> {
  const FacturesRecordDocumentEquality();

  @override
  bool equals(FacturesRecord? e1, FacturesRecord? e2) {
    return e1?.userId == e2?.userId &&
        e1?.clientId == e2?.clientId &&
        e1?.number == e2?.number &&
        e1?.status == e2?.status &&
        e1?.total == e2?.total &&
        e1?.pdfUrl == e2?.pdfUrl &&
        e1?.createAt == e2?.createAt;
  }

  @override
  int hash(FacturesRecord? e) => const ListEquality().hash([
        e?.userId,
        e?.clientId,
        e?.number,
        e?.status,
        e?.total,
        e?.pdfUrl,
        e?.createAt
      ]);

  @override
  bool isValidKey(Object? o) => o is FacturesRecord;
}
