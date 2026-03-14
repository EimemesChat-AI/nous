// shield.js — EimemesChat Prompt Shield
// Filters malicious/harmful inputs before sending to AI,
// and screens AI outputs before returning to the client.
// v1.0

/* ══════════════════════════════════════════════════════════════
   INPUT SHIELD — runs on user message before hitting the model
══════════════════════════════════════════════════════════════ */

// Patterns that attempt to override, leak, or jailbreak the system prompt
const INJECTION_PATTERNS = [
  // Classic prompt injections
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompt|rules?|context|constraints?)/i,
  /forget\s+(everything|all|what\s+you|your\s+(previous|prior|system))/i,
  /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompt|rules?)/i,
  /override\s+(your|the|all)\s*(system\s+)?(prompt|instructions?|rules?|constraints?)/i,
  /you\s+(are\s+now|will\s+now|must\s+now|have\s+to)\s+(be|act|play|pretend|roleplay|become)/i,
  /new\s+(persona|role|instructions?|system\s+prompt|identity|character|mode)/i,
  /system\s*:\s*you\s+are/i,

  // System prompt extraction attempts
  /repeat\s+(back\s+|verbatim\s+|exactly\s+)?(your\s+)?(system\s+prompt|instructions?|initial\s+prompt|first\s+message)/i,
  /print\s+(your|the)\s+(system\s+prompt|instructions?|full\s+prompt)/i,
  /reveal\s+(your|the)\s+(system\s+prompt|instructions?|constraints?|rules?|secrets?)/i,
  /what\s+(are|is)\s+(your\s+)?(exact\s+)?(system\s+prompt|instructions?|initial\s+prompt)/i,
  /show\s+me\s+(your\s+)?(system\s+prompt|instructions?|full\s+prompt)/i,
  /output\s+(your|the)\s+(system\s+prompt|raw\s+instructions?)/i,
  /quote\s+(your|the)\s+(system\s+prompt|instructions?)/i,

  // Jailbreak techniques
  /\bDAN\b/,                                          // "Do Anything Now"
  /\bDANmode\b/i,
  /do\s+anything\s+now/i,
  /jailbreak/i,
  /\bunfiltered\b.*\bmode\b/i,
  /\bdev(eloper)?\s+mode\b/i,
  /\bgodmode\b/i,
  /act\s+as\s+(if\s+you\s+(are|were|have\s+no)\s+)?(?:an?\s+)?(evil|unrestricted|uncensored|unfiltered|unethical)/i,
  /pretend\s+(you\s+)?(have\s+no\s+(restrictions?|rules?|limits?|guidelines?|ethics?))/i,
  /\byou\s+have\s+no\s+(restrictions?|limits?|rules?|ethics?|guidelines?)\b/i,
  /bypass\s+(safety|filter|restriction|content\s+policy)/i,
  /token\s+smuggling/i,
  /virtualjailbreak/i,

  // Role-playing into harmful entities
  /act\s+as\s+(a\s+)?(hacker|terrorist|bomb|weapon|drug)/i,
  /roleplay\s+as\s+(a\s+)?(hacker|terrorist|criminal)/i,

  // Encoding tricks
  /base64\s*(decode|encode|:)/i,
  /rot13\s*(decode|encode)/i,
];

// Patterns for clearly harmful content requests
const HARMFUL_PATTERNS = [
  // Weapons / mass harm
  /how\s+to\s+(make|build|create|synthesize|produce)\s+(a\s+)?(bomb|explosive|grenade|poison|nerve\s+agent|chemical\s+weapon|bioweapon|meth|fentanyl|heroin)/i,
  /instructions?\s+(for|to)\s+(making?|building?|creating?)\s+(a\s+)?(bomb|explosive|weapon|poison)/i,
  /step[s\-]\s*(by[- ]step|by[- ]step)?\s*(guide|instructions?)\s*(to|for)\s*(kill|harm|hurt|attack|bomb)/i,

  // CSAM (absolute block)
  /\b(child|minor|underage|kid).{0,30}(sex|nude|naked|porn|explicit)/i,
  /\b(sex|nude|naked|porn|explicit).{0,30}(child|minor|underage|kid)/i,

  // Doxxing / stalking
  /find\s+(the\s+)?(home\s+)?(address|location|phone|personal\s+info)\s+of\s+(a\s+|the\s+)?real\s+(person|human)/i,
];

// Max input length — prevents token-stuffing / context overflow attacks
const MAX_INPUT_LENGTH = 4000;

/**
 * Screens the user's raw message.
 * @returns {{ blocked: boolean, reason?: string, sanitized: string }}
 */
export function shieldInput(message) {
  if (typeof message !== "string") {
    return { blocked: true, reason: "invalid_input", sanitized: "" };
  }

  // Hard length cap
  const sanitized = message.slice(0, MAX_INPUT_LENGTH).trim();

  if (!sanitized) {
    return { blocked: true, reason: "empty_message", sanitized };
  }

  // Check injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn(`[shield] INPUT BLOCKED — injection pattern: ${pattern}`);
      return { blocked: true, reason: "prompt_injection", sanitized };
    }
  }

  // Check harmful content patterns
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(sanitized)) {
      console.warn(`[shield] INPUT BLOCKED — harmful content pattern: ${pattern}`);
      return { blocked: true, reason: "harmful_content", sanitized };
    }
  }

  return { blocked: false, sanitized };
}

/* ══════════════════════════════════════════════════════════════
   OUTPUT SHIELD — runs on AI response before sending to client
══════════════════════════════════════════════════════════════ */

// Fragments that would indicate the model leaked its system prompt
const SYSTEM_PROMPT_LEAK_MARKERS = [
  /you are eimemeschat.*created by eimemes ai team/i,
  /address the user as melhoi/i,
  /critical security rules.*never reveal/i,
  /KNOWLEDGE BASE.*kuki people/i,
  /never reveal.*repeat.*summarize.*paraphrase.*hint at.*system prompt/i,
];

// Signs the model was jailbroken / produced clearly unsafe output
const UNSAFE_OUTPUT_PATTERNS = [
  /step[\s\-]*\d+.*(?:mix|combine|detonate|synthesize).{0,80}(?:explosive|bomb|poison|nerve)/i,
  /here(?:'s| is) how (?:to (?:make|build|create) (?:a )?(?:bomb|weapon|explosive|poison))/i,
  /(ingredients?|materials?).{0,60}(?:c4|rdx|tnt|semtex|ricin|sarin|vx\s+nerve)/i,
];

/**
 * Screens the AI's full response text.
 * @returns {{ blocked: boolean, reason?: string, cleaned: string }}
 */
export function shieldOutput(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { blocked: false, cleaned: text };
  }

  // Check for system prompt leakage
  for (const pattern of SYSTEM_PROMPT_LEAK_MARKERS) {
    if (pattern.test(text)) {
      console.warn(`[shield] OUTPUT BLOCKED — system prompt leaked: ${pattern}`);
      return {
        blocked: true,
        reason: "system_prompt_leak",
        cleaned: "I'm sorry, I can't share that information.",
      };
    }
  }

  // Check for unsafe generated content
  for (const pattern of UNSAFE_OUTPUT_PATTERNS) {
    if (pattern.test(text)) {
      console.warn(`[shield] OUTPUT BLOCKED — unsafe content in response: ${pattern}`);
      return {
        blocked: true,
        reason: "unsafe_output",
        cleaned: "I'm not able to provide that information. Let me know if there's something else I can help with! 😊",
      };
    }
  }

  return { blocked: false, cleaned: text };
}

/* ══════════════════════════════════════════════════════════════
   USER-FACING MESSAGES for each block reason
══════════════════════════════════════════════════════════════ */
export function getBlockMessage(reason) {
  const messages = {
    prompt_injection:
      "⚠️ That message was flagged as a potential prompt manipulation attempt. Please rephrase your question and try again.",
    harmful_content:
      "⚠️ I'm not able to assist with that request as it may involve harmful content. Try asking something else!",
    empty_message: "Please type a message first.",
    invalid_input: "Something went wrong with your message. Please try again.",
    system_prompt_leak: "I'm sorry, I can't share that information.",
    unsafe_output:
      "I'm not able to provide that information. Let me know if there's something else I can help with! 😊",
  };
  return messages[reason] ?? "I couldn't process that request. Please try again.";
}
