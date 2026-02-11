# System Health Audit and Connectivity

Comprehensive health monitoring and verification system for the AiRA trading platform.

## Features

- **Frontend Health**: Vercel deployment status, API routes, page accessibility
- **Backend Health**: Supabase database, authentication, RLS policies, table schemas
- **Worker Health**: Railway services status, environment variables, logs
- **Redis Health**: Connection, operations, server info
- **Integration Health**: Zerodha and Razorpay credentials and connectivity
- **Code Quality**: Linting, TypeScript compilation, security configuration, encryption

## Quick Start

```bash
# Run full health check
npm run health-check

# Run for specific environment
npm run health-check:dev
npm run health-check:prod

# Run specific category
npm run health-check -- --category=backend

# View audit history
npm run health-check -- history

# Compare with previous audit
npm run health-check -- --compare
```

## Commands

### Run Audit

```bash
npm run health-check [options]
```

Options:
- `-e, --env <environment>` - Environment to audit (development, staging, production)
- `-c, --category <category>` - Specific category to audit
- `--json` - Output JSON only
- `-v, --verbose` - Verbose output
- `--compare` - Compare with previous audit
- `--no-save` - Do not save audit to history

### View History

```bash
npm run health-check -- history [options]
```

Options:
- `-l, --limit <number>` - Limit number of results (default: 10)

### View Specific Audit

```bash
npm run health-check -- view <timestamp>
```

## Configuration

Configuration file: `.kiro/health-check-config.json`

```json
{
  "version": "1.0.0",
  "environments": {
    "production": {
      "vercelProjectId": "your-project-id",
      "railwayProjectId": "your-project-id",
      "supabaseProjectRef": "your-ref",
      "redisUrl": "redis://..."
    }
  },
  "checks": {
    "frontend": {
      "enabled": true,
      "timeout": 30000
    }
  },
  "thresholds": {
    "healthyMinScore": 90,
    "degradedMinScore": 70
  }
}
```

## Environment Variables

Required environment variables:

### Frontend
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_PROJECT_ID` - Vercel project ID (optional)
- `NEXT_PUBLIC_APP_URL` - Application URL

### Backend
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Workers
- `RAILWAY_TOKEN` - Railway API token (optional)
- `RAILWAY_PROJECT_ID` - Railway project ID (optional)

### Redis
- `REDIS_URL` - Redis connection URL

### Integrations
- `ZERODHA_API_KEY` - Zerodha API key
- `ZERODHA_API_SECRET` - Zerodha API secret
- `RAZORPAY_KEY_ID` - Razorpay key ID
- `RAZORPAY_KEY_SECRET` - Razorpay key secret

### Security
- `ENCRYPTION_KEY` - 64-character hex encryption key

## Exit Codes

- `0` - All checks passed (healthy)
- `1` - Warnings present (degraded)
- `2` - Critical issues found (critical)
- `3` - Audit execution failed (unknown)

## Output

### Console Output

```
=== System Health Audit Summary ===

Environment: production
Overall Health: HEALTHY
Health Score: 95/100
Duration: 12.3s

Checks: 38/40 passed

===================================
```

### Markdown Report

Detailed reports are saved to `.kiro/audit-history/report-{env}-{timestamp}.md`

### JSON Output

Use `--json` flag for machine-readable output suitable for CI/CD pipelines.

## Audit History

Audit results are automatically saved to `.kiro/audit-history/` with:
- Timestamp-based filenames
- Automatic cleanup after 30 days
- Comparison with previous audits

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/health-check.yml`:

```yaml
name: System Health Check
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run health-check -- --env=production --json
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
      - name: Upload Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: health-report
          path: .kiro/audit-history/
```

## Troubleshooting

### "REDIS_URL not configured"

Set the `REDIS_URL` environment variable or disable Redis checks in config.

### "Vercel API error: 401"

Verify `VERCEL_TOKEN` is valid and has correct permissions.

### "Database connection failed"

Check Supabase credentials and network connectivity.

### "TypeScript compilation failed"

Run `npm run build` to see detailed TypeScript errors.

## Development

### Project Structure

```
scripts/health-check/
├── cli.ts                    # CLI interface
├── orchestrator.ts           # Audit coordinator
├── config.ts                 # Configuration management
├── types.ts                  # TypeScript types
├── report-generator.ts       # Report generation
├── history-manager.ts        # Audit history
├── connectivity-verifier.ts  # Connectivity tests
└── auditors/
    ├── frontend-auditor.ts
    ├── backend-auditor.ts
    ├── worker-auditor.ts
    ├── redis-auditor.ts
    ├── integration-auditor.ts
    └── code-quality-auditor.ts
```

### Adding New Checks

1. Add check function to appropriate auditor
2. Update category's `run*Audit()` function
3. Add check name to config.ts defaults
4. Update documentation

## Support

For issues or questions, refer to the main project documentation or create an issue in the repository.
