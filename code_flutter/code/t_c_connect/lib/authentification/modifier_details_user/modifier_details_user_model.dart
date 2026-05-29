import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import 'modifier_details_user_widget.dart' show ModifierDetailsUserWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class ModifierDetailsUserModel
    extends FlutterFlowModel<ModifierDetailsUserWidget> {
  ///  Local state fields for this component.

  DateTime? dateDebutStock;

  DateTime? dateFinStock;

  String? etatStock;

  ///  State fields for stateful widgets in this component.

  // State field(s) for ChoiceChipsEtat widget.
  FormFieldController<List<String>>? choiceChipsEtatValueController;
  String? get choiceChipsEtatValue =>
      choiceChipsEtatValueController?.value?.firstOrNull;
  set choiceChipsEtatValue(String? val) =>
      choiceChipsEtatValueController?.value = val != null ? [val] : [];
  // State field(s) for DropDownCategorie widget.
  String? dropDownCategorieValue;
  FormFieldController<String>? dropDownCategorieValueController;
  // State field(s) for DropDownTypeSuivi widget.
  String? dropDownTypeSuiviValue;
  FormFieldController<String>? dropDownTypeSuiviValueController;
  // State field(s) for resume_suivi widget.
  FocusNode? resumeSuiviFocusNode;
  TextEditingController? resumeSuiviTextController;
  String? Function(BuildContext, String?)? resumeSuiviTextControllerValidator;
  // State field(s) for objectifs widget.
  FocusNode? objectifsFocusNode;
  TextEditingController? objectifsTextController;
  String? Function(BuildContext, String?)? objectifsTextControllerValidator;
  DateTime? datePicked1;
  // State field(s) for TextFieldDateDebut widget.
  FocusNode? textFieldDateDebutFocusNode;
  TextEditingController? textFieldDateDebutTextController;
  late MaskTextInputFormatter textFieldDateDebutMask;
  String? Function(BuildContext, String?)?
      textFieldDateDebutTextControllerValidator;
  DateTime? datePicked2;
  // State field(s) for TextFieldDateFin widget.
  FocusNode? textFieldDateFinFocusNode;
  TextEditingController? textFieldDateFinTextController;
  late MaskTextInputFormatter textFieldDateFinMask;
  String? Function(BuildContext, String?)?
      textFieldDateFinTextControllerValidator;
  // State field(s) for indications widget.
  FocusNode? indicationsFocusNode;
  TextEditingController? indicationsTextController;
  String? Function(BuildContext, String?)? indicationsTextControllerValidator;
  // State field(s) for DropDownArretSuivi widget.
  String? dropDownArretSuiviValue;
  FormFieldController<String>? dropDownArretSuiviValueController;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? countAboDejaCree;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? recupEtatClientActif;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? recupEtatClientInactif;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? recupEtatClientProspect;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? countAbo;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? recupEtatActif;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? recupEtatInactif;
  // Stores action output result for [Firestore Query - Query a collection] action in Button_enregistrer widget.
  int? recupEtatProspect;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    resumeSuiviFocusNode?.dispose();
    resumeSuiviTextController?.dispose();

    objectifsFocusNode?.dispose();
    objectifsTextController?.dispose();

    textFieldDateDebutFocusNode?.dispose();
    textFieldDateDebutTextController?.dispose();

    textFieldDateFinFocusNode?.dispose();
    textFieldDateFinTextController?.dispose();

    indicationsFocusNode?.dispose();
    indicationsTextController?.dispose();
  }
}
