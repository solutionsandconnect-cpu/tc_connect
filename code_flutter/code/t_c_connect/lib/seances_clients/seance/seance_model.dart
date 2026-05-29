import '/auth/base_auth_user_provider.dart';
import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/schema/enums/enums.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_timer.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/planning/ajout_commentaire/ajout_commentaire_widget.dart';
import '/planning/bilan_fin_seance/bilan_fin_seance_widget.dart';
import '/planning/formulaire_avant_seance/formulaire_avant_seance_widget.dart';
import '/seances_clients/bilan_fin_circuit/bilan_fin_circuit_widget.dart';
import '/seances_clients/creation_programme_seance/creation_programme_seance_widget.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'package:stop_watch_timer/stop_watch_timer.dart';
import 'seance_widget.dart' show SeanceWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class SeanceModel extends FlutterFlowModel<SeanceWidget> {
  ///  Local state fields for this page.

  SeanceRecord? voirPartie;

  DocumentReference? stockNouveauPlanningDuplique;

  int? numDuplicageSeance = 1;

  int? numDuplicageExo = 1;

  int? verifSeancePresente;

  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Firestore Query - Query a collection] action in Seance widget.
  int? verifSiSeanceExist;
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  PlanningProRecord? recupPlanningSeanceDuplique;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  int? countNbCircuitPlanningInitial;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  List<SeanceRecord>? querySeancePlanninginitial;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  SeanceRecord? recupSeanceInital;
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  SeanceRecord? nouveauDocSeanceCree;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  int? countNbExercicePlanningInitial;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  ProgrammeSeanceRecord? recupExerciceInital;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  UsersRecord? userAdmin;
  // State field(s) for TimerRecupTours widget.
  final timerRecupToursInitialTimeMs = 0;
  int timerRecupToursMilliseconds = 0;
  String timerRecupToursValue = StopWatchTimer.getDisplayTime(
    0,
    hours: false,
    milliSecond: false,
  );
  FlutterFlowTimerController timerRecupToursController =
      FlutterFlowTimerController(StopWatchTimer(mode: StopWatchMode.countDown));

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    timerRecupToursController.dispose();
  }
}
