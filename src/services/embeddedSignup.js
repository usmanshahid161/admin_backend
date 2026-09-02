// services/embeddedSignup.js
const axios = require('axios');
const configs = require('../config');
const WhatsappNumber = require('../models/whatsappNumber');

// Step 1: trade the short-lived OAuth `code` from FB.login() for a real
// access token. Needs the App Secret, which is exactly why this can't
// happen in the browser — it would have to ship the secret to every client.
async function exchangeCodeForToken(code) {
  const { data } = await axios.get(`https://graph.facebook.com/${configs.GRAPH_API_VERSION}/oauth/access_token`, {
    params: {
      client_id: configs.META_APP_ID,
      client_secret: configs.META_APP_SECRET,
      code,
    },
  });

  if (!data?.access_token) {
    const err = new Error('Meta did not return an access token for this code');
    err.statusCode = 422;
    throw err;
  }

  return data.access_token;
}

// Step 2: look up the actual phone number + verified business name for
// display — the popup only hands back an opaque phoneNumberId, not
// anything human-readable.
async function fetchPhoneNumberDetails(phoneNumberId, accessToken) {
  try {
    const { data } = await axios.get(`https://graph.facebook.com/${configs.GRAPH_API_VERSION}/${phoneNumberId}`, {
      params: { fields: 'display_phone_number,verified_name' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      displayPhoneNumber: data?.display_phone_number || phoneNumberId,
      verifiedName: data?.verified_name || 'WhatsApp number',
    };
  } catch (err) {
    // Not fatal — worst case the admin sees a less friendly label and can
    // rename it themselves afterward.
    console.error('Could not fetch phone number details:', err.response?.data || err.message);
    return { displayPhoneNumber: phoneNumberId, verifiedName: 'WhatsApp number' };
  }
}

// Step 3: save the tenant's own Meta credentials — owned by auth service
// (Tenant.accessToken/phoneNumberId/businessAccountId/appId), not this
// service. local_service reads these directly for every Graph API call
// (see local_service's services/tenantCredentials.js), so this is what
// actually makes the connected number usable, not just visually "added".
async function saveTenantCredentials(tenantId, { accessToken, phoneNumberId, wabaId }) {
  await axios.put(
    `${configs.AUTH_SERVICE_URL}/tenants/${tenantId}/whatsapp`,
    {
      accessToken,
      phoneNumberId,
      businessAccountId: wabaId,
      appId: configs.META_APP_ID,
    },
    { headers: { 'x-internal-key': configs.INTERNAL_SERVICE_KEY } }
  );
}

async function completeEmbeddedSignup(tenantId, { code, wabaId, phoneNumberId }) {
  if (!code || !wabaId || !phoneNumberId) {
    const err = new Error('code, wabaId and phoneNumberId are all required');
    err.statusCode = 422;
    throw err;
  }

  const accessToken = await exchangeCodeForToken(code);

  await saveTenantCredentials(tenantId, { accessToken, phoneNumberId, wabaId });

  const { displayPhoneNumber, verifiedName } = await fetchPhoneNumberDetails(phoneNumberId, accessToken);

  // Reuse an existing record for this exact number if the admin is
  // reconnecting (e.g. token expired, or picked the same number again)
  // rather than creating a duplicate.
  let number = await WhatsappNumber.findOne({ tenantId, phoneNumber: displayPhoneNumber });

  if (number) {
    number.displayName = verifiedName;
  } else {
    number = new WhatsappNumber({
      tenantId,
      phoneNumber: displayPhoneNumber,
      displayName: verifiedName,
    });
  }

  await number.save();

  return number.toObject();
}

module.exports = { completeEmbeddedSignup };