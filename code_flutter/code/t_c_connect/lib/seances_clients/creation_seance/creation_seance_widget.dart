import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_choice_chips.dart';
import '/flutter_flow/flutter_flow_count_controller.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import '/seances_clients/intensite_circuit/intensite_circuit_widget.dart';
import 'dart:math';
import 'dart:ui';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mask_text_input_formatter/mask_text_input_formatter.dart';
import 'package:provider/provider.dart';
import 'creation_seance_model.dart';
export 'creation_seance_model.dart';

class CreationSeanceWidget extends StatefulWidget {
  const CreationSeanceWidget({
    super.key,
    this.refSeance,
    this.seanceExist,
    this.refPlanning,
  });

  final SeanceRecord? refSeance;
  final String? seanceExist;
  final PlanningProRecord? refPlanning;

  @override
  State<CreationSeanceWidget> createState() => _CreationSeanceWidgetState();
}

class _CreationSeanceWidgetState extends State<CreationSeanceWidget>
    with TickerProviderStateMixin {
  late CreationSeanceModel _model;

  final animationsMap = <String, AnimationInfo>{};

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => CreationSeanceModel());

    // On component load action.
    SchedulerBinding.instance.addPostFrameCallback((_) async {
      _model.compteNbSeance = await querySeanceRecordCount(
        queryBuilder: (seanceRecord) => seanceRecord.where(
          'ref_planning',
          isEqualTo: widget!.refPlanning?.reference,
        ),
      );
      safeSetState(() {
        _model.numCircuitValue = ((_model.compteNbSeance!) + 1);
      });
    });

    _model.nbToursTextController ??= TextEditingController(
        text: widget!.seanceExist == 'Oui'
            ? widget!.refSeance?.nbTours?.toString()
            : '');
    _model.nbToursFocusNode ??= FocusNode();

    _model.nbToursMask = MaskTextInputFormatter(mask: '###');
    _model.recupToursTextController ??= TextEditingController(
        text: widget!.seanceExist == 'Oui'
            ? widget!.refSeance?.recupTours?.toString()
            : '');
    _model.recupToursFocusNode ??= FocusNode();

    _model.recupToursMask = MaskTextInputFormatter(mask: '###');
    _model.effortDefaultTextController ??= TextEditingController(
        text: widget!.seanceExist == 'Oui'
            ? widget!.refSeance?.tpsEffortExoDefault?.toString()
            : '');
    _model.effortDefaultFocusNode ??= FocusNode();

    _model.effortDefaultMask = MaskTextInputFormatter(mask: '###');
    _model.recupDefaultTextController ??= TextEditingController(
        text: widget!.seanceExist == 'Oui'
            ? widget!.refSeance?.tpsRecupExoDefault?.toString()
            : '');
    _model.recupDefaultFocusNode ??= FocusNode();

    _model.recupDefaultMask = MaskTextInputFormatter(mask: '###');
    _model.observationsTextController ??= TextEditingController(
        text: widget!.seanceExist == 'Oui'
            ? widget!.refSeance?.observationsSeance
            : '');
    _model.observationsFocusNode ??= FocusNode();

    animationsMap.addAll({
      'containerOnPageLoadAnimation': AnimationInfo(
        trigger: AnimationTrigger.onPageLoad,
        effectsBuilder: () => [
          VisibilityEffect(duration: 300.ms),
          MoveEffect(
            curve: Curves.bounceOut,
            delay: 300.0.ms,
            duration: 400.0.ms,
            begin: Offset(0.0, 100.0),
            end: Offset(0.0, 0.0),
          ),
          FadeEffect(
            curve: Curves.easeInOut,
            delay: 300.0.ms,
            duration: 400.0.ms,
            begin: 0.0,
            end: 1.0,
          ),
        ],
      ),
    });
    setupAnimations(
      animationsMap.values.where((anim) =>
          anim.trigger == AnimationTrigger.onActionTrigger ||
          !anim.applyInitialState),
      this,
    );

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 500.0,
      height: double.infinity,
      decoration: BoxDecoration(),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.max,
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsetsDirectional.fromSTEB(16.0, 2.0, 16.0, 16.0),
              child: Container(
                width: double.infinity,
                constraints: BoxConstraints(
                  maxWidth: 670.0,
                ),
                decoration: BoxDecoration(
                  color: FlutterFlowTheme.of(context).secondaryBackground,
                  boxShadow: [
                    BoxShadow(
                      blurRadius: 12.0,
                      color: Color(0x1E000000),
                      offset: Offset(
                        0.0,
                        5.0,
                      ),
                    )
                  ],
                  borderRadius: BorderRadius.circular(16.0),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.max,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding:
                          EdgeInsetsDirectional.fromSTEB(0.0, 16.0, 0.0, 0.0),
                      child: Row(
                        mainAxisSize: MainAxisSize.max,
                        children: [
                          Expanded(
                            child: Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  24.0, 0.0, 0.0, 0.0),
                              child: Text(
                                'Création séance',
                                style: FlutterFlowTheme.of(context)
                                    .headlineMedium
                                    .override(
                                      font: GoogleFonts.interTight(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .headlineMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .headlineMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .headlineMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .headlineMedium
                                          .fontStyle,
                                    ),
                              ),
                            ),
                          ),
                          Align(
                            alignment: AlignmentDirectional(1.0, 0.0),
                            child: Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  0.0, 0.0, 5.0, 0.0),
                              child: FlutterFlowIconButton(
                                borderRadius: 8.0,
                                buttonSize: 40.0,
                                icon: Icon(
                                  Icons.close,
                                  color: FlutterFlowTheme.of(context).primary,
                                  size: 24.0,
                                ),
                                onPressed: () async {
                                  context.safePop();
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding:
                          EdgeInsetsDirectional.fromSTEB(0.0, 16.0, 0.0, 32.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.max,
                        children: [
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                0.0, 5.0, 0.0, 0.0),
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                mainAxisSize: MainAxisSize.max,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Align(
                                    alignment: AlignmentDirectional(0.0, 0.0),
                                    child: Container(
                                      width: 380.0,
                                      height: 70.0,
                                      decoration: BoxDecoration(
                                        color: FlutterFlowTheme.of(context)
                                            .secondaryBackground,
                                      ),
                                      child: Align(
                                        alignment:
                                            AlignmentDirectional(0.0, 0.0),
                                        child: FlutterFlowChoiceChips(
                                          options: [
                                            ChipData('Echauffement'),
                                            ChipData('Corps de séance'),
                                            ChipData('Retour au calme')
                                          ],
                                          onChanged: (val) => safeSetState(() =>
                                              _model.choiceChipsPartiesSeancesValue =
                                                  val?.firstOrNull),
                                          selectedChipStyle: ChipStyle(
                                            backgroundColor:
                                                FlutterFlowTheme.of(context)
                                                    .primary,
                                            textStyle:
                                                FlutterFlowTheme.of(context)
                                                    .bodyMedium
                                                    .override(
                                                      font: GoogleFonts.inter(
                                                        fontWeight:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontWeight,
                                                        fontStyle:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontStyle,
                                                      ),
                                                      color:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .info,
                                                      letterSpacing: 0.0,
                                                      fontWeight:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontWeight,
                                                      fontStyle:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontStyle,
                                                    ),
                                            iconColor:
                                                FlutterFlowTheme.of(context)
                                                    .info,
                                            iconSize: 16.0,
                                            elevation: 0.0,
                                            borderRadius:
                                                BorderRadius.circular(8.0),
                                          ),
                                          unselectedChipStyle: ChipStyle(
                                            backgroundColor:
                                                FlutterFlowTheme.of(context)
                                                    .secondaryBackground,
                                            textStyle:
                                                FlutterFlowTheme.of(context)
                                                    .bodyMedium
                                                    .override(
                                                      font: GoogleFonts.inter(
                                                        fontWeight:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontWeight,
                                                        fontStyle:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontStyle,
                                                      ),
                                                      color:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .secondaryText,
                                                      letterSpacing: 0.0,
                                                      fontWeight:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontWeight,
                                                      fontStyle:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontStyle,
                                                    ),
                                            iconColor:
                                                FlutterFlowTheme.of(context)
                                                    .secondaryText,
                                            iconSize: 16.0,
                                            elevation: 0.0,
                                            borderRadius:
                                                BorderRadius.circular(8.0),
                                          ),
                                          chipSpacing: 0.0,
                                          multiselect: false,
                                          initialized: _model
                                                  .choiceChipsPartiesSeancesValue !=
                                              null,
                                          alignment: WrapAlignment.center,
                                          controller: _model
                                                  .choiceChipsPartiesSeancesValueController ??=
                                              FormFieldController<List<String>>(
                                            [
                                              widget!.seanceExist == 'Oui'
                                                  ? widget!
                                                      .refSeance!.partieSeance
                                                  : 'Corps de séance'
                                            ],
                                          ),
                                          wrapped: true,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.max,
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisSize: MainAxisSize.max,
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Padding(
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          5.0, 0.0, 5.0, 0.0),
                                      child: Container(
                                        width: 300.0,
                                        height: 40.0,
                                        decoration: BoxDecoration(
                                          color: FlutterFlowTheme.of(context)
                                              .secondaryBackground,
                                          borderRadius:
                                              BorderRadius.circular(12.0),
                                          border: Border.all(
                                            color: FlutterFlowTheme.of(context)
                                                .primary,
                                            width: 1.0,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.max,
                                          children: [
                                            Expanded(
                                              child: Padding(
                                                padding: EdgeInsetsDirectional
                                                    .fromSTEB(
                                                        5.0, 2.0, 5.0, 2.0),
                                                child:
                                                    FlutterFlowDropDown<String>(
                                                  controller: _model
                                                          .dropDownTypeSeanceValueController ??=
                                                      FormFieldController<
                                                          String>(
                                                    _model.dropDownTypeSeanceValue ??=
                                                        widget!.seanceExist ==
                                                                'Oui'
                                                            ? widget!.refSeance
                                                                ?.typeSeance
                                                            : '',
                                                  ),
                                                  options: [
                                                    'Circuit classique',
                                                    'Tabata',
                                                    'Circuit en 30-10',
                                                    'Circuit varié (rep)',
                                                    'Circuit varié (temps)',
                                                    'Circuit varié'
                                                  ],
                                                  onChanged: (val) async {
                                                    safeSetState(() => _model
                                                            .dropDownTypeSeanceValue =
                                                        val);
                                                    if (_model
                                                            .dropDownTypeSeanceValue ==
                                                        'Circuit classique') {
                                                      safeSetState(() {
                                                        _model
                                                            .nbToursTextController
                                                            ?.text = '3';
                                                        _model.nbToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .nbToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupToursTextController
                                                            ?.text = '30';
                                                        _model.recupToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .effortDefaultTextController
                                                            ?.text = '30';
                                                        _model.effortDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .effortDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupDefaultTextController
                                                            ?.text = '5';
                                                        _model.recupDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .choiceChipsTypeEffortDefaultValueController
                                                            ?.value = [
                                                          'Secondes'
                                                        ];
                                                      });
                                                    } else if (_model
                                                            .dropDownTypeSeanceValue ==
                                                        'Tabata') {
                                                      safeSetState(() {
                                                        _model
                                                            .nbToursTextController
                                                            ?.text = '4';
                                                        _model.nbToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .nbToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupToursTextController
                                                            ?.text = '0';
                                                        _model.recupToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .effortDefaultTextController
                                                            ?.text = '20';
                                                        _model.effortDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .effortDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupDefaultTextController
                                                            ?.text = '10';
                                                        _model.recupDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .choiceChipsTypeEffortDefaultValueController
                                                            ?.value = [
                                                          'Secondes'
                                                        ];
                                                      });
                                                    } else if (_model
                                                            .dropDownTypeSeanceValue ==
                                                        'Circuit en 30-10') {
                                                      safeSetState(() {
                                                        _model
                                                            .nbToursTextController
                                                            ?.text = '3';
                                                        _model.nbToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .nbToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupToursTextController
                                                            ?.text = '10';
                                                        _model.recupToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .effortDefaultTextController
                                                            ?.text = '30';
                                                        _model.effortDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .effortDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupDefaultTextController
                                                            ?.text = '10';
                                                        _model.recupDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .choiceChipsTypeEffortDefaultValueController
                                                            ?.value = [
                                                          'Secondes'
                                                        ];
                                                      });
                                                    } else if (_model
                                                            .dropDownTypeSeanceValue ==
                                                        'Circuit varié (rep)') {
                                                      safeSetState(() {
                                                        _model
                                                            .nbToursTextController
                                                            ?.text = '3';
                                                        _model.nbToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .nbToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupToursTextController
                                                            ?.text = '30';
                                                        _model.recupToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .effortDefaultTextController
                                                            ?.text = '10';
                                                        _model.effortDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .effortDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupDefaultTextController
                                                            ?.text = '5';
                                                        _model.recupDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .choiceChipsTypeEffortDefaultValueController
                                                            ?.value = [
                                                          'Répétitions'
                                                        ];
                                                      });
                                                    } else if (_model
                                                            .dropDownTypeSeanceValue ==
                                                        'Circuit varié (temps)') {
                                                      safeSetState(() {
                                                        _model
                                                            .nbToursTextController
                                                            ?.text = '3';
                                                        _model.nbToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .nbToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupToursTextController
                                                            ?.text = '30';
                                                        _model.recupToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .effortDefaultTextController
                                                            ?.text = '30';
                                                        _model.effortDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .effortDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupDefaultTextController
                                                            ?.text = '5';
                                                        _model.recupDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .choiceChipsTypeEffortDefaultValueController
                                                            ?.value = [
                                                          'Secondes'
                                                        ];
                                                      });
                                                    } else if (_model
                                                            .dropDownTypeSeanceValue ==
                                                        'Circuit varié') {
                                                      safeSetState(() {
                                                        _model
                                                            .nbToursTextController
                                                            ?.text = '3';
                                                        _model.nbToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .nbToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupToursTextController
                                                            ?.text = '30';
                                                        _model.recupToursMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupToursTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .effortDefaultTextController
                                                            ?.text = '30';
                                                        _model.effortDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .effortDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                      safeSetState(() {
                                                        _model
                                                            .recupDefaultTextController
                                                            ?.text = '5';
                                                        _model.recupDefaultMask
                                                            .updateMask(
                                                          newValue:
                                                              TextEditingValue(
                                                            text: _model
                                                                .recupDefaultTextController!
                                                                .text,
                                                          ),
                                                        );
                                                      });
                                                    }
                                                  },
                                                  width: 200.0,
                                                  height: 40.0,
                                                  textStyle: FlutterFlowTheme
                                                          .of(context)
                                                      .bodyMedium
                                                      .override(
                                                        font: GoogleFonts.inter(
                                                          fontWeight:
                                                              FlutterFlowTheme.of(
                                                                      context)
                                                                  .bodyMedium
                                                                  .fontWeight,
                                                          fontStyle:
                                                              FlutterFlowTheme.of(
                                                                      context)
                                                                  .bodyMedium
                                                                  .fontStyle,
                                                        ),
                                                        letterSpacing: 0.0,
                                                        fontWeight:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontWeight,
                                                        fontStyle:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontStyle,
                                                      ),
                                                  icon: Icon(
                                                    Icons
                                                        .keyboard_arrow_down_rounded,
                                                    color: FlutterFlowTheme.of(
                                                            context)
                                                        .secondaryText,
                                                    size: 24.0,
                                                  ),
                                                  fillColor:
                                                      FlutterFlowTheme.of(
                                                              context)
                                                          .secondaryBackground,
                                                  elevation: 2.0,
                                                  borderColor:
                                                      Colors.transparent,
                                                  borderWidth: 0.0,
                                                  borderRadius: 8.0,
                                                  margin: EdgeInsetsDirectional
                                                      .fromSTEB(
                                                          12.0, 0.0, 12.0, 0.0),
                                                  hidesUnderline: true,
                                                  isOverButton: false,
                                                  isSearchable: false,
                                                  isMultiSelect: false,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 16.0, 24.0, 0.0),
                            child: TextFormField(
                              controller: _model.nbToursTextController,
                              focusNode: _model.nbToursFocusNode,
                              autofocus: true,
                              obscureText: false,
                              decoration: InputDecoration(
                                labelText: 'Nombre de tours',
                                labelStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FontWeight.w600,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FontWeight.w600,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                hintStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color:
                                        FlutterFlowTheme.of(context).alternate,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).primary,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                filled: true,
                                fillColor: FlutterFlowTheme.of(context)
                                    .secondaryBackground,
                                contentPadding: EdgeInsetsDirectional.fromSTEB(
                                    20.0, 24.0, 20.0, 24.0),
                              ),
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    font: GoogleFonts.inter(
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                    letterSpacing: 0.0,
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontStyle,
                                  ),
                              maxLines: null,
                              keyboardType: TextInputType.number,
                              cursorColor: FlutterFlowTheme.of(context).primary,
                              validator: _model.nbToursTextControllerValidator
                                  .asValidator(context),
                              inputFormatters: [_model.nbToursMask],
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 16.0, 24.0, 0.0),
                            child: TextFormField(
                              controller: _model.recupToursTextController,
                              focusNode: _model.recupToursFocusNode,
                              autofocus: true,
                              obscureText: false,
                              decoration: InputDecoration(
                                labelText:
                                    'Récupération entre les tours (en sec)',
                                labelStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FontWeight.w600,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FontWeight.w600,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                hintStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color:
                                        FlutterFlowTheme.of(context).alternate,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).primary,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                filled: true,
                                fillColor: FlutterFlowTheme.of(context)
                                    .secondaryBackground,
                                contentPadding: EdgeInsetsDirectional.fromSTEB(
                                    20.0, 24.0, 20.0, 24.0),
                              ),
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    font: GoogleFonts.inter(
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                    letterSpacing: 0.0,
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontStyle,
                                  ),
                              maxLines: null,
                              keyboardType: TextInputType.number,
                              cursorColor: FlutterFlowTheme.of(context).primary,
                              validator: _model
                                  .recupToursTextControllerValidator
                                  .asValidator(context),
                              inputFormatters: [_model.recupToursMask],
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                0.0, 5.0, 0.0, 0.0),
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                mainAxisSize: MainAxisSize.max,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Align(
                                    alignment: AlignmentDirectional(0.0, 0.0),
                                    child: Container(
                                      width: 400.0,
                                      height: 40.0,
                                      decoration: BoxDecoration(
                                        color: FlutterFlowTheme.of(context)
                                            .secondaryBackground,
                                      ),
                                      child: Align(
                                        alignment:
                                            AlignmentDirectional(0.0, 0.0),
                                        child: FlutterFlowChoiceChips(
                                          options: [
                                            ChipData('Répétitions'),
                                            ChipData('Secondes')
                                          ],
                                          onChanged: (val) => safeSetState(() =>
                                              _model.choiceChipsTypeEffortDefaultValue =
                                                  val?.firstOrNull),
                                          selectedChipStyle: ChipStyle(
                                            backgroundColor:
                                                FlutterFlowTheme.of(context)
                                                    .primary,
                                            textStyle:
                                                FlutterFlowTheme.of(context)
                                                    .bodyMedium
                                                    .override(
                                                      font: GoogleFonts.inter(
                                                        fontWeight:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontWeight,
                                                        fontStyle:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontStyle,
                                                      ),
                                                      color:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .info,
                                                      letterSpacing: 0.0,
                                                      fontWeight:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontWeight,
                                                      fontStyle:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontStyle,
                                                    ),
                                            iconColor:
                                                FlutterFlowTheme.of(context)
                                                    .info,
                                            iconSize: 16.0,
                                            elevation: 0.0,
                                            borderRadius:
                                                BorderRadius.circular(8.0),
                                          ),
                                          unselectedChipStyle: ChipStyle(
                                            backgroundColor:
                                                FlutterFlowTheme.of(context)
                                                    .secondaryBackground,
                                            textStyle:
                                                FlutterFlowTheme.of(context)
                                                    .bodyMedium
                                                    .override(
                                                      font: GoogleFonts.inter(
                                                        fontWeight:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontWeight,
                                                        fontStyle:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .bodyMedium
                                                                .fontStyle,
                                                      ),
                                                      color:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .secondaryText,
                                                      letterSpacing: 0.0,
                                                      fontWeight:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontWeight,
                                                      fontStyle:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .bodyMedium
                                                              .fontStyle,
                                                    ),
                                            iconColor:
                                                FlutterFlowTheme.of(context)
                                                    .secondaryText,
                                            iconSize: 16.0,
                                            elevation: 0.0,
                                            borderRadius:
                                                BorderRadius.circular(8.0),
                                          ),
                                          chipSpacing: 0.0,
                                          multiselect: false,
                                          initialized: _model
                                                  .choiceChipsTypeEffortDefaultValue !=
                                              null,
                                          alignment: WrapAlignment.start,
                                          controller: _model
                                                  .choiceChipsTypeEffortDefaultValueController ??=
                                              FormFieldController<List<String>>(
                                            [
                                              widget!.seanceExist == 'Oui'
                                                  ? widget!.refSeance!
                                                      .typeEffortExoDefault
                                                  : ''
                                            ],
                                          ),
                                          wrapped: true,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 16.0, 24.0, 0.0),
                            child: TextFormField(
                              controller: _model.effortDefaultTextController,
                              focusNode: _model.effortDefaultFocusNode,
                              autofocus: true,
                              obscureText: false,
                              decoration: InputDecoration(
                                labelText: 'Effort par défaut',
                                labelStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FontWeight.w600,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FontWeight.w600,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                hintStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color:
                                        FlutterFlowTheme.of(context).alternate,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).primary,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                filled: true,
                                fillColor: FlutterFlowTheme.of(context)
                                    .secondaryBackground,
                                contentPadding: EdgeInsetsDirectional.fromSTEB(
                                    20.0, 24.0, 20.0, 24.0),
                              ),
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    font: GoogleFonts.inter(
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                    letterSpacing: 0.0,
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontStyle,
                                  ),
                              maxLines: null,
                              keyboardType: TextInputType.number,
                              cursorColor: FlutterFlowTheme.of(context).primary,
                              validator: _model
                                  .effortDefaultTextControllerValidator
                                  .asValidator(context),
                              inputFormatters: [_model.effortDefaultMask],
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 16.0, 24.0, 0.0),
                            child: TextFormField(
                              controller: _model.recupDefaultTextController,
                              focusNode: _model.recupDefaultFocusNode,
                              autofocus: true,
                              obscureText: false,
                              decoration: InputDecoration(
                                labelText: 'Récupération par défaut',
                                labelStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FontWeight.w600,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FontWeight.w600,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                hintStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color:
                                        FlutterFlowTheme.of(context).alternate,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).primary,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                filled: true,
                                fillColor: FlutterFlowTheme.of(context)
                                    .secondaryBackground,
                                contentPadding: EdgeInsetsDirectional.fromSTEB(
                                    20.0, 24.0, 20.0, 24.0),
                              ),
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    font: GoogleFonts.inter(
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                    letterSpacing: 0.0,
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontStyle,
                                  ),
                              maxLines: null,
                              keyboardType: TextInputType.number,
                              cursorColor: FlutterFlowTheme.of(context).primary,
                              validator: _model
                                  .recupDefaultTextControllerValidator
                                  .asValidator(context),
                              inputFormatters: [_model.recupDefaultMask],
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 16.0, 24.0, 0.0),
                            child: TextFormField(
                              controller: _model.observationsTextController,
                              focusNode: _model.observationsFocusNode,
                              autofocus: true,
                              obscureText: false,
                              decoration: InputDecoration(
                                labelText: 'Observations',
                                labelStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FontWeight.w600,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FontWeight.w600,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                hintStyle: FlutterFlowTheme.of(context)
                                    .labelMedium
                                    .override(
                                      font: GoogleFonts.inter(
                                        fontWeight: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontWeight,
                                        fontStyle: FlutterFlowTheme.of(context)
                                            .labelMedium
                                            .fontStyle,
                                      ),
                                      letterSpacing: 0.0,
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .labelMedium
                                          .fontStyle,
                                    ),
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color:
                                        FlutterFlowTheme.of(context).alternate,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).primary,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                    color: FlutterFlowTheme.of(context).error,
                                    width: 2.0,
                                  ),
                                  borderRadius: BorderRadius.circular(12.0),
                                ),
                                filled: true,
                                fillColor: FlutterFlowTheme.of(context)
                                    .secondaryBackground,
                                contentPadding: EdgeInsetsDirectional.fromSTEB(
                                    20.0, 24.0, 20.0, 24.0),
                              ),
                              style: FlutterFlowTheme.of(context)
                                  .bodyMedium
                                  .override(
                                    font: GoogleFonts.inter(
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .bodyMedium
                                          .fontStyle,
                                    ),
                                    letterSpacing: 0.0,
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .bodyMedium
                                        .fontStyle,
                                  ),
                              maxLines: null,
                              cursorColor: FlutterFlowTheme.of(context).primary,
                              validator: _model
                                  .observationsTextControllerValidator
                                  .asValidator(context),
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 5.0, 24.0, 0.0),
                            child: Row(
                              mainAxisSize: MainAxisSize.max,
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  width: 120.0,
                                  height: 40.0,
                                  decoration: BoxDecoration(
                                    color: FlutterFlowTheme.of(context)
                                        .secondaryBackground,
                                    borderRadius: BorderRadius.circular(8.0),
                                    shape: BoxShape.rectangle,
                                  ),
                                  child: FlutterFlowCountController(
                                    decrementIconBuilder: (enabled) => Icon(
                                      Icons.remove_rounded,
                                      color: enabled
                                          ? FlutterFlowTheme.of(context)
                                              .secondaryText
                                          : FlutterFlowTheme.of(context)
                                              .alternate,
                                      size: 24.0,
                                    ),
                                    incrementIconBuilder: (enabled) => Icon(
                                      Icons.add_rounded,
                                      color: enabled
                                          ? FlutterFlowTheme.of(context).primary
                                          : FlutterFlowTheme.of(context)
                                              .alternate,
                                      size: 24.0,
                                    ),
                                    countBuilder: (count) => Text(
                                      count.toString(),
                                      style: FlutterFlowTheme.of(context)
                                          .titleLarge
                                          .override(
                                            font: GoogleFonts.interTight(
                                              fontWeight:
                                                  FlutterFlowTheme.of(context)
                                                      .titleLarge
                                                      .fontWeight,
                                              fontStyle:
                                                  FlutterFlowTheme.of(context)
                                                      .titleLarge
                                                      .fontStyle,
                                            ),
                                            letterSpacing: 0.0,
                                            fontWeight:
                                                FlutterFlowTheme.of(context)
                                                    .titleLarge
                                                    .fontWeight,
                                            fontStyle:
                                                FlutterFlowTheme.of(context)
                                                    .titleLarge
                                                    .fontStyle,
                                          ),
                                    ),
                                    count: _model.numCircuitValue ??=
                                        valueOrDefault<int>(
                                      widget!.seanceExist == 'Oui'
                                          ? widget!.refSeance?.numCircuit
                                          : 1,
                                      1,
                                    ),
                                    updateCount: (count) => safeSetState(
                                        () => _model.numCircuitValue = count),
                                    stepSize: 1,
                                    minimum: 1,
                                    contentPadding:
                                        EdgeInsetsDirectional.fromSTEB(
                                            12.0, 0.0, 12.0, 0.0),
                                  ),
                                ),
                                if ((_model.choiceChipsPartiesSeancesValue !=
                                            null &&
                                        _model.choiceChipsPartiesSeancesValue !=
                                            '') &&
                                    (_model.dropDownTypeSeanceValue != null &&
                                        _model.dropDownTypeSeanceValue != '') &&
                                    (_model.nbToursTextController.text !=
                                            null &&
                                        _model.nbToursTextController.text !=
                                            '') &&
                                    (_model.recupToursTextController.text !=
                                            null &&
                                        _model.recupToursTextController.text !=
                                            '') &&
                                    (_model.numCircuitValue != null))
                                  Align(
                                    alignment: AlignmentDirectional(0.0, 0.05),
                                    child: Builder(
                                      builder: (context) => FFButtonWidget(
                                        onPressed: () async {
                                          if (widget!.seanceExist == 'Oui') {
                                            await widget!.refSeance!.reference
                                                .update(createSeanceRecordData(
                                              partieSeance: _model
                                                  .choiceChipsPartiesSeancesValue,
                                              nbTours: int.tryParse(_model
                                                  .nbToursTextController.text),
                                              observationsSeance: _model
                                                  .observationsTextController
                                                  .text,
                                              recupTours: int.tryParse(_model
                                                  .recupToursTextController
                                                  .text),
                                              typeSeance: _model
                                                  .dropDownTypeSeanceValue,
                                              numCircuit:
                                                  _model.numCircuitValue,
                                              typeEffortExoDefault: _model
                                                  .choiceChipsTypeEffortDefaultValue,
                                              tpsEffortExoDefault: int.tryParse(
                                                  _model
                                                      .effortDefaultTextController
                                                      .text),
                                              tpsRecupExoDefault: int.tryParse(
                                                  _model
                                                      .recupDefaultTextController
                                                      .text),
                                              dateCreate: widget!.refSeance
                                                          ?.dateCreate ==
                                                      null
                                                  ? getCurrentTimestamp
                                                  : widget!
                                                      .refSeance?.dateCreate,
                                            ));
                                            Navigator.pop(context);
                                            await showDialog(
                                              context: context,
                                              builder: (dialogContext) {
                                                return Dialog(
                                                  elevation: 0,
                                                  insetPadding: EdgeInsets.zero,
                                                  backgroundColor:
                                                      Colors.transparent,
                                                  alignment:
                                                      AlignmentDirectional(
                                                              0.0, 0.0)
                                                          .resolve(
                                                              Directionality.of(
                                                                  context)),
                                                  child: IntensiteCircuitWidget(
                                                    refSeance:
                                                        widget!.refSeance,
                                                  ),
                                                );
                                              },
                                            );
                                          } else {
                                            var seanceRecordReference =
                                                SeanceRecord.collection.doc();
                                            await seanceRecordReference
                                                .set(createSeanceRecordData(
                                              refPlanning: widget!
                                                  .refPlanning?.reference,
                                              partieSeance: _model
                                                  .choiceChipsPartiesSeancesValue,
                                              observationsSeance: _model
                                                  .observationsTextController
                                                  .text,
                                              nbTours: int.tryParse(_model
                                                  .nbToursTextController.text),
                                              recupTours: int.tryParse(_model
                                                  .recupToursTextController
                                                  .text),
                                              typeSeance: _model
                                                  .dropDownTypeSeanceValue,
                                              refUsers:
                                                  widget!.refPlanning?.refUsers,
                                              numCircuit:
                                                  _model.numCircuitValue,
                                              typeEffortExoDefault: _model
                                                  .choiceChipsTypeEffortDefaultValue,
                                              tpsEffortExoDefault: int.tryParse(
                                                  _model
                                                      .effortDefaultTextController
                                                      .text),
                                              tpsRecupExoDefault: int.tryParse(
                                                  _model
                                                      .recupDefaultTextController
                                                      .text),
                                              dateCreate: getCurrentTimestamp,
                                            ));
                                            _model.refSeanceCreate =
                                                SeanceRecord
                                                    .getDocumentFromData(
                                                        createSeanceRecordData(
                                                          refPlanning: widget!
                                                              .refPlanning
                                                              ?.reference,
                                                          partieSeance: _model
                                                              .choiceChipsPartiesSeancesValue,
                                                          observationsSeance: _model
                                                              .observationsTextController
                                                              .text,
                                                          nbTours: int.tryParse(
                                                              _model
                                                                  .nbToursTextController
                                                                  .text),
                                                          recupTours: int
                                                              .tryParse(_model
                                                                  .recupToursTextController
                                                                  .text),
                                                          typeSeance: _model
                                                              .dropDownTypeSeanceValue,
                                                          refUsers: widget!
                                                              .refPlanning
                                                              ?.refUsers,
                                                          numCircuit: _model
                                                              .numCircuitValue,
                                                          typeEffortExoDefault:
                                                              _model
                                                                  .choiceChipsTypeEffortDefaultValue,
                                                          tpsEffortExoDefault:
                                                              int.tryParse(_model
                                                                  .effortDefaultTextController
                                                                  .text),
                                                          tpsRecupExoDefault:
                                                              int.tryParse(_model
                                                                  .recupDefaultTextController
                                                                  .text),
                                                          dateCreate:
                                                              getCurrentTimestamp,
                                                        ),
                                                        seanceRecordReference);
                                            Navigator.pop(context);
                                            await showDialog(
                                              context: context,
                                              builder: (dialogContext) {
                                                return Dialog(
                                                  elevation: 0,
                                                  insetPadding: EdgeInsets.zero,
                                                  backgroundColor:
                                                      Colors.transparent,
                                                  alignment:
                                                      AlignmentDirectional(
                                                              0.0, 0.0)
                                                          .resolve(
                                                              Directionality.of(
                                                                  context)),
                                                  child: IntensiteCircuitWidget(
                                                    refSeance:
                                                        _model.refSeanceCreate,
                                                  ),
                                                );
                                              },
                                            );
                                          }

                                          safeSetState(() {});
                                        },
                                        text: 'Enregistrer et Poursuivre',
                                        options: FFButtonOptions(
                                          height: 44.0,
                                          padding:
                                              EdgeInsetsDirectional.fromSTEB(
                                                  24.0, 0.0, 24.0, 0.0),
                                          iconPadding:
                                              EdgeInsetsDirectional.fromSTEB(
                                                  0.0, 0.0, 0.0, 0.0),
                                          color: FlutterFlowTheme.of(context)
                                              .primary,
                                          textStyle: FlutterFlowTheme.of(
                                                  context)
                                              .titleSmall
                                              .override(
                                                font: GoogleFonts.interTight(
                                                  fontWeight:
                                                      FlutterFlowTheme.of(
                                                              context)
                                                          .titleSmall
                                                          .fontWeight,
                                                  fontStyle:
                                                      FlutterFlowTheme.of(
                                                              context)
                                                          .titleSmall
                                                          .fontStyle,
                                                ),
                                                color:
                                                    FlutterFlowTheme.of(context)
                                                        .primaryBackground,
                                                letterSpacing: 0.0,
                                                fontWeight:
                                                    FlutterFlowTheme.of(context)
                                                        .titleSmall
                                                        .fontWeight,
                                                fontStyle:
                                                    FlutterFlowTheme.of(context)
                                                        .titleSmall
                                                        .fontStyle,
                                              ),
                                          elevation: 3.0,
                                          borderSide: BorderSide(
                                            color: Colors.transparent,
                                            width: 1.0,
                                          ),
                                          borderRadius:
                                              BorderRadius.circular(12.0),
                                          hoverColor:
                                              FlutterFlowTheme.of(context)
                                                  .accent1,
                                          hoverBorderSide: BorderSide(
                                            color: FlutterFlowTheme.of(context)
                                                .primary,
                                            width: 1.0,
                                          ),
                                          hoverTextColor:
                                              FlutterFlowTheme.of(context)
                                                  .primaryText,
                                          hoverElevation: 0.0,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ).animateOnPageLoad(
                  animationsMap['containerOnPageLoadAnimation']!),
            ),
          ],
        ),
      ),
    );
  }
}
