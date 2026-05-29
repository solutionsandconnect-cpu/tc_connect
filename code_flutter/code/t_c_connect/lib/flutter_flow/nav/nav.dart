import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:page_transition/page_transition.dart';
import 'package:provider/provider.dart';
import '/backend/backend.dart';

import '/backend/schema/enums/enums.dart';

import '/auth/base_auth_user_provider.dart';

import '/main.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/lat_lng.dart';
import '/flutter_flow/place.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'serialization_util.dart';

import '/index.dart';

export 'package:go_router/go_router.dart';
export 'serialization_util.dart';

const kTransitionInfoKey = '__transition_info__';

GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

class AppStateNotifier extends ChangeNotifier {
  AppStateNotifier._();

  static AppStateNotifier? _instance;
  static AppStateNotifier get instance => _instance ??= AppStateNotifier._();

  BaseAuthUser? initialUser;
  BaseAuthUser? user;
  bool showSplashImage = true;
  String? _redirectLocation;

  /// Determines whether the app will refresh and build again when a sign
  /// in or sign out happens. This is useful when the app is launched or
  /// on an unexpected logout. However, this must be turned off when we
  /// intend to sign in/out and then navigate or perform any actions after.
  /// Otherwise, this will trigger a refresh and interrupt the action(s).
  bool notifyOnAuthChange = true;

  bool get loading => user == null || showSplashImage;
  bool get loggedIn => user?.loggedIn ?? false;
  bool get initiallyLoggedIn => initialUser?.loggedIn ?? false;
  bool get shouldRedirect => loggedIn && _redirectLocation != null;

  String getRedirectLocation() => _redirectLocation!;
  bool hasRedirect() => _redirectLocation != null;
  void setRedirectLocationIfUnset(String loc) => _redirectLocation ??= loc;
  void clearRedirectLocation() => _redirectLocation = null;

  /// Mark as not needing to notify on a sign in / out when we intend
  /// to perform subsequent actions (such as navigation) afterwards.
  void updateNotifyOnAuthChange(bool notify) => notifyOnAuthChange = notify;

  void update(BaseAuthUser newUser) {
    final shouldUpdate =
        user?.uid == null || newUser.uid == null || user?.uid != newUser.uid;
    initialUser ??= newUser;
    user = newUser;
    // Refresh the app on auth change unless explicitly marked otherwise.
    // No need to update unless the user has changed.
    if (notifyOnAuthChange && shouldUpdate) {
      notifyListeners();
    }
    // Once again mark the notifier as needing to update on auth change
    // (in order to catch sign in / out events).
    updateNotifyOnAuthChange(true);
  }

  void stopShowingSplashImage() {
    showSplashImage = false;
    notifyListeners();
  }
}

GoRouter createRouter(AppStateNotifier appStateNotifier) => GoRouter(
      initialLocation: '/',
      debugLogDiagnostics: true,
      refreshListenable: appStateNotifier,
      navigatorKey: appNavigatorKey,
      errorBuilder: (context, state) =>
          appStateNotifier.loggedIn ? NavBarPage() : AuthentificationWidget(),
      routes: [
        FFRoute(
          name: '_initialize',
          path: '/',
          builder: (context, _) => appStateNotifier.loggedIn
              ? NavBarPage()
              : AuthentificationWidget(),
        ),
        FFRoute(
          name: AuthentificationWidget.routeName,
          path: AuthentificationWidget.routePath,
          builder: (context, params) => AuthentificationWidget(),
        ),
        FFRoute(
          name: EditProfilWidget.routeName,
          path: EditProfilWidget.routePath,
          builder: (context, params) => EditProfilWidget(
            parametreAuth: params.getParam(
              'parametreAuth',
              ParamType.DocumentReference,
              isList: false,
              collectionNamePath: ['users'],
            ),
          ),
        ),
        FFRoute(
            name: MonProfilWidget.routeName,
            path: MonProfilWidget.routePath,
            builder: (context, params) => params.isEmpty
                ? NavBarPage(initialPage: 'MonProfil')
                : NavBarPage(
                    initialPage: 'MonProfil',
                    page: MonProfilWidget(),
                  )),
        FFRoute(
            name: AccueilEquipeWidget.routeName,
            path: AccueilEquipeWidget.routePath,
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: AccueilEquipeWidget(),
                )),
        FFRoute(
          name: CreateTeamCopyWidget.routeName,
          path: CreateTeamCopyWidget.routePath,
          asyncParams: {
            'parametreTeam': getDoc(['team'], TeamRecord.fromSnapshot),
          },
          builder: (context, params) => CreateTeamCopyWidget(
            parametreTeam: params.getParam(
              'parametreTeam',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: AddEquipeWidget.routeName,
          path: AddEquipeWidget.routePath,
          builder: (context, params) => AddEquipeWidget(),
        ),
        FFRoute(
          name: EditEquipeWidget.routeName,
          path: EditEquipeWidget.routePath,
          asyncParams: {
            'parametreTeam': getDoc(['team'], TeamRecord.fromSnapshot),
          },
          builder: (context, params) => EditEquipeWidget(
            parametreTeam: params.getParam(
              'parametreTeam',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
            name: DetailsEquipeWidget.routeName,
            path: DetailsEquipeWidget.routePath,
            asyncParams: {
              'parametreDetailsEquipe':
                  getDoc(['team'], TeamRecord.fromSnapshot),
            },
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: DetailsEquipeWidget(
                    parametreDetailsEquipe: params.getParam(
                      'parametreDetailsEquipe',
                      ParamType.Document,
                    ),
                  ),
                )),
        FFRoute(
          name: AddJoueurWidget.routeName,
          path: AddJoueurWidget.routePath,
          asyncParams: {
            'parametreAddJoueurEquipe':
                getDoc(['team'], TeamRecord.fromSnapshot),
            'parametreAddJoueurUser':
                getDoc(['users'], UsersRecord.fromSnapshot),
          },
          builder: (context, params) => AddJoueurWidget(
            parametreAddJoueurEquipe: params.getParam(
              'parametreAddJoueurEquipe',
              ParamType.Document,
            ),
            parametreAddJoueurUser: params.getParam(
              'parametreAddJoueurUser',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: DetailsJoueurWidget.routeName,
          path: DetailsJoueurWidget.routePath,
          asyncParams: {
            'parametreDetailsJoueur':
                getDoc(['joueurs'], JoueursRecord.fromSnapshot),
          },
          builder: (context, params) => DetailsJoueurWidget(
            parametreDetailsJoueur: params.getParam(
              'parametreDetailsJoueur',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: EditJoueurWidget.routeName,
          path: EditJoueurWidget.routePath,
          asyncParams: {
            'parametreEditJoueur':
                getDoc(['joueurs'], JoueursRecord.fromSnapshot),
          },
          builder: (context, params) => EditJoueurWidget(
            parametreEditJoueur: params.getParam(
              'parametreEditJoueur',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: AddStaffWidget.routeName,
          path: AddStaffWidget.routePath,
          asyncParams: {
            'parametreAddStaffEquipe':
                getDoc(['team'], TeamRecord.fromSnapshot),
            'parametreAddStaffUser':
                getDoc(['users'], UsersRecord.fromSnapshot),
          },
          builder: (context, params) => AddStaffWidget(
            parametreAddStaffEquipe: params.getParam(
              'parametreAddStaffEquipe',
              ParamType.Document,
            ),
            parametreAddStaffUser: params.getParam(
              'parametreAddStaffUser',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: AddRPEWidget.routeName,
          path: AddRPEWidget.routePath,
          asyncParams: {
            'parametreJoueur': getDoc(['joueurs'], JoueursRecord.fromSnapshot),
          },
          builder: (context, params) => AddRPEWidget(
            parametreJoueur: params.getParam(
              'parametreJoueur',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
            name: PlanningWidget.routeName,
            path: PlanningWidget.routePath,
            builder: (context, params) => params.isEmpty
                ? NavBarPage(initialPage: 'Planning')
                : NavBarPage(
                    initialPage: 'Planning',
                    page: PlanningWidget(),
                  )),
        FFRoute(
            name: DetailsPlanningWidget.routeName,
            path: DetailsPlanningWidget.routePath,
            asyncParams: {
              'refPlanning':
                  getDoc(['planning_pro'], PlanningProRecord.fromSnapshot),
              'refUsers': getDoc(['users'], UsersRecord.fromSnapshot),
            },
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: DetailsPlanningWidget(
                    refPlanning: params.getParam(
                      'refPlanning',
                      ParamType.Document,
                    ),
                    refUsers: params.getParam(
                      'refUsers',
                      ParamType.Document,
                    ),
                  ),
                )),
        FFRoute(
            name: ListesExercicesWidget.routeName,
            path: ListesExercicesWidget.routePath,
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: ListesExercicesWidget(),
                )),
        FFRoute(
            name: ListesConfigurationsWidget.routeName,
            path: ListesConfigurationsWidget.routePath,
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: ListesConfigurationsWidget(),
                )),
        FFRoute(
            name: ListesUsersWidget.routeName,
            path: ListesUsersWidget.routePath,
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: ListesUsersWidget(),
                )),
        FFRoute(
            name: DetailsSeanceWidget.routeName,
            path: DetailsSeanceWidget.routePath,
            asyncParams: {
              'refSeance': getDoc(['seance'], SeanceRecord.fromSnapshot),
            },
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: DetailsSeanceWidget(
                    refSeance: params.getParam(
                      'refSeance',
                      ParamType.Document,
                    ),
                  ),
                )),
        FFRoute(
            name: SeanceWidget.routeName,
            path: SeanceWidget.routePath,
            asyncParams: {
              'refPlanning':
                  getDoc(['planning_pro'], PlanningProRecord.fromSnapshot),
              'retourPartieSeance':
                  getDoc(['seance'], SeanceRecord.fromSnapshot),
            },
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: SeanceWidget(
                    refPlanning: params.getParam(
                      'refPlanning',
                      ParamType.Document,
                    ),
                    retourPartieSeance: params.getParam(
                      'retourPartieSeance',
                      ParamType.Document,
                    ),
                  ),
                )),
        FFRoute(
          name: FicheExerciceWidget.routeName,
          path: FicheExerciceWidget.routePath,
          asyncParams: {
            'refExerciceBdd':
                getDoc(['exercices'], ExercicesRecord.fromSnapshot),
          },
          builder: (context, params) => FicheExerciceWidget(
            refExerciceBdd: params.getParam(
              'refExerciceBdd',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: SeanceLancementWidget.routeName,
          path: SeanceLancementWidget.routePath,
          asyncParams: {
            'refSeance': getDoc(['seance'], SeanceRecord.fromSnapshot),
            'refPlanningStock':
                getDoc(['planning_pro'], PlanningProRecord.fromSnapshot),
          },
          builder: (context, params) => SeanceLancementWidget(
            refSeance: params.getParam(
              'refSeance',
              ParamType.Document,
            ),
            numExo: params.getParam(
              'numExo',
              ParamType.int,
            ),
            refPlanningStock: params.getParam(
              'refPlanningStock',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
            name: AccueilWidget.routeName,
            path: AccueilWidget.routePath,
            builder: (context, params) => params.isEmpty
                ? NavBarPage(initialPage: 'Accueil')
                : NavBarPage(
                    initialPage: 'Accueil',
                    page: AccueilWidget(),
                  )),
        FFRoute(
            name: NotificationsWidget.routeName,
            path: NotificationsWidget.routePath,
            builder: (context, params) => params.isEmpty
                ? NavBarPage(initialPage: 'Notifications')
                : NavBarPage(
                    initialPage: 'Notifications',
                    page: NotificationsWidget(),
                  )),
        FFRoute(
            name: DetailsUsersWidget.routeName,
            path: DetailsUsersWidget.routePath,
            asyncParams: {
              'refUser': getDoc(['users'], UsersRecord.fromSnapshot),
            },
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: DetailsUsersWidget(
                    refUser: params.getParam(
                      'refUser',
                      ParamType.Document,
                    ),
                  ),
                )),
        FFRoute(
            name: NotesWidget.routeName,
            path: NotesWidget.routePath,
            asyncParams: {
              'refUsers': getDoc(['users'], UsersRecord.fromSnapshot),
            },
            builder: (context, params) => NavBarPage(
                  initialPage: '',
                  page: NotesWidget(
                    refUsers: params.getParam(
                      'refUsers',
                      ParamType.Document,
                    ),
                  ),
                )),
        FFRoute(
          name: ASupprWidget.routeName,
          path: ASupprWidget.routePath,
          builder: (context, params) => ASupprWidget(),
        ),
        FFRoute(
          name: SeanceFicheExerciceWidget.routeName,
          path: SeanceFicheExerciceWidget.routePath,
          asyncParams: {
            'refExerciceSeance': getDoc(
                ['programme_seance'], ProgrammeSeanceRecord.fromSnapshot),
          },
          builder: (context, params) => SeanceFicheExerciceWidget(
            refExerciceSeance: params.getParam(
              'refExerciceSeance',
              ParamType.Document,
            ),
          ),
        ),
        FFRoute(
          name: AVerifierWidget.routeName,
          path: AVerifierWidget.routePath,
          builder: (context, params) => AVerifierWidget(),
        ),
        FFRoute(
          name: PlanningAboWidget.routeName,
          path: PlanningAboWidget.routePath,
          asyncParams: {
            'refAbo': getDoc(['database_users_details'],
                DatabaseUsersDetailsRecord.fromSnapshot),
          },
          builder: (context, params) => PlanningAboWidget(
            refAbo: params.getParam(
              'refAbo',
              ParamType.Document,
            ),
          ),
        )
      ].map((r) => r.toRoute(appStateNotifier)).toList(),
      observers: [routeObserver],
    );

extension NavParamExtensions on Map<String, String?> {
  Map<String, String> get withoutNulls => Map.fromEntries(
        entries
            .where((e) => e.value != null)
            .map((e) => MapEntry(e.key, e.value!)),
      );
}

extension NavigationExtensions on BuildContext {
  void goNamedAuth(
    String name,
    bool mounted, {
    Map<String, String> pathParameters = const <String, String>{},
    Map<String, String> queryParameters = const <String, String>{},
    Object? extra,
    bool ignoreRedirect = false,
  }) =>
      !mounted || GoRouter.of(this).shouldRedirect(ignoreRedirect)
          ? null
          : goNamed(
              name,
              pathParameters: pathParameters,
              queryParameters: queryParameters,
              extra: extra,
            );

  void pushNamedAuth(
    String name,
    bool mounted, {
    Map<String, String> pathParameters = const <String, String>{},
    Map<String, String> queryParameters = const <String, String>{},
    Object? extra,
    bool ignoreRedirect = false,
  }) =>
      !mounted || GoRouter.of(this).shouldRedirect(ignoreRedirect)
          ? null
          : pushNamed(
              name,
              pathParameters: pathParameters,
              queryParameters: queryParameters,
              extra: extra,
            );

  void safePop() {
    // If there is only one route on the stack, navigate to the initial
    // page instead of popping.
    if (canPop()) {
      pop();
    } else {
      go('/');
    }
  }
}

extension GoRouterExtensions on GoRouter {
  AppStateNotifier get appState => AppStateNotifier.instance;
  void prepareAuthEvent([bool ignoreRedirect = false]) =>
      appState.hasRedirect() && !ignoreRedirect
          ? null
          : appState.updateNotifyOnAuthChange(false);
  bool shouldRedirect(bool ignoreRedirect) =>
      !ignoreRedirect && appState.hasRedirect();
  void clearRedirectLocation() => appState.clearRedirectLocation();
  void setRedirectLocationIfUnset(String location) =>
      appState.updateNotifyOnAuthChange(false);
}

extension _GoRouterStateExtensions on GoRouterState {
  Map<String, dynamic> get extraMap =>
      extra != null ? extra as Map<String, dynamic> : {};
  Map<String, dynamic> get allParams => <String, dynamic>{}
    ..addAll(pathParameters)
    ..addAll(uri.queryParameters)
    ..addAll(extraMap);
  TransitionInfo get transitionInfo => extraMap.containsKey(kTransitionInfoKey)
      ? extraMap[kTransitionInfoKey] as TransitionInfo
      : TransitionInfo.appDefault();
}

class FFParameters {
  FFParameters(this.state, [this.asyncParams = const {}]);

  final GoRouterState state;
  final Map<String, Future<dynamic> Function(String)> asyncParams;

  Map<String, dynamic> futureParamValues = {};

  // Parameters are empty if the params map is empty or if the only parameter
  // present is the special extra parameter reserved for the transition info.
  bool get isEmpty =>
      state.allParams.isEmpty ||
      (state.allParams.length == 1 &&
          state.extraMap.containsKey(kTransitionInfoKey));
  bool isAsyncParam(MapEntry<String, dynamic> param) =>
      asyncParams.containsKey(param.key) && param.value is String;
  bool get hasFutures => state.allParams.entries.any(isAsyncParam);
  Future<bool> completeFutures() => Future.wait(
        state.allParams.entries.where(isAsyncParam).map(
          (param) async {
            final doc = await asyncParams[param.key]!(param.value)
                .onError((_, __) => null);
            if (doc != null) {
              futureParamValues[param.key] = doc;
              return true;
            }
            return false;
          },
        ),
      ).onError((_, __) => [false]).then((v) => v.every((e) => e));

  dynamic getParam<T>(
    String paramName,
    ParamType type, {
    bool isList = false,
    List<String>? collectionNamePath,
  }) {
    if (futureParamValues.containsKey(paramName)) {
      return futureParamValues[paramName];
    }
    if (!state.allParams.containsKey(paramName)) {
      return null;
    }
    final param = state.allParams[paramName];
    // Got parameter from `extras`, so just directly return it.
    if (param is! String) {
      return param;
    }
    // Return serialized value.
    return deserializeParam<T>(
      param,
      type,
      isList,
      collectionNamePath: collectionNamePath,
    );
  }
}

class FFRoute {
  const FFRoute({
    required this.name,
    required this.path,
    required this.builder,
    this.requireAuth = false,
    this.asyncParams = const {},
    this.routes = const [],
  });

  final String name;
  final String path;
  final bool requireAuth;
  final Map<String, Future<dynamic> Function(String)> asyncParams;
  final Widget Function(BuildContext, FFParameters) builder;
  final List<GoRoute> routes;

  GoRoute toRoute(AppStateNotifier appStateNotifier) => GoRoute(
        name: name,
        path: path,
        redirect: (context, state) {
          if (appStateNotifier.shouldRedirect) {
            final redirectLocation = appStateNotifier.getRedirectLocation();
            appStateNotifier.clearRedirectLocation();
            return redirectLocation;
          }

          if (requireAuth && !appStateNotifier.loggedIn) {
            appStateNotifier.setRedirectLocationIfUnset(state.uri.toString());
            return '/authentification';
          }
          return null;
        },
        pageBuilder: (context, state) {
          fixStatusBarOniOS16AndBelow(context);
          final ffParams = FFParameters(state, asyncParams);
          final page = ffParams.hasFutures
              ? FutureBuilder(
                  future: ffParams.completeFutures(),
                  builder: (context, _) => builder(context, ffParams),
                )
              : builder(context, ffParams);
          final child = appStateNotifier.loading
              ? Center(
                  child: SizedBox(
                    width: 50.0,
                    height: 50.0,
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(
                        FlutterFlowTheme.of(context).primary,
                      ),
                    ),
                  ),
                )
              : page;

          final transitionInfo = state.transitionInfo;
          return transitionInfo.hasTransition
              ? CustomTransitionPage(
                  key: state.pageKey,
                  name: state.name,
                  child: child,
                  transitionDuration: transitionInfo.duration,
                  transitionsBuilder:
                      (context, animation, secondaryAnimation, child) =>
                          PageTransition(
                    type: transitionInfo.transitionType,
                    duration: transitionInfo.duration,
                    reverseDuration: transitionInfo.duration,
                    alignment: transitionInfo.alignment,
                    child: child,
                  ).buildTransitions(
                    context,
                    animation,
                    secondaryAnimation,
                    child,
                  ),
                )
              : MaterialPage(
                  key: state.pageKey, name: state.name, child: child);
        },
        routes: routes,
      );
}

class TransitionInfo {
  const TransitionInfo({
    required this.hasTransition,
    this.transitionType = PageTransitionType.fade,
    this.duration = const Duration(milliseconds: 300),
    this.alignment,
  });

  final bool hasTransition;
  final PageTransitionType transitionType;
  final Duration duration;
  final Alignment? alignment;

  static TransitionInfo appDefault() => TransitionInfo(hasTransition: false);
}

class RootPageContext {
  const RootPageContext(this.isRootPage, [this.errorRoute]);
  final bool isRootPage;
  final String? errorRoute;

  static bool isInactiveRootPage(BuildContext context) {
    final rootPageContext = context.read<RootPageContext?>();
    final isRootPage = rootPageContext?.isRootPage ?? false;
    final location = GoRouterState.of(context).uri.toString();
    return isRootPage &&
        location != '/' &&
        location != rootPageContext?.errorRoute;
  }

  static Widget wrap(Widget child, {String? errorRoute}) => Provider.value(
        value: RootPageContext(true, errorRoute),
        child: child,
      );
}

extension GoRouterLocationExtension on GoRouter {
  String getCurrentLocation() {
    final RouteMatch lastMatch = routerDelegate.currentConfiguration.last;
    final RouteMatchList matchList = lastMatch is ImperativeRouteMatch
        ? lastMatch.matches
        : routerDelegate.currentConfiguration;
    return matchList.uri.toString();
  }
}
