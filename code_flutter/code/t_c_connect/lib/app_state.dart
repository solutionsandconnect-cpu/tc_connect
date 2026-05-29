import 'package:flutter/material.dart';
import '/backend/backend.dart';
import '/backend/schema/enums/enums.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'flutter_flow/flutter_flow_util.dart';

class FFAppState extends ChangeNotifier {
  static FFAppState _instance = FFAppState._internal();

  factory FFAppState() {
    return _instance;
  }

  FFAppState._internal();

  static void reset() {
    _instance = FFAppState._internal();
  }

  Future initializePersistedState() async {}

  void update(VoidCallback callback) {
    callback();
    notifyListeners();
  }

  DateTime? _today = DateTime.fromMillisecondsSinceEpoch(1767265200000);
  DateTime? get today => _today;
  set today(DateTime? value) {
    _today = value;
  }

  DateTime? _dateSelectPlanning =
      DateTime.fromMillisecondsSinceEpoch(1767222000000);
  DateTime? get dateSelectPlanning => _dateSelectPlanning;
  set dateSelectPlanning(DateTime? value) {
    _dateSelectPlanning = value;
  }

  String _PageActuelle = 'Accueil';
  String get PageActuelle => _PageActuelle;
  set PageActuelle(String value) {
    _PageActuelle = value;
  }
}
