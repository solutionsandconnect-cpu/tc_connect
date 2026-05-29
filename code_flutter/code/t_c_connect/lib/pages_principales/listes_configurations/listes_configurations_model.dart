import '/auth/base_auth_user_provider.dart';
import '/auth/firebase_auth/auth_util.dart';
import '/components/nav_bar_web_widget.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'listes_configurations_widget.dart' show ListesConfigurationsWidget;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class ListesConfigurationsModel
    extends FlutterFlowModel<ListesConfigurationsWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for Nav_bar_web component.
  late NavBarWebModel navBarWebModel;

  @override
  void initState(BuildContext context) {
    navBarWebModel = createModel(context, () => NavBarWebModel());
  }

  @override
  void dispose() {
    navBarWebModel.dispose();
  }
}
