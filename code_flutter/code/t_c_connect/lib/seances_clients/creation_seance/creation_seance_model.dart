import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_count_controller.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/seances_clients/intensite_circuit/intensite_circuit_widget.dart';
import 'dart:math';
import 'dart:ui';
import 'creation_seance_widget.dart' show CreationSeanceWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class CreationSeanceModel extends FlutterFlowModel<CreationSeanceWidget> {
  ///  State fields for stateful widgets in this component.

  // Stores action output result for [Firestore Query - Query a collection] action in Creation_seance widget.
  int? compteNbSeance;
  // State field(s) for ChoiceChipsPartiesSeances widget.
  FormFieldController<List<String>>? choiceChipsPartiesSeancesValueController;
  String? get choiceChipsPartiesSeancesValue =>
      choiceChipsPartiesSeancesValueController?.value?.firstOrNull;
  set choiceChipsPartiesSeancesValue(String? val) =>
      choiceChipsPartiesSeancesValueController?.value =
          val != null ? [val] : [];
  // State field(s) for DropDownTypeSeance widget.
  String? dropDownTypeSeanceValue;
  FormFieldController<String>? dropDownTypeSeanceValueController;
  // State field(s) for nbTours widget.
  FocusNode? nbToursFocusNode;
  TextEditingController? nbToursTextController;
  late MaskTextInputFormatter nbToursMask;
  String? Function(BuildContext, String?)? nbToursTextControllerValidator;
  // State field(s) for recupTours widget.
  FocusNode? recupToursFocusNode;
  TextEditingController? recupToursTextController;
  late MaskTextInputFormatter recupToursMask;
  String? Function(BuildContext, String?)? recupToursTextControllerValidator;
  // State field(s) for ChoiceChipsTypeEffortDefault widget.
  FormFieldController<List<String>>?
      choiceChipsTypeEffortDefaultValueController;
  String? get choiceChipsTypeEffortDefaultValue =>
      choiceChipsTypeEffortDefaultValueController?.value?.firstOrNull;
  set choiceChipsTypeEffortDefaultValue(String? val) =>
      choiceChipsTypeEffortDefaultValueController?.value =
          val != null ? [val] : [];
  // State field(s) for EffortDefault widget.
  FocusNode? effortDefaultFocusNode;
  TextEditingController? effortDefaultTextController;
  late MaskTextInputFormatter effortDefaultMask;
  String? Function(BuildContext, String?)? effortDefaultTextControllerValidator;
  // State field(s) for RecupDefault widget.
  FocusNode? recupDefaultFocusNode;
  TextEditingController? recupDefaultTextController;
  late MaskTextInputFormatter recupDefaultMask;
  String? Function(BuildContext, String?)? recupDefaultTextControllerValidator;
  // State field(s) for observations widget.
  FocusNode? observationsFocusNode;
  TextEditingController? observationsTextController;
  String? Function(BuildContext, String?)? observationsTextControllerValidator;
  // State field(s) for NumCircuit widget.
  int? numCircuitValue;
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  SeanceRecord? refSeanceCreate;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    nbToursFocusNode?.dispose();
    nbToursTextController?.dispose();

    recupToursFocusNode?.dispose();
    recupToursTextController?.dispose();

    effortDefaultFocusNode?.dispose();
    effortDefaultTextController?.dispose();

    recupDefaultFocusNode?.dispose();
    recupDefaultTextController?.dispose();

    observationsFocusNode?.dispose();
    observationsTextController?.dispose();
  }
}
