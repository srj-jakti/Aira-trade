# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive system health audit and connectivity verification feature for the AiRA trading platform. The system audits the health of all platform components (Frontend on Vercel, Backend on Supabase, Workers on Railway, Redis, and external integrations), verifies connectivity across services, identifies broken functionality, and provides automated health monitoring capabilities.

## Glossary

- **Health_Auditor**: The system component responsible for checking the operational status of all platform services
- **Connectivity_Verifier**: The component that validates network connections and API accessibility between services
- **Railway_Service**: Background worker processes running on Railway (trading-engine, market-data-worker, cron-maintenance, rl-engine)
- **Supabase_Backend**: PostgreSQL database and authentication service hosted on Supabase
- **Vercel_Frontend**: Next.js application deployed on Vercel
- **Redis_Cache**: In-memory data store used by Railway workers for caching and distributed locking
- **Health_Check_Script**: Automated script that performs periodic system health verification
- **Audit_Report**: Structured document containing health status, connectivity results, and identified issues
- **Severity_Level**: Classification of issues (Critical, High, Medium, Low) based on impact to system functionality
- **Zerodha_Integration**: Broker API connection for executing trades on NSE/BSE markets
- **RLS_Policy**: Row Level Security policy in Supabase that controls data access permissions

## Requirements

### Requirement 1: Frontend Health Verification

**User Story:** As a system administrator, I want to verify the health of the Vercel frontend deployment, so that I can ensure users can access the application and all pages are functioning correctly.

#### Acceptance Criteria

1. WHEN the Health_Auditor checks the Vercel deployment THEN the system SHALL retrieve the current deployment status and build information
2. WHEN the Health_Auditor tests API routes THEN the system SHALL verify that all critical API endpoints (/api/auth/*, /api/market-data/*, /api/trading/*) return valid responses
3. WHEN the Health_Auditor checks the build status THEN the system SHALL verify that the latest deployment completed successfully without errors
4. WHEN the Health_Auditor tests page accessibility THEN the system SHALL verify that all protected and public routes are accessible
5. IF the frontend deployment has errors THEN the Health_Auditor SHALL classify them by Severity_Level and include deployment logs in the Audit_Report

### Requirement 2: Supabase Backend Health Verification

**User Story:** As a system administrator, I want to verify the health of the Supabase backend, so that I can ensure database operations, authentication, and data security are functioning correctly.

#### Acceptance Criteria

1. WHEN the Connectivity_Verifier tests Supabase connection THEN the system SHALL execute a test query to verify database accessibility
2. WHEN the Health_Auditor checks authentication THEN the system SHALL verify that both anon key and service role key connections are functional
3. WHEN the Health_Auditor validates RLS_Policy configurations THEN the system SHALL verify that all tables have appropriate Row Level Security enabled
4. WHEN the Health_Auditor checks table schemas THEN the system SHALL verify that all required tables (profiles, strategies, trades, market_data, subscriptions) exist with correct column definitions
5. IF database connectivity fails THEN the Health_Auditor SHALL report the failure as Critical severity and include connection error details

### Requirement 3: Railway Worker Health Verification

**User Story:** As a system administrator, I want to verify the health of all Railway worker services, so that I can ensure background processes for trading and market data are operational.

#### Acceptance Criteria

1. WHEN the Health_Auditor checks Railway_Service status THEN the system SHALL retrieve the deployment status for trading-engine, market-data-worker, cron-maintenance, and rl-engine
2. WHEN the Health_Auditor verifies worker processes THEN the system SHALL check that each Railway_Service is running and not in a crashed or failed state
3. WHEN the Health_Auditor checks worker logs THEN the system SHALL retrieve recent logs and identify any error patterns or exceptions
4. WHEN the Health_Auditor validates environment variables THEN the system SHALL verify that all required variables (REDIS_URL, ENCRYPTION_KEY, SUPABASE_SERVICE_ROLE_KEY) are set for each Railway_Service
5. IF any Railway_Service is not running THEN the Health_Auditor SHALL classify it as Critical severity and include the last known error in the Audit_Report

### Requirement 4: Redis Connectivity Verification

**User Story:** As a system administrator, I want to verify Redis connectivity from all services that depend on it, so that I can ensure caching and distributed locking mechanisms are functional.

#### Acceptance Criteria

1. WHEN the Connectivity_Verifier tests Redis connection THEN the system SHALL attempt to connect using the REDIS_URL environment variable
2. WHEN the Connectivity_Verifier validates Redis operations THEN the system SHALL perform test SET and GET operations to verify read/write functionality
3. WHEN the Health_Auditor checks Redis from Railway workers THEN the system SHALL verify that trading-engine and market-data-worker can successfully connect to Redis_Cache
4. IF Redis_Cache is not accessible THEN the Connectivity_Verifier SHALL report it as Critical severity since trading-engine depends on it for distributed locking
5. WHEN Redis connectivity is verified THEN the system SHALL report the Redis version and memory usage statistics

### Requirement 5: External Integration Health Verification

**User Story:** As a system administrator, I want to verify the health of external integrations (Zerodha, Razorpay), so that I can ensure trading and payment functionality are operational.

#### Acceptance Criteria

1. WHEN the Health_Auditor checks Zerodha_Integration THEN the system SHALL verify that API credentials are configured and test authentication
2. WHEN the Health_Auditor validates Zerodha connectivity THEN the system SHALL attempt to fetch market status or instrument list to verify API accessibility
3. WHEN the Health_Auditor checks Razorpay integration THEN the system SHALL verify that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured
4. IF Zerodha_Integration authentication fails THEN the Health_Auditor SHALL classify it as High severity and include the authentication error details
5. IF payment gateway credentials are missing THEN the Health_Auditor SHALL classify it as Medium severity since it affects subscription functionality

### Requirement 6: Code Quality and Security Audit

**User Story:** As a system administrator, I want to audit code quality and security configurations, so that I can identify potential vulnerabilities and code issues that may affect system stability.

#### Acceptance Criteria

1. WHEN the Health_Auditor runs linting checks THEN the system SHALL execute ESLint and report the count of errors and warnings
2. WHEN the Health_Auditor checks TypeScript compilation THEN the system SHALL verify that the codebase compiles without type errors
3. WHEN the Health_Auditor validates security headers THEN the system SHALL verify that HSTS, X-Frame-Options, and CSP headers are configured in next.config.ts
4. WHEN the Health_Auditor checks encryption configuration THEN the system SHALL verify that ENCRYPTION_KEY is set and is exactly 32 bytes (64 hex characters)
5. WHEN the Health_Auditor validates middleware protection THEN the system SHALL verify that admin routes and cron endpoints are protected with authentication checks

### Requirement 7: Comprehensive Audit Report Generation

**User Story:** As a system administrator, I want to receive a comprehensive audit report with all findings, so that I can understand the current system health and prioritize fixes.

#### Acceptance Criteria

1. WHEN the Health_Auditor completes all checks THEN the system SHALL generate an Audit_Report containing results from all verification categories
2. WHEN the Audit_Report is generated THEN the system SHALL organize issues by Severity_Level (Critical, High, Medium, Low)
3. WHEN the Audit_Report includes an issue THEN the system SHALL provide the component name, issue description, severity, and recommended fix
4. WHEN the Audit_Report is complete THEN the system SHALL include a summary section with total issue count by severity and overall health score
5. WHEN the Audit_Report is saved THEN the system SHALL write it to a markdown file with timestamp and include comparison to previous audit if available

### Requirement 8: Automated Health Check Scripts

**User Story:** As a system administrator, I want automated health check scripts that can run periodically, so that I can monitor system health continuously without manual intervention.

#### Acceptance Criteria

1. WHEN a Health_Check_Script is created THEN the system SHALL implement it as a standalone executable script that can run via CLI
2. WHEN the Health_Check_Script runs THEN the system SHALL execute all health verification checks in parallel where possible to minimize execution time
3. WHEN the Health_Check_Script completes THEN the system SHALL output results in both human-readable format and machine-readable JSON format
4. WHEN the Health_Check_Script detects Critical issues THEN the system SHALL exit with a non-zero status code to enable alerting in CI/CD pipelines
5. WHEN the Health_Check_Script is configured THEN the system SHALL support environment-specific configuration (development, staging, production) via command-line flags or environment variables

### Requirement 9: Connectivity Test Suite

**User Story:** As a system administrator, I want a dedicated connectivity test suite, so that I can quickly diagnose network and API connection issues between services.

#### Acceptance Criteria

1. WHEN the Connectivity_Verifier runs the test suite THEN the system SHALL test connections to Supabase_Backend, Redis_Cache, Railway_Service endpoints, and external APIs
2. WHEN the Connectivity_Verifier tests an endpoint THEN the system SHALL measure response time and report if it exceeds acceptable thresholds (>2000ms for database, >5000ms for external APIs)
3. WHEN the Connectivity_Verifier tests Railway services THEN the system SHALL verify that health check endpoints (if implemented) return 200 status codes
4. WHEN connectivity tests fail THEN the Connectivity_Verifier SHALL distinguish between network errors, authentication errors, and timeout errors
5. WHEN the connectivity test suite completes THEN the system SHALL generate a connectivity matrix showing the status of all service-to-service connections

### Requirement 10: Historical Comparison and Trend Analysis

**User Story:** As a system administrator, I want to compare current audit results with previous audits, so that I can identify degradation or improvements in system health over time.

#### Acceptance Criteria

1. WHEN the Health_Auditor generates an Audit_Report THEN the system SHALL store it with a timestamp for historical reference
2. WHEN a new audit is performed THEN the system SHALL compare results with the most recent previous audit (if available)
3. WHEN comparing audits THEN the system SHALL identify new issues that were not present in the previous audit
4. WHEN comparing audits THEN the system SHALL identify resolved issues that were present in the previous audit but are now fixed
5. WHEN the comparison is complete THEN the system SHALL include a "Changes Since Last Audit" section in the Audit_Report showing new, resolved, and persistent issues
