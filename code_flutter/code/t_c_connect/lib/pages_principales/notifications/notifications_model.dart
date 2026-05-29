import '/auth/base_auth_user_provider.dart';
import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/components/nav_bar_web_widget.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/planning/formulaire_avant_seance/formulaire_avant_seance_widget.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'notifications_widget.dart' show NotificationsWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class NotificationsModel extends FlutterFlowModel<NotificationsWidget> {
  ///  Local state fields for this page.

  String rechercheNotifEtat = 'Non lue';

  ///  State fields for stateful widgets in this page.

  // Model for Nav_bar_web component.
  late NavBarWebModel navBarWebModel;
  // State field(s) for ChoiceChipsEtat widget.
  FormFieldController<List<String>>? choiceChipsEtatValueController;
  String? get choiceChipsEtatValue =>
      choiceChipsEtatValueController?.value?.firstOrNull;
  set choiceChipsEtatValue(String? val) =>
      choiceChipsEtatValueController?.value = val != null ? [val] : [];

  @override
  void initState(BuildContext context) {
    navBarWebModel = createModel(context, () => NavBarWebModel());
  }

  @override
  void dispose() {
    navBarWebModel.dispose();
  }
}
