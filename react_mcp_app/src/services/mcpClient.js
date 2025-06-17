// src/services/mcpClient.js

class MCPClient {
  constructor() {
    // Use the CORS proxy instead of direct connection
    this.baseUrl = "http://localhost:8051"; // CORS proxy
    this.isConnected = false;
    this.availableTools = [];
  }

  async connect() {
    if (this.isConnected) return;

    try {
      console.log("Connecting to MCP server via HTTP...");
      
      // Fetch available tools to verify connectivity
      const response = await fetch(`${this.baseUrl}/mcp/tools`);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Tools response:", data);
      this.availableTools = data.tools || [];
      
      this.isConnected = true;
      console.log("✅ Connected to MCP server via HTTP");
      console.log("Available tools:", this.availableTools);
      
      return true;
    } catch (error) {
      console.error("MCP connection error:", error);
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  async listTools() {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.availableTools;
  }

  async draftEmail(name, email, skills, jd) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log("Drafting email with params:", { name, email, skills, jd });
      
      const response = await fetch(`${this.baseUrl}/mcp/tool/draft_email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          skills,
          jd
        })
      });
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log("Raw draft_email response:", responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} - ${responseText}`);
      }
      
      // Parse the JSON after we've logged the raw text
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        console.error("Failed to parse JSON response:", err);
        return responseText; // Return raw text if JSON parsing fails
      }
      
      return data.result || responseText;
    } catch (error) {
      console.error("Tool call error:", error);
      throw new Error(`Failed to call draft_email: ${error.message}`);
    }
  }

  async sendEmail(draft, recipient) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log("Sending email with params:", { draft: draft.substring(0, 50) + "...", recipient });
      
      const response = await fetch(`${this.baseUrl}/mcp/tool/send_email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draft,
          recipient
        })
      });
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log("Raw send_email response:", responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} - ${responseText}`);
      }
      
      // Parse the JSON after we've logged the raw text
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        console.error("Failed to parse JSON response:", err);
        return responseText; // Return raw text if JSON parsing fails
      }
      
      return data.result || responseText;
    } catch (error) {
      console.error("Tool call error:", error);
      throw new Error(`Failed to call send_email: ${error.message}`);
    }
  }
}

// Export a singleton instance for easy reuse
const mcpClient = new MCPClient();
export default mcpClient;
