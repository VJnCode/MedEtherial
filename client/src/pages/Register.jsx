import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true); // Track whether in login or signup mode
  const navigate = useNavigate(); // Get the navigate function for programmatic navigation

  const handleSubmit = async (e) => {
    e.preventDefault();

    //console.log(username + password)

    // Replace with your actual authentication logic using Axios or Fetch API
    try {

      const formData = {
        username,
        password
      }

      const response = await axios.post('http://localhost:5173/api/v1/users/login', formData);
      console.log('Signin successful');
      const data = await response.data;

      // Handle successful login (e.g., store token in local storage)
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken); 

      // Redirect to home page
      navigate('/');

      // Update login state in parent component
      onLogin();

    } catch (error) {
      console.error('Login error:', error.message + " " + error);
      alert("Invalid Credentials"); // Display a user-friendly error message
    }
  };

  const toggleMode = () => {
    setIsLoginMode(prevMode => !prevMode); // Toggle between login and signup mode
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('sunset.jpg')" }}>
      <div className="wrapper rounded-lg border-2 border-black backdrop-filter backdrop-blur-md bg-opacity-20 bg-gray-800 shadow-lg p-8 text-black">
        <form onSubmit={handleSubmit}>
          <h1 className="text-3xl text-center mb-8 text-black">{isLoginMode ? 'Login' : 'Sign Up'}</h1>
          <div className="input-box relative mb-6">
            <i className='bx bxs-user absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400'></i>
            <input
              type="text"
              placeholder="Username"
              className="w-full h-full bg-transparent border-2 border-black rounded-full text-black px-10 py-4 text-lg focus:outline-none shadow-md"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="input-box relative mb-6">
            <input
              type="password"
              placeholder="Password"
              className="w-full h-full bg-transparent border-2 border-black rounded-full text-black px-10 py-4 text-lg focus:outline-none shadow-md"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <i className='bx bxs-lock-alt absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400'></i>
          </div>
          {isLoginMode ? (
            <div className="remember-forgot text-sm mb-4">
              <label className="flex items-center">
                <input type="checkbox" className="form-checkbox text-black" />
                <span className="ml-2 text-black">Remember me</span>
              </label>
              <a href="#" className="text-black hover:underline">Forgot Password?</a>
            </div>
          ) : null}
          <button type="submit" className="btn w-full py-3 bg-black text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition duration-300">
            {isLoginMode ? 'Sign IN' : 'Sign Up'}
          </button>
          <div className="register-link mt-6 text-sm">
            <p className="text-black">
              {isLoginMode ? "Don't have an account?" : "Already have an account?"}
              <span
                className="ml-1 cursor-pointer text-blue-600 hover:text-blue-800"
                onClick={toggleMode}
              >
                {isLoginMode ? 'Sign Up' : 'Sign In'}
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
