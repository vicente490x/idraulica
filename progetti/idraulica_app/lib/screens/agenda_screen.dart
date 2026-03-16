import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/intervento.dart';
import 'calendar_screen.dart';
import 'intervento_screen.dart';
import 'map_screen.dart';

class AgendaScreen extends StatefulWidget {
  const AgendaScreen({super.key});

  @override
  State<AgendaScreen> createState() => _AgendaScreenState();
}

class _AgendaScreenState extends State<AgendaScreen> {

  void aggiungiIntervento(Intervento intervento) {

    FirebaseFirestore.instance.collection("interventi").add({

      "cliente": intervento.cliente,
      "indirizzo": intervento.indirizzo,
      "lavoro": intervento.lavoro,
      "orario": intervento.orario,

    });

  }

  void mostraForm(BuildContext context) {

    final clienteController = TextEditingController();
    final indirizzoController = TextEditingController();
    final lavoroController = TextEditingController();
    final orarioController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {

        return AlertDialog(

          title: const Text("Nuovo Intervento"),

          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [

              TextField(
                controller: clienteController,
                decoration: const InputDecoration(
                  labelText: "Cliente",
                ),
              ),

              TextField(
                controller: indirizzoController,
                decoration: const InputDecoration(
                  labelText: "Indirizzo",
                ),
              ),

              TextField(
                controller: lavoroController,
                decoration: const InputDecoration(
                  labelText: "Tipo lavoro",
                ),
              ),

              TextField(
                controller: orarioController,
                decoration: const InputDecoration(
                  labelText: "Orario",
                ),
              ),

            ],
          ),

          actions: [

            TextButton(
              onPressed: () {
                Navigator.pop(context);
              },
              child: const Text("Annulla"),
            ),

            ElevatedButton(
              onPressed: () {

                aggiungiIntervento(
                  Intervento(
                    cliente: clienteController.text,
                    indirizzo: indirizzoController.text,
                    lavoro: lavoroController.text,
                    orario: orarioController.text,
                  ),
                );

                Navigator.pop(context);
              },
              child: const Text("Salva"),
            )

          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      appBar: AppBar(
        title: const Text("Agenda Interventi"),

        actions: [

          IconButton(
            icon: const Icon(Icons.calendar_month),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const CalendarScreen(),
                ),
              );
            },
          ),

          IconButton(
            icon: const Icon(Icons.map),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const MapScreen(),
                ),
              );
            },
          ),

        ],
      ),

      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () {
          mostraForm(context);
        },
      ),

      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection("interventi")
            .orderBy("orario")
            .snapshots(),

        builder: (context, snapshot) {

          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          final interventi = snapshot.data!.docs;

          return ListView.builder(
            itemCount: interventi.length,
            itemBuilder: (context, index) {

              var data = interventi[index];

              return Card(
                margin: const EdgeInsets.all(10),

                child: ListTile(

                  leading: const Icon(Icons.plumbing),

                  title: Text("${data["cliente"]}"),

                  subtitle: Text(
                    "${data["lavoro"]} - ${data["indirizzo"]}",
                  ),

                  onTap: () {

                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const InterventoScreen(),
                      ),
                    );

                  },

                ),
              );

            },
          );
        },
      ),
    );
  }
}