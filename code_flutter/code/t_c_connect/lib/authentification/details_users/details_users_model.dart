import '/auth/firebase_auth/auth_util.dart';
import '/authentification/modifier_details_user/modifier_details_user_widget.dart';
import '/authentification/modifier_utilisateur/modifier_utilisateur_widget.dart';
import '/backend/backend.dart';
import '/components/bouton_adresses_widget.dart';
import '/components/nav_bar_web_widget.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import '/index.dart';
import 'details_users_widget.dart' show DetailsUsersWidget;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class DetailsUsersModel extends FlutterFlowModel<DetailsUsersWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for Nav_bar_web component.
  late NavBarWebModel navBarWebModel;
  // State field(s) for TextFieldDebut widget.
  FocusNode? textFieldDebutFocusNode;
  TextEditingController? textFieldDebutTextController;
  String? Function(BuildContext, String?)?
      textFieldDebutTextControllerValidator;
  // State field(s) for TextFieldMail widget.
  FocusNode? textFieldMailFocusNode;
  TextEditingController? textFieldMailTextController;
  String? Function(BuildContext, String?)? textFieldMailTextControllerValidator;
  // State field(s) for TextFieldMdp widget.
  FocusNode? textFieldMdpFocusNode;
  TextEditingController? textFieldMdpTextController;
  String? Function(BuildContext, String?)? textFieldMdpTextControllerValidator;
  // State field(s) for TextFieldFin widget.
  FocusNode? textFieldFinFocusNode;
  TextEditingController? textFieldFinTextController;
  String? Function(BuildContext, String?)? textFieldFinTextControllerValidator;
  // State field(s) for ChoiceChips widget.
  FormFieldController<List<String>>? choiceChipsValueController;
  String? get choiceChipsValue =>
      choiceChipsValueController?.value?.firstOrNull;
  set choiceChipsValue(String? val) =>
      choiceChipsValueController?.value = val != null ? [val] : [];
  // State field(s) for ListView widget.

  PagingController<DocumentSnapshot?, DatabaseUsersDetailsRecord>?
      listViewPagingController1;
  Query? listViewPagingQuery1;
  List<StreamSubscription?> listViewStreamSubscriptions1 = [];

  @override
  void initState(BuildContext context) {
    navBarWebModel = createModel(context, () => NavBarWebModel());
  }

  @override
  void dispose() {
    navBarWebModel.dispose();
    textFieldDebutFocusNode?.dispose();
    textFieldDebutTextController?.dispose();

    textFieldMailFocusNode?.dispose();
    textFieldMailTextController?.dispose();

    textFieldMdpFocusNode?.dispose();
    textFieldMdpTextController?.dispose();

    textFieldFinFocusNode?.dispose();
    textFieldFinTextController?.dispose();

    listViewStreamSubscriptions1.forEach((s) => s?.cancel());
    listViewPagingController1?.dispose();
  }

  /// Additional helper methods.
  PagingController<DocumentSnapshot?, DatabaseUsersDetailsRecord>
      setListViewController1(
    Query query, {
    DocumentReference<Object?>? parent,
  }) {
    listViewPagingController1 ??= _createListViewController1(query, parent);
    if (listViewPagingQuery1 != query) {
      listViewPagingQuery1 = query;
      listViewPagingController1?.refresh();
    }
    return listViewPagingController1!;
  }

  PagingController<DocumentSnapshot?, DatabaseUsersDetailsRecord>
      _createListViewController1(
    Query query,
    DocumentReference<Object?>? parent,
  ) {
    final controller =
        PagingController<DocumentSnapshot?, DatabaseUsersDetailsRecord>(
            firstPageKey: null);
    return controller
      ..addPageRequestListener(
        (nextPageMarker) => queryDatabaseUsersDetailsRecordPage(
          queryBuilder: (_) => listViewPagingQuery1 ??= query,
          nextPageMarker: nextPageMarker,
          streamSubscriptions: listViewStreamSubscriptions1,
          controller: controller,
          pageSize: 10,
          isStream: true,
        ),
      );
  }
}
