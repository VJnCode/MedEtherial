import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix marker icon issue with Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const EmergencyRequest = () => {
  const [hospitalId, setHospitalId] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [isRequestAccepted, setIsRequestAccepted] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState(null);
  const [guardianLocation, setGuardianLocation] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Implement request logic (e.g., API call)
    // For demo purposes, simulate request acceptance
    setTimeout(() => {
      setIsRequestAccepted(true);
      // Simulate nearest hospital location to Mysore
      setHospitalLocation([12.2958, 76.6394]); // Example coordinates of Mysore
    }, 1000);
  };

  // Function to get the live location of the guardian
  const getGuardianLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setGuardianLocation([latitude, longitude]);
      });
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  // Fetch live location initially and set up an interval for updates
  useEffect(() => {
    if (isRequestAccepted) {
      getGuardianLocation(); // Get initial location
      const interval = setInterval(() => {
        getGuardianLocation();
      }, 3000); // Update every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isRequestAccepted]);

  // Set initial location to Mysore
  useEffect(() => {
    setGuardianLocation([12.2958, 76.6394]); // Example coordinates of Mysore
  }, []);

  return (
    <div className="max-lg mx-auto p-8 bg-white rounded-lg shadow-md mt-10 pt-20">
      <h2 className="text-2xl font-bold mb-4 text-center">Emergency Connection Request</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="hospitalId" className="block text-gray-700">Hospital ID</label>
          <input
            type="text"
            id="hospitalId"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className="mt-2 w-full p-2 border rounded-md"
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="guardianId" className="block text-gray-700">Guardian ID</label>
          <input
            type="text"
            id="guardianId"
            value={guardianId}
            onChange={(e) => setGuardianId(e.target.value)}
            className="mt-2 w-full p-2 border rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors duration-200"
        >
          Submit Request
        </button>
      </form>
      {isRequestAccepted && (
        <div className="mt-6 w-1/2 p-4 bg-green-100 border-t-4 border-green-500 text-green-900 rounded-md flex justify-center mx-auto">
          <div className="w-full">
            <p className="font-bold">Request Accepted!</p>
            <p>Hospital and Guardian are now connected and can track each other’s location.</p>
            {hospitalLocation && guardianLocation && (
              <MapContainer center={hospitalLocation} zoom={13} className="w-full h-96 mt-4">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={hospitalLocation} />
                <Marker position={guardianLocation} />
                <Polyline positions={[hospitalLocation, guardianLocation]} color="blue" />
              </MapContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyRequest;