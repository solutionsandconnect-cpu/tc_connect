import 'package:flutter/material.dart';
import 'flutter_flow/flutter_flow_util.dart';

abstract class FFAppConstants {
  static const List<String> Materiel = [
    'Sac',
    'Tapis',
    'Enceinte',
    'Chrono',
    'Elastiques',
    'Bande élastiques',
    'Haltères'
  ];
  static const List<String> MaterielPreSelection = [
    'Sac',
    'Tapis',
    'Enceinte',
    'Chrono'
  ];
  static const List<String> ListeTypeRdvTC = [
    'Séance',
    'Programme',
    'Rendez-vous informations',
    'Rendez-vous bilan',
    'Règlement TC',
    'Séance en autonomie',
    'Autre activité',
    'Parcours sportif'
  ];
  static const List<String> ListeTypeRdvSC = [
    'Rendez-vous infos S&C',
    'Rendez-vous bilan S&C',
    'Règlement S&C'
  ];
  static const List<String> ListeTypeRdvFFD = ['Détection', 'Règlement FFD'];
  static const List<String> ListeTypeRdvEMF = ['Séminaire', 'Règlement EMF'];
}
