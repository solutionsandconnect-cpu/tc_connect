import '/auth/base_auth_user_provider.dart';
import '/auth/firebase_auth/auth_util.dart';
import '/authentification/modifier_mail/modifier_mail_widget.dart';
import '/authentification/password_oublie/password_oublie_widget.dart';
import '/backend/backend.dart';
import '/backend/schema/enums/enums.dart';
import '/components/nav_bar_web_widget.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import '/index.dart';
import 'mon_profil_widget.dart' show MonProfilWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class MonProfilModel extends FlutterFlowModel<MonProfilWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for Nav_bar_web component.
  late NavBarWebModel navBarWebModel;
  // State field(s) for version_app widget.
  FocusNode? versionAppFocusNode;
  TextEditingController? versionAppTextController;
  String? Function(BuildContext, String?)? versionAppTextControllerValidator;
  // State field(s) for ChoiceChips widget.
  FormFieldController<List<String>>? choiceChipsValueController;
  String? get choiceChipsValue =>
      choiceChipsValueController?.value?.firstOrNull;
  set choiceChipsValue(String? val) =>
      choiceChipsValueController?.value = val != null ? [val] : [];

  @override
  void initState(BuildContext context) {
    navBarWebModel = createModel(context, () => NavBarWebModel());
  }

  @override
  void dispose() {
    navBarWebModel.dispose();
    versionAppFocusNode?.dispose();
    versionAppTextController?.dispose();
  }
}
