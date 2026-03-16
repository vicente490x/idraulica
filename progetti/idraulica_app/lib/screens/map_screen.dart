import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {

  final LatLng posizione = const LatLng(41.1171, 16.8719);

  final Set<Marker> markers = {

    const Marker(
      markerId: MarkerId("cliente1"),
      position: LatLng(41.1171, 16.8719),
      infoWindow: InfoWindow(
        title: "Cliente Rossi",
        snippet: "Riparazione perdita",
      ),
    ),

  };

  @override
  Widget build(BuildContext context) {

    return Scaffold(

      appBar: AppBar(
        title: const Text("Mappa Interventi"),
      ),

      body: GoogleMap(

        initialCameraPosition: CameraPosition(
          target: posizione,
          zoom: 13,
        ),

        markers: markers,

      ),

    );
  }
}