// import React from 'react';
// import { Link, useNavigate } from 'react-router-dom';

// const Navbar = ({ isLoggedIn, onLogout }) => {
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     // Implement logout logic (clear localStorage, reset state, etc.)
//     // For demo purposes, just navigate to login page
//     navigate('/login');
//     if (onLogout) {
//       onLogout(); 
//     }
//   };

//   return (
//     <nav className="fixed top-0 w-full bg-black shadow-md px-4 py-6 flex items-center justify-between z-50">
//       <div className="flex items-center">
//         <div className="mr-6">
//           <h1 className='text-white font-bold text-2xl'>Med-Ethereal</h1>
//         </div>
//       </div>
//       <div className="flex flex-1 justify-center">
//         <div className="flex">
//           <Link to="/" className="text-white text-xl hover:text-gray-300 hover:text-2xl transition-all duration-200 border-r border-gray-500 px-4">Home</Link>
//           <Link to="/schedules" className="text-white text-xl hover:text-gray-300 hover:text-2xl transition-all duration-200 border-r border-gray-500 px-4">Schedules</Link>
//           <Link to="/doctor-appointment" className="text-white text-xl hover:text-gray-300 hover:text-2xl transition-all duration-200 border-r border-gray-500 px-4">Doctor Appointment</Link>
//           <Link to="/hospital-connection" className="text-white text-xl hover:text-gray-300 hover:text-2xl transition-all duration-200 px-4">Hospital Connection</Link>
//         </div>
//       </div>
//       <div>
//         {isLoggedIn ? (
//           <div className="flex items-center">
//             {/* Replace with your profile icon or avatar */}
//             <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
//             <button onClick={handleLogout} className="ml-4 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md">
//               Logout
//             </button>
//           </div>
//         ) : (
//           <Link to="/login" className="ml-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md">
//             Login
//           </Link>
//         )}
//       </div>
//     </nav>
//   );
// }

// export default Navbar;

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
      // Simulate hospital location
      setHospitalLocation([51.505, -0.09]); // Example coordinates
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

  return (
    <div className="container mx-auto p-4 pt-20">
      <h2 className="text-2xl font-bold mb-4">Connect Hospitals and Guardians</h2>
      <input
        type="text"
        placeholder="Hospital ID"
        value={hospitalId}
        onChange={(e) => setHospitalId(e.target.value)}
        className="border p-2 w-full"
      />
      <input
        type="text"
        placeholder="Guardian ID"
        value={guardianId}
        onChange={(e) => setGuardianId(e.target.value)}
        className="border p-2 w-full"
      />
      <button onClick={sendRequest} className="bg-blue-600 text-white p-2 rounded">
        Send Request
      </button>
    </div>
  );
} 

export default EmergencyRequest;






