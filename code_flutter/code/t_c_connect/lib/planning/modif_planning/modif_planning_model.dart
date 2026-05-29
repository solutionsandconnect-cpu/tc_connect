import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_autocomplete_options_list.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import 'modif_planning_widget.dart' show ModifPlanningWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class ModifPlanningModel extends FlutterFlowModel<ModifPlanningWidget> {
  ///  Local state fields for this component.

  DateTime? dateRdvStock;

  DateTime? debutRdvStock;

  DateTime? finRdvStock;

  ///  State fields for stateful widgets in this component.

  // State field(s) for DropDownClient widget.
  String? dropDownClientValue;
  FormFieldController<String>? dropDownClientValueController;
  // Stores action output result for [Firestore Query - Query a collection] action in DropDownClient widget.
  UsersRecord? selectClientDropDown;
  // State field(s) for DropDownAboClient widget.
  String? dropDownAboClientValue;
  FormFieldController<String>? dropDownAboClientValueController;
  // Stores action output result for [Firestore Query - Query a collection] action in DropDownAboClient widget.
  DatabaseUsersDetailsRecord? selectAboClientDropDownEdit;
  // State field(s) for DropDownTypePlanning widget.
  String? dropDownTypePlanningValue;
  FormFieldController<String>? dropDownTypePlanningValueController;
  // State field(s) for DropDownMateriel widget.
  List<String>? dropDownMaterielValue;
  FormFieldController<List<String>>? dropDownMaterielValueController;
  // State field(s) for adresse widget.
  final adresseKey = GlobalKey();
  FocusNode? adresseFocusNode;
  TextEditingController? adresseTextController;
  String? adresseSelectedOption;
  String? Function(BuildContext, String?)? adresseTextControllerValidator;
  DateTime? datePicked1;
  // State field(s) for TextFieldDate widget.
  FocusNode? textFieldDateFocusNode;
  TextEditingController? textFieldDateTextController;
  late MaskTextInputFormatter textFieldDateMask;
  String? Function(BuildContext, String?)? textFieldDateTextControllerValidator;
  DateTime? datePicked2;
  // State field(s) for TextFieldHeureDebut widget.
  FocusNode? textFieldHeureDebutFocusNode;
  TextEditingController? textFieldHeureDebutTextController;
  late MaskTextInputFormatter textFieldHeureDebutMask;
  String? Function(BuildContext, String?)?
      textFieldHeureDebutTextControllerValidator;
  DateTime? datePicked3;
  // State field(s) for TextFieldHeureFin widget.
  FocusNode? textFieldHeureFinFocusNode;
  TextEditingController? textFieldHeureFinTextController;
  late MaskTextInputFormatter textFieldHeureFinMask;
  String? Function(BuildContext, String?)?
      textFieldHeureFinTextControllerValidator;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    adresseFocusNode?.dispose();

    textFieldDateFocusNode?.dispose();
    textFieldDateTextController?.dispose();

    textFieldHeureDebutFocusNode?.dispose();
    textFieldHeureDebutTextController?.dispose();

    textFieldHeureFinFocusNode?.dispose();
    textFieldHeureFinTextController?.dispose();
  }
}
