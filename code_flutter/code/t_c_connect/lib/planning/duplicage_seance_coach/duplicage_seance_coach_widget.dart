import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_animations.dart';
import '/flutter_flow/flutter_flow_drop_down.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:math';
import 'dart:ui';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'duplicage_seance_coach_model.dart';
export 'duplicage_seance_coach_model.dart';

class DuplicageSeanceCoachWidget extends StatefulWidget {
  const DuplicageSeanceCoachWidget({
    super.key,
    this.refPlanning,
  });

  final PlanningProRecord? refPlanning;

  @override
  State<DuplicageSeanceCoachWidget> createState() =>
      _DuplicageSeanceCoachWidgetState();
}

class _DuplicageSeanceCoachWidgetState extends State<DuplicageSeanceCoachWidget>
    with TickerProviderStateMixin {
  late DuplicageSeanceCoachModel _model;

  final animationsMap = <String, AnimationInfo>{};

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => DuplicageSeanceCoachModel());

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
    return Align(
      alignment: AlignmentDirectional(0.0, 0.0),
      child: Container(
        width: 500.0,
        height: 350.0,
        decoration: BoxDecoration(),
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
                                'Dupliquer la séance',
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
                                  Navigator.pop(context);
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
                                      height: 50.0,
                                      decoration: BoxDecoration(
                                        color: FlutterFlowTheme.of(context)
                                            .secondaryBackground,
                                      ),
                                      child: StreamBuilder<
                                          List<PlanningProRecord>>(
                                        stream: queryPlanningProRecord(
                                          queryBuilder: (planningProRecord) =>
                                              planningProRecord
                                                  .where(
                                                    'nom_event',
                                                    isNotEqualTo: widget!
                                                        .refPlanning?.nomEvent,
                                                  )
                                                  .orderBy('nom_event'),
                                        ),
                                        builder: (context, snapshot) {
                                          // Customize what your widget looks like when it's loading.
                                          if (!snapshot.hasData) {
                                            return Center(
                                              child: SizedBox(
                                                width: 50.0,
                                                height: 50.0,
                                                child:
                                                    CircularProgressIndicator(
                                                  valueColor:
                                                      AlwaysStoppedAnimation<
                                                          Color>(
                                                    FlutterFlowTheme.of(context)
                                                        .primary,
                                                  ),
                                                ),
                                              ),
                                            );
                                          }
                                          List<PlanningProRecord>
                                              dropDownClientDuplicagePlanningProRecordList =
                                              snapshot.data!;

                                          return FlutterFlowDropDown<String>(
                                            controller: _model
                                                    .dropDownClientDuplicageValueController ??=
                                                FormFieldController<String>(
                                              _model.dropDownClientDuplicageValue ??=
                                                  '',
                                            ),
                                            options: List<String>.from(
                                                dropDownClientDuplicagePlanningProRecordList
                                                    .map((e) => e.nomEvent)
                                                    .toList()
                                                    .unique((e) => e)),
                                            optionLabels:
                                                dropDownClientDuplicagePlanningProRecordList
                                                    .map((e) => e.nomEvent)
                                                    .toList()
                                                    .unique((e) => e),
                                            onChanged: (val) async {
                                              safeSetState(() => _model
                                                      .dropDownClientDuplicageValue =
                                                  val);
                                              _model.clientPlanningSelect =
                                                  await queryPlanningProRecordOnce(
                                                queryBuilder:
                                                    (planningProRecord) =>
                                                        planningProRecord.where(
                                                  'nom_event',
                                                  isEqualTo: _model
                                                      .dropDownClientDuplicageValue,
                                                ),
                                                singleRecord: true,
                                              ).then((s) => s.firstOrNull);

                                              safeSetState(() {});
                                            },
                                            width: 200.0,
                                            height: 40.0,
                                            searchHintTextStyle:
                                                FlutterFlowTheme.of(context)
                                                    .labelMedium
                                                    .override(
                                                      font: GoogleFonts.inter(
                                                        fontWeight:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .labelMedium
                                                                .fontWeight,
                                                        fontStyle:
                                                            FlutterFlowTheme.of(
                                                                    context)
                                                                .labelMedium
                                                                .fontStyle,
                                                      ),
                                                      letterSpacing: 0.0,
                                                      fontWeight:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .labelMedium
                                                              .fontWeight,
                                                      fontStyle:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .labelMedium
                                                              .fontStyle,
                                                    ),
                                            searchTextStyle:
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
                                            searchHintText: 'Rechercher...',
                                            icon: Icon(
                                              Icons.keyboard_arrow_down_rounded,
                                              color:
                                                  FlutterFlowTheme.of(context)
                                                      .secondaryText,
                                              size: 24.0,
                                            ),
                                            fillColor:
                                                FlutterFlowTheme.of(context)
                                                    .secondaryBackground,
                                            elevation: 2.0,
                                            borderColor:
                                                FlutterFlowTheme.of(context)
                                                    .primary,
                                            borderWidth: 0.0,
                                            borderRadius: 8.0,
                                            margin:
                                                EdgeInsetsDirectional.fromSTEB(
                                                    12.0, 0.0, 12.0, 0.0),
                                            hidesUnderline: true,
                                            isOverButton: false,
                                            isSearchable: true,
                                            isMultiSelect: false,
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: EdgeInsetsDirectional.fromSTEB(
                                24.0, 5.0, 24.0, 0.0),
                            child: Row(
                              mainAxisSize: MainAxisSize.max,
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Align(
                                  alignment: AlignmentDirectional(0.0, 0.05),
                                  child: FFButtonWidget(
                                    onPressed: () async {
                                      var confirmDialogResponse =
                                          await showDialog<bool>(
                                                context: context,
                                                builder: (alertDialogContext) {
                                                  return AlertDialog(
                                                    title: Text(
                                                        'Duplicage séance'),
                                                    content:
                                                        Text('Êtes-vous sûr ?'),
                                                    actions: [
                                                      TextButton(
                                                        onPressed: () =>
                                                            Navigator.pop(
                                                                alertDialogContext,
                                                                false),
                                                        child: Text('Annuler'),
                                                      ),
                                                      TextButton(
                                                        onPressed: () =>
                                                            Navigator.pop(
                                                                alertDialogContext,
                                                                true),
                                                        child:
                                                            Text('Confirmer'),
                                                      ),
                                                    ],
                                                  );
                                                },
                                              ) ??
                                              false;
                                      if (confirmDialogResponse) {
                                        await widget!.refPlanning!.reference
                                            .update(createPlanningProRecordData(
                                          rdvLie: _model
                                              .clientPlanningSelect?.reference,
                                        ));

                                        await _model
                                            .clientPlanningSelect!.reference
                                            .update(createPlanningProRecordData(
                                          rdvLie:
                                              widget!.refPlanning?.reference,
                                        ));
                                        _model.stockRefPlanningNouveau = _model
                                            .clientPlanningSelect?.reference;
                                        safeSetState(() {});
                                        _model.countNbCircuitPlanningInitial =
                                            await querySeanceRecordCount(
                                          queryBuilder: (seanceRecord) =>
                                              seanceRecord.where(
                                            'ref_planning',
                                            isEqualTo:
                                                widget!.refPlanning?.reference,
                                          ),
                                        );
                                        _model.querySeancePlanninginitial =
                                            await querySeanceRecordOnce(
                                          queryBuilder: (seanceRecord) =>
                                              seanceRecord.where(
                                            'ref_planning',
                                            isEqualTo:
                                                widget!.refPlanning?.reference,
                                          ),
                                        );
                                        while (_model.numDuplicageSeance! <=
                                            _model
                                                .countNbCircuitPlanningInitial!) {
                                          _model.recupSeanceInital =
                                              await querySeanceRecordOnce(
                                            queryBuilder: (seanceRecord) =>
                                                seanceRecord
                                                    .where(
                                                      'ref_planning',
                                                      isEqualTo: widget!
                                                          .refPlanning
                                                          ?.reference,
                                                    )
                                                    .where(
                                                      'num_circuit',
                                                      isEqualTo: _model
                                                          .numDuplicageSeance,
                                                    ),
                                            singleRecord: true,
                                          ).then((s) => s.firstOrNull);

                                          var seanceRecordReference =
                                              SeanceRecord.collection.doc();
                                          await seanceRecordReference
                                              .set(createSeanceRecordData(
                                            refPlanning:
                                                _model.stockRefPlanningNouveau,
                                            partieSeance: _model
                                                .recupSeanceInital
                                                ?.partieSeance,
                                            refUsers: _model
                                                .clientPlanningSelect?.refUsers,
                                            typeSeance: _model
                                                .recupSeanceInital?.typeSeance,
                                            nbTours: _model
                                                .recupSeanceInital?.nbTours,
                                            recupTours: _model
                                                .recupSeanceInital?.recupTours,
                                            numCircuit: _model
                                                .recupSeanceInital?.numCircuit,
                                            nbExercice: _model
                                                .recupSeanceInital?.nbExercice,
                                            intensiteCircuitPlanifie: _model
                                                .recupSeanceInital
                                                ?.intensiteCircuitPlanifie,
                                            typeEffortExoDefault: _model
                                                .recupSeanceInital
                                                ?.typeEffortExoDefault,
                                            tpsEffortExoDefault: _model
                                                .recupSeanceInital
                                                ?.tpsEffortExoDefault,
                                            tpsRecupExoDefault: _model
                                                .recupSeanceInital
                                                ?.tpsRecupExoDefault,
                                            dateCreate: getCurrentTimestamp,
                                            nomEventRef: _model
                                                .clientPlanningSelect?.nomEvent,
                                          ));
                                          _model.nouveauDocSeanceCree =
                                              SeanceRecord.getDocumentFromData(
                                                  createSeanceRecordData(
                                                    refPlanning: _model
                                                        .stockRefPlanningNouveau,
                                                    partieSeance: _model
                                                        .recupSeanceInital
                                                        ?.partieSeance,
                                                    refUsers: _model
                                                        .clientPlanningSelect
                                                        ?.refUsers,
                                                    typeSeance: _model
                                                        .recupSeanceInital
                                                        ?.typeSeance,
                                                    nbTours: _model
                                                        .recupSeanceInital
                                                        ?.nbTours,
                                                    recupTours: _model
                                                        .recupSeanceInital
                                                        ?.recupTours,
                                                    numCircuit: _model
                                                        .recupSeanceInital
                                                        ?.numCircuit,
                                                    nbExercice: _model
                                                        .recupSeanceInital
                                                        ?.nbExercice,
                                                    intensiteCircuitPlanifie: _model
                                                        .recupSeanceInital
                                                        ?.intensiteCircuitPlanifie,
                                                    typeEffortExoDefault: _model
                                                        .recupSeanceInital
                                                        ?.typeEffortExoDefault,
                                                    tpsEffortExoDefault: _model
                                                        .recupSeanceInital
                                                        ?.tpsEffortExoDefault,
                                                    tpsRecupExoDefault: _model
                                                        .recupSeanceInital
                                                        ?.tpsRecupExoDefault,
                                                    dateCreate:
                                                        getCurrentTimestamp,
                                                    nomEventRef: _model
                                                        .clientPlanningSelect
                                                        ?.nomEvent,
                                                  ),
                                                  seanceRecordReference);
                                          _model.countNbExercicePlanningInitial =
                                              await queryProgrammeSeanceRecordCount(
                                            queryBuilder:
                                                (programmeSeanceRecord) =>
                                                    programmeSeanceRecord.where(
                                              'ref_seance',
                                              isEqualTo: _model
                                                  .recupSeanceInital?.reference,
                                            ),
                                          );
                                          while (_model.numDuplicageExo! <=
                                              _model
                                                  .countNbExercicePlanningInitial!) {
                                            _model.recupExerciceInital =
                                                await queryProgrammeSeanceRecordOnce(
                                              queryBuilder:
                                                  (programmeSeanceRecord) =>
                                                      programmeSeanceRecord
                                                          .where(
                                                            'ref_seance',
                                                            isEqualTo: _model
                                                                .recupSeanceInital
                                                                ?.reference,
                                                          )
                                                          .where(
                                                            'num_exercice',
                                                            isEqualTo: _model
                                                                .numDuplicageExo,
                                                          ),
                                              singleRecord: true,
                                            ).then((s) => s.firstOrNull);

                                            await ProgrammeSeanceRecord
                                                .collection
                                                .doc()
                                                .set(
                                                    createProgrammeSeanceRecordData(
                                                  refSeance: _model
                                                      .nouveauDocSeanceCree
                                                      ?.reference,
                                                  exercice: _model
                                                      .recupExerciceInital
                                                      ?.exercice,
                                                  explicationExercice: _model
                                                      .recupExerciceInital
                                                      ?.explicationExercice,
                                                  typeEffort: _model
                                                      .recupExerciceInital
                                                      ?.typeEffort,
                                                  effort: _model
                                                      .recupExerciceInital
                                                      ?.effort,
                                                  recupEffort: _model
                                                      .recupExerciceInital
                                                      ?.recupEffort,
                                                  tempoPhase1: _model
                                                      .recupExerciceInital
                                                      ?.tempoPhase1,
                                                  tempoPhase2: _model
                                                      .recupExerciceInital
                                                      ?.tempoPhase2,
                                                  tempoPhase3: _model
                                                      .recupExerciceInital
                                                      ?.tempoPhase3,
                                                  tempoPhase4: _model
                                                      .recupExerciceInital
                                                      ?.tempoPhase4,
                                                  observations: _model
                                                      .recupExerciceInital
                                                      ?.observations,
                                                  refUsers: _model
                                                      .clientPlanningSelect
                                                      ?.refUsers,
                                                  numExercice: _model
                                                      .recupExerciceInital
                                                      ?.numExercice,
                                                  charge: _model
                                                      .recupExerciceInital
                                                      ?.charge,
                                                  materiel: _model
                                                      .recupExerciceInital
                                                      ?.materiel,
                                                  dateCreate:
                                                      getCurrentTimestamp,
                                                  nomEventRef: _model
                                                      .clientPlanningSelect
                                                      ?.nomEvent,
                                                ));
                                            _model.numDuplicageExo =
                                                _model.numDuplicageExo! + 1;
                                            safeSetState(() {});
                                          }
                                          _model.numDuplicageSeance =
                                              _model.numDuplicageSeance! + 1;
                                          _model.numDuplicageExo = 1;
                                          safeSetState(() {});
                                        }
                                        Navigator.pop(context);
                                      }

                                      safeSetState(() {});
                                    },
                                    text: 'Enregistrer',
                                    options: FFButtonOptions(
                                      height: 44.0,
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          24.0, 0.0, 24.0, 0.0),
                                      iconPadding:
                                          EdgeInsetsDirectional.fromSTEB(
                                              0.0, 0.0, 0.0, 0.0),
                                      color:
                                          FlutterFlowTheme.of(context).primary,
                                      textStyle: FlutterFlowTheme.of(context)
                                          .titleSmall
                                          .override(
                                            font: GoogleFonts.interTight(
                                              fontWeight:
                                                  FlutterFlowTheme.of(context)
                                                      .titleSmall
                                                      .fontWeight,
                                              fontStyle:
                                                  FlutterFlowTheme.of(context)
                                                      .titleSmall
                                                      .fontStyle,
                                            ),
                                            color: FlutterFlowTheme.of(context)
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
                                      borderRadius: BorderRadius.circular(12.0),
                                      hoverColor:
                                          FlutterFlowTheme.of(context).accent1,
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
