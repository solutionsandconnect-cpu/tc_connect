import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'edit_joueur_widget.dart' show EditJoueurWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class EditJoueurModel extends FlutterFlowModel<EditJoueurWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for NomJoueur widget.
  FocusNode? nomJoueurFocusNode;
  TextEditingController? nomJoueurTextController;
  String? Function(BuildContext, String?)? nomJoueurTextControllerValidator;
  // State field(s) for PrenomJoueur widget.
  FocusNode? prenomJoueurFocusNode;
  TextEditingController? prenomJoueurTextController;
  String? Function(BuildContext, String?)? prenomJoueurTextControllerValidator;
  DateTime? datePicked;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    nomJoueurFocusNode?.dispose();
    nomJoueurTextController?.dispose();

    prenomJoueurFocusNode?.dispose();
    prenomJoueurTextController?.dispose();
  }
}
