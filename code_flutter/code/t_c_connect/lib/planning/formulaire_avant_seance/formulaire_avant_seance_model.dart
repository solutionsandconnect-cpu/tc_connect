import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/backend/schema/enums/enums.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'formulaire_avant_seance_widget.dart' show FormulaireAvantSeanceWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class FormulaireAvantSeanceModel
    extends FlutterFlowModel<FormulaireAvantSeanceWidget> {
  ///  Local state fields for this component.

  int? qualiteSommeil = 1;

  int? niveauFatigue = 1;

  int? niveauCourbatures = 1;

  int? quantiteStress = 1;

  int? motivAvantSeance = 1;

  int? alimentationAvantSeance = 1;

  int? activiteAvantSeance = 1;

  String? infosComplementaireAvantSeance;

  ///  State fields for stateful widgets in this component.

  // State field(s) for RatingBarSommeil widget.
  double? ratingBarSommeilValue;
  // State field(s) for RatingBarFatigue widget.
  double? ratingBarFatigueValue;
  // State field(s) for RatingBarCourbatures widget.
  double? ratingBarCourbaturesValue;
  // State field(s) for RatingBarStress widget.
  double? ratingBarStressValue;
  // State field(s) for RatingBarMotiv widget.
  double? ratingBarMotivValue;
  // State field(s) for RatingBarActivite widget.
  double? ratingBarActiviteValue;
  // State field(s) for RatingBarAlimentation widget.
  double? ratingBarAlimentationValue;
  // State field(s) for infosComplementaires widget.
  FocusNode? infosComplementairesFocusNode;
  TextEditingController? infosComplementairesTextController;
  String? Function(BuildContext, String?)?
      infosComplementairesTextControllerValidator;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  UsersRecord? userAdmin;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    infosComplementairesFocusNode?.dispose();
    infosComplementairesTextController?.dispose();
  }
}
