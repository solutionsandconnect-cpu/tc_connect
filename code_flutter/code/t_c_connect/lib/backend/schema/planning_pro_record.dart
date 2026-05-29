import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class PlanningProRecord extends FirestoreRecord {
  PlanningProRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "ref_users" field.
  DocumentReference? _refUsers;
  DocumentReference? get refUsers => _refUsers;
  bool hasRefUsers() => _refUsers != null;

  // "date_planning" field.
  DateTime? _datePlanning;
  DateTime? get datePlanning => _datePlanning;
  bool hasDatePlanning() => _datePlanning != null;

  // "heure_planning_debut" field.
  DateTime? _heurePlanningDebut;
  DateTime? get heurePlanningDebut => _heurePlanningDebut;
  bool hasHeurePlanningDebut() => _heurePlanningDebut != null;

  // "heure_planning_fin" field.
  DateTime? _heurePlanningFin;
  DateTime? get heurePlanningFin => _heurePlanningFin;
  bool hasHeurePlanningFin() => _heurePlanningFin != null;

  // "etat_planning_rdv" field.
  String? _etatPlanningRdv;
  String get etatPlanningRdv => _etatPlanningRdv ?? '';
  bool hasEtatPlanningRdv() => _etatPlanningRdv != null;

  // "adresse_rdv" field.
  String? _adresseRdv;
  String get adresseRdv => _adresseRdv ?? '';
  bool hasAdresseRdv() => _adresseRdv != null;

  // "rdv_pret" field.
  String? _rdvPret;
  String get rdvPret => _rdvPret ?? '';
  bool hasRdvPret() => _rdvPret != null;

  // "rdv_effectue" field.
  String? _rdvEffectue;
  String get rdvEffectue => _rdvEffectue ?? '';
  bool hasRdvEffectue() => _rdvEffectue != null;

  // "observations_rdv" field.
  String? _observationsRdv;
  String get observationsRdv => _observationsRdv ?? '';
  bool hasObservationsRdv() => _observationsRdv != null;

  // "cr_rdv_moi" field.
  String? _crRdvMoi;
  String get crRdvMoi => _crRdvMoi ?? '';
  bool hasCrRdvMoi() => _crRdvMoi != null;

  // "cr_rdv_client" field.
  String? _crRdvClient;
  String get crRdvClient => _crRdvClient ?? '';
  bool hasCrRdvClient() => _crRdvClient != null;

  // "type_planning" field.
  String? _typePlanning;
  String get typePlanning => _typePlanning ?? '';
  bool hasTypePlanning() => _typePlanning != null;

  // "intensite_seance" field.
  int? _intensiteSeance;
  int get intensiteSeance => _intensiteSeance ?? 0;
  bool hasIntensiteSeance() => _intensiteSeance != null;

  // "motivation_pdt_seance" field.
  int? _motivationPdtSeance;
  int get motivationPdtSeance => _motivationPdtSeance ?? 0;
  bool hasMotivationPdtSeance() => _motivationPdtSeance != null;

  // "intensite_mise_pdt_seance" field.
  int? _intensiteMisePdtSeance;
  int get intensiteMisePdtSeance => _intensiteMisePdtSeance ?? 0;
  bool hasIntensiteMisePdtSeance() => _intensiteMisePdtSeance != null;

  // "intensite_seance_planifiee" field.
  int? _intensiteSeancePlanifiee;
  int get intensiteSeancePlanifiee => _intensiteSeancePlanifiee ?? 0;
  bool hasIntensiteSeancePlanifiee() => _intensiteSeancePlanifiee != null;

  // "qualite_sommeil" field.
  int? _qualiteSommeil;
  int get qualiteSommeil => _qualiteSommeil ?? 0;
  bool hasQualiteSommeil() => _qualiteSommeil != null;

  // "niveau_fatigue" field.
  int? _niveauFatigue;
  int get niveauFatigue => _niveauFatigue ?? 0;
  bool hasNiveauFatigue() => _niveauFatigue != null;

  // "niveau_courbatures" field.
  int? _niveauCourbatures;
  int get niveauCourbatures => _niveauCourbatures ?? 0;
  bool hasNiveauCourbatures() => _niveauCourbatures != null;

  // "quantite_stress" field.
  int? _quantiteStress;
  int get quantiteStress => _quantiteStress ?? 0;
  bool hasQuantiteStress() => _quantiteStress != null;

  // "motivation_avant_seance" field.
  int? _motivationAvantSeance;
  int get motivationAvantSeance => _motivationAvantSeance ?? 0;
  bool hasMotivationAvantSeance() => _motivationAvantSeance != null;

  // "activite_derniers_jours" field.
  int? _activiteDerniersJours;
  int get activiteDerniersJours => _activiteDerniersJours ?? 0;
  bool hasActiviteDerniersJours() => _activiteDerniersJours != null;

  // "alimentation_derniers_jours" field.
  int? _alimentationDerniersJours;
  int get alimentationDerniersJours => _alimentationDerniersJours ?? 0;
  bool hasAlimentationDerniersJours() => _alimentationDerniersJours != null;

  // "infos_complementaire_avant_seance_client" field.
  String? _infosComplementaireAvantSeanceClient;
  String get infosComplementaireAvantSeanceClient =>
      _infosComplementaireAvantSeanceClient ?? '';
  bool hasInfosComplementaireAvantSeanceClient() =>
      _infosComplementaireAvantSeanceClient != null;

  // "maj_ap_rdv" field.
  String? _majApRdv;
  String get majApRdv => _majApRdv ?? '';
  bool hasMajApRdv() => _majApRdv != null;

  // "materiel" field.
  List<String>? _materiel;
  List<String> get materiel => _materiel ?? const [];
  bool hasMateriel() => _materiel != null;

  // "rdv_cree_par" field.
  DocumentReference? _rdvCreePar;
  DocumentReference? get rdvCreePar => _rdvCreePar;
  bool hasRdvCreePar() => _rdvCreePar != null;

  // "refDatabaseUser" field.
  DocumentReference? _refDatabaseUser;
  DocumentReference? get refDatabaseUser => _refDatabaseUser;
  bool hasRefDatabaseUser() => _refDatabaseUser != null;

  // "nom_event" field.
  String? _nomEvent;
  String get nomEvent => _nomEvent ?? '';
  bool hasNomEvent() => _nomEvent != null;

  // "rdv_lie" field.
  DocumentReference? _rdvLie;
  DocumentReference? get rdvLie => _rdvLie;
  bool hasRdvLie() => _rdvLie != null;

  // "date_create" field.
  DateTime? _dateCreate;
  DateTime? get dateCreate => _dateCreate;
  bool hasDateCreate() => _dateCreate != null;

  // "hooper_calculate" field.
  int? _hooperCalculate;
  int get hooperCalculate => _hooperCalculate ?? 0;
  bool hasHooperCalculate() => _hooperCalculate != null;

  void _initializeFields() {
    _refUsers = snapshotData['ref_users'] as DocumentReference?;
    _datePlanning = snapshotData['date_planning'] as DateTime?;
    _heurePlanningDebut = snapshotData['heure_planning_debut'] as DateTime?;
    _heurePlanningFin = snapshotData['heure_planning_fin'] as DateTime?;
    _etatPlanningRdv = snapshotData['etat_planning_rdv'] as String?;
    _adresseRdv = snapshotData['adresse_rdv'] as String?;
    _rdvPret = snapshotData['rdv_pret'] as String?;
    _rdvEffectue = snapshotData['rdv_effectue'] as String?;
    _observationsRdv = snapshotData['observations_rdv'] as String?;
    _crRdvMoi = snapshotData['cr_rdv_moi'] as String?;
    _crRdvClient = snapshotData['cr_rdv_client'] as String?;
    _typePlanning = snapshotData['type_planning'] as String?;
    _intensiteSeance = castToType<int>(snapshotData['intensite_seance']);
    _motivationPdtSeance =
        castToType<int>(snapshotData['motivation_pdt_seance']);
    _intensiteMisePdtSeance =
        castToType<int>(snapshotData['intensite_mise_pdt_seance']);
    _intensiteSeancePlanifiee =
        castToType<int>(snapshotData['intensite_seance_planifiee']);
    _qualiteSommeil = castToType<int>(snapshotData['qualite_sommeil']);
    _niveauFatigue = castToType<int>(snapshotData['niveau_fatigue']);
    _niveauCourbatures = castToType<int>(snapshotData['niveau_courbatures']);
    _quantiteStress = castToType<int>(snapshotData['quantite_stress']);
    _motivationAvantSeance =
        castToType<int>(snapshotData['motivation_avant_seance']);
    _activiteDerniersJours =
        castToType<int>(snapshotData['activite_derniers_jours']);
    _alimentationDerniersJours =
        castToType<int>(snapshotData['alimentation_derniers_jours']);
    _infosComplementaireAvantSeanceClient =
        snapshotData['infos_complementaire_avant_seance_client'] as String?;
    _majApRdv = snapshotData['maj_ap_rdv'] as String?;
    _materiel = getDataList(snapshotData['materiel']);
    _rdvCreePar = snapshotData['rdv_cree_par'] as DocumentReference?;
    _refDatabaseUser = snapshotData['refDatabaseUser'] as DocumentReference?;
    _nomEvent = snapshotData['nom_event'] as String?;
    _rdvLie = snapshotData['rdv_lie'] as DocumentReference?;
    _dateCreate = snapshotData['date_create'] as DateTime?;
    _hooperCalculate = castToType<int>(snapshotData['hooper_calculate']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('planning_pro');

  static Stream<PlanningProRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => PlanningProRecord.fromSnapshot(s));

  static Future<PlanningProRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => PlanningProRecord.fromSnapshot(s));

  static PlanningProRecord fromSnapshot(DocumentSnapshot snapshot) =>
      PlanningProRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static PlanningProRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      PlanningProRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'PlanningProRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is PlanningProRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createPlanningProRecordData({
  DocumentReference? refUsers,
  DateTime? datePlanning,
  DateTime? heurePlanningDebut,
  DateTime? heurePlanningFin,
  String? etatPlanningRdv,
  String? adresseRdv,
  String? rdvPret,
  String? rdvEffectue,
  String? observationsRdv,
  String? crRdvMoi,
  String? crRdvClient,
  String? typePlanning,
  int? intensiteSeance,
  int? motivationPdtSeance,
  int? intensiteMisePdtSeance,
  int? intensiteSeancePlanifiee,
  int? qualiteSommeil,
  int? niveauFatigue,
  int? niveauCourbatures,
  int? quantiteStress,
  int? motivationAvantSeance,
  int? activiteDerniersJours,
  int? alimentationDerniersJours,
  String? infosComplementaireAvantSeanceClient,
  String? majApRdv,
  DocumentReference? rdvCreePar,
  DocumentReference? refDatabaseUser,
  String? nomEvent,
  DocumentReference? rdvLie,
  DateTime? dateCreate,
  int? hooperCalculate,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'ref_users': refUsers,
      'date_planning': datePlanning,
      'heure_planning_debut': heurePlanningDebut,
      'heure_planning_fin': heurePlanningFin,
      'etat_planning_rdv': etatPlanningRdv,
      'adresse_rdv': adresseRdv,
      'rdv_pret': rdvPret,
      'rdv_effectue': rdvEffectue,
      'observations_rdv': observationsRdv,
      'cr_rdv_moi': crRdvMoi,
      'cr_rdv_client': crRdvClient,
      'type_planning': typePlanning,
      'intensite_seance': intensiteSeance,
      'motivation_pdt_seance': motivationPdtSeance,
      'intensite_mise_pdt_seance': intensiteMisePdtSeance,
      'intensite_seance_planifiee': intensiteSeancePlanifiee,
      'qualite_sommeil': qualiteSommeil,
      'niveau_fatigue': niveauFatigue,
      'niveau_courbatures': niveauCourbatures,
      'quantite_stress': quantiteStress,
      'motivation_avant_seance': motivationAvantSeance,
      'activite_derniers_jours': activiteDerniersJours,
      'alimentation_derniers_jours': alimentationDerniersJours,
      'infos_complementaire_avant_seance_client':
          infosComplementaireAvantSeanceClient,
      'maj_ap_rdv': majApRdv,
      'rdv_cree_par': rdvCreePar,
      'refDatabaseUser': refDatabaseUser,
      'nom_event': nomEvent,
      'rdv_lie': rdvLie,
      'date_create': dateCreate,
      'hooper_calculate': hooperCalculate,
    }.withoutNulls,
  );

  return firestoreData;
}

class PlanningProRecordDocumentEquality implements Equality<PlanningProRecord> {
  const PlanningProRecordDocumentEquality();

  @override
  bool equals(PlanningProRecord? e1, PlanningProRecord? e2) {
    const listEquality = ListEquality();
    return e1?.refUsers == e2?.refUsers &&
        e1?.datePlanning == e2?.datePlanning &&
        e1?.heurePlanningDebut == e2?.heurePlanningDebut &&
        e1?.heurePlanningFin == e2?.heurePlanningFin &&
        e1?.etatPlanningRdv == e2?.etatPlanningRdv &&
        e1?.adresseRdv == e2?.adresseRdv &&
        e1?.rdvPret == e2?.rdvPret &&
        e1?.rdvEffectue == e2?.rdvEffectue &&
        e1?.observationsRdv == e2?.observationsRdv &&
        e1?.crRdvMoi == e2?.crRdvMoi &&
        e1?.crRdvClient == e2?.crRdvClient &&
        e1?.typePlanning == e2?.typePlanning &&
        e1?.intensiteSeance == e2?.intensiteSeance &&
        e1?.motivationPdtSeance == e2?.motivationPdtSeance &&
        e1?.intensiteMisePdtSeance == e2?.intensiteMisePdtSeance &&
        e1?.intensiteSeancePlanifiee == e2?.intensiteSeancePlanifiee &&
        e1?.qualiteSommeil == e2?.qualiteSommeil &&
        e1?.niveauFatigue == e2?.niveauFatigue &&
        e1?.niveauCourbatures == e2?.niveauCourbatures &&
        e1?.quantiteStress == e2?.quantiteStress &&
        e1?.motivationAvantSeance == e2?.motivationAvantSeance &&
        e1?.activiteDerniersJours == e2?.activiteDerniersJours &&
        e1?.alimentationDerniersJours == e2?.alimentationDerniersJours &&
        e1?.infosComplementaireAvantSeanceClient ==
            e2?.infosComplementaireAvantSeanceClient &&
        e1?.majApRdv == e2?.majApRdv &&
        listEquality.equals(e1?.materiel, e2?.materiel) &&
        e1?.rdvCreePar == e2?.rdvCreePar &&
        e1?.refDatabaseUser == e2?.refDatabaseUser &&
        e1?.nomEvent == e2?.nomEvent &&
        e1?.rdvLie == e2?.rdvLie &&
        e1?.dateCreate == e2?.dateCreate &&
        e1?.hooperCalculate == e2?.hooperCalculate;
  }

  @override
  int hash(PlanningProRecord? e) => const ListEquality().hash([
        e?.refUsers,
        e?.datePlanning,
        e?.heurePlanningDebut,
        e?.heurePlanningFin,
        e?.etatPlanningRdv,
        e?.adresseRdv,
        e?.rdvPret,
        e?.rdvEffectue,
        e?.observationsRdv,
        e?.crRdvMoi,
        e?.crRdvClient,
        e?.typePlanning,
        e?.intensiteSeance,
        e?.motivationPdtSeance,
        e?.intensiteMisePdtSeance,
        e?.intensiteSeancePlanifiee,
        e?.qualiteSommeil,
        e?.niveauFatigue,
        e?.niveauCourbatures,
        e?.quantiteStress,
        e?.motivationAvantSeance,
        e?.activiteDerniersJours,
        e?.alimentationDerniersJours,
        e?.infosComplementaireAvantSeanceClient,
        e?.majApRdv,
        e?.materiel,
        e?.rdvCreePar,
        e?.refDatabaseUser,
        e?.nomEvent,
        e?.rdvLie,
        e?.dateCreate,
        e?.hooperCalculate
      ]);

  @override
  bool isValidKey(Object? o) => o is PlanningProRecord;
}
