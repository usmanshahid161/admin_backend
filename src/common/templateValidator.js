// utils/templateValidator.js
//
// Server-side re-check of every rule already enforced in the UI.
// Never trust client-side validation alone — someone can call the API directly.

const LIMITS = {
  NAME_MAX: 512,
  HEADER_TEXT_MAX: 60,
  BODY_TEXT_MAX: 1024,
  FOOTER_TEXT_MAX: 60,
  BUTTON_TEXT_MAX: 25,
  BUTTONS_MAX: 10,
  QUICK_REPLY_MAX: 10,
  CTA_MAX: 2,
  CAROUSEL_MIN_CARDS: 2,
  CAROUSEL_MAX_CARDS: 10,
  CAROUSEL_BODY_TEXT_MAX: 160,
};

const NAME_PATTERN = /^[a-z0-9_]+$/;

const extractVariables = (text = '') => {
  const matches = [...text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
  return matches.map((m) => m[1]);
};

function validateTemplatePayload(payload) {
  const errors = [];

  if (!payload.name || !payload.name.trim()) {
    errors.push('Template name is required');
  } else if (!NAME_PATTERN.test(payload.name)) {
    errors.push('Template name must contain only lowercase letters, numbers and underscores');
  } else if (payload.name.length > LIMITS.NAME_MAX) {
    errors.push(`Template name must be under ${LIMITS.NAME_MAX} characters`);
  }

  if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(payload.category)) {
    errors.push('Category must be one of MARKETING, UTILITY, AUTHENTICATION');
  }

  if (!payload.language || !payload.language.trim()) {
    errors.push('Language is required');
  }

  // AUTHENTICATION templates are structurally different — no header, no
  // free-form body/footer text (Meta generates it), exactly one OTP
  // button. None of the header/body/footer/regular-button rules below
  // apply to them at all, so this branches early instead of layering
  // "except for auth" exceptions into every check.
  // https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates
  if (payload.category === 'AUTHENTICATION') {
    return validateAuthenticationPayload(payload, errors);
  }

  const body = payload.components?.body;
  const bodyText = body?.text?.trim();
  if (!bodyText) {
    errors.push('Body text is required');
  } else {
    if (bodyText.length > LIMITS.BODY_TEXT_MAX) {
      errors.push(`Body must be under ${LIMITS.BODY_TEXT_MAX} characters`);
    }
    const vars = extractVariables(bodyText);
    if (vars.length) {
      const expected = vars.map((_, i) => String(i + 1));
      const sorted = [...vars].sort((a, b) => Number(a) - Number(b));
      const sequential = expected.every((v, i) => v === sorted[i]);
      if (!sequential) {
        errors.push('Body variables must be numbered sequentially: {{1}}, {{2}}, {{3}}...');
      }
      const missingExamples = vars.some((v) => !body.examples?.[Number(v) - 1]);
      if (missingExamples) {
        errors.push('Every {{variable}} in the body needs an example value for review');
      }
      // Words-to-parameters ratio Meta enforces: words+params >= 3*params + 1
      const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
      if (wordCount < 3 * vars.length + 1) {
        errors.push('Too many variables relative to message length — add more descriptive text or reduce variables');
      }
    }
  }

  const header = payload.components?.header;
  if (header?.type === 'TEXT') {
    if (!header.text?.trim()) {
      errors.push('Header text is required when header type is TEXT');
    } else if (header.text.length > LIMITS.HEADER_TEXT_MAX) {
      errors.push(`Header text must be under ${LIMITS.HEADER_TEXT_MAX} characters`);
    }
    if (extractVariables(header?.text || '').length > 1) {
      errors.push('Header text can contain only one variable');
    }
  }
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header?.type) && !header?.exampleUrl) {
    errors.push('A sample media URL/handle is required for image, video, or document headers');
  }
  if (header?.type === 'LOCATION' && !['MARKETING', 'UTILITY'].includes(payload.category)) {
    errors.push('A location header is only allowed on MARKETING or UTILITY templates');
  }

  const footerText = payload.components?.footer?.text;
  if (footerText && footerText.length > LIMITS.FOOTER_TEXT_MAX) {
    errors.push(`Footer must be under ${LIMITS.FOOTER_TEXT_MAX} characters`);
  }

  const buttons = payload.components?.buttons || [];
  if (buttons.length > LIMITS.BUTTONS_MAX) {
    errors.push(`Maximum ${LIMITS.BUTTONS_MAX} buttons allowed`);
  }
  const quickReplies = buttons.filter((b) => b.type === 'QUICK_REPLY');
  const ctas = buttons.filter((b) => ['URL', 'PHONE_NUMBER', 'COPY_CODE'].includes(b.type));
  if (quickReplies.length > LIMITS.QUICK_REPLY_MAX) {
    errors.push(`Maximum ${LIMITS.QUICK_REPLY_MAX} quick reply buttons allowed`);
  }
  if (ctas.length > LIMITS.CTA_MAX) {
    errors.push(`Maximum ${LIMITS.CTA_MAX} call-to-action buttons (URL / phone / copy code) allowed`);
  }
  buttons.forEach((b, i) => {
    if (!b.text?.trim()) errors.push(`Button ${i + 1}: text is required`);
    else if (b.text.length > LIMITS.BUTTON_TEXT_MAX) errors.push(`Button ${i + 1}: text must be under ${LIMITS.BUTTON_TEXT_MAX} characters`);
    if (b.type === 'URL' && !b.url?.trim()) errors.push(`Button ${i + 1}: URL is required`);
    if (b.type === 'PHONE_NUMBER' && !b.phoneNumber?.trim()) errors.push(`Button ${i + 1}: phone number is required`);
    if (['OTP'].includes(b.type)) errors.push(`Button ${i + 1}: OTP buttons are only valid on AUTHENTICATION templates`);
  });

  if (payload.carousel?.cards?.length) {
    validateCarouselCards(payload.carousel.cards, errors);
  }

  return errors;
}

// Meta's carousel rules — enforced here rather than in the schema so a
// genuinely-invalid draft can still be *saved* mid-edit, just not
// submitted. All of these are Meta requirements, not house style:
// https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/carousel-templates
function validateCarouselCards(cards, errors) {
  if (cards.length < LIMITS.CAROUSEL_MIN_CARDS || cards.length > LIMITS.CAROUSEL_MAX_CARDS) {
    errors.push(`A carousel needs between ${LIMITS.CAROUSEL_MIN_CARDS} and ${LIMITS.CAROUSEL_MAX_CARDS} cards`);
  }

  // Every card's header must be the same media type — Meta rejects a
  // carousel mixing IMAGE and VIDEO cards.
  const headerTypes = new Set(cards.map((c) => c.header?.type).filter(Boolean));
  if (headerTypes.size > 1) {
    errors.push('All carousel cards must use the same media type (all image or all video)');
  }

  // Every card must have the same button structure — same count, same
  // types, same order. Meta treats a mismatch here as invalid, not just
  // inconsistent.
  const buttonSignatures = new Set(
    cards.map((c) => (c.buttons || []).map((b) => b.type).join(','))
  );
  if (buttonSignatures.size > 1) {
    errors.push('All carousel cards must have the same number and types of buttons, in the same order');
  }

  cards.forEach((card, i) => {
    const label = `Card ${i + 1}`;

    if (!['IMAGE', 'VIDEO'].includes(card.header?.type)) {
      errors.push(`${label}: header must be an image or video`);
    } else if (!card.header?.exampleUrl) {
      errors.push(`${label}: a sample media URL is required`);
    }

    const bodyText = card.body?.text?.trim();
    if (!bodyText) {
      errors.push(`${label}: body text is required`);
    } else if (bodyText.length > LIMITS.CAROUSEL_BODY_TEXT_MAX) {
      errors.push(`${label}: body must be under ${LIMITS.CAROUSEL_BODY_TEXT_MAX} characters`);
    } else {
      const vars = extractVariables(bodyText);
      if (vars.length) {
        const expected = vars.map((_, idx) => String(idx + 1));
        const sorted = [...vars].sort((a, b) => Number(a) - Number(b));
        if (!expected.every((v, idx) => v === sorted[idx])) {
          errors.push(`${label}: variables must be numbered sequentially: {{1}}, {{2}}...`);
        }
        const missingExamples = vars.some((v) => !card.body.examples?.[Number(v) - 1]);
        if (missingExamples) {
          errors.push(`${label}: every {{variable}} needs an example value for review`);
        }
      }
    }

    const buttons = card.buttons || [];
    if (!buttons.length) {
      errors.push(`${label}: at least one button is required`);
    }
    buttons.forEach((b, bi) => {
      if (!['QUICK_REPLY', 'URL'].includes(b.type)) {
        errors.push(`${label}, button ${bi + 1}: carousel card buttons must be quick reply or URL only`);
      }
      if (!b.text?.trim()) errors.push(`${label}, button ${bi + 1}: text is required`);
      if (b.type === 'URL' && !b.url?.trim()) errors.push(`${label}, button ${bi + 1}: URL is required`);
    });
  });
}

// Authentication templates support: an optional security-recommendation
// line, an optional code-expiration footer, and exactly one OTP button
// (copy-code, one-tap, or zero-tap). No header, no custom body/footer text.
function validateAuthenticationPayload(payload, errors) {
  const auth = payload.components?.authentication || {};
  const buttons = payload.components?.buttons || [];

  if (payload.components?.header?.type && payload.components.header.type !== 'NONE') {
    errors.push('Authentication templates cannot have a header');
  }

  if (auth.codeExpirationMinutes != null) {
    if (auth.codeExpirationMinutes < 1 || auth.codeExpirationMinutes > 90) {
      errors.push('Code expiration must be between 1 and 90 minutes');
    }
  }

  if (buttons.length !== 1 || buttons[0]?.type !== 'OTP') {
    errors.push('Authentication templates require exactly one OTP button');
  } else {
    const otp = buttons[0];
    if (!['COPY_CODE', 'ONE_TAP', 'ZERO_TAP'].includes(otp.otpType)) {
      errors.push('OTP button must be Copy code, One-tap, or Zero-tap');
    }
    if (['ONE_TAP', 'ZERO_TAP'].includes(otp.otpType) && (!otp.packageName?.trim() || !otp.signatureHash?.trim())) {
      errors.push('One-tap/zero-tap OTP buttons need the Android package name and signature hash');
    }
  }

  return errors;
}

const isTemplateEditable = (status) => ['DRAFT', 'REJECTED'].includes(status);

module.exports = { validateTemplatePayload, isTemplateEditable, LIMITS };