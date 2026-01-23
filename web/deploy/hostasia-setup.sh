#!/bin/bash
# ============================================
# HostAsia VPS Deployment Script for Continuum
# Requires: Ubuntu 22.04 VPS with 2GB+ RAM
# ============================================

set -e

echo "🚀 Continuum HR - HostAsia VPS Setup"
echo "====================================="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Create app directory
sudo mkdir -p /var/www/continuum
sudo chown -R $USER:$USER /var/www/continuum

# Clone repository (replace with your repo)
cd /var/www/continuum
git clone https://github.com/Kiran-svelte/continiuum.git app
cd app

# Setup Next.js frontend
npm install
npm run build

# Setup Python backend
cd backend/constraint-engine
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'continuum-web',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/continuum/app',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'continuum-api',
      script: '/var/www/continuum/app/backend/constraint-engine/venv/bin/python',
      args: '-m flask run --host=0.0.0.0 --port=5000',
      cwd: '/var/www/continuum/app/backend/constraint-engine',
      env: {
        FLASK_APP: 'constraint_engine.py',
        FLASK_ENV: 'production'
      }
    }
  ]
};
EOF

echo "✅ Base installation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Configure PostgreSQL database"
echo "2. Set environment variables in .env"
echo "3. Configure Nginx (see nginx.conf below)"
echo "4. Run: pm2 start ecosystem.config.js"
echo "5. Run: sudo certbot --nginx -d yourdomain.com"
