import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'lat_lng.dart';
import 'place.dart';
import 'uploaded_file.dart';
import '/backend/backend.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '/backend/schema/enums/enums.dart';
import '/auth/firebase_auth/auth_util.dart';

DateTime substractdateca(RpeRecord? docref) {
  final DateTime originalTime = docref?.date ?? DateTime.now();
  final DateTime newTime = originalTime.subtract(Duration(days: 7));
  return newTime;
}

DateTime substractdatecc(RpeRecord? docref) {
  final DateTime originalTime = docref?.date ?? DateTime.now();
  final DateTime newTime = originalTime.subtract(Duration(days: 28));
  return newTime;
}

DateTime today() {
  return DateTime.now().subtract(Duration(
      hours: DateTime.now().hour,
      minutes: DateTime.now().minute,
      seconds: DateTime.now().second,
      milliseconds: DateTime.now().millisecond,
      microseconds: DateTime.now().microsecond));
}

DateTime parseStringToDate(
  String dateString,
  String format,
) {
  return DateFormat(format).parse(dateString);
}

DateTime timestampToDateTime(double ts) {
  return DateTime.fromMillisecondsSinceEpoch(ts.round() + 3600000);
}

String encodeAddress(String address) {
  return Uri.encodeComponent(address);
}

double calculateAcuteLoad(
  List<double> charges,
  List<DateTime> dates,
  DateTime today,
) {
  if (charges.isEmpty || dates.isEmpty) {
    return 0;
  }

  DateTime sevenDaysAgo = today.subtract(Duration(days: 7));

  double total = 0;
  int count = 0;

  for (int i = 0; i < charges.length; i++) {
    DateTime d = dates[i];

    if (d.isAfter(sevenDaysAgo) && d.isBefore(today.add(Duration(days: 1)))) {
      total += charges[i];
      count++;
    }
  }

  if (count == 0) {
    return 0;
  }

  return total / count;
}
