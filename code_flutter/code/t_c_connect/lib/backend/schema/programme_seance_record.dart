import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ProgrammeSeanceRecord extends FirestoreRecord {
  ProgrammeSeanceRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "ref_seance" field.
  DocumentReference? _refSeance;
  DocumentReference? get refSeance => _refSeance;
  bool hasRefSeance() => _refSeance != null;

  // "exercice" field.
  DocumentReference? _exercice;
  DocumentReference? get exercice => _exercice;
  bool hasExercice() => _exercice != null;

  // "explication_exercice" field.
  String? _explicationExercice;
  String get explicationExercice => _explicationExercice ?? '';
  bool hasExplicationExercice() => _explicationExercice != null;

  // "type_effort" field.
  String? _typeEffort;
  String get typeEffort => _typeEffort ?? '';
  bool hasTypeEffort() => _typeEffort != null;

  // "effort" field.
  int? _effort;
  int get effort => _effort ?? 0;
  bool hasEffort() => _effort != null;

  // "recup_effort" field.
  int? _recupEffort;
  int get recupEffort => _recupEffort ?? 0;
  bool hasRecupEffort() => _recupEffort != null;

  // "tempo_phase1" field.
  int? _tempoPhase1;
  int get tempoPhase1 => _tempoPhase1 ?? 0;
  bool hasTempoPhase1() => _tempoPhase1 != null;

  // "tempo_phase2" field.
  int? _tempoPhase2;
  int get tempoPhase2 => _tempoPhase2 ?? 0;
  bool hasTempoPhase2() => _tempoPhase2 != null;

  // "tempo_phase3" field.
  int? _tempoPhase3;
  int get tempoPhase3 => _tempoPhase3 ?? 0;
  bool hasTempoPhase3() => _tempoPhase3 != null;

  // "tempo_phase4" field.
  int? _tempoPhase4;
  int get tempoPhase4 => _tempoPhase4 ?? 0;
  bool hasTempoPhase4() => _tempoPhase4 != null;

  // "observations" field.
  String? _observations;
  String get observations => _observations ?? '';
  bool hasObservations() => _observations != null;

  // "ref_users" field.
  DocumentReference? _refUsers;
  DocumentReference? get refUsers => _refUsers;
  bool hasRefUsers() => _refUsers != null;

  // "num_exercice" field.
  int? _numExercice;
  int get numExercice => _numExercice ?? 0;
  bool hasNumExercice() => _numExercice != null;

  // "nb_serie_effectuee" field.
  int? _nbSerieEffectuee;
  int get nbSerieEffectuee => _nbSerieEffectuee ?? 0;
  bool hasNbSerieEffectuee() => _nbSerieEffectuee != null;

  // "notes_utilisateur" field.
  String? _notesUtilisateur;
  String get notesUtilisateur => _notesUtilisateur ?? '';
  bool hasNotesUtilisateur() => _notesUtilisateur != null;

  // "charge" field.
  double? _charge;
  double get charge => _charge ?? 0.0;
  bool hasCharge() => _charge != null;

  // "materiel" field.
  String? _materiel;
  String get materiel => _materiel ?? '';
  bool hasMateriel() => _materiel != null;

  // "alerte_exercice" field.
  String? _alerteExercice;
  String get alerteExercice => _alerteExercice ?? '';
  bool hasAlerteExercice() => _alerteExercice != null;

  // "intensite_exercice" field.
  String? _intensiteExercice;
  String get intensiteExercice => _intensiteExercice ?? '';
  bool hasIntensiteExercice() => _intensiteExercice != null;

  // "fatigue_engendree" field.
  List<String>? _fatigueEngendree;
  List<String> get fatigueEngendree => _fatigueEngendree ?? const [];
  bool hasFatigueEngendree() => _fatigueEngendree != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "nom_event_ref" field.
  String? _nomEventRef;
  String get nomEventRef => _nomEventRef ?? '';
  bool hasNomEventRef() => _nomEventRef != null;

  void _initializeFields() {
    _refSeance = snapshotData['ref_seance'] as DocumentReference?;
    _exercice = snapshotData['exercice'] as DocumentReference?;
    _explicationExercice = snapshotData['explication_exercice'] as String?;
    _typeEffort = snapshotData['type_effort'] as String?;
    _effort = castToType<int>(snapshotData['effort']);
    _recupEffort = castToType<int>(snapshotData['recup_effort']);
    _tempoPhase1 = castToType<int>(snapshotData['tempo_phase1']);
    _tempoPhase2 = castToType<int>(snapshotData['tempo_phase2']);
    _tempoPhase3 = castToType<int>(snapshotData['tempo_phase3']);
    _tempoPhase4 = castToType<int>(snapshotData['tempo_phase4']);
    _observations = snapshotData['observations'] as String?;
    _refUsers = snapshotData['ref_users'] as DocumentReference?;
    _numExercice = castToType<int>(snapshotData['num_exercice']);
    _nbSerieEffectuee = castToType<int>(snapshotData['nb_serie_effectuee']);
    _notesUtilisateur = snapshotData['notes_utilisateur'] as String?;
    _charge = castToType<double>(snapshotData['charge']);
    _materiel = snapshotData['materiel'] as String?;
    _alerteExercice = snapshotData['alerte_exercice'] as String?;
    _intensiteExercice = snapshotData['intensite_exercice'] as String?;
    _fatigueEngendree = getDataList(snapshotData['fatigue_engendree']);
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _nomEventRef = snapshotData['nom_event_ref'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('programme_seance');

  static Stream<ProgrammeSeanceRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ProgrammeSeanceRecord.fromSnapshot(s));

  static Future<ProgrammeSeanceRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ProgrammeSeanceRecord.fromSnapshot(s));

  static ProgrammeSeanceRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ProgrammeSeanceRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ProgrammeSeanceRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ProgrammeSeanceRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ProgrammeSeanceRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ProgrammeSeanceRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createProgrammeSeanceRecordData({
  DocumentReference? refSeance,
  DocumentReference? exercice,
  String? explicationExercice,
  String? typeEffort,
  int? effort,
  int? recupEffort,
  int? tempoPhase1,
  int? tempoPhase2,
  int? tempoPhase3,
  int? tempoPhase4,
  String? observations,
  DocumentReference? refUsers,
  int? numExercice,
  int? nbSerieEffectuee,
  String? notesUtilisateur,
  double? charge,
  String? materiel,
  String? alerteExercice,
  String? intensiteExercice,
  DateTime? dateCreate,
  String? nomEventRef,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'ref_seance': refSeance,
      'exercice': exercice,
      'explication_exercice': explicationExercice,
      'type_effort': typeEffort,
      'effort': effort,
      'recup_effort': recupEffort,
      'tempo_phase1': tempoPhase1,
      'tempo_phase2': tempoPhase2,
      'tempo_phase3': tempoPhase3,
      'tempo_phase4': tempoPhase4,
      'observations': observations,
      'ref_users': refUsers,
      'num_exercice': numExercice,
      'nb_serie_effectuee': nbSerieEffectuee,
      'notes_utilisateur': notesUtilisateur,
      'charge': charge,
      'materiel': materiel,
      'alerte_exercice': alerteExercice,
      'intensite_exercice': intensiteExercice,
      'date_create': dateCreate,
      'nom_event_ref': nomEventRef,
    }.withoutNulls,
  );

  return firestoreData;
}

class ProgrammeSeanceRecordDocumentEquality
    implements Equality<ProgrammeSeanceRecord> {
  const ProgrammeSeanceRecordDocumentEquality();

  @override
  bool equals(ProgrammeSeanceRecord? e1, ProgrammeSeanceRecord? e2) {
    const listEquality = ListEquality();
    return e1?.refSeance == e2?.refSeance &&
        e1?.exercice == e2?.exercice &&
        e1?.explicationExercice == e2?.explicationExercice &&
        e1?.typeEffort == e2?.typeEffort &&
        e1?.effort == e2?.effort &&
        e1?.recupEffort == e2?.recupEffort &&
        e1?.tempoPhase1 == e2?.tempoPhase1 &&
        e1?.tempoPhase2 == e2?.tempoPhase2 &&
        e1?.tempoPhase3 == e2?.tempoPhase3 &&
        e1?.tempoPhase4 == e2?.tempoPhase4 &&
        e1?.observations == e2?.observations &&
        e1?.refUsers == e2?.refUsers &&
        e1?.numExercice == e2?.numExercice &&
        e1?.nbSerieEffectuee == e2?.nbSerieEffectuee &&
        e1?.notesUtilisateur == e2?.notesUtilisateur &&
        e1?.charge == e2?.charge &&
        e1?.materiel == e2?.materiel &&
        e1?.alerteExercice == e2?.alerteExercice &&
        e1?.intensiteExercice == e2?.intensiteExercice &&
        listEquality.equals(e1?.fatigueEngendree, e2?.fatigueEngendree) &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.nomEventRef == e2?.nomEventRef;
  }

  @override
  int hash(ProgrammeSeanceRecord? e) => const ListEquality().hash([
        e?.refSeance,
        e?.exercice,
        e?.explicationExercice,
        e?.typeEffort,
        e?.effort,
        e?.recupEffort,
        e?.tempoPhase1,
        e?.tempoPhase2,
        e?.tempoPhase3,
        e?.tempoPhase4,
        e?.observations,
        e?.refUsers,
        e?.numExercice,
        e?.nbSerieEffectuee,
        e?.notesUtilisateur,
        e?.charge,
        e?.materiel,
        e?.alerteExercice,
        e?.intensiteExercice,
        e?.fatigueEngendree,
        e?.dateCreate,
        e?.nomEventRef
      ]);

  @override
  bool isValidKey(Object? o) => o is ProgrammeSeanceRecord;
}
