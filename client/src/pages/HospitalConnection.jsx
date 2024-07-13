import React, { useState } from 'react';

const HospitalConnection = () => {
  const [hospital1, setHospital1] = useState('');
  const [hospital2, setHospital2] = useState('');
  const [guardian, setGuardian] = useState('');

  const handleConnect = () => {
    // Implement connection logic here
    console.log(`Connecting ${hospital1} with ${hospital2} and guardian ${guardian}`);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Connect Hospitals and Guardians</h2>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Hospital 1"
          value={hospital1}
          onChange={(e) => setHospital1(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="Hospital 2"
          value={hospital2}
          onChange={(e) => setHospital2(e.target.value)}
          className="border p-2 w-full"
        />
        <input
          type="text"
          placeholder="Guardian"
          value={guardian}
          onChange={(e) => setGuardian(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          onClick={handleConnect}
          className="bg-blue-600 text-white p-2 rounded"
        >
          Connect
        </button>
      </div>
    </div>
  );
}

export default HospitalConnection;
