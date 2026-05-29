import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:math';
import 'dart:ui';
import 'duplicage_seance_coach_widget.dart' show DuplicageSeanceCoachWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class DuplicageSeanceCoachModel
    extends FlutterFlowModel<DuplicageSeanceCoachWidget> {
  ///  Local state fields for this component.

  DocumentReference? stockRefPlanningNouveau;

  int? numDuplicageSeance = 1;

  int? numDuplicageExo = 1;

  ///  State fields for stateful widgets in this component.

  // State field(s) for DropDownClientDuplicage widget.
  String? dropDownClientDuplicageValue;
  FormFieldController<String>? dropDownClientDuplicageValueController;
  // Stores action output result for [Firestore Query - Query a collection] action in DropDownClientDuplicage widget.
  PlanningProRecord? clientPlanningSelect;
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

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
