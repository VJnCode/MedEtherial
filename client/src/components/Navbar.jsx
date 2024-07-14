import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ isLoggedIn, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Implement logout logic (clear localStorage, reset state, etc.)
    // For demo purposes, just navigate to login page
    navigate('/login');
    if (onLogout) {
      onLogout(); 
    }
  };

  return (
    <nav className="bg-black shadow-md px-4 py-6 flex items-center justify-between">
      <div className="flex items-center">
        <div className="mr-6">
          <h1 className='text-white font-bold text-2xl'>Med-Ethereal</h1>
        </div>
      </div>
      <div className="flex flex-1 justify-center">
        <div className="flex space-x-6">
          <Link to="/" className="text-white text-xl hover:text-blue-400 transition-colors duration-200">Home</Link>
          <Link to="/schedules" className="text-white  text-xl hover:text-blue-400 transition-colors duration-200">Schedules</Link>
          <Link to="/doctor-appointment" className="text-white  text-xl hover:text-blue-400 transition-colors duration-200">Doctor Appointment</Link>
          <Link to="/hospital-connection" className="text-white  text-xl hover:text-blue-400 transition-colors duration-200">Hospital Connection</Link>
        </div>
      </div>
      <div>
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
      </div>
    </nav>
  );
}

export default Navbar;