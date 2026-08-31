const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const multer = require('multer');

const publicKey = fs.readFileSync(
  path.join(__dirname, '../../keys/public.pem'),
  'utf8'
)

// Service-to-service calls (the WhatsApp local service creating inbound
// messages/interactions) never have a logged-in user, so they can't carry
// a Bearer JWT. They authenticate instead with this shared secret, sent as
// `x-internal-key`. Keep it out of git — set INTERNAL_SERVICE_KEY in .env
// on both this service and the local service, matching.
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY

const authMiddleware = (req, res, next) => {
  try {
    const internalKey = req.headers['x-internal-key']

    if (INTERNAL_SERVICE_KEY && internalKey === INTERNAL_SERVICE_KEY) {
      req.user = { role: 'SYSTEM', service: 'whatsapp-local' }
      return next()
    }

    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required'
      })
    }

    const [type, token] = authHeader.split(' ')

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format'
      })
    }

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    })

    console.log('================ JWT VERIFIED ================')
    console.log('DECODED:', decoded)
    console.log('CURRENT TIME:', Math.floor(Date.now() / 1000))
    console.log('EXP:', decoded.exp)
    console.log('REMAINING:', decoded.exp - Math.floor(Date.now() / 1000))
    console.log('==============================================')

    req.user = decoded
    next()

  } catch (error) {
    console.log('================ JWT ERROR ================')
    console.log('NAME:', error.name)
    console.log('MESSAGE:', error.message)
    console.log('============================================')

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired'
      })
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid access token'
    })
  }
}

const upload = multer({
  storage: multer.memoryStorage()
});

module.exports = { authMiddleware, upload }