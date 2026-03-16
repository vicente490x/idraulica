import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {

  DateTime today = DateTime.now();

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      appBar: AppBar(
        title: const Text("Calendario"),
      ),

      body: TableCalendar(

        locale: 'it_IT',

        focusedDay: today,

        firstDay: DateTime.utc(2020),

        lastDay: DateTime.utc(2030),

        selectedDayPredicate: (day) {
          return isSameDay(day, today);
        },

        onDaySelected: (selectedDay, focusedDay) {

          setState(() {
            today = selectedDay;
          });

        },

      ),
    );
  }
}