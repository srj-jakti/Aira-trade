const RAILWAY_API_KEY = "e4f59994-176e-44bb-b1e2-fce6390fbe6f";
const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

const SUPABASE_URL = "https://fhkathpufpbkwzdfczgj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoa2F0aHB1ZnBia3d6ZGZjemdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg1MDQ4NiwiZXhwIjoyMDgyNDI2NDg2fQ.rCxdqZ4PRN4WP0BMLl5z0xwCjjwrelgaKgGsqH-5g-Y";
const ENCRYPTION_KEY = "a7f3b9c2d8e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9";

async function railwayQuery(query, variables = {}) {
  const response = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RAILWAY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  
  const data = await response.json();
  if (data.errors) {
    console.error("GraphQL Errors:", JSON.stringify(data.errors, null, 2));
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

async function main() {
  console.log("🚀 Starting Railway Deployment for AiRA Trading Platform...\n");

  // Step 1: Get current user info
  console.log("1. Checking API connection...");
  try {
    const me = await railwayQuery(`query { me { name email } }`);
    console.log(`   ✅ Connected as: ${me.me.name} (${me.me.email})\n`);
  } catch (error) {
    console.error("   ❌ Failed to connect to Railway API:", error.message);
    process.exit(1);
  }

  // Step 2: Create a new project
  console.log("2. Creating new Railway project...");
  let projectId, environmentId;
  try {
    const projectResult = await railwayQuery(`
      mutation projectCreate {
        projectCreate(input: { name: "AiRA Trading Engine", description: "AI Auto-Trading Background Services" }) {
          id
          name
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `);
    
    projectId = projectResult.projectCreate.id;
    environmentId = projectResult.projectCreate.environments.edges[0]?.node.id;
    console.log(`   ✅ Project created: ${projectResult.projectCreate.name}`);
    console.log(`   📁 Project ID: ${projectId}`);
    console.log(`   🌍 Environment ID: ${environmentId}\n`);
  } catch (error) {
    console.error("   ❌ Failed to create project:", error.message);
    process.exit(1);
  }

  // Step 3: Create Market Data Worker service
  console.log("3. Creating Market Data Worker service...");
  let marketDataServiceId;
  try {
    const serviceResult = await railwayQuery(`
      mutation serviceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `, {
      input: {
        projectId: projectId,
        name: "market-data-worker",
      }
    });
    
    marketDataServiceId = serviceResult.serviceCreate.id;
    console.log(`   ✅ Service created: market-data-worker`);
    console.log(`   🔧 Service ID: ${marketDataServiceId}\n`);
  } catch (error) {
    console.error("   ❌ Failed to create market-data-worker:", error.message);
  }

  // Step 4: Create Trading Engine service
  console.log("4. Creating Trading Engine service...");
  let tradingEngineServiceId;
  try {
    const serviceResult = await railwayQuery(`
      mutation serviceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `, {
      input: {
        projectId: projectId,
        name: "trading-engine",
      }
    });
    
    tradingEngineServiceId = serviceResult.serviceCreate.id;
    console.log(`   ✅ Service created: trading-engine`);
    console.log(`   🔧 Service ID: ${tradingEngineServiceId}\n`);
  } catch (error) {
    console.error("   ❌ Failed to create trading-engine:", error.message);
  }

  // Step 5: Set environment variables for market-data-worker
  if (marketDataServiceId) {
    console.log("5. Setting environment variables for market-data-worker...");
    try {
      await railwayQuery(`
        mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
          variableCollectionUpsert(input: $input)
        }
      `, {
        input: {
          projectId: projectId,
          environmentId: environmentId,
          serviceId: marketDataServiceId,
          variables: {
            SUPABASE_URL: SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
            ENCRYPTION_KEY: ENCRYPTION_KEY,
            NODE_ENV: "production",
          }
        }
      });
      console.log("   ✅ Environment variables set\n");
    } catch (error) {
      console.error("   ❌ Failed to set variables:", error.message);
    }
  }

  // Step 6: Set environment variables for trading-engine
  if (tradingEngineServiceId) {
    console.log("6. Setting environment variables for trading-engine...");
    try {
      await railwayQuery(`
        mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
          variableCollectionUpsert(input: $input)
        }
      `, {
        input: {
          projectId: projectId,
          environmentId: environmentId,
          serviceId: tradingEngineServiceId,
          variables: {
            SUPABASE_URL: SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY,
            ENCRYPTION_KEY: ENCRYPTION_KEY,
            NODE_ENV: "production",
            LOG_LEVEL: "info",
          }
        }
      });
      console.log("   ✅ Environment variables set\n");
    } catch (error) {
      console.error("   ❌ Failed to set variables:", error.message);
    }
  }

  // Summary
  console.log("═".repeat(60));
  console.log("🎉 RAILWAY PROJECT SETUP COMPLETE!");
  console.log("═".repeat(60));
  console.log(`
Project ID: ${projectId}
Environment ID: ${environmentId}

Services Created:
  1. market-data-worker (ID: ${marketDataServiceId || "N/A"})
  2. trading-engine (ID: ${tradingEngineServiceId || "N/A"})

NEXT STEPS:
-----------
1. Go to https://railway.app/project/${projectId}
2. For each service, connect the GitHub repo or upload code:
   - market-data-worker → railway/market-data-worker/
   - trading-engine → railway/trading-engine/
3. Or use Railway CLI:
   railway link ${projectId}
   cd railway/market-data-worker && railway up
   cd railway/trading-engine && railway up

Environment Variables are already configured!
`);
}

main().catch(console.error);
