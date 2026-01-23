# 🚀 HostAsia VPS Deployment Guide for Continuum HR

## ⚠️ Important Recommendation

**Your current setup (Vercel + Render + Supabase) is already production-ready and FREE.** Consider if migrating to HostAsia VPS is necessary.

| Aspect | Current Setup | HostAsia VPS |
|--------|---------------|--------------|
| Monthly Cost | ₹0 (free tiers) | ₹500-1000+ |
| Deployment | Automatic (git push) | Manual SSH |
| SSL Certificates | Automatic | Manual setup |
| Scaling | Auto-scales | Manual |
| Maintenance | Zero | You manage server |
| Uptime SLA | 99.9% | Self-managed |

---

## 📋 Prerequisites

1. **HostAsia VPS Plan Required:**
   - Minimum: 2 vCPU, 2GB RAM, 20GB SSD
   - OS: Ubuntu 22.04 LTS
   - Estimated cost: ₹500-800/month

2. **Domain Name** pointing to your VPS IP

3. **SSH Access** to your VPS

---

## 🔧 Step-by-Step Deployment

### Step 1: Purchase VPS

1. Go to HostAsia → VPS Services
2. Select plan with **minimum 2GB RAM**
3. Choose **Ubuntu 22.04 LTS**
4. Note your IP address and root password

### Step 2: Connect to VPS

```bash
ssh root@YOUR_VPS_IP
```

### Step 3: Create Deploy User

```bash
# Create non-root user
adduser deploy
usermod -aG sudo deploy

# Setup SSH key auth (optional but recommended)
su - deploy
mkdir ~/.ssh
chmod 700 ~/.ssh
# Add your public key to ~/.ssh/authorized_keys
```

### Step 4: Run Setup Script

```bash
# As deploy user
wget https://raw.githubusercontent.com/Kiran-svelte/continiuum/main/deploy/hostasia-setup.sh
chmod +x hostasia-setup.sh
./hostasia-setup.sh
```

### Step 5: Configure Environment

```bash
cd /var/www/continuum/app
cp deploy/env.example .env
nano .env  # Edit with your actual values
```

**Required environment variables:**
- `DATABASE_URL` - Keep using Supabase (recommended) or setup local PostgreSQL
- `CLERK_SECRET_KEY` - From Clerk dashboard
- `RESEND_API_KEY` - For email notifications
- `NEXT_PUBLIC_APP_URL` - Your domain (https://yourdomain.com)

### Step 6: Setup Database

**Option A: Keep using Supabase (Recommended)**
- No changes needed, just use existing DATABASE_URL

**Option B: Local PostgreSQL**
```bash
sudo -u postgres psql
CREATE USER continuum WITH PASSWORD 'your_password';
CREATE DATABASE continuum OWNER continuum;
\q

# Run migrations
cd /var/www/continuum/app
npx prisma migrate deploy
```

### Step 7: Configure Nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/continuum
sudo nano /etc/nginx/sites-available/continuum
# Replace 'yourdomain.com' with your actual domain

sudo ln -s /etc/nginx/sites-available/continuum /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8: Setup SSL with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Follow prompts, select option 2 to redirect HTTP to HTTPS
```

### Step 9: Start Application

```bash
cd /var/www/continuum/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the output instructions
```

### Step 10: Configure Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 🔄 Deployment Updates

When you push new code:

```bash
ssh deploy@YOUR_VPS_IP
cd /var/www/continuum/app
git pull origin main
npm install
npm run build
pm2 restart all
```

### Create Auto-Deploy Script

```bash
# /var/www/continuum/deploy.sh
#!/bin/bash
cd /var/www/continuum/app
git pull origin main
npm install
npm run build
pm2 restart all
echo "Deployed at $(date)"
```

---

## 🛡️ Security Checklist

- [x] UFW firewall enabled
- [x] SSL/HTTPS via Let's Encrypt
- [x] Non-root user for deployment
- [x] Security headers in Nginx
- [ ] Fail2ban for SSH protection (optional)
- [ ] Regular security updates

### Install Fail2ban (Optional)

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 📊 Monitoring

```bash
# View logs
pm2 logs

# Monitor resources
pm2 monit

# Check status
pm2 status

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 🔄 Automated Backups

Add to crontab (`crontab -e`):

```cron
# Daily database backup at 2 AM
0 2 * * * pg_dump -U continuum continuum > /var/backups/continuum_$(date +\%Y\%m\%d).sql

# Weekly cleanup of old backups
0 3 * * 0 find /var/backups -name "continuum_*.sql" -mtime +7 -delete
```

---

## ❓ Troubleshooting

### App not loading
```bash
pm2 logs continuum-web --lines 50
```

### 502 Bad Gateway
```bash
pm2 status  # Check if apps are running
sudo systemctl status nginx
```

### SSL certificate issues
```bash
sudo certbot renew --dry-run
```

---

## 📞 Support

- HostAsia Support: [Their support portal]
- Application Issues: Check pm2 logs
- Database Issues: Check Supabase dashboard

---

## 💡 Final Recommendation

Unless you have specific requirements for VPS hosting (data residency, custom configurations, etc.), **staying with Vercel + Render + Supabase is the better choice** for:

1. **Cost**: Free tiers are production-capable
2. **Reliability**: Managed platforms with 99.9% uptime
3. **Deployment**: Automatic on git push
4. **Scaling**: Automatic based on traffic
5. **Security**: Managed SSL, DDoS protection
6. **Maintenance**: Zero server management

Your current deployment at **https://continiuum.vercel.app** is already production-ready! ✅
