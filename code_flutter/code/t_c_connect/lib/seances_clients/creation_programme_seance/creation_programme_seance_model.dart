import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_autocomplete_options_list.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_count_controller.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:math';
import 'dart:ui';
import 'creation_programme_seance_widget.dart'
    show CreationProgrammeSeanceWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class CreationProgrammeSeanceModel
    extends FlutterFlowModel<CreationProgrammeSeanceWidget> {
  ///  Local state fields for this component.

  String? recupExplicationEcriteExercice;

  ///  State fields for stateful widgets in this component.

  // State field(s) for DropDownExercice widget.
  String? dropDownExerciceValue;
  FormFieldController<String>? dropDownExerciceValueController;
  // Stores action output result for [Firestore Query - Query a collection] action in DropDownExercice widget.
  ExercicesRecord? selectExerciceDropDown;
  // State field(s) for ChoiceChipsTypeEffort widget.
  FormFieldController<List<String>>? choiceChipsTypeEffortValueController;
  String? get choiceChipsTypeEffortValue =>
      choiceChipsTypeEffortValueController?.value?.firstOrNull;
  set choiceChipsTypeEffortValue(String? val) =>
      choiceChipsTypeEffortValueController?.value = val != null ? [val] : [];
  // State field(s) for effort widget.
  FocusNode? effortFocusNode;
  TextEditingController? effortTextController;
  late MaskTextInputFormatter effortMask;
  String? Function(BuildContext, String?)? effortTextControllerValidator;
  // State field(s) for recupEffort widget.
  FocusNode? recupEffortFocusNode;
  TextEditingController? recupEffortTextController;
  late MaskTextInputFormatter recupEffortMask;
  String? Function(BuildContext, String?)? recupEffortTextControllerValidator;
  // State field(s) for explicationsExercices widget.
  FocusNode? explicationsExercicesFocusNode;
  TextEditingController? explicationsExercicesTextController;
  String? Function(BuildContext, String?)?
      explicationsExercicesTextControllerValidator;
  // State field(s) for ChoiceChipsIntensite widget.
  FormFieldController<List<String>>? choiceChipsIntensiteValueController;
  String? get choiceChipsIntensiteValue =>
      choiceChipsIntensiteValueController?.value?.firstOrNull;
  set choiceChipsIntensiteValue(String? val) =>
      choiceChipsIntensiteValueController?.value = val != null ? [val] : [];
  // State field(s) for ChoiceChipsAlerte widget.
  FormFieldController<List<String>>? choiceChipsAlerteValueController;
  String? get choiceChipsAlerteValue =>
      choiceChipsAlerteValueController?.value?.firstOrNull;
  set choiceChipsAlerteValue(String? val) =>
      choiceChipsAlerteValueController?.value = val != null ? [val] : [];
  // State field(s) for charge widget.
  FocusNode? chargeFocusNode;
  TextEditingController? chargeTextController;
  late MaskTextInputFormatter chargeMask;
  String? Function(BuildContext, String?)? chargeTextControllerValidator;
  // State field(s) for materiel widget.
  final materielKey = GlobalKey();
  FocusNode? materielFocusNode;
  TextEditingController? materielTextController;
  String? materielSelectedOption;
  String? Function(BuildContext, String?)? materielTextControllerValidator;
  // State field(s) for tempo1 widget.
  FocusNode? tempo1FocusNode;
  TextEditingController? tempo1TextController;
  late MaskTextInputFormatter tempo1Mask;
  String? Function(BuildContext, String?)? tempo1TextControllerValidator;
  // State field(s) for tempo2 widget.
  FocusNode? tempo2FocusNode;
  TextEditingController? tempo2TextController;
  late MaskTextInputFormatter tempo2Mask;
  String? Function(BuildContext, String?)? tempo2TextControllerValidator;
  // State field(s) for tempo3 widget.
  FocusNode? tempo3FocusNode;
  TextEditingController? tempo3TextController;
  late MaskTextInputFormatter tempo3Mask;
  String? Function(BuildContext, String?)? tempo3TextControllerValidator;
  // State field(s) for tempo4 widget.
  FocusNode? tempo4FocusNode;
  TextEditingController? tempo4TextController;
  late MaskTextInputFormatter tempo4Mask;
  String? Function(BuildContext, String?)? tempo4TextControllerValidator;
  // State field(s) for observations widget.
  FocusNode? observationsFocusNode;
  TextEditingController? observationsTextController;
  String? Function(BuildContext, String?)? observationsTextControllerValidator;
  // State field(s) for NumExerciceCircuit widget.
  int? numExerciceCircuitValue;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    effortFocusNode?.dispose();
    effortTextController?.dispose();

    recupEffortFocusNode?.dispose();
    recupEffortTextController?.dispose();

    explicationsExercicesFocusNode?.dispose();
    explicationsExercicesTextController?.dispose();

    chargeFocusNode?.dispose();
    chargeTextController?.dispose();

    materielFocusNode?.dispose();

    tempo1FocusNode?.dispose();
    tempo1TextController?.dispose();

    tempo2FocusNode?.dispose();
    tempo2TextController?.dispose();

    tempo3FocusNode?.dispose();
    tempo3TextController?.dispose();

    tempo4FocusNode?.dispose();
    tempo4TextController?.dispose();

    observationsFocusNode?.dispose();
    observationsTextController?.dispose();
  }
}
