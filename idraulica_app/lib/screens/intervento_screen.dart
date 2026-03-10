import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class InterventoScreen extends StatelessWidget {

  final String cliente;
  final String indirizzo;
  final String telefono;
  final String lavoro;

  const InterventoScreen({
    super.key,
    required this.cliente,
    required this.indirizzo,
    required this.telefono,
    required this.lavoro,
  });

  void apriMaps() async {
    final Uri url = Uri.parse(
        "https://www.google.com/maps/search/?api=1&query=Via Roma 12");

    await launchUrl(url);
  }

  void chiamaCliente() async {
    final Uri url = Uri.parse("tel:+39123456789");

    await launchUrl(url);
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
              "Cliente:",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const Text("Mario Rossi"),

            const SizedBox(height: 20),

            const Text(
              "Indirizzo:",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const Text("Via Roma 12"),

            const SizedBox(height: 20),

            const Text(
              "Tipo lavoro:",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const Text("Riparazione perdita acqua"),

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

            const SizedBox(height: 20),

            const Text(
              "Stato intervento",
              style: TextStyle(fontSize: 18),
            ),

            const SizedBox(height: 10),

            DropdownButton<String>(
              value: "programmato",
              items: const [
                DropdownMenuItem(
                    value: "programmato",
                    child: Text("Programmato")),
                DropdownMenuItem(
                    value: "in_viaggio",
                    child: Text("In viaggio")),
                DropdownMenuItem(
                    value: "in_lavorazione",
                    child: Text("In lavorazione")),
                DropdownMenuItem(
                    value: "completato",
                    child: Text("Completato")),
              ],
              onChanged: null,
            ),

          ],
        ),
      ),
    );
  }
}