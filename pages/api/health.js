export default function handler(req, res) {
  res.status(200).json({ 
    status: 'OK',
    message: 'Cline Platform is running',
    timestamp: new Date().toISOString()
  });
}
