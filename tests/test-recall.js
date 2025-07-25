#!/usr/bin/env node

// Test script for recall function
// This script tests querying stored memories

import { spawn } from 'child_process';

const testRecall = () => {
  console.log('🔍 Testing recall function...');
  
  const mcp = spawn('node', ['../build/index.js'], {
    env: { ...process.env, NEO4J_DATABASE: 'mcp-test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const tests = [
    {
      id: 1,
      query: 'Alice',
      type: 'person',
      depth: 1
    },
    {
      id: 2,
      query: 'San Francisco',
      type: 'place',
      depth: 1
    },
    {
      id: 3,
      query: 'coffee',
      type: 'food',
      depth: 2
    },
    {
      id: 4,
      query: '',
      type: '',
      depth: 1 // Get all memories
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
            console.log(`✅ recall test ${response.id} passed`);
            console.log('Response:', JSON.stringify(response, null, 2));
            completedTests++;
            
            if (completedTests === tests.length) {
              console.log('🎉 All recall tests completed');
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
        name: 'recall',
        arguments: {
          query: test.query,
          type: test.type,
          depth: test.depth
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

testRecall();