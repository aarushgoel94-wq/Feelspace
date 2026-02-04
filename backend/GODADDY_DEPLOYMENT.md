# Deploying Let It Out Backend to GoDaddy

This guide provides easy step-by-step instructions for deploying the backend to GoDaddy hosting.

## ⚠️ Important Note

**GoDaddy shared hosting does NOT support Node.js.** You have two options:

### Option A: GoDaddy VPS Hosting (Recommended)
Use GoDaddy's VPS or Managed WordPress Plus plan that supports Node.js applications.

### Option B: Use a Free/Cheap Alternative (Easier)
Services like Railway, Render, or Fly.io offer free tiers and are easier to set up than GoDaddy VPS.

---

## 🚀 Option 1: Deploy to Railway (Easiest - FREE)

Railway is the easiest way to deploy Node.js apps. It's free to start and much simpler than GoDaddy VPS.

### Steps:

1. **Sign up for Railway**
   - Go to https://railway.app
   - Sign up with GitHub (free)

2. **Create a New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository
   - Select the `backend` folder as the root

3. **Set Environment Variables** (if needed)
   - In Railway dashboard, go to Variables tab
   - Add:
     ```
     PORT=3000
     NODE_ENV=production
     ```

4. **Deploy**
   - Railway automatically detects Node.js and deploys
   - Copy your app URL (e.g., `https://your-app.railway.app`)

5. **Update Mobile App**
   - Update `.env` file:
     ```
     EXPO_PUBLIC_API_URL=https://your-app.railway.app
     ```

**Done!** Your backend is live and accessible from anywhere.

---

## 🖥️ Option 2: Deploy to GoDaddy VPS

If you want to use GoDaddy specifically, you'll need a VPS plan.

### Prerequisites:
- GoDaddy VPS or Managed WordPress Plus plan
- SSH access enabled
- Node.js support

### Steps:

#### Step 1: Purchase VPS Plan
1. Go to GoDaddy.com
2. Purchase a VPS (Virtual Private Server) plan
3. Note your server IP address and login credentials

#### Step 2: Connect via SSH

**On Mac/Linux:**
```bash
ssh root@your-server-ip
```

**On Windows:**
- Download PuTTY or use Windows Terminal
- Connect to your server IP

#### Step 3: Install Node.js

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install Node.js (v18 LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### Step 4: Upload Backend Files

**Option A: Using Git (Recommended)**
```bash
# Install Git
sudo apt install git -y

# Clone your repository
cd /var/www
git clone https://github.com/your-username/letitout-mobile.git
cd letitout-mobile/backend
```

**Option B: Using FTP/SFTP**
1. Use FileZilla or similar FTP client
2. Upload the entire `backend` folder to `/var/www/backend`
3. Connect with your server credentials

#### Step 5: Install Dependencies

```bash
cd /var/www/letitout-mobile/backend
npm install --production
```

#### Step 6: Set Up Environment Variables

```bash
# Create .env file
nano .env
```

Add these lines:
```
PORT=3000
NODE_ENV=production
```

Save: Press `Ctrl+X`, then `Y`, then `Enter`

#### Step 7: Install PM2 (Process Manager)

PM2 keeps your app running even after you close SSH:

```bash
sudo npm install -g pm2

# Start your app with PM2
cd /var/www/letitout-mobile/backend
pm2 start server.js --name "letitout-api"

# Make PM2 start on server reboot
pm2 startup
pm2 save
```

#### Step 8: Set Up Firewall

```bash
# Allow Node.js port (3000)
sudo ufw allow 3000/tcp
sudo ufw enable
```

#### Step 9: Configure Domain (Optional)

If you want to use a domain name:

1. **Point Domain to Server**
   - In GoDaddy DNS settings, add A record:
     - Type: A
     - Name: @ or api
     - Value: Your server IP address

2. **Set Up Nginx (Reverse Proxy)**

```bash
# Install Nginx
sudo apt install nginx -y

# Create config file
sudo nano /etc/nginx/sites-available/letitout-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/letitout-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 10: Test Your API

```bash
# Test locally on server
curl http://localhost:3000/rooms

# Test from your computer
curl http://your-server-ip:3000/rooms
# or
curl http://api.yourdomain.com/rooms
```

#### Step 11: Update Mobile App

Update your `.env` file in the mobile app:
```
EXPO_PUBLIC_API_URL=http://your-server-ip:3000
# or if using domain:
EXPO_PUBLIC_API_URL=http://api.yourdomain.com
```

---

## 🌐 Option 3: GoDaddy + Free Hosting Service (Best Value)

If GoDaddy shared hosting doesn't work, you can:

1. **Keep domain on GoDaddy** (manage DNS there)
2. **Deploy backend for free** on Railway/Render
3. **Point GoDaddy domain** to your free backend

### Steps:

1. **Deploy backend to Railway** (see Option 1 above)
2. **Get your Railway URL**: `https://your-app.railway.app`
3. **Go to GoDaddy DNS settings**
   - Add CNAME record:
     - Type: CNAME
     - Name: api (or subdomain of your choice)
     - Value: `your-app.railway.app`
4. **Update mobile app**:
   ```
   EXPO_PUBLIC_API_URL=https://api.yourdomain.com
   ```

---

## 🔧 Useful Commands (VPS)

```bash
# Check if app is running
pm2 status

# View app logs
pm2 logs letitout-api

# Restart app
pm2 restart letitout-api

# Stop app
pm2 stop letitout-api

# Monitor app
pm2 monit
```

---

## ✅ Quick Verification Checklist

- [ ] Server is accessible
- [ ] Node.js is installed (`node --version`)
- [ ] Backend files are uploaded
- [ ] Dependencies installed (`npm install`)
- [ ] App runs with PM2 (`pm2 status`)
- [ ] Port 3000 is accessible
- [ ] API responds: `curl http://your-server:3000/rooms`
- [ ] Mobile app `.env` is updated
- [ ] Mobile app can connect to backend

---

## 🆘 Troubleshooting

### "Cannot connect to server"
- Check firewall: `sudo ufw status`
- Verify port is open: `sudo ufw allow 3000/tcp`
- Check if app is running: `pm2 status`

### "Database errors"
- Check file permissions: `chmod 755 /var/www/letitout-mobile/backend`
- SQLite needs write access to create database.db

### "Port already in use"
- Find process: `sudo lsof -i :3000`
- Kill process: `sudo kill -9 <PID>`
- Restart with PM2: `pm2 restart letitout-api`

### "PM2 not found"
- Install globally: `sudo npm install -g pm2`
- Or use full path: `/usr/bin/pm2 start server.js`

---

## 💡 Recommendations

**For beginners:** Use Railway (Option 1) - it's free, easy, and works immediately.

**For production:** Use GoDaddy VPS (Option 2) - more control, better for scaling.

**Best value:** GoDaddy domain + Railway backend (Option 3) - professional domain, free hosting.

---

## 📞 Need Help?

- Railway docs: https://docs.railway.app
- GoDaddy VPS support: Check your hosting dashboard
- PM2 docs: https://pm2.keymetrics.io/docs/

