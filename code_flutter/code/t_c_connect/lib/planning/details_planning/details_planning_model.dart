import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/schema/enums/enums.dart';
import '/components/bouton_adresses_widget.dart';
import '/flutter_flow/flutter_flow_checkbox_group.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/planning/ajout_commentaire/ajout_commentaire_widget.dart';
import '/planning/ajout_observations/ajout_observations_widget.dart';
import '/planning/duplicage_seance_coach/duplicage_seance_coach_widget.dart';
import '/planning/etat_rdv/etat_rdv_widget.dart';
import '/planning/formulaire_avant_seance/formulaire_avant_seance_widget.dart';
import '/planning/modif_planning/modif_planning_widget.dart';
import '/planning/planification_avant_seance/planification_avant_seance_widget.dart';
import '/seances_clients/creation_seance/creation_seance_widget.dart';
import 'dart:ui';
import '/index.dart';
import 'details_planning_widget.dart' show DetailsPlanningWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class DetailsPlanningModel extends FlutterFlowModel<DetailsPlanningWidget> {
  ///  Local state fields for this page.

  String? textMessage;

  String? affichageComm = 'Oui';

  ///  State fields for stateful widgets in this page.

  // State field(s) for TextField1 widget.
  FocusNode? textField1FocusNode;
  TextEditingController? textField1TextController;
  String? Function(BuildContext, String?)? textField1TextControllerValidator;
  // State field(s) for TextField2 widget.
  FocusNode? textField2FocusNode;
  TextEditingController? textField2TextController;
  String? Function(BuildContext, String?)? textField2TextControllerValidator;
  // State field(s) for TextField3 widget.
  FocusNode? textField3FocusNode;
  TextEditingController? textField3TextController;
  String? Function(BuildContext, String?)? textField3TextControllerValidator;
  // State field(s) for TextField4 widget.
  FocusNode? textField4FocusNode;
  TextEditingController? textField4TextController;
  String? Function(BuildContext, String?)? textField4TextControllerValidator;
  // State field(s) for TextField5 widget.
  FocusNode? textField5FocusNode;
  TextEditingController? textField5TextController;
  String? Function(BuildContext, String?)? textField5TextControllerValidator;
  // State field(s) for TextField6 widget.
  FocusNode? textField6FocusNode;
  TextEditingController? textField6TextController;
  String? Function(BuildContext, String?)? textField6TextControllerValidator;
  // State field(s) for CheckboxGroupMateriel widget.
  FormFieldController<List<String>>? checkboxGroupMaterielValueController;
  List<String>? get checkboxGroupMaterielValues =>
      checkboxGroupMaterielValueController?.value;
  set checkboxGroupMaterielValues(List<String>? v) =>
      checkboxGroupMaterielValueController?.value = v;

  // State field(s) for TabBar widget.
  TabController? tabBarController;
  int get tabBarCurrentIndex =>
      tabBarController != null ? tabBarController!.index : 0;
  int get tabBarPreviousIndex =>
      tabBarController != null ? tabBarController!.previousIndex : 0;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    textField1FocusNode?.dispose();
    textField1TextController?.dispose();

    textField2FocusNode?.dispose();
    textField2TextController?.dispose();

    textField3FocusNode?.dispose();
    textField3TextController?.dispose();

    textField4FocusNode?.dispose();
    textField4TextController?.dispose();

    textField5FocusNode?.dispose();
    textField5TextController?.dispose();

    textField6FocusNode?.dispose();
    textField6TextController?.dispose();

    tabBarController?.dispose();
  }
}
