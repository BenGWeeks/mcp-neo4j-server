import neo4j, { Driver, Session, QueryResult, Record as Neo4jRecord, Node, Relationship, Integer } from 'neo4j-driver';

export interface Neo4jQueryParams {
  [key: string]: any;
}

export class Neo4jClient {
  private driver: Driver;
  private database?: string;

  constructor(uri: string, username: string, password: string, database?: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    this.database = database;
  }

  async executeQuery<T = any>(query: string, params: Neo4jQueryParams = {}): Promise<T[]> {
    const session: Session = this.driver.session({
      database: this.database
    });
    try {
      const result: QueryResult = await session.run(query, params);
      return result.records.map((record: Neo4jRecord) => {
        const obj: { [key: string]: any } = {};
        for (const key of record.keys) {
          const value = record.get(key);
          if (value instanceof Node || value instanceof Relationship) {
            obj[key as string] = {
              ...value.properties,
              _id: value.identity.toNumber(),
              _labels: value instanceof Node ? value.labels : undefined,
              _type: value instanceof Relationship ? value.type : undefined,
            };
          } else {
            obj[key as string] = value instanceof Integer ? value.toNumber() : value;
          }
        }
        return obj as T;
      });
    } finally {
      await session.close();
    }
  }

  async getNodes(label: string): Promise<any[]> {
    return this.executeQuery(`MATCH (n:${label}) RETURN n`);
  }

  async createNode(label: string, properties: Neo4jQueryParams): Promise<any> {
    const result = await this.executeQuery(`CREATE (n:${label} $props) RETURN n`, { props: properties });
    return result[0];
  }

  async createRelationship(fromNodeId: number, toNodeId: number, relationType: string, properties: Neo4jQueryParams = {}): Promise<any> {
    const result = await this.executeQuery(
      `MATCH (a), (b)
       WHERE id(a) = $fromId AND id(b) = $toId
       CREATE (a)-[r:${relationType} $props]->(b)
       RETURN r`,
      {
        fromId: neo4j.int(fromNodeId),
        toId: neo4j.int(toNodeId),
        props: properties,
      }
    );
    return result[0];
  }

  async updateNode(nodeId: number, properties: Neo4jQueryParams): Promise<any> {
    const result = await this.executeQuery(
      `MATCH (n) WHERE id(n) = $nodeId
       SET n += $props
       RETURN n`,
      {
        nodeId: neo4j.int(nodeId),
        props: properties,
      }
    );
    return result[0];
  }

  async updateRelationship(fromNodeId: number, toNodeId: number, relationType: string, properties: Neo4jQueryParams): Promise<any> {
    const result = await this.executeQuery(
      `MATCH (a)-[r:${relationType}]->(b)
       WHERE id(a) = $fromId AND id(b) = $toId
       SET r += $props
       RETURN r`,
      {
        fromId: neo4j.int(fromNodeId),
        toId: neo4j.int(toNodeId),
        props: properties,
      }
    );
    return result[0];
  }

  async deleteNode(nodeId: number): Promise<any> {
    const result = await this.executeQuery(
      `MATCH (n) WHERE id(n) = $nodeId
       DETACH DELETE n
       RETURN count(n) as deletedCount`,
      {
        nodeId: neo4j.int(nodeId),
      }
    );
    return result[0];
  }

  async deleteRelationship(fromNodeId: number, toNodeId: number, relationType: string): Promise<any> {
    const result = await this.executeQuery(
      `MATCH (a)-[r:${relationType}]->(b)
       WHERE id(a) = $fromId AND id(b) = $toId
       DELETE r
       RETURN count(r) as deletedCount`,
      {
        fromId: neo4j.int(fromNodeId),
        toId: neo4j.int(toNodeId),
      }
    );
    return result[0];
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
