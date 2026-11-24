(function () {
  const prefix = 'akt-master-profile-v1:';
  const saltKey = 'akt-master-profile-salt-v1';
  const sessionKey = 'akt-master-profile-session-v1';
  const encode = new TextEncoder();
  const decode = new TextDecoder();

  function base64(bytes) {
    const parts = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(offset, offset + 8192)));
    }
    return btoa(parts.join(''));
  }

  function bytes(value) {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  async function sessionFromSecret(secret, salt) {
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const parameters = purpose => ({name: 'HKDF', hash: 'SHA-256', salt, info: encode.encode(purpose)});
    const id = await crypto.subtle.deriveBits(parameters('Act Master profile identifier'), material, 256);
    const key = await crypto.subtle.deriveKey(
      parameters('Act Master profile encryption'), material,
      {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']
    );
    return {id: base64(new Uint8Array(id)), key, secret};
  }

  async function derive(code) {
    if (!localStorage.getItem(saltKey)) {
      localStorage.setItem(saltKey, base64(crypto.getRandomValues(new Uint8Array(16))));
    }
    const salt = bytes(localStorage.getItem(saltKey));
    const codeKey = await crypto.subtle.importKey('raw', encode.encode(code), 'PBKDF2', false, ['deriveBits']);
    const secret = await crypto.subtle.deriveBits(
      {name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256'}, codeKey, 256
    );
    return sessionFromSecret(new Uint8Array(secret), salt);
  }

  async function read(session) {
    const stored = localStorage.getItem(prefix + session.id);
    if (stored === null) return null;
    const record = JSON.parse(stored);
    const data = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: bytes(record.iv), additionalData: encode.encode(session.id)
    }, session.key, bytes(record.data));
    return JSON.parse(decode.decode(data));
  }

  async function write(session, snapshot) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({
      name: 'AES-GCM', iv, additionalData: encode.encode(session.id)
    }, session.key, encode.encode(snapshot));
    localStorage.setItem(prefix + session.id, JSON.stringify({iv: base64(iv), data: base64(new Uint8Array(data))}));
  }

  window.actVault = {
    derive, read, write,
    exists: session => localStorage.getItem(prefix + session.id) !== null,
    hasProfiles() {
      return Object.keys(localStorage).some(key => key.startsWith(prefix));
    },
    keep(session) {
      try { sessionStorage.setItem(sessionKey, base64(session.secret)); } catch (error) {}
    },
    forget() {
      try { sessionStorage.removeItem(sessionKey); } catch (error) {}
    },
    async resume() {
      try {
        const secret = sessionStorage.getItem(sessionKey);
        const salt = localStorage.getItem(saltKey);
        return secret && salt ? await sessionFromSecret(bytes(secret), bytes(salt)) : null;
      } catch (error) { return null; }
    }
  };
})();
