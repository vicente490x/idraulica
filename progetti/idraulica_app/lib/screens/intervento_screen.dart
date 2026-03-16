import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class InterventoScreen extends StatelessWidget {
  const InterventoScreen({super.key});

  Future apriMaps() async {

    final url = Uri.parse(
      "https://www.google.com/maps/search/?api=1&query=Via+Roma+10",
    );

    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }

  }

  Future chiamaCliente() async {

    final url = Uri.parse("tel:+39123456789");

    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    }

  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      appBar: AppBar(
        title: const Text("Dettaglio Intervento"),
      ),

      body: Padding(
        padding: const EdgeInsets.all(20),

        child: Column(

          crossAxisAlignment: CrossAxisAlignment.start,

          children: [

            const Text(
              "Cliente: Mario Rossi",
              style: TextStyle(fontSize: 20),
            ),

            const SizedBox(height: 10),

            const Text("Indirizzo: Via Roma 10"),

            const Text("Lavoro: Riparazione perdita"),

            const SizedBox(height: 30),

            ElevatedButton.icon(
              onPressed: apriMaps,
              icon: const Icon(Icons.map),
              label: const Text("Apri navigazione"),
            ),

            const SizedBox(height: 10),

            ElevatedButton.icon(
              onPressed: chiamaCliente,
              icon: const Icon(Icons.phone),
              label: const Text("Chiama cliente"),
            ),

          ],
        ),
      ),
    );
  }
}