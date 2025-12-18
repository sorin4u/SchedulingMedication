# Deploy Backend to Render.com (Free)

## Steps:

1. **Go to Render.com**
   - Visit https://render.com
   - Sign up/Login with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select repository: `sorin4u/SchedulingMedication`

3. **Configure Service**
   - Name: `medication-scheduler-api`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`

4. **Add Environment Variables**
   Click "Environment" tab and add:
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_bOlWTdNa7e9K@ep-misty-glitter-ab1puzd7-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   JWT_SECRET=your-super-secret-random-key-change-this
   PORT=3000
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - Copy your backend URL (e.g., https://medication-scheduler-api.onrender.com)

6. **Update Frontend**
   In your React components, replace `http://localhost:3000` with your Render URL

---

**Note:** Free tier spins down after 15 minutes of inactivity. First request may take 30 seconds to wake up.

## Alternative: Deploy to Railway.app

1. Visit https://railway.app
2. Login with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables
6. Deploy!

Railway gives $5 free credit monthly (enough for small projects).
