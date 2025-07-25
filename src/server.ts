import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Neo4jClient } from './neo4j-client.js';

interface Neo4jServerConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
}

interface ExecuteQueryArgs {
  query: string;
  params?: Record<string, any>;
}

interface CreateNodeArgs {
  label: string;
  properties: Record<string, any>;
}

interface RememberArgs {
  type: 'person' | 'place' | 'organization' | 'object' | 'animal' | 'event' | 'topic' | 'media' | 'food' | 'activity';
  name?: string;
  context?: string | string[];
  properties?: Record<string, any>;
  relates_to?: string;
}

interface RecallArgs {
  query: string;
  type?: string;
  depth?: number;
  order_by?: string;
  limit?: number;
}

interface ConnectMemoriesArgs {
  from: string;
  to: string;
  relationship: string;
}

interface CreateRelationshipArgs {
  fromNodeId: number;
  toNodeId: number;
  type: string;
  properties?: Record<string, any>;
}

interface UpdateNodeArgs {
  nodeId: number;
  properties: Record<string, any>;
}

interface UpdateRelationshipArgs {
  fromNodeId: number;
  toNodeId: number;
  type: string;
  properties: Record<string, any>;
}

interface DeleteNodeArgs {
  nodeId: number;
}

interface DeleteRelationshipArgs {
  fromNodeId: number;
  toNodeId: number;
  type: string;
}

function isExecuteQueryArgs(args: unknown): args is ExecuteQueryArgs {
  return typeof args === 'object' && args !== null && typeof (args as ExecuteQueryArgs).query === 'string';
}

function isCreateNodeArgs(args: unknown): args is CreateNodeArgs {
  return typeof args === 'object' && args !== null && typeof (args as CreateNodeArgs).label === 'string' && typeof (args as CreateNodeArgs).properties === 'object';
}

function isCreateRelationshipArgs(args: unknown): args is CreateRelationshipArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as CreateRelationshipArgs).fromNodeId === 'number' &&
    typeof (args as CreateRelationshipArgs).toNodeId === 'number' &&
    typeof (args as CreateRelationshipArgs).type === 'string'
  );
}

function isRememberArgs(args: unknown): args is RememberArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as RememberArgs).type === 'string' &&
    ['person', 'place', 'organization', 'object', 'animal', 'event', 'topic', 'media', 'food', 'activity'].includes((args as RememberArgs).type)
  );
}

function isRecallArgs(args: unknown): args is RecallArgs {
  return typeof args === 'object' && args !== null && typeof (args as RecallArgs).query === 'string';
}

function isConnectMemoriesArgs(args: unknown): args is ConnectMemoriesArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as ConnectMemoriesArgs).from === 'string' &&
    typeof (args as ConnectMemoriesArgs).to === 'string' &&
    typeof (args as ConnectMemoriesArgs).relationship === 'string'
  );
}

function isUpdateNodeArgs(args: unknown): args is UpdateNodeArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as UpdateNodeArgs).nodeId === 'number' &&
    typeof (args as UpdateNodeArgs).properties === 'object'
  );
}

function isUpdateRelationshipArgs(args: unknown): args is UpdateRelationshipArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as UpdateRelationshipArgs).fromNodeId === 'number' &&
    typeof (args as UpdateRelationshipArgs).toNodeId === 'number' &&
    typeof (args as UpdateRelationshipArgs).type === 'string' &&
    typeof (args as UpdateRelationshipArgs).properties === 'object'
  );
}

function isDeleteNodeArgs(args: unknown): args is DeleteNodeArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as DeleteNodeArgs).nodeId === 'number'
  );
}

function isDeleteRelationshipArgs(args: unknown): args is DeleteRelationshipArgs {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof (args as DeleteRelationshipArgs).fromNodeId === 'number' &&
    typeof (args as DeleteRelationshipArgs).toNodeId === 'number' &&
    typeof (args as DeleteRelationshipArgs).type === 'string'
  );
}

// parseDetails function removed - was causing entity properties to be stored as node properties
// instead of creating separate entities with relationships

export class Neo4jServer {
  private server: Server;
  private neo4j: Neo4jClient;

  constructor(config: Neo4jServerConfig) {
    this.server = new Server(
      {
        name: 'mcp-neo4j-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.neo4j = new Neo4jClient(config.uri, config.username, config.password, config.database);
    this.setupToolHandlers();

    // エラーハンドリング
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // ツール一覧の定義
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_query',
          description: 'Execute a Cypher query on Neo4j database',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Cypher query to execute',
              },
              params: {
                type: 'object',
                description: 'Query parameters',
                additionalProperties: true,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_node',
          description: 'Create a new node in Neo4j',
          inputSchema: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Node label',
              },
              properties: {
                type: 'object',
                description: 'Node properties',
                additionalProperties: true,
              },
            },
            required: ['label', 'properties'],
          },
        },
        {
          name: 'create_relationship',
          description: 'Create a relationship between two nodes',
          inputSchema: {
            type: 'object',
            properties: {
              fromNodeId: {
                type: 'number',
                description: 'ID of the source node',
              },
              toNodeId: {
                type: 'number',
                description: 'ID of the target node',
              },
              type: {
                type: 'string',
                description: 'Relationship type',
              },
              properties: {
                type: 'object',
                description: 'Relationship properties',
                additionalProperties: true,
              },
            },
            required: ['fromNodeId', 'toNodeId', 'type'],
          },
        },
        {
          name: 'remember',
          description: `Store NEW entities in long-term memory. Create separate nodes for each person, place, or thing.

PARAMETERS (MUST use this exact structure):
- type: string (required) - one of: person, place, organization, object, animal, event, topic, media, food, activity
- name: string (optional but STRONGLY RECOMMENDED) - what to call this entity
- context: string/array (optional) - when/how this was mentioned, with quotes
- properties: object (optional) - additional attributes specific to the type
- relates_to: string (optional) - ID or name of related memory

CORRECT USAGE:
remember({
  "type": "person",
  "name": "John Doe",
  "context": "User told me about their friend John",
  "properties": {"age": 30, "occupation": "engineer"}
})

INCORRECT (this is for update_node, not remember):
remember({
  "nodeId": 123,
  "properties": {"age": 30}
})

If you see nodeId, use update_node instead!

CRITICAL - AFTER STORING MEMORIES:
- The user just told you information they want you to remember
- They're still in the middle of telling you things
- Keep listening and engaging with what they're sharing
- Ask follow-up questions about what they told you
- Show interest in the details they shared
- DO NOT say generic things like "How can I help you today?"
- Example: If they told you about their car, ask about it or acknowledge it
- Continue the conversation naturally - they're sharing with you!

BUILDING CONNECTED KNOWLEDGE:
- Isolated memory nodes have limited value - always try to create connections
- After storing a memory, think about what it relates to and use connect_memories()
- Connect new information to existing knowledge whenever possible
- Examples of valuable connections:
  * Person → Location (where they live/work)
  * Person → Person (relationships, family, colleagues)
  * Person → Interests/Topics (what they care about)
  * Facts → Related entities (car → owner, pet → family)
- The more connections, the richer and more useful the knowledge graph becomes
- Connected memories help you understand context and relationships better

CAUTION - VERIFY BEFORE CONNECTING:
- Don't assume relationships - wait for explicit confirmation
- If unsure about a connection, ask for clarification
- Be ready to update connections when you learn new information
- Common mistakes to avoid:
  * Assuming someone's spouse/partner without confirmation
  * Assuming family relationships from shared last names
  * Assuming work relationships without explicit information
  * Connecting wrong entities with similar names
- If you learn something that contradicts existing connections, update them
- It's better to have fewer accurate connections than many assumed ones

EVOLVING PROPERTIES TO ENTITIES:
When you learn more details about something stored as a property, it might need to become its own node:

EXAMPLES of property → entity evolution:
- "work: Google" → Create Organization node "Google" with WORKS_FOR relationship
- "pet: Max" → Create Animal node "Max" with HAS_PET relationship
- "hobby: photography" → Create Topic node "photography" with INTERESTED_IN relationship
- "car: Tesla" → Create Object node "Tesla Model X" with OWNS relationship

WHEN TO CONVERT:
- The property gains its own attributes (e.g., pet has breed, age, personality)
- You learn about relationships it has (e.g., the workplace has other employees)
- It becomes important enough to track independently
- Multiple people share the same entity (e.g., multiple people work at same company)

HOW TO CONVERT:
1. Create new node with remember() for the entity
2. Update original node to remove the property
3. Create appropriate relationship with connect_memories()
4. Add any additional properties to the new entity node

WHEN TO STORE MEMORIES (like a person would):
- Someone introduces themselves: "My name is Sarah"
- Someone shares personal details: job, age, location, family, pets, hobbies
- Someone mentions preferences: "I love jazz music", "I hate spinach"
- Someone tells you about important life events or experiences
- Someone corrects you about something personal
- Important details that would help in future conversations
- Use your judgment - don't store every casual remark

HANDLING INCOMPLETE INFORMATION:
- Sometimes you won't know the name: "I saw my neighbor's white poodle"
  → remember({type: "animal", context: "neighbor's pet", properties: {color: "white", breed: "poodle"}})
- Ask for clarification when appropriate: "What's your neighbor's name? And their dog's name?"
- It's better to store partial information than nothing at all
- You can always update the node later when you learn the name

DON'T STORE:
- Greetings, partial words, "yes/no" answers, casual responses
- Temporary conversation state or casual remarks
- Information already mentioned in current conversation context

ENTITY-BASED APPROACH:
- Store ONE entity per remember() call - don't combine multiple entities
- Use separate remember() calls for each person, place, organization mentioned
- Use connect_memories() to create relationships between entities
- Focus on clean, specific entities that can be connected later

CRITICAL: ENTITY EXTRACTION FOR MEMORY
When someone mentions people, places, or things, extract them as SEPARATE entities with relationships:

BAD APPROACH (storing as properties):
- remember with details="daughter=Nineveh,age=10,son=Isaac,age=17"

GOOD APPROACH (separate entities with relationships):
1. Create person: remember for "Ben" (main person)
2. Create person: remember for "Nineveh" as separate person
3. Create person: remember for "Isaac" as separate person  
4. Create relationships: connect_memories between Ben and each child

ENTITY TYPES TO EXTRACT:
- Person: Names of people mentioned (family, friends, colleagues)
- Location: Cities, venues, addresses, places
- Organization: Companies, schools, groups
- Fact: Ages, dates, important information
- Preference: Likes, dislikes, interests
- Event: Significant moments
- Topic: Areas of knowledge

WHEN TO UPDATE VS CREATE:
- UPDATE: When adding new info about existing entities (age change, new job, moved house)
- CREATE: When introducing completely new entities or correcting major errors
- ALWAYS use recall first to check if entity exists before creating new ones

UPDATE EXAMPLES:
- "Ben moved to London" → update_node on Ben's location property
- "Sarah got promoted" → update_node on Sarah's job_title
- "Ben and Sarah got married" → connect_memories with MARRIED_TO relationship

MEMORY TYPES:
- person: Individual people
- location: Specific places
- fact: Objective information
- preference: Likes/dislikes
- event: Significant moments
- topic: Areas of knowledge

GOOD PATTERN:
1. remember(type="person", name="Ben")
2. remember(type="person", name="Sarah") 
3. connect_memories(from="Ben", to="Sarah", relationship="MARRIED_TO")

BAD PATTERN:
- remember(type="person", name="Ben", properties={"wife": "Sarah"}) // 'wife' should be a separate node!

Examples:
- remember(type="person", name="Ben", context="User introduced themselves")
- remember(type="place", name="Cambridge", properties={"country": "UK"})
- remember(type="food", name="pizza", context="User's favorite food")
- remember(type="animal", name="Max", properties={"breed": "poodle", "color": "white"})
- Then use connect_memories() to link them`,
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['person', 'place', 'organization', 'object', 'animal', 'event', 'topic', 'media', 'food', 'activity'],
                description: 'Type of memory to store',
              },
              name: {
                type: 'string',
                description: 'What to call this entity (optional but strongly recommended)',
              },
              context: {
                type: ['string', 'array'],
                description: 'When/how this was mentioned, including quotes',
              },
              properties: {
                type: 'object',
                description: 'Additional attributes specific to the entity type',
                additionalProperties: true,
              },
              relates_to: {
                type: 'string',
                description: 'ID or name of related memory to connect to',
              },
            },
            required: ['type'],
          },
        },
        {
          name: 'recall',
          description: `Search and retrieve memories from the knowledge graph. Use this BEFORE creating new memories to avoid duplicates.

MEMORY STRUCTURE MIGRATION:
When you encounter memories using the old structure (with 'content' instead of 'name'), consider updating them:
- Old format: Nodes with 'content' property containing the entity name
- New format: Nodes with 'name' property and optional 'context' for source information
- If appropriate to the conversation, ask the user to clarify ambiguous memories
- Example: "I see you have a memory about 'Cambridge' - is this Cambridge, UK or Cambridge, MA?"
- Use update_node to migrate memories to the new structure when clarifying with users
- Add missing properties like country, state, or other disambiguating information

ALWAYS USE THIS TOOL WHEN:
- User asks about identity: "who am I", "what's my name", "do you know me"
- Starting a conversation (check for relationship=self to find who the user is)
- User mentions any person, place, or topic that might be known
- Before using remember to check if memory already exists

Common queries:
- "What's my name?" → recall(query="relationship=self", type="person")
- "What do you know about me?" → recall(query="[name]", type="person", depth=3)
- "Where do I live?" → recall(query="[name]", type="person", depth=2)
- Check for existing entities → recall(query="Cambridge", type="location")
- Find recent memories → recall(query="", type="person") and check created_at

HANDLING EMPTY RESULTS:
- If recall returns [] (empty array), this means NO MEMORIES EXIST YET for this query
- This is NORMAL for new conversations or new topics
- Do NOT interpret empty results as "new conversation" - just means no stored memories
- Continue normally with the conversation using information from current context
- Only store memories when users share meaningful personal information

HANDLING AMBIGUOUS SEARCHES:
- Multiple Johns? → recall(query="John", type="person") then check details to identify which one
- Multiple Cambridges? → recall(query="Cambridge", type="location") then look for country/region
- If multiple results, ask user to clarify: "I know 3 Johns. Do you mean John from Google, John your brother, or John from tennis club?"

WHEN TO RECALL MEMORIES (like a person would):
- They ask what you remember about someone/something
- Something reminds you of previous conversations
- When it would naturally help the conversation

PROACTIVE MEMORY RECALL:
When people, places, or familiar topics are mentioned, you MAY check if you have memories about them:
- Use recall sparingly - only when it would genuinely help the conversation
- Focus on responding to what they're saying NOW rather than always checking memory
- If you do recall something relevant, use it naturally without announcing "I recall..."
- Empty results don't mean anything is wrong - just means you haven't learned about that yet

UNDERSTANDING WHEN TO USE RECALL:

**CHECK CONVERSATION FIRST**: Before using recall, always check your current conversation!
- If user told you their name 3 messages ago, you already know it - don't recall
- If user mentioned they live in Cambridge earlier in THIS chat, you know it - don't recall
- Only use recall when information is NOT in the current conversation

**USE RECALL FOR**:
- Information from PREVIOUS conversations (past sessions)
- Starting a NEW conversation ("who am I?" at the beginning)
- Verifying if something exists in long-term memory before storing it
- Finding connections and relationships stored from past interactions

REMEMBER: Your conversation history is your short-term memory. Neo4j is your long-term memory.
Don't use a database query for something you were just told!

MEMORY PERSPECTIVE:
- Treat stored memories as YOUR personal knowledge about people and situations
- Say "I remember you told me..." or "From what I know about you..." rather than "your memories show..."
- Use your memory naturally like a person would - recall relevant details when they matter to the conversation
- Don't always announce when you're accessing memory - just know things naturally from past conversations
- The memory system helps you be a better conversational partner by remembering context

The depth parameter controls how many relationships to traverse (1=just the node, 2+=includes connections).

ORDERING AND LIMITS:
- Results are ordered by created_at DESC (most recent first)
- Limited to 50 results to prevent overwhelming responses
- If you need older memories, be more specific in your query
- Most recent memories are prioritized in truncated responses`,
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'What to search for',
              },
              type: {
                type: 'string',
                description: 'Optional: Filter by memory type',
              },
              depth: {
                type: 'number',
                description: 'How many relationship levels to include (default 1)',
              },
              order_by: {
                type: 'string',
                description: 'Optional: How to order results. Options: "created_at DESC" (newest first), "created_at ASC" (oldest first), "updated_at DESC" (recently modified), or any property like "name ASC". Default: "created_at DESC"',
              },
              limit: {
                type: 'number',
                description: 'Optional: Maximum number of results (default 50, max 200)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'connect_memories',
          description: `Create relationships between existing memories to build a knowledge graph.

IMPORTANT: Only use AFTER creating both nodes with remember(). The nodes must exist before connecting them.

WHY CONNECTIONS MATTER:
- Isolated memories are like scattered puzzle pieces - connections make the picture complete
- Connected knowledge is exponentially more valuable than isolated facts
- Relationships help you understand context and make better conversation
- Always look for opportunities to connect new information to existing knowledge
- The richer the connections, the better you can understand and help the user

RELATIONSHIP PATTERNS:
- Family: FATHER_OF, MOTHER_OF, CHILD_OF, SIBLING_OF, MARRIED_TO
- Work: WORKS_FOR, COLLEAGUE_OF, MANAGER_OF, REPORTS_TO
- Location: LIVES_IN, WORKS_IN, BORN_IN, VISITED
- Social: KNOWS, FRIEND_OF, PARTNER_OF
- Interest: INTERESTED_IN, EXPERT_IN, STUDIES

Common relationships:
- Person → Location: LIVES_IN, WORKS_IN, VISITED, FROM
- Person → Person: KNOWS, FRIEND_OF, WORKS_WITH, RELATED_TO
- Person → Organization: WORKS_AT, MEMBER_OF, FOUNDED
- Person → Topic: INTERESTED_IN, EXPERT_IN
- Person → Preference: HAS_PREFERENCE

Examples:
- connect_memories(from="Ben", to="Cambridge, UK", relationship="LIVES_IN")
- connect_memories(from="Ben", to="pizza", relationship="LOVES")
- connect_memories(from="Ben", to="Sarah", relationship="MARRIED_TO")
- connect_memories(from="Ben", to="Nineveh", relationship="FATHER_OF")
- connect_memories(from="Ben", to="OpenAI", relationship="WORKS_FOR")`,
          inputSchema: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                description: 'Source memory ID or unique identifier',
              },
              to: {
                type: 'string',
                description: 'Target memory ID or unique identifier',
              },
              relationship: {
                type: 'string',
                description: 'Type of relationship (e.g., KNOWS, LIVES_IN, PREFERS)',
              },
            },
            required: ['from', 'to', 'relationship'],
          },
        },
        {
          name: 'update_node',
          description: `Update properties of an EXISTING node (not for creating new memories).

PARAMETERS (MUST use this exact structure):
- nodeId: number (required) - the numeric ID of the existing node
- properties: object (required) - key-value pairs to update

CORRECT USAGE:
update_node({
  "nodeId": 123,
  "properties": {
    "age": 30,
    "occupation": "Engineer"
  }
})

INCORRECT (this is for remember, not update_node):
update_node({
  "type": "person",
  "content": "John Doe"
})

Use this ONLY when:
1. You have an existing node ID from recall
2. You want to UPDATE properties, not create new entities
3. The entity already exists in the database

For creating NEW memories, use remember instead!

CONSIDER ENTITY EVOLUTION:
Before adding complex properties, consider if they should be separate nodes:
- Simple property: age=25, color=blue ✓
- Should be entity: work=Google, pet=Max, car="Tesla Model X" ✗
- If a property could have its own properties or relationships, make it a node
- This creates a richer, more queryable knowledge graph`,
          inputSchema: {
            type: 'object',
            properties: {
              nodeId: {
                type: 'number',
                description: 'ID of the node to update',
              },
              properties: {
                type: 'object',
                description: 'Properties to update/add',
                additionalProperties: true,
              },
            },
            required: ['nodeId', 'properties'],
          },
        },
        {
          name: 'update_relationship',
          description: `Update properties of an existing relationship when you learn new information.

USE THIS WHEN:
- You learn that a relationship has changed (e.g., job change, moved locations)
- You need to correct a mistaken connection
- You want to add more details to an existing relationship
- The nature of a relationship has evolved

EXAMPLES:
- Person changed jobs: Update WORKS_FOR relationship
- Someone moved: Update LIVES_IN relationship
- Relationship status changed: Update from DATING to MARRIED_TO
- Correcting mistakes: Fix wrong connections based on new information

IMPORTANT: This updates relationship properties, not the relationship type itself.
To change relationship types, you may need to delete and recreate the connection.`,
          inputSchema: {
            type: 'object',
            properties: {
              fromNodeId: {
                type: 'number',
                description: 'ID of the source node',
              },
              toNodeId: {
                type: 'number',
                description: 'ID of the target node',
              },
              type: {
                type: 'string',
                description: 'Relationship type',
              },
              properties: {
                type: 'object',
                description: 'Properties to update/add',
                additionalProperties: true,
              },
            },
            required: ['fromNodeId', 'toNodeId', 'type', 'properties'],
          },
        },
        {
          name: 'delete_node',
          description: `Delete a memory node and all its relationships from the knowledge graph.

USE WITH EXTREME CAUTION:
- This permanently removes a memory from the database
- All relationships connected to this node will also be deleted
- This action cannot be undone
- Consider if you really need to delete or just update instead

AGENT GUIDANCE - BE VERY CAUTIOUS:
- Never delete memories unless explicitly requested by the user
- Always confirm with the user before deleting: "Are you sure you want me to forget about X?"
- Suggest alternatives: "Would you like me to update this information instead?"
- Explain the consequences: "This will also remove all connections to this memory"
- Default to updating rather than deleting when possible
- If user says something is wrong, ask if they want to correct it (update) or completely forget it (delete)

WHEN TO USE:
- User explicitly asks to forget something: "Forget that I told you X"
- Correcting major errors that can't be fixed with updates
- Removing test data or duplicate entries
- Privacy concerns or user requests for data removal

WHEN NOT TO USE:
- Information has changed: Use update_node instead
- Relationship has changed: Use delete_relationship + create new one
- Minor corrections: Use update functions

IMPORTANT:
- Always use recall first to find the correct node ID
- Double-check you have the right node before deleting
- Consider the impact on connected memories`,
          inputSchema: {
            type: 'object',
            properties: {
              nodeId: {
                type: 'number',
                description: 'ID of the node to delete',
              },
            },
            required: ['nodeId'],
          },
        },
        {
          name: 'delete_relationship',
          description: `Delete a specific relationship between two nodes without deleting the nodes themselves.

USE THIS WHEN:
- A relationship is no longer valid (e.g., no longer works at a company)
- Correcting mistaken connections
- Before creating a new relationship of a different type
- Cleaning up duplicate or incorrect relationships

EXAMPLES:
- Someone quit their job: Delete WORKS_FOR relationship
- Moved away: Delete LIVES_IN relationship  
- Relationship ended: Delete MARRIED_TO or DATING relationship
- Correcting mistakes: Remove wrong connections

IMPORTANT:
- This only deletes the relationship, not the nodes
- You need both node IDs and the exact relationship type
- Use recall first to find the correct node IDs
- Consider if you should create a new relationship after deleting`,
          inputSchema: {
            type: 'object',
            properties: {
              fromNodeId: {
                type: 'number',
                description: 'ID of the source node',
              },
              toNodeId: {
                type: 'number',
                description: 'ID of the target node',
              },
              type: {
                type: 'string',
                description: 'Exact relationship type to delete (e.g., WORKS_FOR, LIVES_IN)',
              },
            },
            required: ['fromNodeId', 'toNodeId', 'type'],
          },
        },
      ],
    }));

    // ツールの実行ハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'execute_query': {
            if (!isExecuteQueryArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid execute_query arguments');
            }
            const result = await this.neo4j.executeQuery(args.query, args.params ?? {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'create_node': {
            if (!isCreateNodeArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid create_node arguments');
            }
            const result = await this.neo4j.createNode(args.label, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'create_relationship': {
            if (!isCreateRelationshipArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid create_relationship arguments');
            }
            const result = await this.neo4j.createRelationship(args.fromNodeId, args.toNodeId, args.type, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'remember': {
            if (!isRememberArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid remember arguments');
            }
            
            // Create clean properties object
            const properties: Record<string, any> = {
              type: args.type,
              created_at: new Date().toISOString()
            };
            
            // Add name if provided
            if (args.name) {
              properties.name = args.name;
            }
            
            // Add context if provided
            if (args.context) {
              properties.context = args.context;
            }
            
            // Add any additional properties
            if (args.properties) {
              Object.assign(properties, args.properties);
            }
            
            // Create the memory node
            const label = args.type.charAt(0).toUpperCase() + args.type.slice(1);
            const result = await this.neo4j.createNode(label, properties);
            
            // If relates_to is specified, create a relationship
            if (args.relates_to) {
              // Find the related node
              const relatedQuery = `
                MATCH (n) 
                WHERE n.name = $name OR id(n) = toInteger($name)
                RETURN id(n) as id
                LIMIT 1
              `;
              const relatedResult = await this.neo4j.executeQuery(relatedQuery, { name: args.relates_to });
              
              if (relatedResult.length > 0) {
                const relatedId = relatedResult[0].id;
                await this.neo4j.createRelationship(
                  result.id,
                  relatedId,
                  'RELATES_TO',
                  { created_at: new Date().toISOString() }
                );
              }
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'recall': {
            if (!isRecallArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid recall arguments');
            }
            
            const depth = args.depth || 1;
            const limit = Math.min(args.limit ?? 50, 200); // Cap at 200
            
            // Parse and validate order_by to prevent injection
            let orderBy = 'n.created_at DESC'; // default
            if (args.order_by) {
              const orderMatch = args.order_by.match(/^(n\.)?([a-zA-Z_]+)\s+(ASC|DESC)$/i);
              if (orderMatch) {
                const property = orderMatch[2];
                const direction = orderMatch[3].toUpperCase();
                orderBy = `n.${property} ${direction}`;
              } else {
                throw new McpError(ErrorCode.InvalidParams, 'Invalid order_by format. Use "property ASC" or "property DESC"');
              }
            }
            
            let query = `
              MATCH (n)
              WHERE n.name CONTAINS $query OR n.context CONTAINS $query OR any(key IN keys(n) WHERE toString(n[key]) CONTAINS $query)
            `;
            
            if (args.type) {
              query += ` AND labels(n)[0] = $type`;
            }
            
            if (depth > 0) {
              query += `
                OPTIONAL MATCH path = (n)-[*1..${depth}]-(related)
                RETURN n, collect(DISTINCT {
                  node: related,
                  relationship: relationships(path)[0],
                  distance: length(path)
                }) as connections
                ORDER BY ${orderBy}
                LIMIT ${limit}
              `;
            } else {
              query += ` RETURN n, [] as connections
                ORDER BY ${orderBy}
                LIMIT ${limit}`;
            }
            
            const params: Record<string, any> = { query: args.query };
            if (args.type) {
              params.type = args.type.charAt(0).toUpperCase() + args.type.slice(1);
            }
            
            const result = await this.neo4j.executeQuery(query, params);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'connect_memories': {
            if (!isConnectMemoriesArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid connect_memories arguments');
            }
            
            // Find the source node
            const fromQuery = `
              MATCH (n) 
              WHERE n.name = $name OR id(n) = toInteger($name)
              RETURN id(n) as id
              LIMIT 1
            `;
            const fromResult = await this.neo4j.executeQuery(fromQuery, { name: args.from });
            
            if (fromResult.length === 0) {
              throw new Error(`Source memory '${args.from}' not found`);
            }
            
            // Find the target node
            const toResult = await this.neo4j.executeQuery(fromQuery, { name: args.to });
            
            if (toResult.length === 0) {
              throw new Error(`Target memory '${args.to}' not found`);
            }
            
            const result = await this.neo4j.createRelationship(
              fromResult[0].id,
              toResult[0].id,
              args.relationship,
              { created_at: new Date().toISOString() }
            );
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'update_node': {
            if (!isUpdateNodeArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid update_node arguments');
            }
            const result = await this.neo4j.updateNode(args.nodeId, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'update_relationship': {
            if (!isUpdateRelationshipArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid update_relationship arguments');
            }
            const result = await this.neo4j.updateRelationship(args.fromNodeId, args.toNodeId, args.type, args.properties);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'delete_node': {
            if (!isDeleteNodeArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid delete_node arguments');
            }
            const result = await this.neo4j.deleteNode(args.nodeId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'delete_relationship': {
            if (!isDeleteRelationshipArgs(args)) {
              throw new McpError(ErrorCode.InvalidParams, 'Invalid delete_relationship arguments');
            }
            const result = await this.neo4j.deleteRelationship(args.fromNodeId, args.toNodeId, args.type);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error('Error executing tool:', error);
        return {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : 'Unknown error occurred',
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Neo4j MCP server running on stdio');
  }

  async close(): Promise<void> {
    await this.neo4j.close();
    await this.server.close();
  }
}
