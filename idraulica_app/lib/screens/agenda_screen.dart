import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'intervento_screen.dart';
import 'crea_intervento_screen.dart';

class AgendaScreen extends StatelessWidget {
  const AgendaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Agenda Interventi"),
      ),

      // pulsante per creare nuovo appuntamento
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const CreaInterventoScreen(),
            ),
          );
        },
      ),

      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection("interventi")
            .orderBy("orario")
            .snapshots(),

        builder: (context, snapshot) {

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const Center(
              child: Text("Nessun intervento programmato"),
            );
          }

          var interventi = snapshot.data!.docs;

          return ListView.builder(
            itemCount: interventi.length,
            itemBuilder: (context, index) {

              var data = interventi[index].data() as Map<String, dynamic>;

              return Column(
                children: [

                  ListTile(
                    leading: const Icon(Icons.plumbing),

                    title: Text(
                      "${data['orario']} - ${data['cliente']}",
                    ),

                    subtitle: Text(
                      "${data['lavoro']} - ${data['indirizzo']}",
                    ),

                    trailing: const Icon(Icons.arrow_forward),

                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => InterventoScreen(
                            cliente: data['cliente'],
                            indirizzo: data['indirizzo'],
                            telefono: data['telefono'],
                            lavoro: data['lavoro'],
                          ),
                        ),
                      );
                    },
                  ),

                  const Divider(),

                ],
              );
            },
          );
        },
      ),
    );
  }
}