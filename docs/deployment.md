# Deployment Guide

## Overview

This guide covers deploying the Shopify Browser Agent to various environments including development, staging, and production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Monitoring & Logging](#monitoring--logging)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Kubernetes cluster (for K8s deployment)
- Cloud provider account (AWS, GCP, Azure)

## Environment Setup

### 1. Environment Variables

Copy the appropriate environment template:

```bash
# Development
cp .env.example .env

# Production
cp .env.production.example .env.production
```

### 2. Required Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# Shopify
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret

# AI Services
OPENAI_API_KEY=your_openai_key
MISTRAL_API_KEY=your_mistral_key

# Security
JWT_SECRET=your_32_char_secret
SESSION_SECRET=your_32_char_session_secret

# Monitoring (Optional)
SENTRY_DSN=your_sentry_dsn
```

## Local Development

### 1. Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### 2. Manual Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL & Redis
# (Use your preferred method)

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### 3. Database Setup

```bash
# Create database
createdb shopify_agent

# Run migrations
npm run migrate

# Seed data (optional)
npm run seed
```

## Docker Deployment

### 1. Build Image

```bash
# Build for production
docker build -t shopify-browser-agent:latest .

# Build with specific tag
docker build -t shopify-browser-agent:v1.0.0 .
```

### 2. Run Container

```bash
# Basic run
docker run -p 3000:3000 shopify-browser-agent:latest

# With environment file
docker run --env-file .env.production -p 3000:3000 shopify-browser-agent:latest

# With volumes
docker run \
  --env-file .env.production \
  -v /path/to/logs:/app/logs \
  -p 3000:3000 \
  shopify-browser-agent:latest
```

### 3. Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: shopify-browser-agent:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Deployment

### 1. Namespace & Config

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shopify-agent

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shopify-agent-config
  namespace: shopify-agent
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
```

### 2. Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: shopify-agent-secrets
  namespace: shopify-agent
type: Opaque
data:
  DATABASE_URL: <base64-encoded-url>
  REDIS_URL: <base64-encoded-url>
  SHOPIFY_API_KEY: <base64-encoded-key>
  SHOPIFY_API_SECRET: <base64-encoded-secret>
  OPENAI_API_KEY: <base64-encoded-key>
  JWT_SECRET: <base64-encoded-secret>
```

### 3. Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shopify-agent
  namespace: shopify-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shopify-agent
  template:
    metadata:
      labels:
        app: shopify-agent
    spec:
      containers:
      - name: shopify-agent
        image: ghcr.io/your-org/shopify-browser-agent:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: shopify-agent-config
        - secretRef:
            name: shopify-agent-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 4. Service & Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: shopify-agent-service
  namespace: shopify-agent
spec:
  selector:
    app: shopify-agent
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shopify-agent-ingress
  namespace: shopify-agent
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: shopify-agent-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: shopify-agent-service
            port:
              number: 80
```

### 5. Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n shopify-agent

# View logs
kubectl logs -f deployment/shopify-agent -n shopify-agent

# Scale deployment
kubectl scale deployment shopify-agent --replicas=5 -n shopify-agent
```

## Cloud Deployment

### AWS ECS

1. **Create ECR Repository**
```bash
aws ecr create-repository --repository-name shopify-browser-agent
```

2. **Push Image**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag shopify-browser-agent:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/shopify-browser-agent:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/shopify-browser-agent:latest
```

3. **Create ECS Task Definition**
```json
{
  "family": "shopify-browser-agent",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "shopify-browser-agent",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/shopify-browser-agent:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:shopify-agent/db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/shopify-browser-agent",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/shopify-browser-agent

# Deploy to Cloud Run
gcloud run deploy shopify-browser-agent \
  --image gcr.io/PROJECT-ID/shopify-browser-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=shopify-agent-db-url:latest
```

### Azure Container Instances

```bash
# Create resource group
az group create --name shopify-agent-rg --location eastus

# Deploy container
az container create \
  --resource-group shopify-agent-rg \
  --name shopify-browser-agent \
  --image your-registry/shopify-browser-agent:latest \
  --cpu 1 \
  --memory 2 \
  --ports 3000 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables DATABASE_URL=$DATABASE_URL
```

## Monitoring & Logging

### 1. Health Checks

The application includes built-in health checks:

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health status

### 2. Metrics

Enable metrics collection:

```bash
# Enable metrics in environment
ENABLE_METRICS=true

# View metrics endpoint
GET /metrics
```

### 3. Logging

Logs are automatically collected and can be viewed:

```bash
# Docker logs
docker logs -f shopify-browser-agent

# Kubernetes logs
kubectl logs -f deployment/shopify-agent -n shopify-agent

# Cloud logs (AWS CloudWatch, Google Cloud Logging, etc.)
```

### 4. Error Monitoring

Set up Sentry for error tracking:

```bash
# Add to environment
SENTRY_DSN=https://your-sentry-dsn
```

## Security Considerations

### 1. API Keys & Secrets

- Use environment variables for all secrets
- Rotate API keys regularly
- Use secret management services (AWS Secrets Manager, etc.)

### 2. Network Security

- Use HTTPS in production
- Implement rate limiting
- Configure firewall rules
- Use VPC/private networks

### 3. Container Security

- Use non-root users
- Scan images for vulnerabilities
- Implement resource limits
- Use read-only filesystems where possible

### 4. Database Security

- Use SSL connections
- Implement proper access controls
- Regular backups
- Monitor for unusual activity

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
```bash
# Check database URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

2. **Redis Connection Failed**
```bash
# Check Redis URL
echo $REDIS_URL

# Test connection
redis-cli -u $REDIS_URL ping
```

3. **Container Won't Start**
```bash
# Check logs
docker logs container-name

# Check environment
docker exec container-name env
```

4. **High Memory Usage**
```bash
# Monitor memory usage
docker stats

# Check for memory leaks
kubectl top pods -n shopify-agent
```

### Performance Optimization

1. **Database Indexing**
```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_products_status ON products(status);
```

2. **Redis Caching**
```bash
# Monitor Redis performance
redis-cli info memory
redis-cli info stats
```

3. **Application Performance**
```bash
# Enable performance monitoring
ENABLE_PROFILING=true

# View slow queries
LOG_LEVEL=debug
```

## Rollback Procedures

### Docker Rollback

```bash
# Stop current container
docker stop shopify-browser-agent

# Run previous version
docker run -d --env-file .env.production shopify-browser-agent:v1.0.0
```

### Kubernetes Rollback

```bash
# View deployment history
kubectl rollout history deployment/shopify-agent -n shopify-agent

# Rollback to previous version
kubectl rollout undo deployment/shopify-browser-agent -n shopify-agent

# Rollback to specific revision
kubectl rollout undo deployment/shopify-browser-agent --to-revision=2 -n shopify-agent
```

## Support

For deployment issues:

1. Check the logs for error messages
2. Verify all environment variables are set
3. Ensure all dependencies (database, Redis) are running
4. Review the troubleshooting section above

For additional support:
- 📧 Email: support@your-domain.com
- 💬 Discord: [Join our community](https://discord.gg/your-server)
- 📖 Documentation: [Full docs](https://docs.your-domain.com)
