import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import 'add_staff_widget.dart' show AddStaffWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:easy_debounce/easy_debounce.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class AddStaffModel extends FlutterFlowModel<AddStaffWidget> {
  ///  Local state fields for this page.

  String? verifMail;

  DocumentReference? idUserMail;

  String? stockagePosteAutre;

  ///  State fields for stateful widgets in this page.

  // State field(s) for MailUser widget.
  FocusNode? mailUserFocusNode;
  TextEditingController? mailUserTextController;
  String? Function(BuildContext, String?)? mailUserTextControllerValidator;
  // Stores action output result for [Firestore Query - Query a collection] action in MailUser widget.
  List<UsersRecord>? verifMailUserCreateStaff;
  // Stores action output result for [Firestore Query - Query a collection] action in MailUser widget.
  UsersRecord? recupIdUserStaff;
  // Stores action output result for [Firestore Query - Query a collection] action in Text widget.
  UsersRecord? recupIdUserMail;
  // State field(s) for NomJoueur widget.
  FocusNode? nomJoueurFocusNode;
  TextEditingController? nomJoueurTextController;
  String? Function(BuildContext, String?)? nomJoueurTextControllerValidator;
  // State field(s) for PrenomJoueur widget.
  FocusNode? prenomJoueurFocusNode;
  TextEditingController? prenomJoueurTextController;
  String? Function(BuildContext, String?)? prenomJoueurTextControllerValidator;
  // State field(s) for SelectTypeStaff widget.
  String? selectTypeStaffValue;
  FormFieldController<String>? selectTypeStaffValueController;
  // State field(s) for AutrePoste widget.
  FocusNode? autrePosteFocusNode;
  TextEditingController? autrePosteTextController;
  String? Function(BuildContext, String?)? autrePosteTextControllerValidator;
  DateTime? datePicked;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    mailUserFocusNode?.dispose();
    mailUserTextController?.dispose();

    nomJoueurFocusNode?.dispose();
    nomJoueurTextController?.dispose();

    prenomJoueurFocusNode?.dispose();
    prenomJoueurTextController?.dispose();

    autrePosteFocusNode?.dispose();
    autrePosteTextController?.dispose();
  }
}
