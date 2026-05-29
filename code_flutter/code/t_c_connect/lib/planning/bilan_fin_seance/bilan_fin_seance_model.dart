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
import 'bilan_fin_seance_widget.dart' show BilanFinSeanceWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class BilanFinSeanceModel extends FlutterFlowModel<BilanFinSeanceWidget> {
  ///  Local state fields for this component.

  int? rpeStock;

  int? motivStock;

  int? intensiteMiseStock;

  ///  State fields for stateful widgets in this component.

  // State field(s) for RatingBarMotiv widget.
  double? ratingBarMotivValue;
  // State field(s) for RatingBarIntensiteMise widget.
  double? ratingBarIntensiteMiseValue;
  // State field(s) for RatingBarRpe widget.
  double? ratingBarRpeValue;
  // Stores action output result for [Firestore Query - Query a collection] action in Button widget.
  UsersRecord? userAdmin;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
