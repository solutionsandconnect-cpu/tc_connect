import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class SeanceRecord extends FirestoreRecord {
  SeanceRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "ref_planning" field.
  DocumentReference? _refPlanning;
  DocumentReference? get refPlanning => _refPlanning;
  bool hasRefPlanning() => _refPlanning != null;

  // "partie_seance" field.
  String? _partieSeance;
  String get partieSeance => _partieSeance ?? '';
  bool hasPartieSeance() => _partieSeance != null;

  // "type_seance" field.
  String? _typeSeance;
  String get typeSeance => _typeSeance ?? '';
  bool hasTypeSeance() => _typeSeance != null;

  // "observations_seance" field.
  String? _observationsSeance;
  String get observationsSeance => _observationsSeance ?? '';
  bool hasObservationsSeance() => _observationsSeance != null;

  // "nb_tours" field.
  int? _nbTours;
  int get nbTours => _nbTours ?? 0;
  bool hasNbTours() => _nbTours != null;

  // "recup_tours" field.
  int? _recupTours;
  int get recupTours => _recupTours ?? 0;
  bool hasRecupTours() => _recupTours != null;

  // "ref_users" field.
  DocumentReference? _refUsers;
  DocumentReference? get refUsers => _refUsers;
  bool hasRefUsers() => _refUsers != null;

  // "num_circuit" field.
  int? _numCircuit;
  int get numCircuit => _numCircuit ?? 0;
  bool hasNumCircuit() => _numCircuit != null;

  // "avancement_circuit" field.
  double? _avancementCircuit;
  double get avancementCircuit => _avancementCircuit ?? 0.0;
  bool hasAvancementCircuit() => _avancementCircuit != null;

  // "nb_exercice" field.
  int? _nbExercice;
  int get nbExercice => _nbExercice ?? 0;
  bool hasNbExercice() => _nbExercice != null;

  // "intensite_circuit" field.
  int? _intensiteCircuit;
  int get intensiteCircuit => _intensiteCircuit ?? 0;
  bool hasIntensiteCircuit() => _intensiteCircuit != null;

  // "intensite_circuit_planifie" field.
  int? _intensiteCircuitPlanifie;
  int get intensiteCircuitPlanifie => _intensiteCircuitPlanifie ?? 0;
  bool hasIntensiteCircuitPlanifie() => _intensiteCircuitPlanifie != null;

  // "intensite_gen" field.
  String? _intensiteGen;
  String get intensiteGen => _intensiteGen ?? '';
  bool hasIntensiteGen() => _intensiteGen != null;

  // "satisfaction_circuit" field.
  String? _satisfactionCircuit;
  String get satisfactionCircuit => _satisfactionCircuit ?? '';
  bool hasSatisfactionCircuit() => _satisfactionCircuit != null;

  // "type_effort_exo_default" field.
  String? _typeEffortExoDefault;
  String get typeEffortExoDefault => _typeEffortExoDefault ?? '';
  bool hasTypeEffortExoDefault() => _typeEffortExoDefault != null;

  // "tps_effort_exo_default" field.
  int? _tpsEffortExoDefault;
  int get tpsEffortExoDefault => _tpsEffortExoDefault ?? 0;
  bool hasTpsEffortExoDefault() => _tpsEffortExoDefault != null;

  // "tps_recup_exo_default" field.
  int? _tpsRecupExoDefault;
  int get tpsRecupExoDefault => _tpsRecupExoDefault ?? 0;
  bool hasTpsRecupExoDefault() => _tpsRecupExoDefault != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "nom_event_ref" field.
  String? _nomEventRef;
  String get nomEventRef => _nomEventRef ?? '';
  bool hasNomEventRef() => _nomEventRef != null;

  void _initializeFields() {
    _refPlanning = snapshotData['ref_planning'] as DocumentReference?;
    _partieSeance = snapshotData['partie_seance'] as String?;
    _typeSeance = snapshotData['type_seance'] as String?;
    _observationsSeance = snapshotData['observations_seance'] as String?;
    _nbTours = castToType<int>(snapshotData['nb_tours']);
    _recupTours = castToType<int>(snapshotData['recup_tours']);
    _refUsers = snapshotData['ref_users'] as DocumentReference?;
    _numCircuit = castToType<int>(snapshotData['num_circuit']);
    _avancementCircuit = castToType<double>(snapshotData['avancement_circuit']);
    _nbExercice = castToType<int>(snapshotData['nb_exercice']);
    _intensiteCircuit = castToType<int>(snapshotData['intensite_circuit']);
    _intensiteCircuitPlanifie =
        castToType<int>(snapshotData['intensite_circuit_planifie']);
    _intensiteGen = snapshotData['intensite_gen'] as String?;
    _satisfactionCircuit = snapshotData['satisfaction_circuit'] as String?;
    _typeEffortExoDefault = snapshotData['type_effort_exo_default'] as String?;
    _tpsEffortExoDefault =
        castToType<int>(snapshotData['tps_effort_exo_default']);
    _tpsRecupExoDefault =
        castToType<int>(snapshotData['tps_recup_exo_default']);
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _nomEventRef = snapshotData['nom_event_ref'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('seance');

  static Stream<SeanceRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => SeanceRecord.fromSnapshot(s));

  static Future<SeanceRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => SeanceRecord.fromSnapshot(s));

  static SeanceRecord fromSnapshot(DocumentSnapshot snapshot) => SeanceRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static SeanceRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      SeanceRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'SeanceRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is SeanceRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createSeanceRecordData({
  DocumentReference? refPlanning,
  String? partieSeance,
  String? typeSeance,
  String? observationsSeance,
  int? nbTours,
  int? recupTours,
  DocumentReference? refUsers,
  int? numCircuit,
  double? avancementCircuit,
  int? nbExercice,
  int? intensiteCircuit,
  int? intensiteCircuitPlanifie,
  String? intensiteGen,
  String? satisfactionCircuit,
  String? typeEffortExoDefault,
  int? tpsEffortExoDefault,
  int? tpsRecupExoDefault,
  DateTime? dateCreate,
  String? nomEventRef,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'ref_planning': refPlanning,
      'partie_seance': partieSeance,
      'type_seance': typeSeance,
      'observations_seance': observationsSeance,
      'nb_tours': nbTours,
      'recup_tours': recupTours,
      'ref_users': refUsers,
      'num_circuit': numCircuit,
      'avancement_circuit': avancementCircuit,
      'nb_exercice': nbExercice,
      'intensite_circuit': intensiteCircuit,
      'intensite_circuit_planifie': intensiteCircuitPlanifie,
      'intensite_gen': intensiteGen,
      'satisfaction_circuit': satisfactionCircuit,
      'type_effort_exo_default': typeEffortExoDefault,
      'tps_effort_exo_default': tpsEffortExoDefault,
      'tps_recup_exo_default': tpsRecupExoDefault,
      'date_create': dateCreate,
      'nom_event_ref': nomEventRef,
    }.withoutNulls,
  );

  return firestoreData;
}

class SeanceRecordDocumentEquality implements Equality<SeanceRecord> {
  const SeanceRecordDocumentEquality();

  @override
  bool equals(SeanceRecord? e1, SeanceRecord? e2) {
    return e1?.refPlanning == e2?.refPlanning &&
        e1?.partieSeance == e2?.partieSeance &&
        e1?.typeSeance == e2?.typeSeance &&
        e1?.observationsSeance == e2?.observationsSeance &&
        e1?.nbTours == e2?.nbTours &&
        e1?.recupTours == e2?.recupTours &&
        e1?.refUsers == e2?.refUsers &&
        e1?.numCircuit == e2?.numCircuit &&
        e1?.avancementCircuit == e2?.avancementCircuit &&
        e1?.nbExercice == e2?.nbExercice &&
        e1?.intensiteCircuit == e2?.intensiteCircuit &&
        e1?.intensiteCircuitPlanifie == e2?.intensiteCircuitPlanifie &&
        e1?.intensiteGen == e2?.intensiteGen &&
        e1?.satisfactionCircuit == e2?.satisfactionCircuit &&
        e1?.typeEffortExoDefault == e2?.typeEffortExoDefault &&
        e1?.tpsEffortExoDefault == e2?.tpsEffortExoDefault &&
        e1?.tpsRecupExoDefault == e2?.tpsRecupExoDefault &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.nomEventRef == e2?.nomEventRef;
  }

  @override
  int hash(SeanceRecord? e) => const ListEquality().hash([
        e?.refPlanning,
        e?.partieSeance,
        e?.typeSeance,
        e?.observationsSeance,
        e?.nbTours,
        e?.recupTours,
        e?.refUsers,
        e?.numCircuit,
        e?.avancementCircuit,
        e?.nbExercice,
        e?.intensiteCircuit,
        e?.intensiteCircuitPlanifie,
        e?.intensiteGen,
        e?.satisfactionCircuit,
        e?.typeEffortExoDefault,
        e?.tpsEffortExoDefault,
        e?.tpsRecupExoDefault,
        e?.dateCreate,
        e?.nomEventRef
      ]);

  @override
  bool isValidKey(Object? o) => o is SeanceRecord;
}
