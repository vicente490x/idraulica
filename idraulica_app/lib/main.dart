import 'package:flutter/material.dart';

void main() {
  runApp(AppuntamentiApp());
}

class AppuntamentiApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gestione Appuntamenti',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: ListaAppuntamenti(),
    );
  }
}

class Appuntamento {
  String cliente;
  String indirizzo;
  String data;

  Appuntamento({
    required this.cliente,
    required this.indirizzo,
    required this.data,
  });
}

class ListaAppuntamenti extends StatefulWidget {
  @override
  _ListaAppuntamentiState createState() => _ListaAppuntamentiState();
}

class _ListaAppuntamentiState extends State<ListaAppuntamenti> {

  List<Appuntamento> appuntamenti = [];

  void aggiungiAppuntamento(Appuntamento app) {
    setState(() {
      appuntamenti.add(app);
    });
  }

  void eliminaAppuntamento(int index) {
    setState(() {
      appuntamenti.removeAt(index);
    });
  }

  void apriForm() async {
    final nuovo = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => NuovoAppuntamento()),
    );

    if (nuovo != null) {
      aggiungiAppuntamento(nuovo);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Appuntamenti"),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: apriForm,
        child: Icon(Icons.add),
      ),
      body: ListView.builder(
        itemCount: appuntamenti.length,
        itemBuilder: (context, index) {
          final app = appuntamenti[index];

          return Card(
            margin: EdgeInsets.all(10),
            child: ListTile(
              title: Text(app.cliente),
              subtitle: Text("${app.indirizzo} - ${app.data}"),
              trailing: IconButton(
                icon: Icon(Icons.delete),
                onPressed: () => eliminaAppuntamento(index),
              ),
            ),
          );
        },
      ),
    );
  }
}

class NuovoAppuntamento extends StatefulWidget {
  @override
  _NuovoAppuntamentoState createState() => _NuovoAppuntamentoState();
}

class _NuovoAppuntamentoState extends State<NuovoAppuntamento> {

  final clienteController = TextEditingController();
  final indirizzoController = TextEditingController();
  final dataController = TextEditingController();

  void salva() {

    if (clienteController.text.isEmpty) return;

    final app = Appuntamento(
      cliente: clienteController.text,
      indirizzo: indirizzoController.text,
      data: dataController.text,
    );

    Navigator.pop(context, app);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Nuovo Appuntamento"),
      ),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          children: [

            TextField(
              controller: clienteController,
              decoration: InputDecoration(
                labelText: "Nome Cliente",
              ),
            ),

            SizedBox(height: 10),

            TextField(
              controller: indirizzoController,
              decoration: InputDecoration(
                labelText: "Indirizzo",
              ),
            ),

            SizedBox(height: 10),

            TextField(
              controller: dataController,
              decoration: InputDecoration(
                labelText: "Data",
              ),
            ),

            SizedBox(height: 20),

            ElevatedButton(
              onPressed: salva,
              child: Text("Salva Appuntamento"),
            )

          ],
        ),
      ),
    );
  }
}