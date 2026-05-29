import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';
import '/backend/schema/enums/enums.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ExercicesRecord extends FirestoreRecord {
  ExercicesRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "partie_prioritaire" field.
  String? _partiePrioritaire;
  String get partiePrioritaire => _partiePrioritaire ?? '';
  bool hasPartiePrioritaire() => _partiePrioritaire != null;

  // "nom_exercice" field.
  String? _nomExercice;
  String get nomExercice => _nomExercice ?? '';
  bool hasNomExercice() => _nomExercice != null;

  // "image_exercice" field.
  String? _imageExercice;
  String get imageExercice => _imageExercice ?? '';
  bool hasImageExercice() => _imageExercice != null;

  // "video_exercice" field.
  String? _videoExercice;
  String get videoExercice => _videoExercice ?? '';
  bool hasVideoExercice() => _videoExercice != null;

  // "lien_exercice" field.
  String? _lienExercice;
  String get lienExercice => _lienExercice ?? '';
  bool hasLienExercice() => _lienExercice != null;

  // "explications_commentees_exercice" field.
  String? _explicationsCommenteesExercice;
  String get explicationsCommenteesExercice =>
      _explicationsCommenteesExercice ?? '';
  bool hasExplicationsCommenteesExercice() =>
      _explicationsCommenteesExercice != null;

  // "Materiel" field.
  List<String>? _materiel;
  List<String> get materiel => _materiel ?? const [];
  bool hasMateriel() => _materiel != null;

  // "Muscles" field.
  List<String>? _muscles;
  List<String> get muscles => _muscles ?? const [];
  bool hasMuscles() => _muscles != null;

  // "exercice_reference_si_duplicage_photo_video" field.
  DocumentReference? _exerciceReferenceSiDuplicagePhotoVideo;
  DocumentReference? get exerciceReferenceSiDuplicagePhotoVideo =>
      _exerciceReferenceSiDuplicagePhotoVideo;
  bool hasExerciceReferenceSiDuplicagePhotoVideo() =>
      _exerciceReferenceSiDuplicagePhotoVideo != null;

  void _initializeFields() {
    _partiePrioritaire = snapshotData['partie_prioritaire'] as String?;
    _nomExercice = snapshotData['nom_exercice'] as String?;
    _imageExercice = snapshotData['image_exercice'] as String?;
    _videoExercice = snapshotData['video_exercice'] as String?;
    _lienExercice = snapshotData['lien_exercice'] as String?;
    _explicationsCommenteesExercice =
        snapshotData['explications_commentees_exercice'] as String?;
    _materiel = getDataList(snapshotData['Materiel']);
    _muscles = getDataList(snapshotData['Muscles']);
    _exerciceReferenceSiDuplicagePhotoVideo =
        snapshotData['exercice_reference_si_duplicage_photo_video']
            as DocumentReference?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('exercices');

  static Stream<ExercicesRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ExercicesRecord.fromSnapshot(s));

  static Future<ExercicesRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ExercicesRecord.fromSnapshot(s));

  static ExercicesRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ExercicesRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ExercicesRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ExercicesRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ExercicesRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ExercicesRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createExercicesRecordData({
  String? partiePrioritaire,
  String? nomExercice,
  String? imageExercice,
  String? videoExercice,
  String? lienExercice,
  String? explicationsCommenteesExercice,
  DocumentReference? exerciceReferenceSiDuplicagePhotoVideo,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'partie_prioritaire': partiePrioritaire,
      'nom_exercice': nomExercice,
      'image_exercice': imageExercice,
      'video_exercice': videoExercice,
      'lien_exercice': lienExercice,
      'explications_commentees_exercice': explicationsCommenteesExercice,
      'exercice_reference_si_duplicage_photo_video':
          exerciceReferenceSiDuplicagePhotoVideo,
    }.withoutNulls,
  );

  return firestoreData;
}

class ExercicesRecordDocumentEquality implements Equality<ExercicesRecord> {
  const ExercicesRecordDocumentEquality();

  @override
  bool equals(ExercicesRecord? e1, ExercicesRecord? e2) {
    const listEquality = ListEquality();
    return e1?.partiePrioritaire == e2?.partiePrioritaire &&
        e1?.nomExercice == e2?.nomExercice &&
        e1?.imageExercice == e2?.imageExercice &&
        e1?.videoExercice == e2?.videoExercice &&
        e1?.lienExercice == e2?.lienExercice &&
        e1?.explicationsCommenteesExercice ==
            e2?.explicationsCommenteesExercice &&
        listEquality.equals(e1?.materiel, e2?.materiel) &&
        listEquality.equals(e1?.muscles, e2?.muscles) &&
        e1?.exerciceReferenceSiDuplicagePhotoVideo ==
            e2?.exerciceReferenceSiDuplicagePhotoVideo;
  }

  @override
  int hash(ExercicesRecord? e) => const ListEquality().hash([
        e?.partiePrioritaire,
        e?.nomExercice,
        e?.imageExercice,
        e?.videoExercice,
        e?.lienExercice,
        e?.explicationsCommenteesExercice,
        e?.materiel,
        e?.muscles,
        e?.exerciceReferenceSiDuplicagePhotoVideo
      ]);

  @override
  bool isValidKey(Object? o) => o is ExercicesRecord;
}
