import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/firebase_storage/storage.dart';
import '/flutter_flow/flutter_flow_autocomplete_options_list.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/flutter_flow/upload_data.dart';
import 'dart:ui';
import '/flutter_flow/custom_functions.dart' as functions;
import 'modifier_utilisateur_widget.dart' show ModifierUtilisateurWidget;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';

class ModifierUtilisateurModel
    extends FlutterFlowModel<ModifierUtilisateurWidget> {
  ///  Local state fields for this component.

  String? photoUserStock;

  DateTime? dateNaissanceStock;

  ///  State fields for stateful widgets in this component.

  bool isDataUploading_uploadData8ss254 = false;
  FFUploadedFile uploadedLocalFile_uploadData8ss254 =
      FFUploadedFile(bytes: Uint8List.fromList([]), originalFilename: '');
  String uploadedFileUrl_uploadData8ss254 = '';

  // State field(s) for nom widget.
  FocusNode? nomFocusNode;
  TextEditingController? nomTextController;
  String? Function(BuildContext, String?)? nomTextControllerValidator;
  // State field(s) for prenom widget.
  FocusNode? prenomFocusNode;
  TextEditingController? prenomTextController;
  String? Function(BuildContext, String?)? prenomTextControllerValidator;
  // State field(s) for TextFieldDateNaissance widget.
  FocusNode? textFieldDateNaissanceFocusNode;
  TextEditingController? textFieldDateNaissanceTextController;
  late MaskTextInputFormatter textFieldDateNaissanceMask;
  String? Function(BuildContext, String?)?
      textFieldDateNaissanceTextControllerValidator;
  DateTime? datePicked;
  // State field(s) for ChoiceChipsGenre widget.
  FormFieldController<List<String>>? choiceChipsGenreValueController;
  String? get choiceChipsGenreValue =>
      choiceChipsGenreValueController?.value?.firstOrNull;
  set choiceChipsGenreValue(String? val) =>
      choiceChipsGenreValueController?.value = val != null ? [val] : [];
  // State field(s) for indicatifTel widget.
  FocusNode? indicatifTelFocusNode;
  TextEditingController? indicatifTelTextController;
  String? Function(BuildContext, String?)? indicatifTelTextControllerValidator;
  // State field(s) for phone widget.
  FocusNode? phoneFocusNode;
  TextEditingController? phoneTextController;
  String? Function(BuildContext, String?)? phoneTextControllerValidator;
  // State field(s) for rue widget.
  FocusNode? rueFocusNode;
  TextEditingController? rueTextController;
  String? Function(BuildContext, String?)? rueTextControllerValidator;
  // State field(s) for codePostale widget.
  final codePostaleKey = GlobalKey();
  FocusNode? codePostaleFocusNode;
  TextEditingController? codePostaleTextController;
  String? codePostaleSelectedOption;
  String? Function(BuildContext, String?)? codePostaleTextControllerValidator;
  // State field(s) for villeAdresse widget.
  final villeAdresseKey = GlobalKey();
  FocusNode? villeAdresseFocusNode;
  TextEditingController? villeAdresseTextController;
  String? villeAdresseSelectedOption;
  String? Function(BuildContext, String?)? villeAdresseTextControllerValidator;
  // State field(s) for decouverteTC widget.
  final decouverteTCKey = GlobalKey();
  FocusNode? decouverteTCFocusNode;
  TextEditingController? decouverteTCTextController;
  String? decouverteTCSelectedOption;
  String? Function(BuildContext, String?)? decouverteTCTextControllerValidator;
  // State field(s) for nbKM widget.
  FocusNode? nbKMFocusNode;
  TextEditingController? nbKMTextController;
  String? Function(BuildContext, String?)? nbKMTextControllerValidator;
  // State field(s) for tps_route widget.
  FocusNode? tpsRouteFocusNode;
  TextEditingController? tpsRouteTextController;
  late MaskTextInputFormatter tpsRouteMask;
  String? Function(BuildContext, String?)? tpsRouteTextControllerValidator;
  // State field(s) for siret widget.
  FocusNode? siretFocusNode;
  TextEditingController? siretTextController;
  String? Function(BuildContext, String?)? siretTextControllerValidator;
  // State field(s) for infos widget.
  FocusNode? infosFocusNode;
  TextEditingController? infosTextController;
  String? Function(BuildContext, String?)? infosTextControllerValidator;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    nomFocusNode?.dispose();
    nomTextController?.dispose();

    prenomFocusNode?.dispose();
    prenomTextController?.dispose();

    textFieldDateNaissanceFocusNode?.dispose();
    textFieldDateNaissanceTextController?.dispose();

    indicatifTelFocusNode?.dispose();
    indicatifTelTextController?.dispose();

    phoneFocusNode?.dispose();
    phoneTextController?.dispose();

    rueFocusNode?.dispose();
    rueTextController?.dispose();

    codePostaleFocusNode?.dispose();

    villeAdresseFocusNode?.dispose();

    decouverteTCFocusNode?.dispose();

    nbKMFocusNode?.dispose();
    nbKMTextController?.dispose();

    tpsRouteFocusNode?.dispose();
    tpsRouteTextController?.dispose();

    siretFocusNode?.dispose();
    siretTextController?.dispose();

    infosFocusNode?.dispose();
    infosTextController?.dispose();
  }
}
