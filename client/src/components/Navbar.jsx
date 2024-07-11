import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.jpg'; // Ensure this path is correct


const Navbar = () => {
  return (
    <nav className="sticky top-4 bg-gradient-to-br from-white to-gray-100 shadow-lg rounded-lg z-50 mb-8 py-3 px-4 mx-6">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo and Med-Eth on the left */}
        <div className="flex items-center space-x-2">
          <img src={logo} alt="Med-Eth Logo" className="h-10 w-10 object-cover" />
          <span className="text-2xl font-bold text-gray-800">Med-Eth</span>
        </div>
        {/* Navigation Links centered */}
        <div className="flex-grow flex justify-center space-x-6">
          <div className="flex space-x-6">
            <Link to="/" className="text-gray-800 transition-colors duration-200 hover:text-gray-600 hover:underline">Home</Link>
            <Link to="/schedules" className="text-gray-800 transition-colors duration-200 hover:text-gray-600 hover:underline">Schedules</Link>
            <Link to="/doctor-appointment" className="text-gray-800 transition-colors duration-200 hover:text-gray-600 hover:underline">Doctor Appointment</Link>
          </div>
        </div>
        {/* Login Button on the right with different shades of white */}
        <div>
          <button className="text-gray-800 hover:text-gray-600 transition-colors duration-200 bg-white shadow-md py-2 px-4 rounded-lg border border-gray-300">Login</button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
