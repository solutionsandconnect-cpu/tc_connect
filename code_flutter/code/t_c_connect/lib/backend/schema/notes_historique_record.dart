import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class NotesHistoriqueRecord extends FirestoreRecord {
  NotesHistoriqueRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "ref_users" field.
  DocumentReference? _refUsers;
  DocumentReference? get refUsers => _refUsers;
  bool hasRefUsers() => _refUsers != null;

  // "notes" field.
  String? _notes;
  String get notes => _notes ?? '';
  bool hasNotes() => _notes != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "type_note" field.
  String? _typeNote;
  String get typeNote => _typeNote ?? '';
  bool hasTypeNote() => _typeNote != null;

  // "date_max_note_active" field.
  DateTime? _dateMaxNoteActive;
  DateTime? get dateMaxNoteActive => _dateMaxNoteActive;
  bool hasDateMaxNoteActive() => _dateMaxNoteActive != null;

  void _initializeFields() {
    _refUsers = snapshotData['ref_users'] as DocumentReference?;
    _notes = snapshotData['notes'] as String?;
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _typeNote = snapshotData['type_note'] as String?;
    _dateMaxNoteActive = snapshotData['date_max_note_active'] as DateTime?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('notes_historique');

  static Stream<NotesHistoriqueRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => NotesHistoriqueRecord.fromSnapshot(s));

  static Future<NotesHistoriqueRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => NotesHistoriqueRecord.fromSnapshot(s));

  static NotesHistoriqueRecord fromSnapshot(DocumentSnapshot snapshot) =>
      NotesHistoriqueRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static NotesHistoriqueRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      NotesHistoriqueRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'NotesHistoriqueRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is NotesHistoriqueRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createNotesHistoriqueRecordData({
  DocumentReference? refUsers,
  String? notes,
  DateTime? dateCreate,
  String? typeNote,
  DateTime? dateMaxNoteActive,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'ref_users': refUsers,
      'notes': notes,
      'date_create': dateCreate,
      'type_note': typeNote,
      'date_max_note_active': dateMaxNoteActive,
    }.withoutNulls,
  );

  return firestoreData;
}

class NotesHistoriqueRecordDocumentEquality
    implements Equality<NotesHistoriqueRecord> {
  const NotesHistoriqueRecordDocumentEquality();

  @override
  bool equals(NotesHistoriqueRecord? e1, NotesHistoriqueRecord? e2) {
    return e1?.refUsers == e2?.refUsers &&
        e1?.notes == e2?.notes &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.typeNote == e2?.typeNote &&
        e1?.dateMaxNoteActive == e2?.dateMaxNoteActive;
  }

  @override
  int hash(NotesHistoriqueRecord? e) => const ListEquality().hash([
        e?.refUsers,
        e?.notes,
        e?.dateCreate,
        e?.typeNote,
        e?.dateMaxNoteActive
      ]);

  @override
  bool isValidKey(Object? o) => o is NotesHistoriqueRecord;
}
