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
  });

  if (payload.category === 'AUTHENTICATION') {
    const invalidButtons = buttons.some((b) => !['OTP', 'COPY_CODE'].includes(b.type));
    if (invalidButtons) errors.push('Authentication templates only support OTP / copy-code buttons');
  }

  return errors;
}

const isTemplateEditable = (status) => ['DRAFT', 'REJECTED'].includes(status);

module.exports = { validateTemplatePayload, isTemplateEditable, LIMITS };