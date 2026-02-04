# devops-nginx

Reverse proxy configuration.

## Purpose

- SSL termination
- Load balancing
- Static file serving
- Rate limiting

## File: nginx/nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8080;
    }

    server {
        listen 80;
        server_name localhost;

        # Health check endpoint (no auth)
        location /health {
            proxy_pass http://api/health;
            access_log off;
        }

        # API routes
        location / {
            proxy_pass http://api;
            proxy_http_version 1.1;
            
            # Headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
```

## SSL Configuration

```nginx
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;  # Redirect HTTP to HTTPS
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    # SSL certificates
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Rate Limiting

```nginx
# Define rate limit zone
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://api;
    }
}
```

## Docker Compose

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
```

## Common Pitfalls

**Incorrect: Missing proxy headers**
```nginx
# ❌ Client IP lost
location / {
    proxy_pass http://api;
}
```

**Correct: Forward headers**
```nginx
# ✅ Original client info preserved
location / {
    proxy_pass http://api;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

**Incorrect: No timeout**
```nginx
# ❌ Default timeout may be too short
location / {
    proxy_pass http://api;
}
```

**Correct: Explicit timeouts**
```nginx
# ✅ Suitable for long requests
location / {
    proxy_pass http://api;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
}
```
