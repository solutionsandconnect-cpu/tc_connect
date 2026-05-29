import '/auth/base_auth_user_provider.dart';
import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/components/nav_bar_web_widget.dart';
import '/flutter_flow/flutter_flow_autocomplete_options_list.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import '/index.dart';
import 'notes_widget.dart' show NotesWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class NotesModel extends FlutterFlowModel<NotesWidget> {
  ///  Local state fields for this page.

  DateTime? stockDateMax;

  String? stockDateFormatText;

  ///  State fields for stateful widgets in this page.

  // Model for Nav_bar_web component.
  late NavBarWebModel navBarWebModel;
  // State field(s) for TypeNotes widget.
  final typeNotesKey = GlobalKey();
  FocusNode? typeNotesFocusNode;
  TextEditingController? typeNotesTextController;
  String? typeNotesSelectedOption;
  String? Function(BuildContext, String?)? typeNotesTextControllerValidator;
  // State field(s) for Notes widget.
  FocusNode? notesFocusNode;
  TextEditingController? notesTextController;
  String? Function(BuildContext, String?)? notesTextControllerValidator;
  DateTime? datePicked;

  @override
  void initState(BuildContext context) {
    navBarWebModel = createModel(context, () => NavBarWebModel());
  }

  @override
  void dispose() {
    navBarWebModel.dispose();
    typeNotesFocusNode?.dispose();

    notesFocusNode?.dispose();
    notesTextController?.dispose();
  }
}
