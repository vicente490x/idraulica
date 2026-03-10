import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class CreaInterventoScreen extends StatefulWidget {
  const CreaInterventoScreen({super.key});

  @override
  State<CreaInterventoScreen> createState() => _CreaInterventoScreenState();
}

class _CreaInterventoScreenState extends State<CreaInterventoScreen> {

  final clienteController = TextEditingController();
  final indirizzoController = TextEditingController();
  final telefonoController = TextEditingController();
  final lavoroController = TextEditingController();
  final orarioController = TextEditingController();

  Future salvaIntervento() async {

    await FirebaseFirestore.instance.collection("interventi").add({
      "cliente": clienteController.text,
      "indirizzo": indirizzoController.text,
      "telefono": telefonoController.text,
      "lavoro": lavoroController.text,
      "orario": orarioController.text,
      "stato": "programmato"
    });

    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Nuovo intervento"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: ListView(
          children: [

            TextField(
              controller: clienteController,
              decoration: const InputDecoration(labelText: "Nome cliente"),
            ),

            TextField(
              controller: telefonoController,
              decoration: const InputDecoration(labelText: "Telefono"),
            ),

            TextField(
              controller: indirizzoController,
              decoration: const InputDecoration(labelText: "Indirizzo"),
            ),

            TextField(
              controller: lavoroController,
              decoration: const InputDecoration(labelText: "Tipo lavoro"),
            ),

            TextField(
              controller: orarioController,
              decoration: const InputDecoration(labelText: "Orario"),
            ),

            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: salvaIntervento,
              child: const Text("SALVA APPUNTAMENTO"),
            )

          ],
        ),
      ),
    );
  }
}