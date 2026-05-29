import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:math';
import 'dart:ui';
import 'creation_exercice_widget.dart' show CreationExerciceWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class CreationExerciceModel extends FlutterFlowModel<CreationExerciceWidget> {
  ///  Local state fields for this component.

  String? photoExercice;

  String? videoExercice;

  ///  State fields for stateful widgets in this component.

  // State field(s) for ChoiceChipsPartiesPrioritaires widget.
  FormFieldController<List<String>>?
      choiceChipsPartiesPrioritairesValueController;
  String? get choiceChipsPartiesPrioritairesValue =>
      choiceChipsPartiesPrioritairesValueController?.value?.firstOrNull;
  set choiceChipsPartiesPrioritairesValue(String? val) =>
      choiceChipsPartiesPrioritairesValueController?.value =
          val != null ? [val] : [];
  // State field(s) for ChoiceChipsMuscles widget.
  FormFieldController<List<String>>? choiceChipsMusclesValueController;
  List<String>? get choiceChipsMusclesValues =>
      choiceChipsMusclesValueController?.value;
  set choiceChipsMusclesValues(List<String>? val) =>
      choiceChipsMusclesValueController?.value = val;
  // State field(s) for ChoiceChipsMateriel widget.
  FormFieldController<List<String>>? choiceChipsMaterielValueController;
  List<String>? get choiceChipsMaterielValues =>
      choiceChipsMaterielValueController?.value;
  set choiceChipsMaterielValues(List<String>? val) =>
      choiceChipsMaterielValueController?.value = val;
  // State field(s) for nomExercice widget.
  FocusNode? nomExerciceFocusNode;
  TextEditingController? nomExerciceTextController;
  String? Function(BuildContext, String?)? nomExerciceTextControllerValidator;
  // State field(s) for explicationExercice widget.
  FocusNode? explicationExerciceFocusNode;
  TextEditingController? explicationExerciceTextController;
  String? Function(BuildContext, String?)?
      explicationExerciceTextControllerValidator;
  // State field(s) for lienExercice widget.
  FocusNode? lienExerciceFocusNode;
  TextEditingController? lienExerciceTextController;
  String? Function(BuildContext, String?)? lienExerciceTextControllerValidator;
  bool isDataUploading_uploadData543 = false;
  FFUploadedFile uploadedLocalFile_uploadData543 =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_uploadData543 = '';

  bool isDataUploading_uploadDataVideo543 = false;
  FFUploadedFile uploadedLocalFile_uploadDataVideo543 =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_uploadDataVideo543 = '';

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    nomExerciceFocusNode?.dispose();
    nomExerciceTextController?.dispose();

    explicationExerciceFocusNode?.dispose();
    explicationExerciceTextController?.dispose();

    lienExerciceFocusNode?.dispose();
    lienExerciceTextController?.dispose();
  }
}
