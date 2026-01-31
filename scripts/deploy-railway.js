const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!RAILWAY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables. Please check your .env.local file.");
  process.exit(1);
}

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

  // Step 1: Get current user info and workspace
  console.log("1. Checking API connection...");
  let workspaceId;
  try {
    // First check user and get workspace
    const me = await railwayQuery(`query { me { name email id workspaces { id name } } }`);
    console.log(`   ✅ Connected as: ${me.me.name || me.me.email} (${me.me.email})`);
    
    if (me.me.workspaces?.length > 0) {
      workspaceId = me.me.workspaces[0].id;
      console.log(`   📂 Using workspace: ${me.me.workspaces[0].name} (${workspaceId})\n`);
    } else {
      console.error("   ❌ No workspaces found. Please create a workspace on Railway first.");
      process.exit(1);
    }
  } catch (error) {
    console.error("   ❌ Failed to connect to Railway API:", error.message);
    process.exit(1);
  }

  // Step 2: Create a new project
  console.log("2. Creating new Railway project...");
  let projectId, environmentId;
  try {
    const projectResult = await railwayQuery(`
      mutation projectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
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
    `, {
      input: {
        name: "AiRA Trading Engine",
        description: "AI Auto-Trading Background Services",
        workspaceId: workspaceId
      }
    });
    
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
