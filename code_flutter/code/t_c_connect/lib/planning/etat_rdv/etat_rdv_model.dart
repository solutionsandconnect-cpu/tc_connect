import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:math';
import 'dart:ui';
import 'etat_rdv_widget.dart' show EtatRdvWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class EtatRdvModel extends FlutterFlowModel<EtatRdvWidget> {
  ///  State fields for stateful widgets in this component.

  // State field(s) for ChoiceChipsEtatRdv widget.
  FormFieldController<List<String>>? choiceChipsEtatRdvValueController;
  String? get choiceChipsEtatRdvValue =>
      choiceChipsEtatRdvValueController?.value?.firstOrNull;
  set choiceChipsEtatRdvValue(String? val) =>
      choiceChipsEtatRdvValueController?.value = val != null ? [val] : [];
  // State field(s) for ChoiceChipsRdvPret widget.
  FormFieldController<List<String>>? choiceChipsRdvPretValueController;
  String? get choiceChipsRdvPretValue =>
      choiceChipsRdvPretValueController?.value?.firstOrNull;
  set choiceChipsRdvPretValue(String? val) =>
      choiceChipsRdvPretValueController?.value = val != null ? [val] : [];
  // State field(s) for ChoiceChipsRdvFait widget.
  FormFieldController<List<String>>? choiceChipsRdvFaitValueController;
  String? get choiceChipsRdvFaitValue =>
      choiceChipsRdvFaitValueController?.value?.firstOrNull;
  set choiceChipsRdvFaitValue(String? val) =>
      choiceChipsRdvFaitValueController?.value = val != null ? [val] : [];

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
