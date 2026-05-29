import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/schema/enums/enums.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:math';
import 'dart:ui';
import 'ajout_commentaire_widget.dart' show AjoutCommentaireWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class AjoutCommentaireModel extends FlutterFlowModel<AjoutCommentaireWidget> {
  ///  Local state fields for this component.

  String? typeCommentaire;

  ///  State fields for stateful widgets in this component.

  // State field(s) for Commentaire widget.
  FocusNode? commentaireFocusNode;
  TextEditingController? commentaireTextController;
  String? Function(BuildContext, String?)? commentaireTextControllerValidator;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  UsersRecord? userAdmin;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    commentaireFocusNode?.dispose();
    commentaireTextController?.dispose();
  }
}
