# Cline Platform - Web Interface

A Next.js web application to run and manage Cline commands from a user-friendly interface.

## Features

✅ Web-based command interface
✅ Execute Cline commands directly from browser
✅ Real-time command output
✅ Command history tracking
✅ Quick command buttons
✅ Error handling and display
✅ Beautiful, responsive UI
✅ Localhost deployment ready

## Installation

```bash
cd C:\Users\syedm\Development\nextjs-project
npm install
```

## Running Locally

### Development Mode
```bash
npm run dev
```
The platform will be available at: **http://localhost:3000**

### Production Mode
```bash
npm run build
npm start
```

## Usage

1. **Start the platform:**
   ```bash
   npm run dev
   ```

2. **Open browser:**
   - Navigate to `http://localhost:3000`

3. **Execute commands:**
   - Type a Cline command in the input field
   - Click "Execute" button
   - View the output in real-time
   - Check command history on the right

## Supported Commands

All Cline commands are supported:
- `cline --version` - Check Cline version
- `cline --help` - View help documentation
- Any other Cline command

## API Endpoints

### POST /api/execute
Execute a Cline command

**Request:**
```json
{
  "command": "cline --version"
}
```

**Response:**
```json
{
  "success": true,
  "output": "Command output here",
  "error": null,
  "command": "cline --version"
}
```

### GET /api/health
Check if the platform is running

**Response:**
```json
{
  "status": "OK",
  "message": "Cline Platform is running",
  "timestamp": "2026-08-12T12:00:00.000Z"
}
```

## Project Structure

```
nextjs-project/
├── pages/
│   ├── api/
│   │   ├── execute.js    # API endpoint to run Cline commands
│   │   └── health.js     # Health check endpoint
│   ├── index.js          # Main home page
│   └── _app.js           # App wrapper
├── styles/
│   ├── Home.module.css   # Component styles
│   └── globals.css       # Global styles
├── package.json
├── next.config.js
└── README.md
```

## System Requirements

- Node.js 18+
- npm or yarn
- Cline installed globally (`npm i -g cline`)

## Testing the Platform

1. **Check version:**
   ```
   Input: cline --version
   Expected: Display Cline version number
   ```

2. **Get help:**
   ```
   Input: cline --help
   Expected: Display Cline help documentation
   ```

3. **Run a command:**
   - Use any valid Cline command
   - View output in the platform

## Deployment Options

### Deploy to Vercel (Free)
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify
1. Push to GitHub
2. Connect to Netlify
3. Set build command: `npm run build`

### Deploy to AWS/Azure/Google Cloud
Use standard Node.js deployment procedures

## Troubleshooting

**Port 3000 already in use:**
```bash
npm run dev -- -p 3001
```

**Command not found error:**
- Ensure Cline is installed globally: `npm i -g cline`
- Verify with: `cline --version`

**Permission denied:**
- Run terminal/command prompt as Administrator

## Performance Notes

- Commands have a 30-second timeout
- Output buffer: 10MB max
- Real-time output streaming
- History limited to current session

## License

MIT

## Support

For issues with Cline, visit: https://github.com/cline/cline
