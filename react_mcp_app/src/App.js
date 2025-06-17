// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import mcpClient from './services/mcpClient';

function App() {
  const [jd, setJd] = useState('');
  const [resources, setResources] = useState([]);
  const [selected, setSelected] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState('');
  const [tools, setTools] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize MCP connection
  useEffect(() => {
    const initMCP = async () => {
      try {
        await mcpClient.connect();
        const toolsResult = await mcpClient.listTools();
        setTools(toolsResult?.tools || []);
        setIsConnected(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setNotification(`MCP connection error: ${error.message}`);
      }
    };

    initMCP();
  }, []);

  // Find matching resources
  const findResources = () => {
    if (!jd.trim()) {
      setNotification('Please enter a job description');
      return;
    }

    // Dummy data - replace with actual API call
    const dummyResources = [
      { id: 1, name: 'Sarah Johnson', email: 'sarah@example.com', skills: ['React', 'Node.js'], status: 'Available' },
      { id: 2, name: 'Michael Chen', email: 'michael@example.com', skills: ['Python', 'Django', 'AWS'], status: 'Available' },
      { id: 3, name: 'Emma Rodriguez', email: 'emma@example.com', skills: ['Java', 'Spring Boot', 'Kubernetes'], status: 'Available' },
      { id: 4, name: 'David Kim', email: 'david@example.com', skills: ['Go', 'Docker', 'Terraform'], status: 'Available' },
      { id: 5, name: 'Priya Sharma', email: 'priya@example.com', skills: ['JavaScript', 'Vue.js', 'UI/UX'], status: 'Available' },
    ];

    setResources(dummyResources);
    setNotification(`Found ${dummyResources.length} matching resources`);
    setSelected({});
  };

  // Handle resource selection
  const handleSelect = (id) => {
    setSelected(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Send emails to selected resources
  const sendEmails = async () => {
    const selectedIds = Object.keys(selected).filter(id => selected[id]);
    
    if (selectedIds.length === 0) {
      setNotification('Please select at least one resource');
      return;
    }

    setIsSending(true);
    setNotification(`Sending emails to ${selectedIds.length} resources...`);

    try {
      const updatedResources = [...resources];
      let successCount = 0;

      for (const id of selectedIds) {
        const resource = resources.find(r => r.id === parseInt(id));
        if (!resource) continue;

        try {
          setNotification(`Drafting email for ${resource.name}...`);
          
          // Draft email using MCP tool
          const draft = await mcpClient.draftEmail(
            resource.name,
            resource.email,
            resource.skills,
            jd
          );

          setNotification(`Sending email to ${resource.email}...`);
          
          // Send email using MCP tool
          await mcpClient.sendEmail(draft, resource.email);
          
          // Update resource status
          const index = updatedResources.findIndex(r => r.id === resource.id);
          if (index !== -1) {
            updatedResources[index] = {
              ...updatedResources[index],
              status: 'Contacted'
            };
          }
          
          successCount++;
        } catch (error) {
          console.error(`Failed to process ${resource.name}:`, error);
          const index = updatedResources.findIndex(r => r.id === resource.id);
          if (index !== -1) {
            updatedResources[index] = {
              ...updatedResources[index],
              status: 'Failed'
            };
          }
        }
      }

      setResources(updatedResources);
      setNotification(`Successfully contacted ${successCount}/${selectedIds.length} resources`);
    } catch (error) {
      console.error('Email sending error:', error);
      setNotification(`Failed to send emails: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-indigo-700 mb-2">Resource Manager</h1>
          <p className="text-gray-600">Find and recruit the best talent for your projects</p>
          
          <div className="mt-4 flex justify-center items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`}></div>
            <span className="text-sm text-gray-500">
              {isConnected 
                ? `Connected to MCP server (${tools?.length || 0} tools available)` 
                : "Connecting to MCP server..."}
            </span>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Job Description</h2>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Enter job description and required skills..."
            className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={findResources}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105"
          >
            Find Matching Resources
          </button>
        </div>

        {notification && (
          <div className={`mb-6 p-4 rounded-lg ${
            notification.includes('Failed') 
              ? 'bg-red-50 text-red-700' 
              : notification.includes('Success') 
                ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
          }`}>
            {notification}
          </div>
        )}

        {resources.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-semibold text-gray-800">Matching Resources</h2>
              <button
                onClick={sendEmails}
                disabled={isSending}
                className={`flex items-center gap-2 font-medium py-2 px-5 rounded-lg transition ${
                  isSending 
                    ? 'bg-gray-300 text-gray-500' 
                    : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
                }`}
              >
                {isSending ? (
                  <>
                    <span>Sending...</span>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  </>
                ) : (
                  'Send Emails to Selected'
                )}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resources.map((resource) => (
                    <tr 
                      key={resource.id} 
                      className={`transition ${
                        selected[resource.id] ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      } ${
                        resource.status === 'Contacted' ? 'bg-green-50' : 
                        resource.status === 'Failed' ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={!!selected[resource.id]}
                          onChange={() => handleSelect(resource.id)}
                          disabled={resource.status === 'Contacted' || resource.status === 'Failed'}
                          className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {resource.email}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {resource.skills.map((skill, idx) => (
                            <span 
                              key={idx}
                              className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          resource.status === 'Available' ? 'bg-green-100 text-green-800' :
                          resource.status === 'Contacted' ? 'bg-blue-100 text-blue-800' :
                          resource.status === 'Failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {resource.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isConnected && tools.length > 0 && (
          <div className="mt-8 bg-indigo-50 rounded-xl p-5">
            <h3 className="text-lg font-medium text-indigo-800 mb-3">Available MCP Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tools.map((tool, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                  <h4 className="font-semibold text-indigo-700">{tool.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;