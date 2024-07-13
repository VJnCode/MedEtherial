import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ isLoggedIn, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Implement logout logic (clear localStorage, reset state, etc.)
    // For demo purposes, just navigate to login page
    navigate('/login');
    if (onLogout) {
      onLogout(); // Notify parent component of logout
    }
  };

  return (
    <nav className="bg-gray-200 shadow-md px-4 py-2 flex items-center justify-between">
      <div className="flex items-center">
        <div className="mr-6">
          <img src="/assests/logo.jpg" alt="Logo" className="h-8" />
        </div>
        <div className="space-x-6">
          <Link to="/" className="text-gray-800 hover:text-gray-600 transition-colors duration-200">Home</Link>
          <Link to="/schedules" className="text-gray-800 hover:text-gray-600 transition-colors duration-200">Schedules</Link>
          <Link to="/doctor-appointment" className="text-gray-800 hover:text-gray-600 transition-colors duration-200">Doctor Appointment</Link>
        </div>
      </div>
      {isLoggedIn ? (
        <div className="flex items-center">
          {/* Replace with your profile icon or avatar */}
          <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
          <button onClick={handleLogout} className="ml-4 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md">
            Logout
          </button>
        </div>
      ) : (
        <Link to="/login" className="ml-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md">
          Login
        </Link>
      )}
    </nav>
  );
}

export default Navbar;
