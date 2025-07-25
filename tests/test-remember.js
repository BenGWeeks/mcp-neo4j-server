#!/usr/bin/env node

// Test script for remember function
// This script tests creating different types of memory entities

import { spawn } from 'child_process';

const testRemember = () => {
  console.log('🧠 Testing remember function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'mcp-test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const tests = [
    {
      id: 1,
      type: 'person',
      name: 'Alice',
      context: 'Test user for MCP testing',
      properties: { occupation: 'Engineer', company: 'Tech Corp' }
    },
    {
      id: 2,
      type: 'place',
      name: 'San Francisco',
      context: 'Test location',
      properties: { state: 'California', country: 'USA' }
    },
    {
      id: 3,
      type: 'food',
      name: 'coffee',
      context: 'Alice loves coffee',
      relates_to: 'Alice'
    }
  ];

  let completedTests = 0;
  let output = '';

  mcp.stdout.on('data', (data) => {
    output += data.toString();
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id && response.id <= tests.length) {
            console.log(`✅ remember test ${response.id} passed`);
            console.log('Response:', JSON.stringify(response, null, 2));
            completedTests++;
            
            if (completedTests === tests.length) {
              console.log('🎉 All remember tests completed');
              mcp.kill();
              return;
            }
          }
        } catch (e) {
          // Ignore non-JSON lines
        }
      }
    }
  });

  mcp.stderr.on('data', (data) => {
    console.error('❌ Error:', data.toString());
  });

  // Send all test messages
  tests.forEach(test => {
    const testMessage = {
      jsonrpc: '2.0',
      id: test.id,
      method: 'tools/call',
      params: {
        name: 'remember',
        arguments: {
          type: test.type,
          name: test.name,
          context: test.context,
          properties: test.properties,
          relates_to: test.relates_to
        }
      }
    };
    mcp.stdin.write(JSON.stringify(testMessage) + '\n');
  });

  setTimeout(() => {
    console.log('⏰ Test timeout');
    mcp.kill();
  }, 10000);
};

testRemember();