import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:math';
import 'dart:ui';
import 'ajout_observations_widget.dart' show AjoutObservationsWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class AjoutObservationsModel extends FlutterFlowModel<AjoutObservationsWidget> {
  ///  State fields for stateful widgets in this component.

  // State field(s) for Commentaire widget.
  FocusNode? commentaireFocusNode;
  TextEditingController? commentaireTextController;
  String? Function(BuildContext, String?)? commentaireTextControllerValidator;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    commentaireFocusNode?.dispose();
    commentaireTextController?.dispose();
  }
}
