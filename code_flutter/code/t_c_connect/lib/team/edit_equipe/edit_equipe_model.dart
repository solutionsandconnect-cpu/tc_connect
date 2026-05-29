import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import '/index.dart';
import 'edit_equipe_widget.dart' show EditEquipeWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class EditEquipeModel extends FlutterFlowModel<EditEquipeWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for SelectSport widget.
  String? selectSportValue;
  FormFieldController<String>? selectSportValueController;
  // State field(s) for nomEquipe widget.
  FocusNode? nomEquipeFocusNode;
  TextEditingController? nomEquipeTextController;
  String? Function(BuildContext, String?)? nomEquipeTextControllerValidator;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    nomEquipeFocusNode?.dispose();
    nomEquipeTextController?.dispose();
  }
}
