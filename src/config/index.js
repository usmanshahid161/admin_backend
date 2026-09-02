require("dotenv").config();

module.exports = {

  PORT:
    process.env.PORT || 3033,

  MONGODB_URI:
  process.env.MONGODB_URI,

  WHATSAPP_LOCAL_URL:
  process.env.WHATSAPP_LOCAL_URL,

  // Shared secret for internal (non-UI) callers — the local service and
  // cloud service both send this as x-internal-key instead of a user JWT.
  // Must match the same variable on those services (and center-service,
  // which uses it too) exactly.
  INTERNAL_SERVICE_KEY:
  process.env.INTERNAL_SERVICE_KEY,

  AWS_REGION:
  process.env.AWS_REGION,

  AWS_ACCESS_KEY_ID:
  process.env.AWS_ACCESS_KEY_ID,

  AWS_SECRET_ACCESS_KEY:
  process.env.AWS_SECRET_ACCESS_KEY,

  AWS_S3_BUCKET:
  process.env.AWS_S3_BUCKET

};
