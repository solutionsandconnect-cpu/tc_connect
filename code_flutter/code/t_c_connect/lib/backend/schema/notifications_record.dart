import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class NotificationsRecord extends FirestoreRecord {
  NotificationsRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "refUsers" field.
  DocumentReference? _refUsers;
  DocumentReference? get refUsers => _refUsers;
  bool hasRefUsers() => _refUsers != null;

  // "type_notification" field.
  String? _typeNotification;
  String get typeNotification => _typeNotification ?? '';
  bool hasTypeNotification() => _typeNotification != null;

  // "notification" field.
  String? _notification;
  String get notification => _notification ?? '';
  bool hasNotification() => _notification != null;

  // "etat_notification" field.
  String? _etatNotification;
  String get etatNotification => _etatNotification ?? '';
  bool hasEtatNotification() => _etatNotification != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "date_lecture" field.
  DateTime? _dateLecture;
  DateTime? get dateLecture => _dateLecture;
  bool hasDateLecture() => _dateLecture != null;

  // "date_declenchement" field.
  DateTime? _dateDeclenchement;
  DateTime? get dateDeclenchement => _dateDeclenchement;
  bool hasDateDeclenchement() => _dateDeclenchement != null;

  // "action_via_planning" field.
  DocumentReference? _actionViaPlanning;
  DocumentReference? get actionViaPlanning => _actionViaPlanning;
  bool hasActionViaPlanning() => _actionViaPlanning != null;

  // "type_vue_pour_cond_action" field.
  String? _typeVuePourCondAction;
  String get typeVuePourCondAction => _typeVuePourCondAction ?? '';
  bool hasTypeVuePourCondAction() => _typeVuePourCondAction != null;

  void _initializeFields() {
    _refUsers = snapshotData['refUsers'] as DocumentReference?;
    _typeNotification = snapshotData['type_notification'] as String?;
    _notification = snapshotData['notification'] as String?;
    _etatNotification = snapshotData['etat_notification'] as String?;
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _dateLecture = snapshotData['date_lecture'] as DateTime?;
    _dateDeclenchement = snapshotData['date_declenchement'] as DateTime?;
    _actionViaPlanning =
        snapshotData['action_via_planning'] as DocumentReference?;
    _typeVuePourCondAction =
        snapshotData['type_vue_pour_cond_action'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('Notifications');

  static Stream<NotificationsRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => NotificationsRecord.fromSnapshot(s));

  static Future<NotificationsRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => NotificationsRecord.fromSnapshot(s));

  static NotificationsRecord fromSnapshot(DocumentSnapshot snapshot) =>
      NotificationsRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static NotificationsRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      NotificationsRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'NotificationsRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is NotificationsRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createNotificationsRecordData({
  DocumentReference? refUsers,
  String? typeNotification,
  String? notification,
  String? etatNotification,
  DateTime? dateCreate,
  DateTime? dateLecture,
  DateTime? dateDeclenchement,
  DocumentReference? actionViaPlanning,
  String? typeVuePourCondAction,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'refUsers': refUsers,
      'type_notification': typeNotification,
      'notification': notification,
      'etat_notification': etatNotification,
      'date_create': dateCreate,
      'date_lecture': dateLecture,
      'date_declenchement': dateDeclenchement,
      'action_via_planning': actionViaPlanning,
      'type_vue_pour_cond_action': typeVuePourCondAction,
    }.withoutNulls,
  );

  return firestoreData;
}

class NotificationsRecordDocumentEquality
    implements Equality<NotificationsRecord> {
  const NotificationsRecordDocumentEquality();

  @override
  bool equals(NotificationsRecord? e1, NotificationsRecord? e2) {
    return e1?.refUsers == e2?.refUsers &&
        e1?.typeNotification == e2?.typeNotification &&
        e1?.notification == e2?.notification &&
        e1?.etatNotification == e2?.etatNotification &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.dateLecture == e2?.dateLecture &&
        e1?.dateDeclenchement == e2?.dateDeclenchement &&
        e1?.actionViaPlanning == e2?.actionViaPlanning &&
        e1?.typeVuePourCondAction == e2?.typeVuePourCondAction;
  }

  @override
  int hash(NotificationsRecord? e) => const ListEquality().hash([
        e?.refUsers,
        e?.typeNotification,
        e?.notification,
        e?.etatNotification,
        e?.dateCreate,
        e?.dateLecture,
        e?.dateDeclenchement,
        e?.actionViaPlanning,
        e?.typeVuePourCondAction
      ]);

  @override
  bool isValidKey(Object? o) => o is NotificationsRecord;
}
